"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "./lib/supabase";
import { Toaster, toast } from "sonner";
import { COUNTRIES_CITIES, COUNTRY_FLAGS } from "./lib/countries";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";
const GIPHY_API_KEY = "sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh"; // Free public demo key

const MAJORS = ["Computer Science", "Business", "Engineering", "Medicine", "Arts", "Law", "Science", "Architecture", "Design", "Psychology", "Other"];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

export default function Home() {
  // ---- AUTH & USER STATE ----
  const [user, setUser] = useState<any>(null);
  const [isReadyToChat, setIsReadyToChat] = useState(false);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  
  // Profile State
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [major, setMajor] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [uniName, setUniName] = useState("");
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  
  // Login Flow State
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState(""); 
  const [showOtpInput, setShowOtpInput] = useState(false); 
  const [loading, setLoading] = useState(false);
  
  // Logic State
  const [showTimeoutAlert, setShowTimeoutAlert] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [lastRoomId, setLastRoomId] = useState<string | null>(null);

  // Chat State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("Idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<{ uni: string; name: string; country: string } | null>(null);
  const [messages, setMessages] = useState<{ text: string; ts: number; from: "me" | "partner"; isGif?: boolean }[]>([]);
  const [input, setInput] = useState("");
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  
  // GIF State
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<any[]>([]);
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  // 1. CHECK SESSION & LOAD PROFILE
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setUser(data.session.user);
        await loadUserProfile(data.session.user.email);
        await generateJWT(data.session);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadUserProfile(session.user.email);
        await generateJWT(session);
      } else {
        handleLogoutCleanup();
      }
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  // Generate JWT Token
  const generateJWT = async (session: any) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email: session.user.email })
      });
      const data = await response.json();
      if (data.token) {
        setJwtToken(data.token);
        localStorage.setItem('campchat_jwt', data.token);
      }
    } catch (err) {
      console.error('JWT generation failed:', err);
    }
  };

  // Load User Profile from DB
  const loadUserProfile = async (email: string) => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("email", email)
      .single();
    
    if (data && !error) {
      setDisplayName(data.display_name || "");
      setGender(data.gender || "");
      setMajor(data.major || "");
      setCountry(data.country || "");
      setCity(data.city || "");
      setUniName(data.uni_name || "");
      
      if (data.country && COUNTRIES_CITIES[data.country]) {
        setAvailableCities(COUNTRIES_CITIES[data.country]);
      }
    }
  };

  // Save User Profile to DB
  const saveUserProfile = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from("user_profiles")
      .upsert({
        email: user.email,
        display_name: displayName,
        gender: gender,
        major: major,
        country: country,
        city: city,
        uni_name: uniName,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Profile save error:', error);
      toast.error("Failed to save profile");
    }
  };

  // Update available cities when country changes
  useEffect(() => {
    if (country && COUNTRIES_CITIES[country]) {
      setAvailableCities(COUNTRIES_CITIES[country]);
      setCity(""); // Reset city when country changes
    } else {
      setAvailableCities([]);
    }
  }, [country]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPartnerTyping]);

  // 2. CONNECT SOCKET WITH JWT
  useEffect(() => {
    if (!isReadyToChat || !user || !jwtToken) return;

    const domain = user.email.split("@")[1];
    const cleanDomain = domain ? domain.replace(/student\.|my\.|mail\.|\.edu\.au|\.edu|\.ca|\.ac\.uk|\.ac\.in/g, "") : "anon";
    const parsedUni = cleanDomain.toUpperCase().split(".")[0];
    if (!uniName) setUniName(parsedUni);

    const filterValue = (document.getElementById("uni-filter") as HTMLSelectElement)?.value || "Any";

    const s = io(SERVER_URL, {
      transports: ["websocket"],
      auth: { token: jwtToken }, // JWT auth instead of query params
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(s);
    setStatus("Searching for a vibe match... 🌊");

    const timer = setTimeout(() => {
      if (!roomId && filterValue !== "Any") setShowTimeoutAlert(true);
    }, 10000);

    s.on("connect", () => {
      setIsSocketConnected(true);
      reconnectAttempts.current = 0;
      
      // Send profile data after connection
      s.emit("set_profile", {
        uni: uniName || parsedUni,
        name: displayName,
        gender: gender,
        major: major,
        country: country,
        city: city,
        targetUni: filterValue,
      });
      
      s.emit("get_online_count");
      
      // Try to reconnect to previous room if exists
      if (lastRoomId) {
        s.emit("reconnect_to_room", { roomId: lastRoomId });
      }
    });

    s.on("disconnect", (reason) => {
      setIsSocketConnected(false);
      if (reason === "io server disconnect") {
        // Server disconnected us, don't try to reconnect
        toast.error("Disconnected by server");
      }
    });

    s.on("connect_error", (err) => {
      if (err.message.includes("BANNED")) {
        toast.error("⛔ You are permanently banned.");
        handleLogoutCleanup();
      } else if (err.message.includes("AUTH_REQUIRED") || err.message.includes("INVALID_TOKEN")) {
        toast.error("Authentication failed. Please log in again.");
        handleLogoutCleanup();
      }
    });

    s.on("reconnected", ({ roomId, partnerUni, partnerName, partnerCountry }) => {
      setRoomId(roomId);
      setPartnerInfo({ uni: partnerUni, name: partnerName, country: partnerCountry });
      setStatus(`Reconnected with ${partnerName}`);
      toast.success("Reconnected to chat!");
    });

    s.on("online_count", ({ count }) => setOnlineCount(count));

    s.on("matched", ({ roomId, partnerUni, partnerName, partnerCountry }) => {
      setRoomId(roomId);
      setLastRoomId(roomId);
      setPartnerInfo({ uni: partnerUni, name: partnerName, country: partnerCountry });
      setMessages([]);
      setStatus(`Vibing with ${partnerName}`);
      setShowTimeoutAlert(false);
      clearTimeout(timer);
      toast.success("Match found! Say hi 👋");
    });

    s.on("message", (msg) => {
      setMessages((prev) => [...prev, { ...msg, from: "partner" }]);
      setIsPartnerTyping(false);
    });

    s.on("typing", () => setIsPartnerTyping(true));
    s.on("stop_typing", () => setIsPartnerTyping(false));

    s.on("partner_left", () => {
      setStatus("Partner dipped 💨 Reconnecting...");
      setRoomId(null);
      setLastRoomId(null);
      setPartnerInfo(null);
      setIsPartnerTyping(false);
      toast("Partner left the chat.", { icon: "👣" });
      setTimeout(() => {
        setStatus("Searching for a vibe match... 🌊");
        s.emit("waiting");
      }, 2000);
    });

    s.on("warning", () => toast.warning("⚠️ You have been reported for inappropriate behavior."));
    
    s.on("banned", () => {
      toast.error("⛔ Account Suspended: Multiple reports received.");
      handleLogoutCleanup();
    });

    s.on("rate_limited", ({ type }) => {
      if (type === "message") {
        toast.error("⚠️ Slow down! Too many messages.");
      } else if (type === "report") {
        toast.error("⚠️ Report limit reached. Please wait.");
      }
    });

    return () => {
      s.disconnect();
      clearTimeout(timer);
    };
  }, [isReadyToChat, user, jwtToken]);

  // Search GIFs
  const searchGifs = async (query: string) => {
    if (!query.trim()) return;
    setIsSearchingGifs(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (err) {
      console.error('GIF search failed:', err);
      toast.error("Failed to load GIFs");
    }
    setIsSearchingGifs(false);
  };

  // Load trending GIFs
  const loadTrendingGifs = async () => {
    setIsSearchingGifs(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (err) {
      console.error('GIF load failed:', err);
    }
    setIsSearchingGifs(false);
  };

  // Send GIF
  const sendGif = (gifUrl: string) => {
  if (!roomId || !socket) return;
  const msg = { text: gifUrl, ts: Date.now(), from: "me" as const, isGif: true };
  setMessages((prev) => [...prev, msg]);
  socket.emit("send_message", { message: gifUrl, isGif: true }); // ✅ Send isGif flag
  setShowGifPicker(false);
  setGifSearch("");
  setGifs([]);
};

  // ---- HELPERS ----
  const handleLogoutCleanup = () => {
    setUser(null);
    setIsReadyToChat(false);
    setShowOtpInput(false);
    setOtpInput("");
    setEmailInput("");
    setLoading(false);
    setJwtToken(null);
    localStorage.removeItem('campchat_jwt');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    handleLogoutCleanup();
  };

  const handleSendCode = async () => {
    setLoading(true);
    const email = emailInput.toLowerCase().trim();
    const publicDomains = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me"];
    
    if (!email.includes("@")) { 
      toast.error("Invalid email."); 
      setLoading(false); 
      return; 
    }
    
    const domain = email.split("@")[1];
    if (publicDomains.includes(domain)) {
      toast.error("⚠️ Students only! Use your university email.");
      setLoading(false);
      return;
    }
    
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) { 
      toast.error(error.message); 
    } else { 
      setShowOtpInput(true); 
      toast.success(`Code sent to ${email}! 📩`); 
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ 
      email: emailInput, 
      token: otpInput, 
      type: 'email' 
    });
    if (error) { 
      toast.error(error.message); 
      setLoading(false); 
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (socket && roomId) {
      socket.emit("typing", { roomId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => socket.emit("stop_typing", { roomId }), 1000);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !roomId || !socket) return;
    const msg = { text: input, ts: Date.now(), from: "me" as const };
    setMessages((prev) => [...prev, msg]);
    socket.emit("send_message", { message: input });
    socket.emit("stop_typing", { roomId });
    setInput("");
  };

  const handleShare = () => {
    navigator.clipboard.writeText("Chat with students from my uni on CampChat! ⛺ https://campchat.app");
    toast.success("Link copied!");
  };

  const handleGoGlobal = () => { 
    if (socket) { 
      socket.emit("update_preference", { targetUni: "Any" }); 
      setShowTimeoutAlert(false); 
      setStatus("Expanded search to Global 🌍"); 
      toast("Searching Globally!"); 
    }
  };

  const handleDisconnect = () => { 
    if (socket) socket.disconnect(); 
    setSocket(null); 
    setRoomId(null); 
    setLastRoomId(null);
    setMessages([]); 
    setPartnerInfo(null); 
    setIsReadyToChat(false); 
    setStatus("Idle"); 
    setShowTimeoutAlert(false); 
  };

  const handleNextMatch = () => { 
    if (!socket) return; 
    setMessages([]); 
    setRoomId(null); 
    setLastRoomId(null);
    setPartnerInfo(null); 
    setStatus("Skipping... ⏭️"); 
    socket.disconnect(); 
    setIsReadyToChat(false); 
    setTimeout(() => setIsReadyToChat(true), 100); 
  };

  const handleReport = () => { 
    if (!socket || !roomId) return; 
    if (confirm("Report this user?")) { 
      socket.emit("report_partner"); 
      setStatus("Reported 🚫 Switching..."); 
      setRoomId(null); 
      setLastRoomId(null);
      setPartnerInfo(null); 
      setMessages([]); 
      setTimeout(() => socket.emit("waiting"), 1500); 
      toast.error("User reported."); 
    }
  };

  const handleStartChat = async () => {
    if (!displayName || !gender || !major || !country || !city) {
      toast.error("Please fill all fields!");
      return;
    }
    
    await saveUserProfile();
    setIsReadyToChat(true);
  };

  // 🧱 COMPONENT: NAVBAR
  const Navbar = () => (
    <nav className="w-full h-16 border-b border-white/5 bg-black/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-50">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⛺</span>
        <span className="font-bold text-white tracking-tight">CampChat</span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-white/10">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-medium text-zinc-400">
            {onlineCount > 0 ? `${onlineCount} Online` : 'Offline'}
          </span>
        </div>
        {user && (
          <button 
            onClick={handleLogout} 
            className="text-xs font-medium text-zinc-500 hover:text-white transition-colors"
          >
            Log out
          </button>
        )}
      </div>
    </nav>
  );

  // ---- VIEW 1: LOGIN ----
  if (!user) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-black">
        <Navbar />
        <Toaster position="top-center" richColors theme="dark" />
        
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="solid-panel w-full max-w-md rounded-2xl p-8 text-center relative z-10">
            <div className="mb-6 inline-block rounded-full bg-emerald-500/10 p-4 border border-emerald-500/20">
              <span className="text-4xl drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">⛺</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">hey bud</h1>
            <p className="text-zinc-400 mb-8 text-sm">Enter your student email to join the camp.</p>
            
            {!showOtpInput ? (
              <div className="space-y-4">
                <input 
                  type="email" 
                  placeholder="student@uni.edu.au" 
                  className="input-solid w-full rounded-xl p-4" 
                  value={emailInput} 
                  onChange={(e) => setEmailInput(e.target.value)} 
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()} 
                />
                <button 
                  onClick={handleSendCode} 
                  disabled={loading || !emailInput} 
                  className="btn-emerald w-full rounded-xl py-4"
                >
                  {loading ? "Sending..." : "Get Login Code ⚡"}
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">
                  Check your inbox
                </div>
                <input 
                  type="text" 
                  placeholder="123456" 
                  className="input-solid w-full rounded-xl p-4 text-center text-2xl tracking-[0.5em]" 
                  maxLength={6} 
                  value={otpInput} 
                  onChange={(e) => setOtpInput(e.target.value)} 
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()} 
                />
                <button 
                  onClick={handleVerifyCode} 
                  disabled={loading || otpInput.length < 6} 
                  className="btn-emerald w-full rounded-xl py-4"
                >
                  {loading ? "Verifying..." : "Verify & Enter 🚀"}
                </button>
                <button 
                  onClick={() => { setShowOtpInput(false); setLoading(false); }} 
                  className="text-xs text-zinc-500 hover:text-white mt-4 block mx-auto"
                >
                  Wrong email?
                </button>
              </div>
            )}
          </div>
          <p className="mt-8 text-[10px] text-zinc-700 uppercase tracking-widest font-medium">
            Verified Students Only
          </p>
        </div>
      </div>
    );
  }

  // ---- VIEW 2: PROFILE SETUP ----
  if (!isReadyToChat) {
    return (
      <div className="flex flex-col h-screen bg-black">
        <Navbar />
        <Toaster position="top-center" richColors theme="dark" />
        
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="solid-panel w-full max-w-md rounded-2xl p-8 relative overflow-hidden">
            <h1 className="text-2xl font-bold text-white mb-6">Setup Profile</h1>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                  Display Name
                </label>
                <input 
                  className="input-solid w-full mt-1 rounded-xl p-3" 
                  placeholder="e.g. Coffee Addict" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                    Gender
                  </label>
                  <select 
                    className="input-solid w-full mt-1 rounded-xl p-3" 
                    value={gender} 
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="" disabled>Select</option>
                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                    Major
                  </label>
                  <select 
                    className="input-solid w-full mt-1 rounded-xl p-3" 
                    value={major} 
                    onChange={(e) => setMajor(e.target.value)}
                  >
                    <option value="" disabled>Select</option>
                    {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                    Country
                  </label>
                  <select 
                    className="input-solid w-full mt-1 rounded-xl p-3" 
                    value={country} 
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    <option value="" disabled>Select Country</option>
                    {Object.keys(COUNTRIES_CITIES).sort().map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                    City
                  </label>
                  <select 
                    className="input-solid w-full mt-1 rounded-xl p-3" 
                    value={city} 
                    onChange={(e) => setCity(e.target.value)}
                    disabled={!country}
                  >
                    <option value="" disabled>
                      {country ? "Select City" : "Select Country First"}
                    </option>
                    {availableCities.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleStartChat}
                className="btn-emerald w-full rounded-xl py-3 mt-2"
              >
                Start Matching 🚀
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- VIEW 3: CHAT SCREEN ----
  return (
    <div className="flex flex-col h-[100dvh] bg-black overflow-hidden">
      <Navbar />
      <Toaster position="top-center" richColors theme="dark" />
      
      <div className="flex-1 flex flex-col w-full max-w-3xl mx-auto sm:my-4 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-zinc-900/50 relative overflow-hidden">
        
        {/* TIMEOUT POPUP */}
        {showTimeoutAlert && !roomId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
            <div className="solid-panel p-6 text-center max-w-xs rounded-xl">
              <h3 className="text-xl font-bold text-white mb-2">No match found 😔</h3>
              <button 
                onClick={handleGoGlobal} 
                className="btn-emerald w-full rounded-lg py-2 mb-2"
              >
                Search Globally 🌍
              </button>
              <button 
                onClick={() => setShowTimeoutAlert(false)} 
                className="text-xs text-zinc-500 hover:text-white"
              >
                Keep Waiting
              </button>
            </div>
          </div>
        )}

        {/* GIF PICKER POPUP */}
        {showGifPicker && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="solid-panel w-full max-w-lg rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Search GIFs</h3>
                <button 
                  onClick={() => { setShowGifPicker(false); setGifSearch(""); setGifs([]); }}
                  className="text-zinc-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-4 border-b border-white/10">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Search for GIFs..."
                    className="input-solid flex-1 rounded-lg p-2 text-sm"
                    value={gifSearch}
                    onChange={(e) => setGifSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchGifs(gifSearch)}
                  />
                  <button 
                    onClick={() => searchGifs(gifSearch)}
                    className="btn-emerald rounded-lg px-4 text-sm"
                    disabled={isSearchingGifs}
                  >
                    Search
                  </button>
                </div>
                <button 
                  onClick={loadTrendingGifs}
                  className="text-xs text-emerald-400 hover:text-emerald-300 mt-2"
                >
                  Show Trending
                </button>
              </div>

              <div className="p-4 grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                {isSearchingGifs ? (
                  <div className="col-span-3 text-center text-zinc-500 py-8">Loading...</div>
                ) : gifs.length === 0 ? (
                  <div className="col-span-3 text-center text-zinc-500 py-8">
                    Search for GIFs or view trending
                  </div>
                ) : (
                  gifs.map((gif) => (
                    <button
                      key={gif.id}
                      onClick={() => sendGif(gif.images.fixed_height.url)}
                      className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                    >
                      <img 
                        src={gif.images.fixed_height.url} 
                        alt={gif.title}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* CHAT HEADER */}
        <div className="h-16 border-b border-white/5 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              {roomId && partnerInfo?.country && (
                <span className="text-lg">{COUNTRY_FLAGS[partnerInfo.country]}</span>
              )}
              <h2 className="font-bold text-white">
                {roomId ? partnerInfo?.name : "Searching..."}
              </h2>
              {roomId && partnerInfo?.uni && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {partnerInfo.uni}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isSocketConnected ? (
                <span className="text-[10px] text-amber-500 animate-pulse">Reconnecting...</span>
              ) : (
                <p className="text-xs text-zinc-400">
                  {roomId ? <span className="text-emerald-500">● Online</span> : status}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {roomId ? (
              <>
                <button 
                  onClick={handleReport} 
                  className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 text-xs"
                >
                  🚩 Report
                </button>
                <button 
                  onClick={handleNextMatch} 
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-medium border border-white/5"
                >
                  Skip
                </button>
              </>
            ) : (
              <button 
                onClick={handleShare} 
                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs hover:bg-emerald-500/20"
              >
                Share Link 🔗
              </button>
            )}
            <button 
              onClick={handleDisconnect} 
              className="px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs"
            >
              Exit
            </button>
          </div>
        </div>

        {/* MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-black/20">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-zinc-600">
              <div className="mb-4 rounded-full bg-zinc-900 p-6 border border-white/5">
                <span className="text-3xl animate-pulse grayscale opacity-50">📡</span>
              </div>
              <p className="text-sm font-medium">Scanning frequency...</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.from === "me" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl overflow-hidden shadow-sm ${m.from === "me" ? "bg-emerald-600 text-white rounded-tr-none shadow-[0_2px_10px_rgba(16,185,129,0.2)]" : "bg-zinc-800 text-zinc-200 rounded-tl-none border border-white/5"}`}>
                {m.isGif ? (
                  <img src={m.text} alt="GIF" className="max-w-full rounded-2xl" />
                ) : (
                  <div className="px-4 py-3 text-sm">{m.text}</div>
                )}
              </div>
              <span className="text-[10px] text-zinc-600 mt-1 px-1">
                {m.from === "me" ? "Me" : partnerInfo?.name}
              </span>
            </div>
          ))}
          {isPartnerTyping && (
            <div className="flex items-center gap-2 p-2">
              <div className="flex space-x-1 rounded-2xl bg-zinc-900 border border-white/5 px-4 py-3 rounded-tl-none">
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]"></div>
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 bg-zinc-900/80 backdrop-blur-md border-t border-white/5 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!roomId) {
                  toast.error("Wait for a match first!");
                  return;
                }
                setShowGifPicker(true);
                loadTrendingGifs();
              }}
              disabled={!roomId}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-xl disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send GIF"
            >
              🎬
            </button>
            <input 
              className="input-solid flex-1 rounded-xl px-4 py-3 text-sm" 
              placeholder={roomId ? "Type a message..." : "Waiting for partner..."} 
              value={input} 
              onChange={handleTyping} 
              onKeyDown={(e) => e.key === "Enter" && sendMessage()} 
              disabled={!roomId} 
            />
            <button 
              onClick={sendMessage} 
              disabled={!roomId} 
              className="btn-emerald rounded-xl px-6"
            >
              Send
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
