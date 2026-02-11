"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "./lib/supabase";
import { Toaster, toast } from "sonner"; 

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

const MAJORS = ["Computer Science", "Business", "Engineering", "Medicine", "Arts", "Law", "Science", "Architecture", "Design", "Psychology", "Other"];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

export default function Home() {
  // ---- AUTH & USER STATE ----
  const [user, setUser] = useState<any>(null);
  const [isReadyToChat, setIsReadyToChat] = useState(false);
  
  // Profile State
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [major, setMajor] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [uniName, setUniName] = useState("");
  
  // 🛡️ BOT TEST STATE
  const [isHuman, setIsHuman] = useState(false);

  // Login Flow State
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState(""); 
  const [showOtpInput, setShowOtpInput] = useState(false); 
  const [loading, setLoading] = useState(false);
  
  // Logic State
  const [showTimeoutAlert, setShowTimeoutAlert] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0); 

  // Chat State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("Idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<{ uni: string; name: string } | null>(null);
  const [messages, setMessages] = useState<{ text: string; ts: number; from: "me" | "partner" }[]>([]);
  const [input, setInput] = useState("");
  const [isPartnerTyping, setIsPartnerTyping] = useState(false); 

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
        handleLogoutCleanup(); 
      }
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPartnerTyping]);

  // 2. CONNECT SOCKET
  useEffect(() => {
    if (!isReadyToChat || !user) return;

    const domain = user.email.split("@")[1];
    const cleanDomain = domain ? domain.replace(/student\.|my\.|mail\.|\.edu\.au|\.edu|\.ca|\.ac\.uk|\.ac\.in/g, "") : "anon";
    const parsedUni = cleanDomain.toUpperCase().split(".")[0];
    if (!uniName) setUniName(parsedUni);

    const filterValue = (document.getElementById("uni-filter") as HTMLSelectElement)?.value || "Any";
    const isPremium = filterValue !== "Any" ? "true" : "false";

    const s = io(SERVER_URL, {
      transports: ["websocket"],
      query: {
        email: user.email,
        uni: uniName || parsedUni,
        name: displayName,
        gender: gender,
        major: major,
        targetUni: filterValue,
        isPremium: isPremium, 
      },
    });

    setSocket(s);
    setStatus("Searching for a vibe match... 🌊");

    const timer = setTimeout(() => {
      if (!roomId && filterValue !== "Any") setShowTimeoutAlert(true);
    }, 10000); 

    s.on("connect", () => {
        setIsSocketConnected(true);
        s.emit("get_online_count");
    });
    s.on("disconnect", () => setIsSocketConnected(false));
    s.on("connect_error", (err) => {
        if (err.message.includes("BANNED")) {
          toast.error("⛔ You are permanently banned.");
          handleLogoutCleanup();
        }
    });
    s.on("online_count", ({ count }) => setOnlineCount(count));
    s.on("matched", ({ roomId, partnerUni, partnerName }) => {
      setRoomId(roomId);
      setPartnerInfo({ uni: partnerUni, name: partnerName });
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

    return () => {
      s.disconnect();
      clearTimeout(timer);
    };
  }, [isReadyToChat, user]);

  // ---- HELPERS ----
  const handleLogoutCleanup = () => {
    setUser(null);
    setIsReadyToChat(false);
    setShowOtpInput(false);
    setOtpInput("");
    setEmailInput("");
    setLoading(false);
    setIsHuman(false); // Reset Bot Test
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    handleLogoutCleanup();
  };

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
    if (error) { toast.error(error.message); } 
    else { setShowOtpInput(true); toast.success(`Code sent to ${email}! 📩`); }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email: emailInput, token: otpInput, type: 'email' });
    if (error) { toast.error(error.message); setLoading(false); }
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

  const handleGoGlobal = () => { if (socket) { socket.emit("update_preference", { targetUni: "Any" }); setShowTimeoutAlert(false); setStatus("Expanded search to Global 🌍"); toast("Searching Globally!"); }};
  const handleDisconnect = () => { if (socket) socket.disconnect(); setSocket(null); setRoomId(null); setMessages([]); setPartnerInfo(null); setIsReadyToChat(false); setStatus("Idle"); setShowTimeoutAlert(false); };
  const handleNextMatch = () => { if (!socket) return; setMessages([]); setRoomId(null); setPartnerInfo(null); setStatus("Skipping... ⏭️"); socket.disconnect(); setIsReadyToChat(false); setTimeout(() => setIsReadyToChat(true), 100); };
  const handleReport = () => { if (!socket || !roomId) return; if (confirm("Report this user?")) { socket.emit("report_partner"); setStatus("Reported 🚫 Switching..."); setRoomId(null); setPartnerInfo(null); setMessages([]); setTimeout(() => socket.emit("waiting"), 1500); toast.error("User reported."); }};

  // 🧱 COMPONENT: NAVBAR (The "Solid" Header)
  const Navbar = () => (
    <nav className="w-full h-16 border-b border-white/5 bg-black/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-2">
            <span className="text-2xl">⛺</span>
            <span className="font-bold text-white tracking-tight">CampChat</span>
        </div>
        
        <div className="flex items-center gap-4">
            {/* Live Count Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-white/10">
                 <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                 <span className="text-xs font-medium text-zinc-400">{onlineCount > 0 ? `${onlineCount} Online` : 'Offline'}</span>
            </div>
            {user && (
                <button onClick={handleLogout} className="text-xs font-medium text-zinc-500 hover:text-white transition-colors">
                    Log out
                </button>
            )}
        </div>
    </nav>
  );

  // ---- VIEW 1: LOGIN (Grounded) ----
  if (!user) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-black">
        <Navbar />
        <Toaster position="top-center" richColors theme="dark" />
        
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
            {/* Background Glow Orb */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>

            <div className="solid-panel w-full max-w-md rounded-2xl p-8 text-center relative z-10">
                <div className="mb-6 inline-block rounded-full bg-emerald-500/10 p-4 border border-emerald-500/20">
                    <span className="text-4xl drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">⛺</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">hey bud</h1>
                <p className="text-zinc-400 mb-8 text-sm">Enter your student email to join the camp.</p>
                
                {!showOtpInput ? (
                    <div className="space-y-4">
                        <input type="email" placeholder="student@uni.edu.au" className="input-solid w-full rounded-xl p-4" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendCode()} />
                        <button onClick={handleSendCode} disabled={loading || !emailInput} className="btn-emerald w-full rounded-xl py-4">{loading ? "Sending..." : "Get Login Code ⚡"}</button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">Check your inbox</div>
                        <input type="text" placeholder="123456" className="input-solid w-full rounded-xl p-4 text-center text-2xl tracking-[0.5em]" maxLength={6} value={otpInput} onChange={(e) => setOtpInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()} />
                        <button onClick={handleVerifyCode} disabled={loading || otpInput.length < 6} className="btn-emerald w-full rounded-xl py-4">{loading ? "Verifying..." : "Verify & Enter 🚀"}</button>
                        <button onClick={() => { setShowOtpInput(false); setLoading(false); }} className="text-xs text-zinc-500 hover:text-white mt-4 block mx-auto">Wrong email?</button>
                    </div>
                )}
            </div>
            <p className="mt-8 text-[10px] text-zinc-700 uppercase tracking-widest font-medium">Verified Students Only</p>
        </div>
      </div>
    );
  }

  // ---- VIEW 2: PROFILE SETUP (With Bot Test) ----
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
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Display Name</label>
                        <input className="input-solid w-full mt-1 rounded-xl p-3" placeholder="e.g. Coffee Addict" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Gender</label>
                            <select className="input-solid w-full mt-1 rounded-xl p-3" value={gender} onChange={(e) => setGender(e.target.value)}>
                                <option value="" disabled>Select</option>
                                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Major</label>
                            <select className="input-solid w-full mt-1 rounded-xl p-3" value={major} onChange={(e) => setMajor(e.target.value)}>
                                <option value="" disabled>Select</option>
                                {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Country</label>
                            <input className="input-solid w-full mt-1 rounded-xl p-3" placeholder="Australia" value={country} onChange={(e) => setCountry(e.target.value)} />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">City</label>
                            <input className="input-solid w-full mt-1 rounded-xl p-3" placeholder="Sydney" value={city} onChange={(e) => setCity(e.target.value)} />
                        </div>
                    </div>

                    {/* 🛡️ BOT CHECK (Security Step) */}
                    <div className="mt-6 p-4 rounded-xl bg-black/40 border border-emerald-500/20 flex items-center gap-3">
                        <input 
                            type="checkbox" 
                            id="bot-check" 
                            checked={isHuman} 
                            onChange={(e) => setIsHuman(e.target.checked)}
                            className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                        />
                        <label htmlFor="bot-check" className="text-sm text-zinc-300 cursor-pointer select-none">
                            I am a real student (Human Check) 🤖
                        </label>
                    </div>

                    <button 
                        onClick={() => { 
                            if(displayName && gender && major && country && city && isHuman) setIsReadyToChat(true); 
                            else toast.error(isHuman ? "Please fill all fields!" : "Please confirm you are human!"); 
                        }} 
                        disabled={!isHuman}
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

  // ---- VIEW 3: CHAT SCREEN (Full Height Layout) ----
  return (
    <div className="flex flex-col h-[100dvh] bg-black overflow-hidden">
      <Navbar />
      <Toaster position="top-center" richColors theme="dark" />
      
      {/* Main Chat Container - Fits remaining space */}
      <div className="flex-1 flex flex-col w-full max-w-3xl mx-auto sm:my-4 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-zinc-900/50 relative overflow-hidden">
        
        {/* TIMEOUT POPUP */}
        {showTimeoutAlert && !roomId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
            <div className="solid-panel p-6 text-center max-w-xs rounded-xl">
               <h3 className="text-xl font-bold text-white mb-2">No match found 😔</h3>
               <button onClick={handleGoGlobal} className="btn-emerald w-full rounded-lg py-2 mb-2">Search Globally 🌍</button>
               <button onClick={() => setShowTimeoutAlert(false)} className="text-xs text-zinc-500 hover:text-white">Keep Waiting</button>
            </div>
          </div>
        )}

        {/* CHAT HEADER */}
        <div className="h-16 border-b border-white/5 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
                <h2 className="font-bold text-white">{roomId ? partnerInfo?.name : "Searching..."}</h2>
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
                   <p className="text-xs text-zinc-400">{roomId ? <span className="text-emerald-500">● Online</span> : status}</p>
                )}
            </div>
          </div>

          <div className="flex gap-2">
            {roomId ? (
                <>
                    <button onClick={handleReport} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 text-xs">🚩 Report</button>
                    <button onClick={handleNextMatch} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-medium border border-white/5">Skip</button>
                </>
            ) : (
                <button onClick={handleShare} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs hover:bg-emerald-500/20">Share Link 🔗</button>
            )}
            <button onClick={handleDisconnect} className="px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs">Exit</button>
          </div>
        </div>

        {/* MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-black/20">
          {messages.length === 0 && (
             <div className="flex h-full flex-col items-center justify-center text-zinc-600">
               <div className="mb-4 rounded-full bg-zinc-900 p-6 border border-white/5"><span className="text-3xl animate-pulse grayscale opacity-50">📡</span></div>
               <p className="text-sm font-medium">Scanning frequency...</p>
             </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.from === "me" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${m.from === "me" ? "bg-emerald-600 text-white rounded-tr-none shadow-[0_2px_10px_rgba(16,185,129,0.2)]" : "bg-zinc-800 text-zinc-200 rounded-tl-none border border-white/5"}`}>{m.text}</div>
              <span className="text-[10px] text-zinc-600 mt-1 px-1">{m.from === "me" ? "Me" : partnerInfo?.name}</span>
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
              <input 
                className="input-solid flex-1 rounded-xl px-4 py-3 text-sm" 
                placeholder={roomId ? "Type a message..." : "Waiting for partner..."} 
                value={input} 
                onChange={handleTyping} 
                onKeyDown={(e) => e.key === "Enter" && sendMessage()} 
                disabled={!roomId} 
              />
              <button onClick={sendMessage} disabled={!roomId} className="btn-emerald rounded-xl px-6">Send</button>
            </div>
        </div>

      </div>
    </div>
  );
}