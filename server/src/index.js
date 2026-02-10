import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js"; // 🆕 Import Supabase

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
const io = new Server(server, { cors: { origin: WEB_ORIGIN, credentials: true } });

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
  const { email, uni, isPremium, name, targetUni } = socket.handshake.query;

  if (blacklist.has(email)) {
    return next(new Error("BANNED: You have been suspended for violating community guidelines."));
  }

  socket.userData = {
    email: email || "anon",
    uni: uni || "Unknown",
    name: name || "Stranger",
    targetUni: targetUni || "Any",
    isPremium: targetUni !== "Any" ? true : (isPremium === "true"),
  };
  
  console.log(`🔌 Connect: ${socket.userData.email} (${socket.userData.uni})`);
  next();
});

// ---- MATCHING LOGIC ----
function isCompatible(userA, userB) {
  if (userA.userData.targetUni !== "Any" && userA.userData.targetUni !== userB.userData.uni) return false;
  if (userB.userData.targetUni !== "Any" && userB.userData.targetUni !== userA.userData.uni) return false;
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

io.on("connection", (socket) => {
  queue.push(socket);
  tryMatch();

  socket.on("update_preference", ({ targetUni }) => {
    socket.userData.targetUni = targetUni;
    tryMatch();
  });

  socket.on("waiting", () => {
    if (!queue.find((s) => s.id === socket.id)) {
      queue.push(socket);
      tryMatch();
    }
  });

  socket.on("send_message", ({ message }) => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) socket.broadcast.to(roomId).emit("message", { text: message, ts: Date.now(), from: "partner" });
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
      
      // 1. Log to DB (Permanent Record)
      await supabase.from("reports").insert({
        reporter_email: reporterEmail,
        reported_email: reportedEmail,
        chat_room_id: roomId,
        reason: "User Report"
      });

      // 2. Increment Strike Count
      const currentStrikes = (reportCounts.get(reportedEmail) || 0) + 1;
      reportCounts.set(reportedEmail, currentStrikes);
      
      console.log(`🚩 REPORT: ${reportedEmail} (Strikes: ${currentStrikes})`);

      // 3. Check Threshold
      if (currentStrikes >= 3) {
        // BAN HIM (DB & Memory)
        blacklist.add(reportedEmail);
        await supabase.from("banned_users").insert({ email: reportedEmail, reason: "3 Strikes" });
        
        console.log(`🚨 BANNED: ${reportedEmail}`);
        partner.emit("banned");
        partner.disconnect();
      } else {
        // WARN
        partner.emit("warning");
        partner.disconnect(); 
      }
    }
  });

  socket.on("disconnect", () => {
    const idx = queue.findIndex((s) => s.id === socket.id);
    if (idx !== -1) queue.splice(idx, 1);
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit("partner_left");
      socketToRoom.delete(socket.id);
      roomToSockets.delete(roomId);
    }
  });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));