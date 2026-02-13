"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "./lib/supabase";
import { Toaster, toast } from "sonner";
import { COUNTRIES_CITIES, COUNTRY_FLAGS } from "./lib/countries";
import { UNIVERSITIES_BY_COUNTRY } from "./lib/universities";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

const MAJORS = ["Computer Science", "Business", "Engineering", "Medicine", "Arts", "Law", "Science", "Architecture", "Design", "Psychology", "Other"];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
function useMobileKeyboard() {
  useEffect(() => {
    const setVH = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
    };
    setVH();
    window.visualViewport?.addEventListener('resize', setVH);
    window.addEventListener('resize', setVH);
    return () => {
      window.visualViewport?.removeEventListener('resize', setVH);
      window.removeEventListener('resize', setVH);
    };
  }, []);
}
export default function Home() {
  useMobileKeyboard();
  // ---- AUTH & USER STATE ----
  const [user, setUser] = useState<any>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  
  // View States
  const [currentView, setCurrentView] = useState<"landing" | "login" | "profile" | "terms" | "app">("landing");
  const [activeTab, setActiveTab] = useState<"home" | "campuses" | "profile">("home");
  const [showEditProfile, setShowEditProfile] = useState(false);
  
  // Profile State
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [major, setMajor] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [university, setUniversity] = useState("");
  const [uniName, setUniName] = useState("");
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableUniversities, setAvailableUniversities] = useState<string[]>([]);
  
  // Premium State
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<Date | null>(null);
  
  // Terms State
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  // Login Flow State
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  // Filter States
  const [filterGender, setFilterGender] = useState("Any");
  const [filterCountry, setFilterCountry] = useState("Any");
  const [filterUni, setFilterUni] = useState("Any");
  const [filterMajor, setFilterMajor] = useState("Any");
  
  // Chat State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("Idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<{ uni: string; name: string; country: string } | null>(null);
  const [messages, setMessages] = useState<{ text: string; ts: number; from: "me" | "partner"; isGif?: boolean; isImage?: boolean }[]>([]);
  const [input, setInput] = useState("");
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [lastRoomId, setLastRoomId] = useState<string | null>(null);
  const [showTimeoutAlert, setShowTimeoutAlert] = useState(false);
  const [isReadyToChat, setIsReadyToChat] = useState(false);
  const [targetUniFilter, setTargetUniFilter] = useState("Any");
  
  // GIF State
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<any[]>([]);
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);

  // Disappearing image states
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imageTimers, setImageTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messageTimers, setMessageTimers] = useState<Map<number, NodeJS.Timeout>>(new Map());

  // CHECK SESSION & LOAD PROFILE
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setUser(data.session.user);
        const hasProfile = await loadUserProfile(data.session.user.email);
        await generateJWT(data.session);
        
        // If user has complete profile, skip to terms or app
        if (hasProfile) {
          setCurrentView("terms");
        } else {
          setCurrentView("profile");
        }
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const hasProfile = await loadUserProfile(session.user.email);
        await generateJWT(session);
        
        if (hasProfile) {
          setCurrentView("terms");
        } else {
          setCurrentView("profile");
        }
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
  const loadUserProfile = async (email: string): Promise<boolean> => {
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
      setUniversity(data.university || "");
      setUniName(data.uni_name || "");
      
      // Check premium status
      if (data.premium_until) {
        const premiumDate = new Date(data.premium_until);
        setIsPremium(premiumDate > new Date());
        setPremiumUntil(premiumDate);
      }
      
      if (data.country) {
        if (COUNTRIES_CITIES[data.country]) {
          setAvailableCities(COUNTRIES_CITIES[data.country]);
        }
        if (UNIVERSITIES_BY_COUNTRY[data.country]) {
          setAvailableUniversities(UNIVERSITIES_BY_COUNTRY[data.country]);
        }
      }
      
      // Check if profile is complete
      const isComplete = !!(data.display_name && data.gender && data.major && data.country && data.city);
      return isComplete;
    }
    return false;
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
        university: university,
        uni_name: uniName,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'email'  
      });
    
    if (error) {
      console.error('Profile save error:', error);
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile saved!");
    }
  };

  // Update available cities/unis when country changes
  useEffect(() => {
    if (country) {
      if (COUNTRIES_CITIES[country]) {
        setAvailableCities(COUNTRIES_CITIES[country]);
      } else {
        setAvailableCities([]);
      }
      
      if (UNIVERSITIES_BY_COUNTRY[country]) {
        setAvailableUniversities(UNIVERSITIES_BY_COUNTRY[country]);
      } else {
        setAvailableUniversities([]);
      }
      
      setCity("");
      setUniversity("");
    }
  }, [country]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPartnerTyping]);

  // CONNECT SOCKET WITH JWT
  useEffect(() => {
    if (!isReadyToChat || !user || !jwtToken) return;

    const domain = user.email.split("@")[1];
    const cleanDomain = domain ? domain.replace(/student\.|my\.|mail\.|\.edu\.au|\.edu|\.ca|\.ac\.uk|\.ac\.in/g, "") : "anon";
    const parsedUni = cleanDomain.toUpperCase().split(".")[0];
    const displayUni = university || uniName || parsedUni;

    const s = io(SERVER_URL, {
      transports: ["websocket"],
      auth: { token: jwtToken },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(s);
    setStatus("Searching for a vibe match... 🌊");

    s.on("connect", () => {
      setIsSocketConnected(true);
      reconnectAttempts.current = 0;
      
      s.emit("set_profile", {
        uni: displayUni,
        name: displayName,
        gender: gender,
        major: major,
        country: country,
        city: city,
        // Send filter preferences
        filters: {
          gender: filterGender,
          country: filterCountry,
          uni: filterUni,
          major: filterMajor
        }
      });
      
      s.emit("get_online_count");
      
      if (lastRoomId) {
        s.emit("reconnect_to_room", { roomId: lastRoomId });
      }
    });

    s.on("disconnect", (reason) => {
      setIsSocketConnected(false);
      if (reason === "io server disconnect") {
        toast.error("Disconnected by server");
      }
    });

    s.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
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
    };
  }, [isReadyToChat, user, jwtToken, targetUniFilter]);
  // Auto-delete messages after 2 minutes (SEPARATE)
  useEffect(() => {
    messages.forEach((msg, index) => {
      const msgKey = msg.ts;
      
      if (messageTimers.has(msgKey)) return;
      
      const timer = setTimeout(() => {
        setMessages(prev => prev.filter(m => m.ts !== msgKey));
        setMessageTimers(prev => {
          const newMap = new Map(prev);
          newMap.delete(msgKey);
          return newMap;
        });
      }, 120000);
      
      setMessageTimers(prev => new Map(prev).set(msgKey, timer));
    });
  
  return () => {
    messageTimers.forEach(timer => clearTimeout(timer));
  };
}, [messages]);

  // Search GIFs
  // Search GIFs
const searchGifs = async (query: string) => {
  if (!query.trim()) return;
  setIsSearchingGifs(true);
  try {
    console.log('🔍 Searching GIFs for:', query); // DEBUG
    const response = await fetch(
      `${SERVER_URL}/api/gifs/search?q=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ GIF Response:', data); // DEBUG
    
    if (data.data && Array.isArray(data.data)) {
      setGifs(data.data);
    } else {
      console.error('Invalid GIF response:', data);
      toast.error("Invalid GIF data received");
    }
  } catch (err) {
    console.error('❌ GIF search failed:', err);
    toast.error("Failed to load GIFs - check console");
  } finally {
    setIsSearchingGifs(false);
  }
};

  // Load trending GIFs
  // Load trending GIFs
const loadTrendingGifs = async () => {
  setIsSearchingGifs(true);
  try {
    console.log('🔥 Loading trending GIFs'); // DEBUG
    const response = await fetch(
      `${SERVER_URL}/api/gifs/trending`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Trending GIFs:', data); // DEBUG
    
    if (data.data && Array.isArray(data.data)) {
      setGifs(data.data);
    } else {
      console.error('Invalid GIF response:', data);
    }
  } catch (err) {
    console.error('❌ Trending GIFs failed:', err);
  } finally {
    setIsSearchingGifs(false);
  }
};
  // Send GIF
  const sendGif = (gifUrl: string) => {
    if (!roomId || !socket) return;
    const msg = { text: gifUrl, ts: Date.now(), from: "me" as const, isGif: true };
    setMessages((prev) => [...prev, msg]);
    socket.emit("send_message", { message: gifUrl, isGif: true });
    setShowGifPicker(false);
    setGifSearch("");
    setGifs([]);
  };

  // Handle Image Upload (Premium Only)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!isPremium) {
    showPremiumPaywall();
    return;
  }
  
  const file = e.target.files?.[0];
  if (!file) return;
  
  if (file.size > 5 * 1024 * 1024) {
    toast.error("Image too large! Max 5MB");
    return;
  }
  
  if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
    toast.error("Only JPG, PNG, GIF allowed");
    return;
  }
  
  // Store pending image and show timer modal
  setPendingImage(file);
  setShowTimerModal(true);
};
 const sendImageWithTimer = async (timerSeconds: number) => {
  if (!pendingImage || !socket || !roomId) return;
  
  setShowTimerModal(false);
  const toastId = toast.loading("Uploading image...", {
    duration: Infinity
  });
  
  const fileName = `${user.email}-${Date.now()}-${pendingImage.name}`;
  const { data, error } = await supabase.storage
    .from('chat-images')
    .upload(fileName, pendingImage);
  
  if (error) {
    toast.error("Upload failed!", { id: toastId });
    setPendingImage(null);
    return;
  }
  
  const { data: urlData } = supabase.storage
    .from('chat-images')
    .getPublicUrl(fileName);
  
  if (urlData) {
    const imageUrl = urlData.publicUrl;
    const msg = { 
      text: imageUrl, 
      ts: Date.now(), 
      from: "me" as const, 
      isImage: true,
      isBlurred: true,
      timerSeconds: timerSeconds,
      fileName: fileName
    };
    
    setMessages((prev) => [...prev, msg]);
    socket.emit("send_message", { 
      message: imageUrl, 
      isImage: true, 
      isBlurred: true,
      timerSeconds: timerSeconds,
      fileName: fileName
    });
    
    toast.success("Image sent!", { id: toastId });
    setPendingImage(null);
  }
};
const handleImageClick = (imageUrl: string, fileName: string, timerSeconds: number) => {
  // Unblur image
  setMessages(prev => prev.map(msg => 
    msg.text === imageUrl 
      ? { ...msg, isBlurred: false } 
      : msg
  ));
  
  // Start deletion timer
  const timer = setTimeout(async () => {
    // Delete from Supabase
    await supabase.storage
      .from('chat-images')
      .remove([fileName]);
    
    // Remove from messages
    setMessages(prev => prev.filter(msg => msg.text !== imageUrl));
    
    toast("Image deleted", { icon: "🔥" });
  }, timerSeconds * 1000);
  
  setImageTimers(prev => new Map(prev).set(imageUrl, timer));
};

  // Show Premium Paywall
  const showPremiumPaywall = () => {
    toast.error("🔒 Premium Feature - Coffee is $5. This is $3/week. Be smart.", {
      duration: 3000,
    });
    setTimeout(() => {
      toast("Stripe checkout coming soon!");
    }, 1000);
  };

  // ---- HELPERS ----
  const handleLogoutCleanup = () => {
    setUser(null);
    setCurrentView("landing");
    setShowOtpInput(false);
    setOtpInput("");
    setEmailInput("");
    setLoading(false);
    setJwtToken(null);
    setIsReadyToChat(false);
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

  // Find handleVerifyCode function (around line 240) and replace with:

const handleVerifyCode = async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase.auth.verifyOtp({ 
      email: emailInput, 
      token: otpInput, 
      type: 'email' 
    });
    
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    
    // ✅ Verification successful
    toast.success("Verified! Setting up...");
    
    // Wait a moment for session to establish
    setTimeout(async () => {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        setUser(session.session.user);
        const hasProfile = await loadUserProfile(session.session.user.email);
        await generateJWT(session.session);
        
        if (hasProfile) {
          setCurrentView("terms");
        } else {
          setCurrentView("profile");
        }
        setLoading(false);
      } else {
        toast.error("Session error. Please try again.");
        setLoading(false);
      }
    }, 500);
    
  } catch (err) {
    console.error("Verification error:", err);
    toast.error("Verification failed. Try again.");
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
    setCurrentView("terms");
  };
  
  const handleAcceptTerms = () => {
    if (!acceptedTerms) {
      toast.error("Please accept the terms!");
      return;
    }
    setCurrentView("app");
  };
  
  const handleEditProfile = () => {
    setShowEditProfile(true);
  };
  
  const handleSaveEditedProfile = async () => {
    await saveUserProfile();
    setShowEditProfile(false);
  };

  // ---- VIEW: LANDING PAGE ----
  if (currentView === "landing") {
    return <LandingPage onLoginClick={() => setCurrentView("login")} />;
  }

  // ---- VIEW: LOGIN ----
  if (currentView === "login") {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-black">
        <MobileNavbar onlineCount={onlineCount} onLogout={null} />
        <Toaster position="top-center" richColors theme="dark" />
        
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          <button 
            onClick={() => setCurrentView("landing")}
            className="absolute top-24 left-6 text-zinc-500 hover:text-white flex items-center gap-2 text-sm transition-colors z-20"
          >
            ← Back to Home
          </button>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="solid-panel w-full max-w-md rounded-2xl p-8 text-center relative z-10">
            <div className="mb-6 inline-block rounded-full bg-emerald-500/10 p-4 border border-emerald-500/20">
              <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-zinc-400 mb-8 text-sm">Enter your student email to join the camp.</p>
            
            {!showOtpInput ? (
              <div className="space-y-4">
                <input 
                  type="email" 
                  placeholder="student@uni.edu.au" 
                  className="mobile-input input-solid w-full rounded-xl p-4" 
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
                  className="mobile-input input-solid w-full rounded-xl p-4 text-center text-2xl tracking-[0.5em]" 
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

  // ---- VIEW: PROFILE SETUP ----
  if (currentView === "profile") {
    return (
      <div className="flex flex-col h-screen bg-black">
        <MobileNavbar onlineCount={onlineCount} onLogout={handleLogout} />
        <Toaster position="top-center" richColors theme="dark" />
        
        <div className="flex-1 flex flex-col items-center justify-center p-4 pb-24">
          <div className="solid-panel w-full max-w-md rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            <h1 className="text-2xl font-bold text-white mb-6">Setup Profile</h1>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                  Display Name
                </label>
                <input 
                  className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
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
                    className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
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
                    className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
                    value={major} 
                    onChange={(e) => setMajor(e.target.value)}
                  >
                    <option value="" disabled>Select</option>
                    {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                  Country
                </label>
                <select 
                  className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
                  value={country} 
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="" disabled>Select Country</option>
                  {Object.keys(COUNTRIES_CITIES).sort().map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                  City
                </label>
                <select 
                  className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
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
              
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                  University (Optional)
                </label>
                <select 
                  className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
                  value={university} 
                  onChange={(e) => setUniversity(e.target.value)}
                  disabled={!country}
                >
                  <option value="">Skip for now</option>
                  {availableUniversities.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleStartChat}
                className="btn-emerald w-full rounded-xl py-3 mt-2"
              >
                Continue 🚀
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- VIEW: TERMS & CONDITIONS ----
  if (currentView === "terms") {
    return (
      <div className="flex flex-col h-screen bg-black">
        <MobileNavbar onlineCount={onlineCount} onLogout={handleLogout} />
        <Toaster position="top-center" richColors theme="dark" />
        
        <div className="flex-1 flex flex-col items-center justify-center p-4 pb-24">
          <div className="solid-panel w-full max-w-2xl rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            <h1 className="text-3xl font-bold text-white mb-2">The Vibe Check ✨</h1>
            <p className="text-zinc-400 text-sm mb-6">Quick rules before you enter the campfire.</p>
            
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar mb-6">
              <div className="flex gap-3 items-start">
                <span className="text-2xl shrink-0">🚫</span>
                <div>
                  <h3 className="font-bold text-white mb-1">Don't be a creep</h3>
                  <p className="text-sm text-zinc-400">No harassment, hate speech, or inappropriate behavior. We have zero tolerance.</p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <span className="text-2xl shrink-0">🤖</span>
                <div>
                  <h3 className="font-bold text-white mb-1">No bots allowed</h3>
                  <p className="text-sm text-zinc-400">This is for real humans only. If you're caught botting, instant ban.</p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <span className="text-2xl shrink-0">📸</span>
                <div>
                  <h3 className="font-bold text-white mb-1">Respect privacy</h3>
                  <p className="text-sm text-zinc-400">Don't share personal info, screenshots, or recordings. What happens in the chat stays in the chat.</p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <span className="text-2xl shrink-0">🎓</span>
                <div>
                  <h3 className="font-bold text-white mb-1">Students only</h3>
                  <p className="text-sm text-zinc-400">Verified .edu emails only. If you're not a student, this ain't for you.</p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <span className="text-2xl shrink-0">🚨</span>
                <div>
                  <h3 className="font-bold text-white mb-1">Three strikes policy</h3>
                  <p className="text-sm text-zinc-400">Get reported 3 times? You're out. Permanently.</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 mb-6">
              <input 
                type="checkbox" 
                id="accept-terms" 
                checked={acceptedTerms} 
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-emerald-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="accept-terms" className="text-sm text-zinc-300 cursor-pointer select-none">
                I promise to be cool, respectful, and follow the rules. I understand that breaking these rules means I'm out.
              </label>
            </div>
            
            <button 
              onClick={handleAcceptTerms}
              disabled={!acceptedTerms}
              className="btn-emerald w-full rounded-xl py-4"
            >
              Let's Go! 🔥
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- VIEW: MAIN APP WITH TABS ----
  if (currentView === "app") {
    return (
      <div className="flex flex-col h-screen bg-black overflow-hidden">
        <MobileNavbar onlineCount={onlineCount} onLogout={handleLogout} />
        <Toaster position="top-center" richColors theme="dark" />
        {showTimerModal && (
          <TimerModal 
            onClose={() => {
              setShowTimerModal(false);
              setPendingImage(null);
            }}
            onSelectTimer={sendImageWithTimer}
          />
        )}
        
        {/* MAIN CONTENT AREA */}
        <div className="flex-1 overflow-hidden pb-16">
          {/* HOME TAB - 1-on-1 Chat */}
          {activeTab === "home" && (
            isReadyToChat ? (
              <ChatView
                roomId={roomId}
                partnerInfo={partnerInfo}
                messages={messages}
                input={input}
                isPartnerTyping={isPartnerTyping}
                isSocketConnected={isSocketConnected}
                status={status}
                showTimeoutAlert={showTimeoutAlert}
                showGifPicker={showGifPicker}
                gifSearch={gifSearch}
                gifs={gifs}
                isSearchingGifs={isSearchingGifs}
                isPremium={isPremium}
                messagesEndRef={messagesEndRef}
                fileInputRef={fileInputRef}
                onTyping={handleTyping}
                onSendMessage={sendMessage}
                onReport={handleReport}
                onNextMatch={handleNextMatch}
                onShare={handleShare}
                onDisconnect={handleDisconnect}
                onShowGifPicker={() => { setShowGifPicker(true); loadTrendingGifs(); }}
                onCloseGifPicker={() => { setShowGifPicker(false); setGifSearch(""); setGifs([]); }}
                onSearchGifs={searchGifs}
                onSendGif={sendGif}
                onImageUpload={handleImageUpload}
                showPremiumPaywall={showPremiumPaywall}
                setGifSearch={setGifSearch}
                onEndChat={() => setIsReadyToChat(false)} 
                onHandleImageClick={handleImageClick} 
              />
            ) : (
              <StartChatView 
                isPremium={isPremium}
                filterGender={filterGender}
                setFilterGender={setFilterGender}
                filterCountry={filterCountry}
                setFilterCountry={setFilterCountry}
                filterUni={filterUni}
                setFilterUni={setFilterUni}
                filterMajor={filterMajor}
                setFilterMajor={setFilterMajor}
                onStartChat={() => setIsReadyToChat(true)}
                showPremiumPaywall={showPremiumPaywall}
                availableUniversities={availableUniversities}
                availableCities={availableCities}
              />
            )
          )}
          
          {/* CAMPUSES TAB */}
          {activeTab === "campuses" && (
            <CampusesView />
          )}
          
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <ProfileView
              displayName={displayName}
              email={user?.email}
              isPremium={isPremium}
              premiumUntil={premiumUntil}
              onLogout={handleLogout}
              onEditProfile={handleEditProfile}
              showEditProfile={showEditProfile}
              setDisplayName={setDisplayName}
              setGender={setGender}
              setMajor={setMajor}
              setCountry={setCountry}
              setCity={setCity}
              setUniversity={setUniversity}
              gender={gender}
              major={major}
              country={country}
              city={city}
              university={university}
              availableCities={availableCities}
              availableUniversities={availableUniversities}
              onSave={handleSaveEditedProfile}
              onCancel={() => setShowEditProfile(false)}
            />
          )}
        </div>
        
        {/* BOTTOM TAB BAR */}
        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  return null;
}

// ==================== COMPONENTS ====================

// Mobile Navbar
function MobileNavbar({ onlineCount, onLogout }: { onlineCount: number; onLogout: (() => void) | null }) {
  return (
    <nav className="w-full h-14 border-b border-white/5 bg-black/95 backdrop-blur-md flex items-center justify-between px-3 sm:px-4 shrink-0 z-50">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <img src="/logo.png" alt="Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
        <span className="font-bold text-white text-xs sm:text-sm tracking-tight">CampChat</span>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-3">
        {onlineCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 rounded-full border border-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-medium text-zinc-400">{onlineCount}</span>
          </div>
        )}
        {onLogout && (
          <button 
            onClick={onLogout} 
            className="text-[10px] font-medium text-zinc-500 hover:text-white transition-colors"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}

// Bottom Tab Bar
function BottomTabBar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: "home" | "campuses" | "profile") => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-2 z-50">
      <button
        onClick={() => onTabChange("home")}
        className={`flex flex-col items-center justify-center flex-1 py-2 rounded-xl transition-colors ${
          activeTab === "home" ? "text-emerald-400" : "text-zinc-500"
        }`}
      >
        <span className="text-xl mb-0.5">🏠</span>
        <span className="text-[10px] font-medium">Home</span>
      </button>
      
      <button
        onClick={() => onTabChange("campuses")}
        className={`flex flex-col items-center justify-center flex-1 py-2 rounded-xl transition-colors ${
          activeTab === "campuses" ? "text-emerald-400" : "text-zinc-500"
        }`}
      >
        <span className="text-xl mb-0.5">⛺</span>
        <span className="text-[10px] font-medium">Campuses</span>
      </button>
      
      <button
        onClick={() => onTabChange("profile")}
        className={`flex flex-col items-center justify-center flex-1 py-2 rounded-xl transition-colors ${
          activeTab === "profile" ? "text-emerald-400" : "text-zinc-500"
        }`}
      >
        <span className="text-xl mb-0.5">👤</span>
        <span className="text-[10px] font-medium">Profile</span>
      </button>
    </div>
  );
}

// START CHAT VIEW (New - with Premium Matching)
function StartChatView({ 
  isPremium, 
  filterGender, setFilterGender,
  filterCountry, setFilterCountry,
  filterUni, setFilterUni,
  filterMajor, setFilterMajor,
  onStartChat, 
  showPremiumPaywall, 
  availableUniversities,
  availableCities 
}: any) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 bg-black/20 overflow-y-auto">
      <div className="solid-panel w-full max-w-md rounded-2xl p-6 text-center my-auto">
        <div className="mb-6">
          <div className="inline-block rounded-full bg-emerald-500/10 p-6 border border-emerald-500/20 mb-4">
            <span className="text-5xl">💬</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Ready to Chat?</h2>
          <p className="text-sm text-zinc-400">Choose your matching preferences</p>
        </div>

        {/* FILTERS SECTION */}
        <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Filter: Gender */}
          <div className={`p-3 rounded-xl border transition-all ${
            isPremium 
              ? 'bg-emerald-500/5 border-emerald-500/20' 
              : 'bg-zinc-900/30 border-zinc-800 opacity-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Filter by Gender
              </label>
              {!isPremium && <span className="text-xs">🔒</span>}
            </div>
            <select 
              className="mobile-input input-solid w-full rounded-xl p-3 text-sm" 
              value={filterGender} 
              onChange={(e) => isPremium ? setFilterGender(e.target.value) : showPremiumPaywall()}
              disabled={!isPremium}
              onClick={() => !isPremium && showPremiumPaywall()}
            >
              <option value="Any">Any Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
            </select>
          </div>

          {/* Filter: Country */}
          <div className={`p-3 rounded-xl border transition-all ${
            isPremium 
              ? 'bg-emerald-500/5 border-emerald-500/20' 
              : 'bg-zinc-900/30 border-zinc-800 opacity-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Filter by Country
              </label>
              {!isPremium && <span className="text-xs">🔒</span>}
            </div>
            <select 
              className="mobile-input input-solid w-full rounded-xl p-3 text-sm" 
              value={filterCountry} 
              onChange={(e) => isPremium ? setFilterCountry(e.target.value) : showPremiumPaywall()}
              disabled={!isPremium}
              onClick={() => !isPremium && showPremiumPaywall()}
            >
              <option value="Any">Any Country</option>
              {Object.keys(COUNTRIES_CITIES).sort().map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Filter: University */}
          <div className={`p-4 rounded-xl border transition-all ${
            isPremium 
              ? 'bg-emerald-500/5 border-emerald-500/20' 
              : 'bg-zinc-900/30 border-zinc-800 opacity-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Filter by University
              </label>
              {!isPremium && <span className="text-xs">🔒</span>}
            </div>
            <select 
              className="mobile-input input-solid w-full rounded-xl p-3 text-sm" 
              value={filterUni} 
              onChange={(e) => isPremium ? setFilterUni(e.target.value) : showPremiumPaywall()}
              disabled={!isPremium}
              onClick={() => !isPremium && showPremiumPaywall()}
            >
              <option value="Any">Any University</option>
              {availableUniversities.map((u: string) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Filter: Major */}
          <div className={`p-4 rounded-xl border transition-all ${
            isPremium 
              ? 'bg-emerald-500/5 border-emerald-500/20' 
              : 'bg-zinc-900/30 border-zinc-800 opacity-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Filter by Major
              </label>
              {!isPremium && <span className="text-xs">🔒</span>}
            </div>
            <select 
              className="mobile-input input-solid w-full rounded-xl p-3 text-sm" 
              value={filterMajor} 
              onChange={(e) => isPremium ? setFilterMajor(e.target.value) : showPremiumPaywall()}
              disabled={!isPremium}
              onClick={() => !isPremium && showPremiumPaywall()}
            >
              <option value="Any">Any Major</option>
              {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

        </div>

        <button 
          onClick={onStartChat}
          className="btn-emerald w-full rounded-xl py-4 text-lg"
        >
          Start Chatting 🚀
        </button>
      </div>
    </div>
  );
}

// Chat View Component
function ChatView(props: any) {  // ✅ CORRECT // Add onEndChat here
  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="h-14 border-b border-white/5 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          {props.roomId && props.partnerInfo?.country && (
            <span className="text-base">{COUNTRY_FLAGS[props.partnerInfo.country]}</span>
          )}
          <div>
            <h2 className="font-bold text-white text-sm leading-tight">
              {props.roomId ? props.partnerInfo?.name : "Searching..."}
            </h2>
            {props.roomId && props.partnerInfo?.uni && (
              <span className="text-[9px] font-bold text-blue-400">{props.partnerInfo.uni}</span>
            )}
          </div>
        </div>

        <div className="flex gap-1">
          {props.roomId && (
            <>
              <button 
                onClick={props.onReport} 
                className="p-1.5 bg-red-500/10 text-red-400 rounded-lg text-[10px]"
              >
                🚩
              </button>
              <button 
                onClick={props.onNextMatch} 
                className="px-2 py-1 bg-white/5 text-white rounded-lg text-[10px] font-medium"
              >
                Skip
              </button>
            </>
          )}
          {/* NEW: End Chat button - always visible */}
          <button 
            onClick={props.onEndChat}
            className="px-2 py-1 bg-red-500/10 text-red-400 rounded-lg text-[10px] font-medium border border-red-500/20 hover:bg-red-500/20"
          >
            End Chat
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-black/20 pb-safe">
        {props.messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-zinc-600">
            <div className="mb-3 rounded-full bg-zinc-900 p-4 border border-white/5">
              <span className="text-2xl animate-pulse grayscale opacity-50">📡</span>
            </div>
            <p className="text-xs font-medium">Scanning frequency...</p>
          </div>
        )}
        {props.messages.map((m: any, i: number) => (
          <div key={i} className={`flex flex-col ${m.from === "me" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[85%] rounded-2xl overflow-hidden shadow-sm ${m.from === "me" ? "bg-emerald-600 text-white rounded-tr-none" : "bg-zinc-800 text-zinc-200 rounded-tl-none border border-white/5"}`}>
              {m.isGif ? (
                <img src={m.text} alt="GIF" className="max-w-full rounded-2xl" />
              ) : m.isImage ? (
                <div 
                  className="relative cursor-pointer"
                  onClick={() => m.isBlurred && props.onHandleImageClick(m.text, m.fileName, m.timerSeconds)}
                >
                  <img 
                    src={m.text} 
                    alt="Image" 
                    className={`max-w-full rounded-2xl transition-all ${
                      m.isBlurred ? 'blur-xl' : ''
                    }`}
                  />
                  {m.isBlurred && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black/70 px-4 py-2 rounded-full text-white text-sm font-bold">
                        Tap to view • {m.timerSeconds}s
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-3 py-2 text-sm">{m.text}</div>
              )}
            </div>
            <span className="text-[9px] text-zinc-600 mt-0.5 px-1">
              {m.from === "me" ? "Me" : props.partnerInfo?.name}
            </span>
          </div>
        ))}
        {props.isPartnerTyping && (
          <div className="flex items-center gap-2">
            <div className="flex space-x-1 rounded-2xl bg-zinc-900 border border-white/5 px-3 py-2 rounded-tl-none">
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce"></div>
            </div>
          </div>
        )}
        <div ref={props.messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-zinc-900/80 backdrop-blur-md border-t border-white/5 shrink-0 safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!props.roomId) {
                toast.error("Wait for a match first!");
                return;
              }
              props.onShowGifPicker();
            }}
            disabled={!props.roomId}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-lg disabled:opacity-50"
          >
            🎬
          </button>
          
          <button
            onClick={() => {
              if (!props.roomId) {
                toast.error("Wait for a match first!");
                return;
              }
              if (!props.isPremium) {
                props.showPremiumPaywall();
                return;
              }
              props.fileInputRef.current?.click();
            }}
            disabled={!props.roomId}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-lg disabled:opacity-50 relative"
          >
            📸
            {!props.isPremium && (
              <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>
            )}
          </button>
          <input 
            ref={props.fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={props.onImageUpload}
            className="hidden"
          />
          
          <input 
            className="mobile-input input-solid flex-1 rounded-xl px-3 py-2 text-sm" 
            placeholder={props.roomId ? "Type..." : "Waiting..."} 
            value={props.input} 
            onChange={props.onTyping} 
            onKeyDown={(e) => e.key === "Enter" && props.onSendMessage()}
            onFocus={() => {
              setTimeout(() => {
                props.messagesEndRef.current?.scrollIntoView({ 
                  behavior: "smooth", 
                  block: "end" 
                });
              }, 300);
            }}
            disabled={!props.roomId} 
          />
          <button 
            onClick={props.onSendMessage} 
            disabled={!props.roomId} 
            className="btn-emerald rounded-xl px-4 text-sm"
          >
            Send
          </button>
        </div>
      </div>
      
      {/* GIF Picker Modal */}
      {props.showGifPicker && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="solid-panel w-full max-w-lg rounded-xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-3 border-b border-white/10 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-white">Search GIFs</h3>
              <button 
                onClick={props.onCloseGifPicker}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="p-3 border-b border-white/10 shrink-0">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Search..."
                  className="mobile-input input-solid flex-1 rounded-lg p-2 text-sm"
                  value={props.gifSearch}
                  onChange={(e) => props.setGifSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && props.onSearchGifs(props.gifSearch)}
                />
                <button 
                  onClick={() => props.onSearchGifs(props.gifSearch)}
                  className="btn-emerald rounded-lg px-3 text-xs"
                >
                  Go
                </button>
              </div>
            </div>

            <div className="p-3 grid grid-cols-3 gap-2 overflow-y-auto flex-1">
              {props.isSearchingGifs ? (
                <div className="col-span-3 text-center text-zinc-500 py-4 text-xs">Loading...</div>
              ) : props.gifs.length === 0 ? (
                <div className="col-span-3 text-center text-zinc-500 py-4 text-xs">Search for GIFs</div>
              ) : (
                props.gifs.map((gif: any) => (
                  <button
                    key={gif.id}
                    onClick={() => props.onSendGif(gif.images.fixed_height.url)}
                    className="aspect-square rounded-lg overflow-hidden hover:opacity-80"
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
    </div>
  );
}
// Timer Selection Modal Component
function TimerModal({ onClose, onSelectTimer }: { onClose: () => void; onSelectTimer: (seconds: number) => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="solid-panel w-full max-w-sm rounded-2xl p-6 text-center">
        <h3 className="text-xl font-bold text-white mb-2">Choose Timer</h3>
        <p className="text-sm text-zinc-400 mb-6">Image will disappear after:</p>
        
        <div className="space-y-3">
          <button 
            onClick={() => onSelectTimer(10)}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all"
          >
            10 Seconds ⚡
          </button>
          <button 
            onClick={() => onSelectTimer(30)}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all"
          >
            30 Seconds ⏱️
          </button>
          <button 
            onClick={() => onSelectTimer(60)}
            className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all"
          >
            60 Seconds 🕐
          </button>
        </div>
        
        <button 
          onClick={onClose}
          className="mt-4 text-sm text-zinc-500 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
// Campuses View Component
function CampusesView() {
  const campuses = [
    { name: "Campus Social", icon: "🥂", color: "pink", desc: "Chill & banter", online: "1.2k" },
    { name: "Campus Career", icon: "💼", color: "blue", desc: "Network & grind", online: "850" },
    { name: "Campus Founder", icon: "🚀", color: "amber", desc: "Build & pitch", online: "420" },
    { name: "Campus Global", icon: "🌏", color: "teal", desc: "International vibes", online: "3.1k" },
    { name: "Campus Sports", icon: "⚽", color: "red", desc: "Match talk", online: "950" },
    { name: "Campus Study", icon: "📚", color: "indigo", desc: "Focus sessions", online: "1.5k" },
  ];
  
  return (
    <div className="h-full overflow-y-auto p-4 pb-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white mb-1">Find Your Tribe</h1>
        <p className="text-sm text-zinc-400">Join group chats for every aspect of uni life.</p>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {campuses.map((campus, i) => (
          <button
            key={i}
            onClick={() => toast("Coming soon! Campus rooms launching in v5 🔥")}
            className="p-4 rounded-2xl bg-zinc-900/50 border border-white/10 hover:border-emerald-500/30 transition-all text-left"
          >
            <div className="text-3xl mb-2">{campus.icon}</div>
            <h3 className="text-sm font-bold text-white mb-1">{campus.name}</h3>
            <p className="text-[10px] text-zinc-400 mb-3">{campus.desc}</p>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-emerald-400 font-bold">Join →</span>
              <span className="flex items-center gap-1 text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {campus.online}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Profile View Component
function ProfileView({ 
  displayName, email, isPremium, premiumUntil, onLogout, onEditProfile, showEditProfile,
  setDisplayName, setGender, setMajor, setCountry, setCity, setUniversity,
  gender, major, country, city, university,
  availableCities, availableUniversities, onSave, onCancel
}: any) {
  if (showEditProfile) {
    return (
      <div className="h-full overflow-y-auto p-4 pb-8">
        <div className="solid-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Edit Profile</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                Display Name
              </label>
              <input 
                className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
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
                  className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
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
                  className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
                  value={major} 
                  onChange={(e) => setMajor(e.target.value)}
                >
                  <option value="" disabled>Select</option>
                  {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                Country
              </label>
              <select 
                className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
                value={country} 
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="" disabled>Select Country</option>
                {Object.keys(COUNTRIES_CITIES).sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                City
              </label>
              <select 
                className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
                value={city} 
                onChange={(e) => setCity(e.target.value)}
                disabled={!country}
              >
                <option value="" disabled>
                  {country ? "Select City" : "Select Country First"}
                </option>
                {availableCities.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">
                University (Optional)
              </label>
              <select 
                className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
                value={university} 
                onChange={(e) => setUniversity(e.target.value)}
                disabled={!country}
              >
                <option value="">Skip for now</option>
                {availableUniversities.map((u: string) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mt-6">
              <button 
                onClick={onSave}
                className="btn-emerald flex-1 rounded-xl py-3"
              >
                Save Changes
              </button>
              <button 
                onClick={onCancel}
                className="px-6 py-3 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 pb-8">
      <div className="space-y-4">
        {/* Profile Card */}
        <div className="solid-panel rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-white">
            {displayName?.charAt(0)?.toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{displayName}</h2>
          <p className="text-xs text-zinc-500">{email}</p>
        </div>
        
        {/* Premium Status */}
        <div className={`solid-panel rounded-2xl p-6 ${isPremium ? "border-emerald-500/30" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Premium Status</h3>
            {isPremium ? (
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20">
                ACTIVE
              </span>
            ) : (
              <span className="px-2 py-1 bg-zinc-800 text-zinc-500 text-[10px] font-bold rounded-full">
                FREE
              </span>
            )}
          </div>
          
          {isPremium ? (
            <p className="text-xs text-zinc-400">
              Active until {premiumUntil?.toLocaleDateString()}
            </p>
          ) : (
            <div>
              <p className="text-xs text-zinc-400 mb-3">Unlock advanced filters, image uploads & more!</p>
              <button 
                onClick={() => toast("Stripe checkout coming soon!")}
                className="btn-emerald w-full rounded-xl py-2 text-sm"
              >
                Upgrade for $3/week
              </button>
            </div>
          )}
        </div>
        
        {/* Settings */}
        <div className="space-y-2">
          <button 
            onClick={onEditProfile}
            className="w-full p-4 rounded-xl bg-zinc-900/50 border border-white/10 text-left text-sm text-white hover:bg-zinc-900/80 transition-colors"
          >
            Edit Profile
          </button>
          <button className="w-full p-4 rounded-xl bg-zinc-900/50 border border-white/10 text-left text-sm text-white hover:bg-zinc-900/80 transition-colors">
            Restore Purchase
          </button>
          <button 
            onClick={onLogout}
            className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-left text-sm text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

// Landing Page Component (YOUR ORIGINAL)
function LandingPage({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-emerald-500/30 overflow-x-hidden">
      {/* 1. Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
            <span className="font-bold text-xl tracking-tight">CampChat</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onLoginClick} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Log In</button>
            <button onClick={onLoginClick} className="btn-emerald px-6 py-2.5 rounded-full text-sm">Join Now</button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <div className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left: Text Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Now
            </div>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">Campfire</span> for <br /> Uni Students.
            </h1>
            <p className="text-lg text-zinc-400 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Skip the awkward small talk. Connect anonymously with verified students from your university or around the world. Safe, exclusive, and totally free.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <button onClick={onLoginClick} className="btn-emerald px-8 py-4 rounded-xl text-lg w-full sm:w-auto">
                Start Chatting 🚀
              </button>
              <button onClick={onLoginClick} className="px-8 py-4 rounded-xl border border-white/10 hover:bg-white/5 transition-colors w-full sm:w-auto font-medium">
                View Demo
              </button>
            </div>
            <div className="mt-8 flex items-center justify-center lg:justify-start gap-4 text-xs text-zinc-500 font-medium">
              <div className="flex items-center gap-1"><span className="text-emerald-500">✓</span> Verified Students</div>
              <div className="flex items-center gap-1"><span className="text-emerald-500">✓</span> No Bots</div>
              <div className="flex items-center gap-1"><span className="text-emerald-500">✓</span> 100% Anonymous</div>
            </div>
          </div>

          {/* Right: Visual (Floating Chat Bubbles & Global Badges) */}
          <div className="relative h-[600px] hidden lg:block w-full">
            {/* 📱 Mock Phone */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-5 shadow-2xl rotate-[-6deg] hover:rotate-0 transition-transform duration-700 ease-out z-20">
              {/* Fake Header */}
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-lg">🦊</div>
                  <div>
                    <div className="h-2.5 w-24 bg-zinc-700 rounded-full mb-2"></div>
                    <div className="h-2 w-16 bg-zinc-800 rounded-full"></div>
                  </div>
                </div>
              </div>
              {/* Fake Messages */}
              <div className="space-y-4">
                <div className="bg-zinc-800/50 p-4 rounded-2xl rounded-tl-none border border-white/5 text-sm text-zinc-300">
                  Anyone doing CompSci at UTS? 💻
                </div>
                <div className="bg-emerald-600/20 p-4 rounded-2xl rounded-tr-none border border-emerald-500/20 text-sm text-emerald-100 ml-auto max-w-[85%]">
                  Yo! I'm struggling with Data Structures rn 😭
                </div>
                <div className="bg-zinc-800/50 p-4 rounded-2xl rounded-tl-none border border-white/5 text-sm text-zinc-300">
                  Haha same. Library study session?
                </div>
                <div className="bg-emerald-600/20 p-4 rounded-2xl rounded-tr-none border border-emerald-500/20 text-sm text-emerald-100 ml-auto max-w-[85%]">
                  I'm down! Meet at level 7?
                </div>
              </div>
              {/* Fake Input */}
              <div className="mt-6 bg-black/40 h-14 rounded-2xl border border-white/5"></div>
            </div>

            {/* 🌍 GLOBAL FLOATING BADGES */}
            {/* Top Left - Harvard */}
            <div className="absolute top-10 left-0 animate-bounce [animation-delay:0s] z-10">
              <div className="solid-panel px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-l-4 border-l-red-500">
                <span>🎓</span> Harvard
              </div>
            </div>

            {/* Top Right - Internships */}
            <div className="absolute top-20 right-[-20px] animate-pulse [animation-delay:1s] z-30">
              <div className="solid-panel px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-l-4 border-l-blue-500 shadow-xl">
                <span>💼</span> Tech Internships
              </div>
            </div>

            {/* Middle Left - Toronto */}
            <div className="absolute top-1/2 left-[-20px] animate-bounce [animation-delay:2s] z-30">
              <div className="solid-panel px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-l-4 border-l-red-400">
                <span>🇨🇦</span> Toronto
              </div>
            </div>

            {/* Middle Right - AI Club */}
            <div className="absolute top-[40%] right-[-10px] animate-pulse [animation-delay:1.5s] z-10">
              <div className="solid-panel px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-l-4 border-l-purple-500">
                <span>🤖</span> AI Club
              </div>
            </div>

            {/* Bottom Left - London */}
            <div className="absolute bottom-20 left-10 animate-bounce [animation-delay:3s] z-30">
              <div className="solid-panel px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-l-4 border-l-indigo-500">
                <span>🇬🇧</span> London
              </div>
            </div>

            {/* Bottom Right - NYC */}
            <div className="absolute bottom-10 right-20 animate-pulse [animation-delay:0.5s] z-30">
              <div className="solid-panel px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-l-4 border-l-yellow-500">
                <span>🇺🇸</span> NYC
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Features Grid */}
      <div className="max-w-7xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: "🛡️", title: "Uni Verified", desc: "No randoms. We require a valid student email to ensure you're chatting with real peers." },
            { icon: "🎭", title: "Truly Anonymous", desc: "Express yourself freely. No profiles, no history, no footprint. Just the vibe." },
            { icon: "⚡", title: "Instant Match", desc: "Filter by University or go Global. Find your crowd in seconds." }
          ].map((f, i) => (
            <div key={i} className="p-6 rounded-2xl bg-zinc-900/30 border border-white/5 hover:border-emerald-500/30 transition-colors">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. THE CAMPUSES */}
      <div className="py-24 relative overflow-hidden border-t border-white/5 bg-zinc-900/20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Find Your <span className="text-emerald-400">Tribe</span>.</h1>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Introducing our <span className="text-emerald-400">Campus</span> by Campchat</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Don't just chat 1-on-1. Jump into massive, dedicated group campuses for every aspect of university life.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Campus Social */}
            <div className="group relative p-8 rounded-3xl bg-black border border-white/10 hover:border-pink-500/50 transition-all duration-500 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300">🥂</div>
                <h3 className="text-2xl font-bold text-white mb-2">Campus Social</h3>
                <p className="text-zinc-400 text-sm mb-6">The digital pub. Chill vibes, banter, and making friends outside your degree.</p>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-xs font-bold text-pink-400 uppercase tracking-wider">Join Room →</span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 1.2k Online</span>
                </div>
              </div>
            </div>

            {/* Campus Career */}
            <div className="group relative p-8 rounded-3xl bg-black border border-white/10 hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300">💼</div>
                <h3 className="text-2xl font-bold text-white mb-2">Campus Career</h3>
                <p className="text-zinc-400 text-sm mb-6">Network & grind. Resume roasts, internship hunting, and corporate advice.</p>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Join Room →</span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 850 Online</span>
                </div>
              </div>
            </div>

            {/* Campus Entrepreneur */}
            <div className="group relative p-8 rounded-3xl bg-black border border-white/10 hover:border-amber-500/50 transition-all duration-500 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300">🚀</div>
                <h3 className="text-2xl font-bold text-white mb-2">Campus Founder</h3>
                <p className="text-zinc-400 text-sm mb-6">The startup lab. Find co-founders, pitch ideas, and break things.</p>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Join Room →</span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 420 Online</span>
                </div>
              </div>
            </div>

            {/* Campus International */}
            <div className="group relative p-8 rounded-3xl bg-black border border-white/10 hover:border-teal-500/50 transition-all duration-500 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300">🌏</div>
                <h3 className="text-2xl font-bold text-white mb-2">Campus Global</h3>
                <p className="text-zinc-400 text-sm mb-6">For international students. Home away from home, visa help, and culture swap.</p>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Join Room →</span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 3.1k Online</span>
                </div>
              </div>
            </div>

            {/* Campus Sports */}
            <div className="group relative p-8 rounded-3xl bg-black border border-white/10 hover:border-red-500/50 transition-all duration-500 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-500/5 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300">⚽</div>
                <h3 className="text-2xl font-bold text-white mb-2">Campus Sports</h3>
                <p className="text-zinc-400 text-sm mb-6">The locker room. Match discussions, finding gym buddies, and team banter.</p>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Join Room →</span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 950 Online</span>
                </div>
              </div>
            </div>

            {/* Campus Study */}
            <div className="group relative p-8 rounded-3xl bg-black border border-white/10 hover:border-indigo-500/50 transition-all duration-500 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300">📚</div>
                <h3 className="text-2xl font-bold text-white mb-2">Campus Study</h3>
                <p className="text-zinc-400 text-sm mb-6">The quiet zone. Focus sessions, homework help, and exam prep groups.</p>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Join Room →</span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 1.5k Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Footer */}
      <footer className="border-t border-white/5 py-12 text-center text-zinc-600 text-sm">
        <p>&copy; {new Date().getFullYear()} CampChat. Built for students.</p>
      </footer>
    </div>
  );
}
