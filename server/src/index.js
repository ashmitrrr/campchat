import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const PORT = process.env.PORT || 8080;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

// 🆕 Initialize Supabase Admin Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // ⚠️ MUST BE SERVICE_ROLE KEY
);

const app = express();
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: WEB_ORIGIN, 
    credentials: true 
  } 
});

// ---- STATE ----
const queue = [];
const socketToRoom = new Map();
const roomToSockets = new Map();

// SAFETY STATE
const blacklist = new Set(); 
const reportCounts = new Map(); 

// 🆕 SYNC BANS ON STARTUP
async function loadBans() {
  const { data, error } = await supabase.from("banned_users").select("email");
  if (data) {
    data.forEach(user => blacklist.add(user.email));
    console.log(`🛡️ Loaded ${data.length} banned users from Database.`);
  } else {
    console.error("⚠️ Failed to load bans:", error);
  }
}
loadBans(); // Run immediately

// ---- MIDDLEWARE ----
io.use((socket, next) => {
  const { email, uni, isPremium, name, targetUni, gender, major } = socket.handshake.query;

  if (blacklist.has(email)) {
    return next(new Error("BANNED: You have been suspended for violating community guidelines."));
  }

  socket.userData = {
    email: email || "anon",
    uni: uni || "Unknown",
    name: name || "Stranger",
    gender: gender || "Hidden", // 🆕 v2 Feature
    major: major || "Undecided", // 🆕 v2 Feature
    targetUni: targetUni || "Any",
    isPremium: targetUni !== "Any" ? true : (isPremium === "true"),
  };
  
  console.log(`🔌 Connect: ${socket.userData.email} (${socket.userData.uni})`);
  next();
});

// ---- MATCHING LOGIC ----
function isCompatible(userA, userB) {
  // 1. Uni Filter Logic
  if (userA.userData.targetUni !== "Any" && userA.userData.targetUni !== userB.userData.uni) return false;
  if (userB.userData.targetUni !== "Any" && userB.userData.targetUni !== userA.userData.uni) return false;
  
  // (Future v3 idea: You can add Gender/Major matching logic here easily now!)
  
  return true;
}

function tryMatch() {
  if (queue.length < 2) return;

  for (let i = 0; i < queue.length; i++) {
    const p1 = queue[i];
    for (let j = i + 1; j < queue.length; j++) {
      const p2 = queue[j];

      if (isCompatible(p1, p2)) {
        queue.splice(j, 1);
        queue.splice(i, 1);

        const roomId = `room_${crypto.randomUUID()}`;
        p1.join(roomId);
        p2.join(roomId);

        socketToRoom.set(p1.id, roomId);
        socketToRoom.set(p2.id, roomId);
        roomToSockets.set(roomId, [p1, p2]);

        p1.emit("matched", { roomId, partnerUni: p2.userData.uni, partnerName: p2.userData.name });
        p2.emit("matched", { roomId, partnerUni: p1.userData.uni, partnerName: p1.userData.name });

        tryMatch(); 
        return;
      }
    }
  }
}

// ---- HELPER: BROADCAST ONLINE COUNT ----
function broadcastOnlineCount() {
  io.emit("online_count", { count: io.engine.clientsCount });
}

io.on("connection", (socket) => {
  // 1. Handle New Connection
  queue.push(socket);
  tryMatch();
  broadcastOnlineCount(); // 🆕 Update count for everyone

  // 2. Handle Preferences
  socket.on("update_preference", ({ targetUni }) => {
    socket.userData.targetUni = targetUni;
    tryMatch();
  });

  // 3. Handle Waiting Pool
  socket.on("waiting", () => {
    if (!queue.find((s) => s.id === socket.id)) {
      queue.push(socket);
      tryMatch();
    }
  });

  // 4. Handle Messaging
  socket.on("send_message", ({ message }) => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) socket.broadcast.to(roomId).emit("message", { text: message, ts: Date.now(), from: "partner" });
  });

  // 🆕 5. Handle Typing Events (v2 Feature)
  socket.on("typing", ({ roomId }) => {
    // Relay "typing" to everyone in the room EXCEPT the sender
    socket.to(roomId).emit("typing");
  });

  socket.on("stop_typing", ({ roomId }) => {
    socket.to(roomId).emit("stop_typing");
  });

  // 🆕 6. Explicit Request for Online Count
  socket.on("get_online_count", () => {
    socket.emit("online_count", { count: io.engine.clientsCount });
  });

  // 🚩 REPORT SYSTEM (DB Connected)
  socket.on("report_partner", async () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const sockets = roomToSockets.get(roomId) || [];
    const partner = sockets.find((s) => s.id !== socket.id);

    if (partner) {
      const reporterEmail = socket.userData.email;
      const reportedEmail = partner.userData.email;
      
      // Log to DB
      await supabase.from("reports").insert({
        reporter_email: reporterEmail,
        reported_email: reportedEmail,
        chat_room_id: roomId,
        reason: "User Report"
      });

      // Increment Strike Count
      const currentStrikes = (reportCounts.get(reportedEmail) || 0) + 1;
      reportCounts.set(reportedEmail, currentStrikes);
      
      console.log(`🚩 REPORT: ${reportedEmail} (Strikes: ${currentStrikes})`);

      // Check Threshold
      if (currentStrikes >= 3) {
        blacklist.add(reportedEmail);
        await supabase.from("banned_users").insert({ email: reportedEmail, reason: "3 Strikes" });
        
        console.log(`🚨 BANNED: ${reportedEmail}`);
        partner.emit("banned");
        partner.disconnect();
      } else {
        partner.emit("warning");
        partner.disconnect(); 
      }
    }
  });

  // 🔌 DISCONNECT
  socket.on("disconnect", () => {
    const idx = queue.findIndex((s) => s.id === socket.id);
    if (idx !== -1) queue.splice(idx, 1);
    
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit("partner_left");
      socketToRoom.delete(socket.id);
      roomToSockets.delete(roomId);
    }

    broadcastOnlineCount(); // 🆕 Update count when user leaves
  });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));