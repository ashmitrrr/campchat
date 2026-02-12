import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const PORT = process.env.PORT || 8080;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
app.use(express.json());

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
const roomPersistence = new Map(); // Store rooms for reconnection
const blacklist = new Set();

// RATE LIMITING STATE
const messageRateLimits = new Map(); // email -> { count, resetTime }
const reportRateLimits = new Map(); // email -> { count, resetTime }

const MESSAGE_LIMIT = 30; // 30 messages per minute
const REPORT_LIMIT = 3; // 3 reports per hour
const ROOM_PERSISTENCE_TIME = 120000; // 2 minutes

// ---- RATE LIMITING HELPERS ----
function checkRateLimit(limitMap, email, limit, windowMs) {
  const now = Date.now();
  const userLimit = limitMap.get(email);
  
  if (!userLimit || now > userLimit.resetTime) {
    limitMap.set(email, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= limit) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// ---- SYNC BANS ON STARTUP ----
async function loadBans() {
  const { data, error } = await supabase.from("banned_users").select("email");
  if (data) {
    data.forEach(user => blacklist.add(user.email));
    console.log(`🛡️ Loaded ${data.length} banned users from Database.`);
  } else {
    console.error("⚠️ Failed to load bans:", error);
  }
}
loadBans();

// ---- JWT GENERATION ENDPOINT ----
app.post("/api/generate-token", async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  // Verify user session with Supabase (optional but recommended)
  const { data: { user }, error } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
  
  if (error || !user || user.email !== email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ token });
});

// ---- SOCKET MIDDLEWARE ----
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error("AUTH_REQUIRED: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = decoded.email;

    if (blacklist.has(email)) {
      return next(new Error("BANNED: You have been suspended for violating community guidelines."));
    }

    socket.email = email;
    console.log(`🔌 Connect: ${email}`);
    next();
  } catch (err) {
    return next(new Error("INVALID_TOKEN: Authentication failed"));
  }
});

// ---- MATCHING LOGIC ----
function isCompatible(userA, userB) {
  if (userA.targetUni !== "Any" && userA.targetUni !== userB.uni) return false;
  if (userB.targetUni !== "Any" && userB.targetUni !== userA.uni) return false;
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

        // Store for persistence
        roomPersistence.set(roomId, {
          users: [
            { socketId: p1.id, email: p1.email, ...p1.userData },
            { socketId: p2.id, email: p2.email, ...p2.userData }
          ],
          createdAt: Date.now()
        });

        p1.emit("matched", { 
          roomId, 
          partnerUni: p2.userData.uni, 
          partnerName: p2.userData.name,
          partnerCountry: p2.userData.country 
        });
        p2.emit("matched", { 
          roomId, 
          partnerUni: p1.userData.uni, 
          partnerName: p1.userData.name,
          partnerCountry: p1.userData.country 
        });

        tryMatch();
        return;
      }
    }
  }
}

// ---- CLEANUP OLD ROOMS ----
setInterval(() => {
  const now = Date.now();
  for (const [roomId, data] of roomPersistence.entries()) {
    if (now - data.createdAt > ROOM_PERSISTENCE_TIME) {
      roomPersistence.delete(roomId);
    }
  }
}, 30000); // Clean every 30 seconds

// ---- BROADCAST ONLINE COUNT ----
function broadcastOnlineCount() {
  io.emit("online_count", { count: io.engine.clientsCount });
}

