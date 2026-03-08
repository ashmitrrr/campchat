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

// 🔥 CAMPUS ROOMS STATE
const CAMPUS_ROOMS = {
  "campus-social": { name: "Campus Social", icon: "🥂", users: new Map() },
  "campus-career": { name: "Campus Career", icon: "💼", users: new Map() },
  "campus-founder": { name: "Campus Founder", icon: "🚀", users: new Map() },
  "campus-global": { name: "Campus Global", icon: "🌏", users: new Map() },
  "campus-sports": { name: "Campus Sports", icon: "⚽", users: new Map() },
  "campus-study": { name: "Campus Study", icon: "📚", users: new Map() }
};

// Track which campus rooms each user is in
const userCampusRooms = new Map();

// RATE LIMITING STATE
const messageRateLimits = new Map();
const reportRateLimits = new Map();

const MESSAGE_LIMIT = 30;
const REPORT_LIMIT = 3;
const ROOM_PERSISTENCE_TIME = 120000;
const MAX_MESSAGE_LENGTH = 500;

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

// ============== PAYPAL HELPERS ==============
async function getPayPalAccessToken() {
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      ).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  return data.access_token;
}

// 🔥 NEW: CAMPUS MESSAGE HELPERS
async function saveCampusMessage(campusId, userEmail, userName, profilePic, message, isGif = false) {
  try {
    const { error } = await supabase.from("campus_messages").insert({
      campus_id: campusId,
      user_email: userEmail,
      user_name: userName,
      user_profile_pic: profilePic,
      message: message,
      is_gif: isGif,
      created_at: new Date().toISOString()
    });
    
    if (error) {
      console.error("Failed to save campus message:", error);
    }
  } catch (err) {
    console.error("Error saving campus message:", err);
  }
}

async function loadCampusHistory(campusId) {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from("campus_messages")
      .select("*")
      .eq("campus_id", campusId)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: true })
      .limit(50);
    
    if (error) {
      console.error("Failed to load campus history:", error);
      return [];
    }
    
    return data.map(msg => ({
      text: msg.message,
      ts: new Date(msg.created_at).getTime(),
      from: msg.user_name,
      email: msg.user_email,
      profilePic: msg.user_profile_pic,
      isGif: msg.is_gif
    }));
  } catch (err) {
    console.error("Error loading campus history:", err);
    return [];
  }
}

// 🔥 NEW: CAMPUS MEMBERSHIP HELPERS
async function joinCampusMembership(userEmail, campusId) {
  try {
    await supabase.from("campus_memberships").upsert({
      user_email: userEmail,
      campus_id: campusId,
      joined_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    }, {
      onConflict: 'user_email,campus_id'
    });
  } catch (err) {
    console.error("Error joining campus membership:", err);
  }
}

async function updateLastSeen(userEmail, campusId) {
  try {
    await supabase
      .from("campus_memberships")
      .update({ last_seen: new Date().toISOString() })
      .eq("user_email", userEmail)
      .eq("campus_id", campusId);
  } catch (err) {
    console.error("Error updating last seen:", err);
  }
}

async function getUserCampuses(userEmail) {
  try {
    const { data, error } = await supabase
      .from("campus_memberships")
      .select("campus_id")
      .eq("user_email", userEmail);
    
    if (error) return [];
    return data.map(row => row.campus_id);
  } catch (err) {
    console.error("Error getting user campuses:", err);
    return [];
  }
}

// 🔥 AUTO-DELETE OLD MESSAGES (runs every hour)
setInterval(async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from("campus_messages")
      .delete()
      .lt("created_at", twentyFourHoursAgo);
    
    if (error) {
      console.error("Failed to delete old campus messages:", error);
    } else {
      console.log("🧹 Cleaned up old campus messages");
    }
  } catch (err) {
    console.error("Error cleaning old messages:", err);
  }
}, 60 * 60 * 1000); // Every hour

