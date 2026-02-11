"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "./lib/supabase";
import { Toaster, toast } from "sonner"; // 🆕 Smart Notifications

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

// 🆕 Data Lists for Profile
const MAJORS = ["Computer Science", "Business", "Engineering", "Medicine", "Arts", "Law", "Science", "Architecture", "Design", "Psychology", "Other"];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

export default function Home() {
  // ---- AUTH & USER STATE ----
  const [user, setUser] = useState<any>(null);
  const [isReadyToChat, setIsReadyToChat] = useState(false);
  
  // 🆕 Profile State (v2)
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [major, setMajor] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [uniName, setUniName] = useState(""); // Stores manual uni name if needed

  // Login Flow State
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState(""); 
  const [showOtpInput, setShowOtpInput] = useState(false); 
  const [loading, setLoading] = useState(false);
  
  // ---- LOGIC STATE ----
  const [showTimeoutAlert, setShowTimeoutAlert] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(true); // 🆕 Reconnection Badge
  const [onlineCount, setOnlineCount] = useState(0); // 🆕 Live Counter

  // ---- CHAT STATE ----
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("Idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<{ uni: string; name: string } | null>(null);
  const [messages, setMessages] = useState<{ text: string; ts: number; from: "me" | "partner" }[]>([]);
  const [input, setInput] = useState("");
  const [isPartnerTyping, setIsPartnerTyping] = useState(false); // 🆕 Partner Typing

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. CHECK SESSION
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) setUser(data.session.user);
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        handleLogoutCleanup(); // 🧹 Auto-cleanup
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPartnerTyping]);

  // 2. CONNECT SOCKET
  useEffect(() => {
    if (!isReadyToChat || !user) return;

    // Smart Domain Parser
    const domain = user.email.split("@")[1];
    const cleanDomain = domain ? domain.replace(/student\.|my\.|mail\.|\.edu\.au|\.edu|\.ca|\.ac\.uk|\.ac\.in/g, "") : "anon";
    const parsedUni = cleanDomain.toUpperCase().split(".")[0];
    
    // Auto-fill uni name from email if not manually set
    if (!uniName) setUniName(parsedUni);

    const filterValue = (document.getElementById("uni-filter") as HTMLSelectElement)?.value || "Any";
    const isPremium = filterValue !== "Any" ? "true" : "false";

    const s = io(SERVER_URL, {
      transports: ["websocket"],
      query: {
        email: user.email,
        uni: uniName || parsedUni, // Use profile uni or parsed
        name: displayName,
        gender: gender, // 🆕 Send new profile data
        major: major,
        targetUni: filterValue,
        isPremium: isPremium, 
      },
    });

    setSocket(s);
    setStatus("Searching for a vibe match... 🌊");

    const timer = setTimeout(() => {
      if (!roomId && filterValue !== "Any") {
        setShowTimeoutAlert(true);
      }
    }, 10000); 

    // ---- SOCKET EVENTS ----
    s.on("connect", () => {
        setIsSocketConnected(true);
        // 🆕 Request online count
        s.emit("get_online_count");
    });

    s.on("disconnect", () => {
        setIsSocketConnected(false);
    });

    s.on("connect_error", (err) => {
        if (err.message.includes("BANNED")) {
          toast.error("⛔ You are permanently banned.");
          handleLogoutCleanup();
        }
    });

    // 🆕 Live Counter Update
    s.on("online_count", ({ count }) => {
        setOnlineCount(count);
    });

    s.on("matched", ({ roomId, partnerUni, partnerName }) => {
      setRoomId(roomId);
      setPartnerInfo({ uni: partnerUni, name: partnerName });
      setMessages([]);
      setStatus(`Vibing with ${partnerName}`);
      setShowTimeoutAlert(false); 
      clearTimeout(timer);
      toast.success("Match found! Say hi 👋"); // 🆕 Smart Notification
    });

    s.on("message", (msg) => {
      setMessages((prev) => [...prev, { ...msg, from: "partner" }]);
      setIsPartnerTyping(false); // Stop typing bubble when message arrives
    });

    // 🆕 Typing Events
    s.on("typing", () => setIsPartnerTyping(true));
    s.on("stop_typing", () => setIsPartnerTyping(false));

    s.on("partner_left", () => {
      setStatus("Partner dipped 💨 Reconnecting...");
      setRoomId(null);
      setPartnerInfo(null);
      setIsPartnerTyping(false);
      toast("Partner left the chat.", { icon: "👣" }); // 🆕 Smart Notification
      setTimeout(() => {
        setStatus("Searching for a vibe match... 🌊");
        s.emit("waiting");
      }, 2000);
    });

    s.on("warning", () => {
      toast.warning("⚠️ You have been reported for inappropriate behavior.");
    });

    s.on("banned", () => {
      toast.error("⛔ Account Suspended: Multiple reports received.");
      handleLogoutCleanup();
    });

    return () => {
      s.disconnect();
      clearTimeout(timer);
    };
  }, [isReadyToChat, user]);

  // ---- HELPERS & ACTIONS ----

  // 🧹 CLEANUP FUNCTION (Used by Logout & Auto-Logout)
  const handleLogoutCleanup = () => {
    setUser(null);
    setIsReadyToChat(false);
    setShowOtpInput(false);
    setOtpInput("");
    setEmailInput("");
    setLoading(false);
    // Reset Profile State
    setDisplayName("");
    setGender("");
    setMajor("");
    setCountry("");
    setCity("");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    handleLogoutCleanup();
  };

  // 🟢 FIX: Reset loading state correctly
  const handleBackToEmail = () => {
    setShowOtpInput(false);
    setOtpInput("");
    setLoading(false); 
  };
  
  // 📨 STEP 1: SEND CODE
  const handleSendCode = async () => {
    setLoading(true);
    const email = emailInput.toLowerCase().trim();
    const publicDomains = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me"];
    
    if (!email.includes("@")) { toast.error("Invalid email."); setLoading(false); return; }
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

  // 🔐 STEP 2: VERIFY CODE
  const handleVerifyCode = async () => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
        email: emailInput,
        token: otpInput,
        type: 'email',
    });

    if (error) {
        toast.error(error.message);
        setLoading(false); 
    }
  };

  // 🆕 Typing Logic
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    if (socket && roomId) {
        socket.emit("typing", { roomId });
        
        // Debounce stop typing
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("stop_typing", { roomId });
        }, 1000);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !roomId || !socket) return;
    const msg = { text: input, ts: Date.now(), from: "me" as const };
    setMessages((prev) => [...prev, msg]);
    socket.emit("send_message", { message: input });
    socket.emit("stop_typing", { roomId }); // Ensure typing stops immediately on send
    setInput("");
  };

  // 🆕 Share Feature
  const handleShare = () => {
    navigator.clipboard.writeText("Chat with students from my uni on CampChat! ⛺ https://campchat.app");
    toast.success("Link copied to clipboard!");
  };

  // ... (Other handlers unchanged but using toast) ...
  const handleGoGlobal = () => { if (socket) { socket.emit("update_preference", { targetUni: "Any" }); setShowTimeoutAlert(false); setStatus("Expanded search to Global 🌍"); toast("Searching Globally!"); }};
  const handleDisconnect = () => { if (socket) socket.disconnect(); setSocket(null); setRoomId(null); setMessages([]); setPartnerInfo(null); setIsReadyToChat(false); setStatus("Idle"); setShowTimeoutAlert(false); };
  const handleNextMatch = () => { if (!socket) return; setMessages([]); setRoomId(null); setPartnerInfo(null); setStatus("Skipping... ⏭️"); socket.disconnect(); setIsReadyToChat(false); setTimeout(() => setIsReadyToChat(true), 100); };
  const handleReport = () => { if (!socket || !roomId) return; if (confirm("Report this user?")) { socket.emit("report_partner"); setStatus("Reported 🚫 Switching..."); setRoomId(null); setPartnerInfo(null); setMessages([]); setTimeout(() => socket.emit("waiting"), 1500); toast.error("User reported."); }};

  // ---- RENDER: 1. LOGIN SCREEN ----
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Toaster position="top-center" richColors /> {/* 🆕 Notification Center */}
        <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center animate-float">
            <div className="mb-6 inline-block rounded-full bg-emerald-500/20 p-4"><span className="text-4xl">⛺</span></div>
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">CampChat</h1>
            <p className="text-zinc-400 mb-8">The exclusive social network for uni students.</p>
            
            {!showOtpInput ? (
                <div className="space-y-4">
                    <input type="email" placeholder="student@uni.edu.au" className="w-full rounded-xl bg-black/40 border border-white/10 p-4 text-white placeholder-zinc-500 focus:border-emerald-500 outline-none transition-colors" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendCode()} />
                    <button onClick={handleSendCode} disabled={loading || !emailInput} className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-black hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20">{loading ? "Sending..." : "Get Login Code ⚡"}</button>
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    <div className="text-emerald-400 text-sm font-bold mb-2">Code sent! Check your email. 📩</div>
                    <input type="text" placeholder="123456" className="w-full rounded-xl bg-black/40 border border-white/10 p-4 text-center text-2xl tracking-[0.5em] text-white placeholder-zinc-700 focus:border-emerald-500 outline-none transition-colors" maxLength={6} value={otpInput} onChange={(e) => setOtpInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()} />
                    <button onClick={handleVerifyCode} disabled={loading || otpInput.length < 6} className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-black hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20">{loading ? "Verifying..." : "Verify & Enter 🚀"}</button>
                    <button onClick={handleBackToEmail} className="text-xs text-zinc-500 underline hover:text-white mt-2">Wrong email? Go back</button>
                </div>
            )}
            <p className="mt-8 text-[10px] text-zinc-600 uppercase tracking-widest">Verified Students Only</p>
        </div>
      </div>
    );
  }

  // ---- RENDER: 2. SETUP SCREEN (v2 New Onboarding) ----
  if (!isReadyToChat) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
         <Toaster position="top-center" richColors />
         <div className="glass-panel w-full max-w-md rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl"></div>
            <h1 className="text-2xl font-bold text-white mb-6">Setup Profile</h1>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Display Name */}
                <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Display Name</label>
                    <input className="w-full mt-2 rounded-xl bg-black/30 border border-white/10 p-3 text-white focus:border-emerald-500 outline-none" placeholder="e.g. Coffee Addict" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>

                {/* Gender Dropdown */}
                <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Gender</label>
                    <select className="w-full mt-2 rounded-xl bg-black/30 border border-white/10 p-3 text-white outline-none focus:border-emerald-500" value={gender} onChange={(e) => setGender(e.target.value)}>
                        <option value="" disabled>Select Gender</option>
                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>

                {/* Major Dropdown */}
                <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Major</label>
                    <select className="w-full mt-2 rounded-xl bg-black/30 border border-white/10 p-3 text-white outline-none focus:border-emerald-500" value={major} onChange={(e) => setMajor(e.target.value)}>
                        <option value="" disabled>Select Major</option>
                        {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {/* Country & City */}
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Country</label>
                        <input className="w-full mt-2 rounded-xl bg-black/30 border border-white/10 p-3 text-white focus:border-emerald-500 outline-none" placeholder="Australia" value={country} onChange={(e) => setCountry(e.target.value)} />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">City</label>
                        <input className="w-full mt-2 rounded-xl bg-black/30 border border-white/10 p-3 text-white focus:border-emerald-500 outline-none" placeholder="Sydney" value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                </div>

                {/* Filter */}
                <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex justify-between">Match Preference <span className="text-emerald-400">Premium</span></label>
                    <div className="relative mt-2">
                        <select className="w-full appearance-none rounded-xl bg-black/30 border border-white/10 p-3 text-white outline-none focus:border-emerald-500" id="uni-filter">
                          <option value="Any">Anyone (Free)</option>
                          <option value="UTS">Only UTS</option>
                          <option value="UNSW">Only UNSW</option>
                          <option value="USYD">Only USYD</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-3.5 text-zinc-400">▼</div>
                    </div>
                </div>

                <button onClick={() => { if(displayName && gender && major && country && city) setIsReadyToChat(true); else toast.error("Please fill all fields!"); }} className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all">Start Matching 🚀</button>
                <button onClick={handleLogout} className="w-full text-center text-xs text-zinc-500 hover:text-white transition-colors">Log out</button>
            </div>
         </div>
      </div>
    );
  }

  // ---- RENDER: 3. CHAT SCREEN (v2 Sticky & Badges) ----
  return (
    // 🆕 Sticky Layout: h-[100dvh] fixes mobile browser input jumping
    <div className="flex h-[100dvh] flex-col items-center justify-center bg-black sm:p-6">
      <Toaster position="top-center" richColors />
      
      <div className="glass-panel flex w-full max-w-lg flex-1 flex-col overflow-hidden sm:rounded-3xl relative">
        
        {/* TIMEOUT POPUP */}
        {showTimeoutAlert && !roomId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
            <div className="glass-panel border-white/20 p-6 text-center max-w-xs shadow-2xl animate-float">
               <h3 className="text-xl font-bold text-white mb-2">No match found 😔</h3>
               <button onClick={handleGoGlobal} className="w-full rounded-lg bg-emerald-500 py-2 text-black font-bold mb-2 hover:bg-emerald-400 transition-colors">Search Globally 🌍</button>
               <button onClick={() => setShowTimeoutAlert(false)} className="w-full text-zinc-500 text-xs hover:text-white">Keep Waiting</button>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/5 bg-black/20 p-4 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
                <h2 className="font-bold text-white tracking-wide">{roomId ? partnerInfo?.name : "Searching..."}</h2>
                {/* 🆕 University Badge */}
                {roomId && partnerInfo?.uni && (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/30">
                        {partnerInfo.uni}
                    </span>
                )}
            </div>
            
            {/* 🆕 Live Counter & Reconnecting Badge */}
            <div className="flex items-center gap-2 mt-1">
                {!isSocketConnected ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span> Reconnecting...
                    </span>
                ) : (
                   <p className="text-xs text-zinc-400 flex items-center gap-1">
                      {roomId ? <span className="text-emerald-400">● Online</span> : status}
                   </p>
                )}
            </div>
          </div>

          <div className="flex gap-2">
            {/* 🆕 Live User Count Badge */}
            <div className="hidden sm:flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span> {onlineCount} Online
            </div>

            {roomId ? (
                <>
                    <button onClick={handleReport} className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20">🚩</button>
                    <button onClick={handleNextMatch} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">Skip</button>
                </>
            ) : (
                <button onClick={handleShare} className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20">Share 🔗</button>
            )}
            <button onClick={handleDisconnect} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white">Exit</button>
          </div>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {messages.length === 0 && (
             <div className="flex h-full flex-col items-center justify-center text-zinc-500">
               <div className="mb-4 rounded-full bg-zinc-800/50 p-4"><span className="text-2xl animate-pulse">📡</span></div>
               <p className="text-sm font-medium">{status}</p>
             </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.from === "me" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${m.from === "me" ? "bg-emerald-500 text-white rounded-tr-none" : "bg-zinc-800 text-zinc-200 rounded-tl-none"}`}>{m.text}</div>
              {/* Name + Uni tag in chat */}
              <span className="text-[10px] text-zinc-600 mt-1 px-1 opacity-60">
                {m.from === "me" ? "Me" : partnerInfo?.name}
              </span>
            </div>
          ))}
          
          {/* 🆕 Partner Typing Bubble */}
          {isPartnerTyping && (
             <div className="flex items-center gap-2 p-2">
                <div className="flex space-x-1 rounded-2xl bg-zinc-800 px-4 py-3 rounded-tl-none">
                    <div className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce"></div>
                </div>
                <span className="text-xs text-zinc-600">Partner is typing...</span>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT (Sticky & Fixed) */}
        <div className="border-t border-white/5 bg-black/20 p-4 backdrop-blur-md shrink-0">
            <div className="flex gap-2">
              <input 
                className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 transition-colors" 
                placeholder={roomId ? "Type a message..." : "Waiting for partner..."} 
                value={input} 
                onChange={handleTyping} // 🆕 Triggers typing event
                onKeyDown={(e) => e.key === "Enter" && sendMessage()} 
                disabled={!roomId} 
              />
              <button onClick={sendMessage} disabled={!roomId} className="rounded-xl bg-emerald-500 px-5 font-bold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none hover:bg-emerald-400 transition-all active:scale-95">Send</button>
            </div>
        </div>

      </div>
    </div>
  );
}