io.on("connection", (socket) => {
  
  // Handle profile data from client
  socket.on("set_profile", (profileData) => {
    socket.userData = {
      uni: profileData.uni || "Unknown",
      name: profileData.name || "Stranger",
      gender: profileData.gender || "Hidden",
      major: profileData.major || "Undecided",
      country: profileData.country || "Unknown",
      city: profileData.city || "Unknown",
      targetUni: profileData.targetUni || "Any",
    };
    
    // Add to queue after profile is set
    queue.push(socket);
    tryMatch();
  });

  broadcastOnlineCount();

  // Handle Preferences
  socket.on("update_preference", ({ targetUni }) => {
    if (socket.userData) {
      socket.userData.targetUni = targetUni;
      tryMatch();
    }
  });

  // Handle Waiting Pool
  socket.on("waiting", () => {
    if (!queue.find((s) => s.id === socket.id)) {
      queue.push(socket);
      tryMatch();
    }
  });

  // Handle Messaging with Rate Limit
  socket.on("send_message", ({ message, isGif }) => {
  if (!checkRateLimit(messageRateLimits, socket.email, MESSAGE_LIMIT, 60000)) {
    socket.emit("rate_limited", { type: "message" });
    return;
  }

  const roomId = socketToRoom.get(socket.id);
  if (roomId) {
    socket.broadcast.to(roomId).emit("message", { 
      text: message, 
      ts: Date.now(), 
      from: "partner",
      isGif: isGif || false  // ✅ Pass through the isGif flag
    });
  }
});

  // Handle Typing Events
  socket.on("typing", ({ roomId }) => {
    socket.to(roomId).emit("typing");
  });

  socket.on("stop_typing", ({ roomId }) => {
    socket.to(roomId).emit("stop_typing");
  });

  // Get Online Count
  socket.on("get_online_count", () => {
    socket.emit("online_count", { count: io.engine.clientsCount });
  });

  // REPORT SYSTEM with Rate Limit and DB
  socket.on("report_partner", async () => {
    if (!checkRateLimit(reportRateLimits, socket.email, REPORT_LIMIT, 3600000)) {
      socket.emit("rate_limited", { type: "report" });
      return;
    }

    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    
    const sockets = roomToSockets.get(roomId) || [];
    const partner = sockets.find((s) => s.id !== socket.id);

    if (partner) {
      const reporterEmail = socket.email;
      const reportedEmail = partner.email;
      
      // Log to DB
      await supabase.from("reports").insert({
        reporter_email: reporterEmail,
        reported_email: reportedEmail,
        chat_room_id: roomId,
        reason: "User Report"
      });

      // Get strike count from DB
      const { data: reports } = await supabase
        .from("reports")
        .select("*")
        .eq("reported_email", reportedEmail);
      
      const strikeCount = reports ? reports.length : 0;
      
      console.log(`🚩 REPORT: ${reportedEmail} (Strikes: ${strikeCount})`);

      // Check Threshold
      if (strikeCount >= 3) {
        blacklist.add(reportedEmail);
        await supabase.from("banned_users").insert({ 
          email: reportedEmail, 
          reason: "3 Strikes" 
        });
        
        console.log(`🚨 BANNED: ${reportedEmail}`);
        partner.emit("banned");
        partner.disconnect();
      } else {
        partner.emit("warning");
        partner.disconnect();
      }
    }
  });

  // RECONNECTION LOGIC
  socket.on("reconnect_to_room", ({ roomId }) => {
    const persistedRoom = roomPersistence.get(roomId);
    if (persistedRoom) {
      const userInRoom = persistedRoom.users.find(u => u.email === socket.email);
      if (userInRoom) {
        socket.join(roomId);
        socketToRoom.set(socket.id, roomId);
        
        // Update socket reference
        const sockets = roomToSockets.get(roomId) || [];
        const updatedSockets = sockets.map(s => 
          s.email === socket.email ? socket : s
        );
        roomToSockets.set(roomId, updatedSockets);
        
        const partner = persistedRoom.users.find(u => u.email !== socket.email);
        socket.emit("reconnected", { 
          roomId, 
          partnerUni: partner.uni, 
          partnerName: partner.name,
          partnerCountry: partner.country 
        });
      }
    }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const idx = queue.findIndex((s) => s.id === socket.id);
    if (idx !== -1) queue.splice(idx, 1);
    
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit("partner_left");
      socketToRoom.delete(socket.id);
      
      // Don't delete room immediately - keep for reconnection
      setTimeout(() => {
        const stillExists = Array.from(socketToRoom.values()).includes(roomId);
        if (!stillExists) {
          roomToSockets.delete(roomId);
        }
      }, ROOM_PERSISTENCE_TIME);
    }

    broadcastOnlineCount();
  });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));