"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "./lib/supabase";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

export default function Home() {
  // ---- AUTH & USER STATE ----
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [isReadyToChat, setIsReadyToChat] = useState(false);
  const [acceptedToS, setAcceptedToS] = useState(false);
  
  // Login Flow State
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  // ---- LOGIC STATE ----
  const [showTimeoutAlert, setShowTimeoutAlert] = useState(false);

  // ---- CHAT STATE ----
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("Idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<{ uni: string; name: string } | null>(null);
  const [messages, setMessages] = useState<{ text: string; ts: number; from: "me" | "partner" }[]>([]);
  const [input, setInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. CHECK SESSION (Handles the return from Email Link or Google)
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) setUser(data.session.user);
    };
    checkUser();

    // Listen for auth changes (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) setUser(session.user);
      else setUser(null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 2. CONNECT SOCKET
  useEffect(() => {
    if (!isReadyToChat || !user) return;

    const domain = user.email.split("@")[1];
    // Smart Parser: Handles international domains
    const cleanDomain = domain ? domain.replace(/student\.|my\.|mail\.|\.edu\.au|\.edu|\.ca|\.ac\.uk|\.ac\.in/g, "") : "anon";
    const uni = cleanDomain.toUpperCase().split(".")[0];
    const filterValue = (document.getElementById("uni-filter") as HTMLSelectElement)?.value || "Any";
    
    // Strict Logic: If they chose a filter, treat them as Premium
    const isPremium = filterValue !== "Any" ? "true" : "false";

    const s = io(SERVER_URL, {
      transports: ["websocket"],
      query: {
        email: user.email,
        uni: uni,
        name: displayName,
        targetUni: filterValue,
        isPremium: isPremium, 
      },
    });

    setSocket(s);
    setStatus("Searching for a vibe match... 🌊");

    // Timeout Logic (10 seconds)
    const timer = setTimeout(() => {
      if (!roomId && filterValue !== "Any") {
        setShowTimeoutAlert(true);
      }
    }, 10000); 

    // ---- EVENTS ----
    s.on("connect_error", (err) => {
        if (err.message.includes("BANNED")) {
          alert("⛔ You are permanently banned.");
          setUser(null);
          setIsReadyToChat(false);
        }
    });

    s.on("matched", ({ roomId, partnerUni, partnerName }) => {
      setRoomId(roomId);
      setPartnerInfo({ uni: partnerUni, name: partnerName });
      setMessages([]);
      setStatus(`Vibing with ${partnerName}`);
      setShowTimeoutAlert(false); 
      clearTimeout(timer);
    });

    s.on("message", (msg) => {
      setMessages((prev) => [...prev, { ...msg, from: "partner" }]);
    });

    s.on("partner_left", () => {
      setStatus("Partner dipped 💨 Reconnecting...");
      setRoomId(null);
      setPartnerInfo(null);
      setTimeout(() => {
        setStatus("Searching for a vibe match... 🌊");
        s.emit("waiting");
      }, 2000);
    });

    s.on("warning", () => {
      alert("⚠️ Warning: You have been reported for inappropriate behavior.");
      window.location.reload();
    });

    s.on("banned", () => {
      alert("⛔ Account Suspended: Multiple reports received.");
      window.location.reload();
    });

    return () => {
      s.disconnect();
      clearTimeout(timer);
    };
  }, [isReadyToChat, user]);

  // ---- ACTIONS ----

  // 🦁 HANDLE GOOGLE LOGIN
  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // ⚠️ This matches your Production Domain to prevent redirect loops
        redirectTo: 'https://campchat.app/auth/callback', 
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) alert(error.message);
    setLoading(false);
  };
  
  // 📧 HANDLE MAGIC LINK
  const handleLogin = async () => {
    setLoading(true);
    setAuthMessage("");

    const email = emailInput.toLowerCase().trim();

    // 1. The "No Gmail Allowed" Rule 🚫
    const publicDomains = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me"];
    
    if (!email.includes("@")) {
        alert("Please enter a valid email address.");
        setLoading(false);
        return;
    }

    const domain = email.split("@")[1];

    if (publicDomains.includes(domain)) {
        alert("⚠️ Students only! Please use your university email (e.g., .edu, .ca, .ac.uk).");
        setLoading(false);
        return;
    }

    if (!email.includes(".")) {
       alert("Please enter a valid email address.");
       setLoading(false);
       return;
    }

    // 3. Send Supabase Magic Link
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: 'https://campchat.app/auth/callback',
      },
    });

    if (error) {
      alert(error.message);
    } else {
      setAuthMessage(`Magic link sent to ${email}! Check your inbox (and spam). 📩`);
    }
    setLoading(false);
  };

  const handleGoGlobal = () => {
    if (!socket) return;
    socket.emit("update_preference", { targetUni: "Any" });
    setShowTimeoutAlert(false);
    setStatus("Expanded search to Global 🌍");
  };

  const handleDisconnect = () => {
    if (socket) socket.disconnect();
    setSocket(null);
    setRoomId(null);
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
    setPartnerInfo(null);
    setStatus("Skipping... ⏭️");
    socket.disconnect();
    setIsReadyToChat(false);
    setTimeout(() => setIsReadyToChat(true), 100);
  };

  const handleReport = () => {
    if (!socket || !roomId) return;
    if (confirm("Report this user? Moderators will review the chat logs.")) {
        socket.emit("report_partner");
        setStatus("Reported 🚫 Switching...");
        setRoomId(null);
        setPartnerInfo(null);
        setMessages([]);
        setTimeout(() => socket.emit("waiting"), 1500);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !roomId || !socket) return;
    const msg = { text: input, ts: Date.now(), from: "me" as const };
    setMessages((prev) => [...prev, msg]);
    socket.emit("send_message", { message: input });
    setInput("");
  };

  // ---- RENDER: 1. LOGIN SCREEN (Real Auth) ----
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center animate-float">
            <div className="mb-6 inline-block rounded-full bg-emerald-500/20 p-4">
                <span className="text-4xl">⛺</span>
            </div>
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">CampChat</h1>
            <p className="text-zinc-400 mb-8">The exclusive social network for uni students.</p>
            
            {!loading && !authMessage ? (
              <div className="space-y-4">
                 <input 
                    type="email" 
                    placeholder="student@uni.edu.au"
                    className="w-full rounded-xl bg-black/40 border border-white/10 p-4 text-white placeholder-zinc-500 focus:border-emerald-500 outline-none transition-colors"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                 />
                 <button 
                    onClick={handleLogin} 
                    disabled={!emailInput}
                    className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-black hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20">
                    Send Magic Link ⚡
                 </button>

                 <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-zinc-700"></div>
                    <span className="flex-shrink mx-4 text-zinc-500 text-xs">OR</span>
                    <div className="flex-grow border-t border-zinc-700"></div>
                 </div>

                 <button 
                    onClick={handleGoogleLogin}
                    className="w-full rounded-xl bg-white py-3 font-bold text-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                 >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sign in with Google
                 </button>
              </div>
            ) : (
              <div className="rounded-xl bg-white/5 p-6 border border-white/10">
                 {authMessage ? (
                   <>
                     <div className="text-emerald-400 text-lg font-bold mb-2">Check your email! 📩</div>
                     <p className="text-zinc-400 text-xs">{authMessage}</p>
                     <button onClick={() => setAuthMessage("")} className="mt-4 text-xs text-zinc-500 underline">Try different email</button>
                   </>
                 ) : (
                   <div className="text-zinc-400 animate-pulse flex flex-col items-center gap-2">
                      <div className="h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      Connecting...
                   </div>
                 )}
              </div>
            )}
            
            <p className="mt-8 text-[10px] text-zinc-600 uppercase tracking-widest">
              Verified Students Only
            </p>
        </div>
      </div>
    );
  }

  // ---- RENDER: 2. SETUP SCREEN ----
  if (!isReadyToChat) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
         <div className="glass-panel w-full max-w-md rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl"></div>
            
            <h1 className="text-2xl font-bold text-white mb-6">Setup Profile</h1>
            
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Display Name</label>
                    <input 
                      className="w-full mt-2 rounded-xl bg-black/30 border border-white/10 p-3 text-white placeholder-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
                      placeholder="e.g. Coffee Addict"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex justify-between">
                      Filter <span className="text-emerald-400">Premium</span>
                    </label>
                    <div className="relative mt-2">
                        <select 
                          className="w-full appearance-none rounded-xl bg-black/30 border border-white/10 p-3 text-white outline-none focus:border-emerald-500"
                          id="uni-filter"
                        >
                          <option value="Any">Anyone (Free)</option>
                          <option value="UTS">Only UTS</option>
                          <option value="UNSW">Only UNSW</option>
                          <option value="USYD">Only USYD</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-3.5 text-zinc-400">▼</div>
                    </div>
                </div>

                <div className="flex items-center gap-3 py-2">
                    <input 
                        type="checkbox" 
                        id="tos" 
                        checked={acceptedToS}
                        onChange={(e) => setAcceptedToS(e.target.checked)}
                        className="h-5 w-5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                    />
                    <label htmlFor="tos" className="text-xs text-zinc-400 leading-tight cursor-pointer">
                        I agree not to be a creep. I understand that if I am reported, I will be banned permanently.
                    </label>
                </div>

                <button 
                  onClick={() => {
                    if(displayName.trim() && acceptedToS) setIsReadyToChat(true);
                  }}
                  disabled={!displayName.trim() || !acceptedToS}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Start Matching 🚀
                </button>
                
                <button onClick={() => supabase.auth.signOut()} className="w-full text-center text-xs text-zinc-500 hover:text-white transition-colors">
                    Log out
                </button>
            </div>
         </div>
      </div>
    );
  }

  // ---- RENDER: 3. CHAT SCREEN ----
  return (
    <div className="flex h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="glass-panel flex w-full max-w-lg flex-col overflow-hidden rounded-3xl h-[85vh] sm:h-[90vh] relative">
        
        {/* TIMEOUT ALERT POPUP */}
        {showTimeoutAlert && !roomId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
            <div className="glass-panel border-white/20 p-6 text-center max-w-xs shadow-2xl animate-float">
               <h3 className="text-xl font-bold text-white mb-2">No match found 😔</h3>
               <p className="text-sm text-zinc-400 mb-4">We couldn't find anyone from your selected uni online right now.</p>
               <button onClick={handleGoGlobal} className="w-full rounded-lg bg-emerald-500 py-2 text-black font-bold mb-2 hover:bg-emerald-400 transition-colors">
                 Search Globally 🌍
               </button>
               <button onClick={() => setShowTimeoutAlert(false)} className="w-full text-zinc-500 text-xs hover:text-white">
                 Keep Waiting
               </button>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/5 bg-black/20 p-4 backdrop-blur-md">
          <div>
            <h2 className="font-bold text-white tracking-wide">
              {roomId ? partnerInfo?.name : "Searching..."}
            </h2>
            <p className="text-xs text-zinc-400 flex items-center gap-1">
              {roomId ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {partnerInfo?.uni} Student
                  </>
              ) : status}
            </p>
          </div>
          <div className="flex gap-2">
            {roomId && (
                <>
                    <button onClick={handleReport} className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors">🚩 Report</button>
                    <button onClick={handleNextMatch} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors">Skip</button>
                </>
            )}
            <button onClick={handleDisconnect} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors">Exit</button>
          </div>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
             <div className="flex h-full flex-col items-center justify-center text-zinc-500">
               <div className="mb-4 rounded-full bg-zinc-800/50 p-4">
                  <span className="text-2xl animate-pulse">📡</span>
               </div>
               <p className="text-sm font-medium">{status}</p>
             </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.from === "me" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                m.from === "me" 
                  ? "bg-emerald-500 text-white rounded-tr-none" 
                  : "bg-zinc-800 text-zinc-200 rounded-tl-none"
              }`}>
                {m.text}
              </div>
              <span className="text-[10px] text-zinc-600 mt-1 px-1 opacity-60">
                {m.from === "me" ? "Me" : partnerInfo?.name}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="border-t border-white/5 bg-black/20 p-4 backdrop-blur-md">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 transition-colors"
                placeholder={roomId ? "Type a message..." : "Waiting for partner..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                disabled={!roomId}
              />
              <button
                onClick={sendMessage}
                disabled={!roomId}
                className="rounded-xl bg-emerald-500 px-5 font-bold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none hover:bg-emerald-400 transition-all active:scale-95"
              >
                Send
              </button>
            </div>
        </div>

      </div>
    </div>
  );
}