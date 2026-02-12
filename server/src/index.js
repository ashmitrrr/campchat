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
if (!process.env.JWT_SECRET) {
  throw new Error("❌ FATAL: JWT_SECRET environment variable is missing! Set it in .env file.");
}
const JWT_SECRET = process.env.JWT_SECRET;
console.log("✅ JWT_SECRET loaded from environment");

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
const roomPersistence = new Map();
const blacklist = new Set();

// RATE LIMITING STATE
const messageRateLimits = new Map();
const reportRateLimits = new Map();

const MESSAGE_LIMIT = 30; // 30 messages per minute
const REPORT_LIMIT = 3; // 3 reports per hour
const ROOM_PERSISTENCE_TIME = 120000; // 2 minutes
const MAX_MESSAGE_LENGTH = 500; // Character limit for messages

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

// ============== GIF API ROUTES ==============
app.get("/api/gifs/search", async (req, res) => {
  // 🔒 IMPROVEMENT #4: Guard against missing API key
  if (!process.env.GIPHY_API_KEY) {
    return res.status(500).json({ error: "GIPHY API key not configured" });
  }

  try {
    const query = req.query.q;
    
    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Query required" });
    }
    
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
    );
    
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("GIF search error:", err);
    res.status(500).json({ error: "Failed to search GIFs" });
  }
});

app.get("/api/gifs/trending", async (req, res) => {
  // 🔒 IMPROVEMENT #4: Guard against missing API key
  if (!process.env.GIPHY_API_KEY) {
    return res.status(500).json({ error: "GIPHY API key not configured" });
  }

  try {
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/trending?api_key=${process.env.GIPHY_API_KEY}&limit=20&rating=g`
    );
    
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("GIF trending error:", err);
    res.status(500).json({ error: "Failed to load trending GIFs" });
  }
});

// ---- JWT GENERATION ENDPOINT ----
app.post("/api/generate-token", async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

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
        // 🔒 IMPROVEMENT #3: Safer queue removal (prevents index mutation bugs)
        const newQueue = queue.filter(
          (s) => s.id !== p1.id && s.id !== p2.id
        );
        queue.length = 0;
        queue.push(...newQueue);

        const roomId = `room_${crypto.randomUUID()}`;
        p1.join(roomId);
        p2.join(roomId);

        socketToRoom.set(p1.id, roomId);
        socketToRoom.set(p2.id, roomId);
        roomToSockets.set(roomId, [p1, p2]);

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
}, 30000);

// ---- BROADCAST ONLINE COUNT ----
function broadcastOnlineCount() {
  io.emit("online_count", { count: io.engine.clientsCount });
}

io.on("connection", (socket) => {
  
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
    
    // 🔒 IMPROVEMENT #1: Prevent duplicate queue entries
    if (!queue.find((s) => s.id === socket.id)) {
      queue.push(socket);
    }
    tryMatch();
  });

  broadcastOnlineCount();

  socket.on("update_preference", ({ targetUni }) => {
    if (socket.userData) {
      socket.userData.targetUni = targetUni;
      tryMatch();
    }
  });

  socket.on("waiting", () => {
    if (!queue.find((s) => s.id === socket.id)) {
      queue.push(socket);
      tryMatch();
    }
  });

  // 🔒 IMPROVEMENT #2: Validate message content (CRITICAL)
  socket.on("send_message", ({ message, isGif }) => {
    // Validate message exists and is a string
    if (!message || typeof message !== "string") return;

    const trimmed = message.trim();
    
    // Reject empty messages
    if (trimmed.length === 0) return;
    
    // Reject overly long messages (prevents spam/abuse)
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      socket.emit("rate_limited", { type: "message_too_long" });
      return;
    }

    // Rate limiting
    if (!checkRateLimit(messageRateLimits, socket.email, MESSAGE_LIMIT, 60000)) {
      socket.emit("rate_limited", { type: "message" });
      return;
    }

    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.broadcast.to(roomId).emit("message", { 
        text: trimmed,
        ts: Date.now(), 
        from: "partner",
        isGif: !!isGif // Force boolean
      });
    }
  });

  socket.on("typing", ({ roomId }) => {
    socket.to(roomId).emit("typing");
  });

  socket.on("stop_typing", ({ roomId }) => {
    socket.to(roomId).emit("stop_typing");
  });

  socket.on("get_online_count", () => {
    socket.emit("online_count", { count: io.engine.clientsCount });
  });

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
      
      await supabase.from("reports").insert({
        reporter_email: reporterEmail,
        reported_email: reportedEmail,
        chat_room_id: roomId,
        reason: "User Report"
      });

      const { data: reports } = await supabase
        .from("reports")
        .select("*")
        .eq("reported_email", reportedEmail);
      
      const strikeCount = reports ? reports.length : 0;
      
      console.log(`🚩 REPORT: ${reportedEmail} (Strikes: ${strikeCount})`);

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

  socket.on("reconnect_to_room", ({ roomId }) => {
    const persistedRoom = roomPersistence.get(roomId);
    if (persistedRoom) {
      const userInRoom = persistedRoom.users.find(u => u.email === socket.email);
      if (userInRoom) {
        socket.join(roomId);
        socketToRoom.set(socket.id, roomId);
        
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

  socket.on("disconnect", () => {
    const idx = queue.findIndex((s) => s.id === socket.id);
    if (idx !== -1) queue.splice(idx, 1);
    
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit("partner_left");
      socketToRoom.delete(socket.id);
      
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