// ============== GIF API ROUTES ==============
app.get("/api/gifs/search", async (req, res) => {
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

// ============== PAYPAL ROUTES ==============
app.post("/api/paypal/create-subscription", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (error || !user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const token = await getPayPalAccessToken();
    const response = await fetch("https://api-m.paypal.com/v1/billing/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        plan_id: process.env.PAYPAL_PLAN_ID,
        application_context: {
          brand_name: "CampChat",
          return_url: `${process.env.WEB_ORIGIN}/premium/success`,
          cancel_url: `${process.env.WEB_ORIGIN}/premium/cancel`,
        },
      }),
    });

    const data = await response.json();
    const approvalUrl = data.links?.find(l => l.rel === "approve")?.href;

    if (!approvalUrl) {
      console.error("PayPal error:", data);
      return res.status(500).json({ error: "Failed to create subscription" });
    }

    res.json({ approvalUrl, subscriptionId: data.id });
  } catch (err) {
    console.error("PayPal create-subscription error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/paypal/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const event = JSON.parse(req.body);

  if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") {
    const subscriptionId = event.resource?.id;
    const payerEmail = event.resource?.subscriber?.email_address;

    if (payerEmail) {
      const premiumUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from("user_profiles")
        .update({ 
          premium_until: premiumUntil,
          paypal_subscription_id: subscriptionId
        })
        .eq("email", payerEmail);

      if (error) {
        console.error("Failed to update premium status:", error);
        return res.status(500).json({ error: "DB update failed" });
      }

      console.log(`💎 Premium activated for ${payerEmail} until ${premiumUntil}`);
    }
  }

  res.json({ received: true });
});

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

// ---- MATCHING LOGIC (1-on-1 Chat) ----
function isCompatible(userA, userB) {
  const filtersA = userA.filters || {};
  const filtersB = userB.filters || {};
  
  if (filtersA.gender && filtersA.gender !== "Any" && filtersA.gender !== userB.gender) return false;
  if (filtersA.country && filtersA.country !== "Any" && filtersA.country !== userB.country) return false;
  if (filtersA.uni && filtersA.uni !== "Any" && filtersA.uni !== userB.uni) return false;
  if (filtersA.major && filtersA.major !== "Any" && filtersA.major !== userB.major) return false;
  
  if (filtersB.gender && filtersB.gender !== "Any" && filtersB.gender !== userA.gender) return false;
  if (filtersB.country && filtersB.country !== "Any" && filtersB.country !== userA.country) return false;
  if (filtersB.uni && filtersB.uni !== "Any" && filtersB.uni !== userA.uni) return false;
  if (filtersB.major && filtersB.major !== "Any" && filtersB.major !== userA.major) return false;
  
  return true;
}

function tryMatch() {
  if (queue.length < 2) return;

  for (let i = 0; i < queue.length; i++) {
    const p1 = queue[i];
    for (let j = i + 1; j < queue.length; j++) {
      const p2 = queue[j];

      if (isCompatible(p1, p2)) {
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
          partnerCountry: p2.userData.country,
          partnerProfilePic: p2.userData.profilePic || null
        });
        p2.emit("matched", { 
          roomId, 
          partnerUni: p1.userData.uni, 
          partnerName: p1.userData.name,
          partnerCountry: p1.userData.country,
          partnerProfilePic: p1.userData.profilePic || null
        });

        tryMatch();
        return;
      }
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [roomId, data] of roomPersistence.entries()) {
    if (now - data.createdAt > ROOM_PERSISTENCE_TIME) {
      roomPersistence.delete(roomId);
    }
  }
}, 30000);

function broadcastOnlineCount() {
  io.emit("online_count", { count: io.engine.clientsCount });
}

// 🔥 CAMPUS ROOM HELPERS
function broadcastCampusUsers(campusId) {
  const room = CAMPUS_ROOMS[campusId];
  if (!room) return;
  
  const userList = Array.from(room.users.values()).map(u => ({
    name: u.name,
    uni: u.uni,
    profilePic: u.profilePic
  }));
  
  io.to(campusId).emit("campus_users", { users: userList, count: userList.length });
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
      profilePic: profileData.profilePic || null,
      filters: profileData.filters || {
        gender: "Any",
        country: "Any",
        uni: "Any",
        major: "Any"
      },
      isPremium: profileData.isPremium || false
    };
    
    if (!queue.find((s) => s.id === socket.id)) {
      queue.push(socket);
    }
    tryMatch();
  });

  broadcastOnlineCount();

  // 🔥 NEW: JOIN CAMPUS ROOM WITH HISTORY
  socket.on("join_campus", async ({ campusId }) => {
    const room = CAMPUS_ROOMS[campusId];
    if (!room) {
      socket.emit("error", { message: "Campus room not found" });
      return;
    }

    // Check if user already in a campus room (free users)
    const userRooms = userCampusRooms.get(socket.email) || new Set();
    
    if (!socket.userData?.isPremium && userRooms.size >= 1) {
      socket.emit("error", { message: "Free users can only join 1 campus at a time. Upgrade to Premium!" });
      return;
    }

    // Join the room
    socket.join(campusId);
    room.users.set(socket.email, {
      socketId: socket.id,
      name: socket.userData?.name || "Anonymous",
      uni: socket.userData?.uni || "Unknown",
      profilePic: socket.userData?.profilePic || null
    });

    userRooms.add(campusId);
    userCampusRooms.set(socket.email, userRooms);

    // 🔥 Save membership to DB
    await joinCampusMembership(socket.email, campusId);

    // 🔥 Load and send message history
    const history = await loadCampusHistory(campusId);
    
    socket.emit("campus_joined", { 
      campusId, 
      name: room.name,
      history: history // Send history with join confirmation
    });
    
    broadcastCampusUsers(campusId);
    
    console.log(`🏕️ ${socket.email} joined ${room.name}`);
  });

  // 🔥 LEAVE CAMPUS ROOM
  socket.on("leave_campus", async ({ campusId }) => {
    const room = CAMPUS_ROOMS[campusId];
    if (!room) return;

    socket.leave(campusId);
    room.users.delete(socket.email);

    const userRooms = userCampusRooms.get(socket.email);
    if (userRooms) {
      userRooms.delete(campusId);
      if (userRooms.size === 0) {
        userCampusRooms.delete(socket.email);
      }
    }

    // 🔥 Update last seen in DB
    await updateLastSeen(socket.email, campusId);

    broadcastCampusUsers(campusId);
    console.log(`🏕️ ${socket.email} left ${room.name}`);
  });

  // 🔥 NEW: SEND CAMPUS MESSAGE WITH DB STORAGE
  socket.on("send_campus_message", async ({ campusId, message, isGif, isImage, timerSeconds, fileName }) => {
    if (!message || typeof message !== "string") return;

    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_LENGTH) return;

    if (!checkRateLimit(messageRateLimits, socket.email, MESSAGE_LIMIT, 60000)) {
      socket.emit("rate_limited", { type: "message" });
      return;
    }

    const room = CAMPUS_ROOMS[campusId];
    if (!room || !room.users.has(socket.email)) return;

    const messageData = {
      text: trimmed,
      ts: Date.now(),
      from: socket.userData?.name || "Anonymous",
      email: socket.email,
      profilePic: socket.userData?.profilePic || null,
      isGif: !!isGif,
      isImage: !!isImage,
      timerSeconds: timerSeconds || 0,
      fileName: fileName || ""
    };

    // 🔥 Save to database
    await saveCampusMessage(
      campusId,
      socket.email,
      socket.userData?.name || "Anonymous",
      socket.userData?.profilePic || null,
      trimmed,
      !!isGif
    );

    // Broadcast to all users in room
    io.to(campusId).emit("campus_message", messageData);
  });

  // 🔥 NEW: GET USER'S CAMPUSES
  socket.on("get_my_campuses", async () => {
    const campuses = await getUserCampuses(socket.email);
    socket.emit("my_campuses", { campuses });
  });

  // GET CAMPUS ONLINE COUNT
  socket.on("get_campus_users", ({ campusId }) => {
    broadcastCampusUsers(campusId);
  });

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

  socket.on("send_message", ({ message, isGif, isImage, isBlurred, timerSeconds, fileName }) => {
    if (!message || typeof message !== "string") return;

    const trimmed = message.trim();
    
    if (trimmed.length === 0) return;
    
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      socket.emit("rate_limited", { type: "message_too_long" });
      return;
    }

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
        isGif: !!isGif,
        isImage: !!isImage,
        isBlurred: !!isBlurred,
        timerSeconds: timerSeconds || 0,
        fileName: fileName || ""
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
          partnerCountry: partner.country,
          partnerProfilePic: partner.profilePic || null
        });
      }
    }
  });

  socket.on("disconnect", () => {
    // Remove from 1-on-1 queue
    const idx = queue.findIndex((s) => s.id === socket.id);
    if (idx !== -1) queue.splice(idx, 1);
    
    // Remove from 1-on-1 room
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

    // 🔥 Remove from all campus rooms (but keep in DB for persistent membership)
    const userRooms = userCampusRooms.get(socket.email);
    if (userRooms) {
      userRooms.forEach(campusId => {
        const room = CAMPUS_ROOMS[campusId];
        if (room) {
          room.users.delete(socket.email);
          broadcastCampusUsers(campusId);
        }
      });
      userCampusRooms.delete(socket.email);
    }

    broadcastOnlineCount();
  });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));