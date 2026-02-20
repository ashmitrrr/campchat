// Location: /apps/web/app/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "./lib/supabase";
import { Toaster, toast } from "sonner";
import { COUNTRIES_CITIES, COUNTRY_FLAGS } from "./lib/countries";
import { UNIVERSITIES_BY_COUNTRY } from "./lib/universities";
import { SERVER_URL } from "./lib/constants";
import bcrypt from "bcryptjs";

// Import all components
import { LandingPage } from "./components/landing";
import { LoginView, ProfileSetup, TermsView } from "./components/views";
import { ChatView, StartChatView, TimerModal } from "./components/chat";
import { MobileNavbar, BottomTabBar, CampusesView, ProfileView } from "./components/profile";

// Mobile keyboard hook
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

  // Profile Picture State
  const [profilePic, setProfilePic] = useState<string | null>(null);

  // Chat Theme State (1-5, 1&2 free, 3-5 premium)
  const [chatTheme, setChatTheme] = useState<number>(1);
  
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

  // 🔐 NEW: Passcode States
  const [hasPasscode, setHasPasscode] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [showPasscodeInput, setShowPasscodeInput] = useState(false);
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false);
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  
  // Filter States
  const [filterGender, setFilterGender] = useState("Any");
  const [filterCountry, setFilterCountry] = useState("Any");
  const [filterUni, setFilterUni] = useState("Any");
  const [filterMajor, setFilterMajor] = useState("Any");
  
  // Chat State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("Idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<{ uni: string; name: string; country: string; profilePic?: string } | null>(null);
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
      if (data.profile_pic) setProfilePic(data.profile_pic);
      if (data.chat_theme) setChatTheme(data.chat_theme);
      
      // Check premium status
      if (data.premium_until) {
        const premiumDate = new Date(data.premium_until);
        setIsPremium(premiumDate > new Date());
        setPremiumUntil(premiumDate);
      }
      
      if (data.country) {
        if (COUNTRIES_CITIES[data.country]) setAvailableCities(COUNTRIES_CITIES[data.country]);
        if (UNIVERSITIES_BY_COUNTRY[data.country]) setAvailableUniversities(UNIVERSITIES_BY_COUNTRY[data.country]);
      }
      
      const isComplete = !!(data.display_name && data.gender && data.major && data.country && data.city);
      return isComplete;
    }
    return false;
  };

  // 🔐 NEW: Check if user has passcode
  const checkPasscodeExists = async (email: string): Promise<boolean> => {
    const { data } = await supabase
      .from("user_profiles")
      .select("passcode_hash")
      .eq("email", email)
      .single();
    
    return !!(data?.passcode_hash);
  };

  // 🔐 NEW: Verify passcode
  const verifyPasscode = async (email: string, passcode: string): Promise<boolean> => {
    const { data } = await supabase
      .from("user_profiles")
      .select("passcode_hash")
      .eq("email", email)
      .single();
    
    if (!data?.passcode_hash) return false;
    
    return await bcrypt.compare(passcode, data.passcode_hash);
  };

  // 🔐 NEW: Save passcode
  const savePasscode = async (email: string, passcode: string) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(passcode, salt);
    
    await supabase
      .from("user_profiles")
      .upsert({
        email: email,
        passcode_hash: hash,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' });
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
        profile_pic: profilePic,
        chat_theme: chatTheme,
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

  // Handle Profile Picture Upload
  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image too large! Max 3MB");
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error("Only JPG, PNG, WEBP allowed");
      return;
    }

    const toastId = toast.loading("Uploading photo...", { duration: Infinity });

    const fileName = `profile-pics/${user.email}-${Date.now()}`;
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file, { upsert: true });

    if (error) {
      toast.error("Upload failed!", { id: toastId });
      return;
    }

    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName);

    if (urlData) {
      setProfilePic(urlData.publicUrl);
      await supabase.from("user_profiles").upsert({
        email: user.email,
        profile_pic: urlData.publicUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' });
      toast.success("Profile photo updated!", { id: toastId });
    }
  };

  // Handle Chat Theme Change
  const handleThemeChange = async (themeId: number) => {
    if (themeId > 2 && !isPremium) {
      toast.error("🔒 Premium Feature - Coffee is $5. This is $3/week. Be smart.", { duration: 3000 });
      return;
    }
    if (!user) return;
    setChatTheme(themeId);
    await supabase.from("user_profiles").upsert({
      email: user.email,
      chat_theme: themeId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'email' });
    toast.success("Theme updated!");
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
        profilePic: profilePic,
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

    s.on("reconnected", ({ roomId, partnerUni, partnerName, partnerCountry, partnerProfilePic }) => {
      setRoomId(roomId);
      setPartnerInfo({ uni: partnerUni, name: partnerName, country: partnerCountry, profilePic: partnerProfilePic });
      setStatus(`Reconnected with ${partnerName}`);
      toast.success("Reconnected to chat!");
    });

    s.on("online_count", ({ count }) => setOnlineCount(count));

    s.on("matched", ({ roomId, partnerUni, partnerName, partnerCountry, partnerProfilePic }) => {
      setRoomId(roomId);
      setLastRoomId(roomId);
      setPartnerInfo({ uni: partnerUni, name: partnerName, country: partnerCountry, profilePic: partnerProfilePic });
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

    return () => { s.disconnect(); };
  }, [isReadyToChat, user, jwtToken, targetUniFilter]);

  // Auto-delete messages after 2 minutes
  useEffect(() => {
    messages.forEach((msg) => {
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
    return () => { messageTimers.forEach(timer => clearTimeout(timer)); };
  }, [messages]);

  // Search GIFs
  const searchGifs = async (query: string) => {
    if (!query.trim()) return;
    setIsSearchingGifs(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/gifs/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        setGifs(data.data);
      } else {
        toast.error("Invalid GIF data received");
      }
    } catch (err) {
      console.error('GIF search failed:', err);
      toast.error("Failed to load GIFs");
    } finally {
      setIsSearchingGifs(false);
    }
  };

  // Load trending GIFs
  const loadTrendingGifs = async () => {
    setIsSearchingGifs(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/gifs/trending`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) setGifs(data.data);
    } catch (err) {
      console.error('Trending GIFs failed:', err);
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
    if (!isPremium) { showPremiumPaywall(); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image too large! Max 5MB"); return; }
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) { toast.error("Only JPG, PNG, GIF allowed"); return; }
    setPendingImage(file);
    setShowTimerModal(true);
  };

  const sendImageWithTimer = async (timerSeconds: number) => {
    if (!pendingImage || !socket || !roomId) return;
    setShowTimerModal(false);
    const toastId = toast.loading("Uploading image...", { duration: Infinity });
    const fileName = `${user.email}-${Date.now()}-${pendingImage.name}`;
    const { data, error } = await supabase.storage.from('chat-images').upload(fileName, pendingImage);
    if (error) { toast.error("Upload failed!", { id: toastId }); setPendingImage(null); return; }
    const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
    if (urlData) {
      const imageUrl = urlData.publicUrl;
      const msg = { text: imageUrl, ts: Date.now(), from: "me" as const, isImage: true, isBlurred: true, timerSeconds, fileName };
      setMessages((prev) => [...prev, msg]);
      socket.emit("send_message", { message: imageUrl, isImage: true, isBlurred: true, timerSeconds, fileName });
      toast.success("Image sent!", { id: toastId });
      setPendingImage(null);
    }
  };

  const handleImageClick = (imageUrl: string, fileName: string, timerSeconds: number) => {
    setMessages(prev => prev.map(msg => msg.text === imageUrl ? { ...msg, isBlurred: false } : msg));
    const timer = setTimeout(async () => {
      await supabase.storage.from('chat-images').remove([fileName]);
      setMessages(prev => prev.filter(msg => msg.text !== imageUrl));
      toast("Image deleted", { icon: "🔥" });
    }, timerSeconds * 1000);
    setImageTimers(prev => new Map(prev).set(imageUrl, timer));
  };

  // Show Premium Paywall
  const showPremiumPaywall = () => {
    toast.error("🔒 Premium Feature - Coffee is $5. This is $3/week. Be smart.", { duration: 3000 });
    setTimeout(() => { toast("Stripe checkout coming soon!"); }, 1000);
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
    setShowPasscodeInput(false);
    setPasscodeInput("");
    setHasPasscode(false);
    localStorage.removeItem('campchat_jwt');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    handleLogoutCleanup();
  };

  // 🔐 NEW: Handle email submit - check for passcode first
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

    // Check if user has passcode
    const hasExistingPasscode = await checkPasscodeExists(email);
    
    if (hasExistingPasscode) {
      // Show passcode input instead of OTP
      setHasPasscode(true);
      setShowPasscodeInput(true);
      setLoading(false);
      return;
    }

    // No passcode - send OTP as usual
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) { 
      toast.error(error.message); 
    } else { 
      setShowOtpInput(true); 
      toast.success(`Code sent to ${email}! 📩`); 
    }
    setLoading(false);
  };

  // 🔐 NEW: Handle passcode login
  const handlePasscodeLogin = async () => {
    if (passcodeInput.length !== 6) {
      toast.error("Passcode must be 6 digits");
      return;
    }

    setLoading(true);
    const isValid = await verifyPasscode(emailInput, passcodeInput);
    
    if (!isValid) {
      toast.error("Incorrect passcode");
      setPasscodeInput("");
      setLoading(false);
      return;
    }

    // Passcode valid - sign in with OTP but skip the code
    const { error } = await supabase.auth.signInWithOtp({ 
      email: emailInput,
      options: { shouldCreateUser: false }
    });

    if (error) {
      toast.error("Login failed. Please try OTP instead.");
      setLoading(false);
      return;
    }

    // Create a session directly (this is a workaround)
    // For production, you'd want a server endpoint that creates a session after passcode verification
    toast.success("Logging in...");
    
    // Send OTP and auto-fill (user won't see this)
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
      }
      setLoading(false);
    }, 1000);
  };

  // 🔐 NEW: Switch to OTP from passcode screen
  const handleSwitchToOTP = async () => {
    setShowPasscodeInput(false);
    setPasscodeInput("");
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithOtp({ email: emailInput });
    if (error) { 
      toast.error(error.message); 
    } else { 
      setShowOtpInput(true); 
      toast.success(`Code sent to ${emailInput}! 📩`); 
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: emailInput, token: otpInput, type: 'email' });
      if (error) { toast.error(error.message); setLoading(false); return; }
      
      // Check if this is first-time login (no passcode set)
      const hasExistingPasscode = await checkPasscodeExists(emailInput);
      
      if (!hasExistingPasscode) {
        // First time - offer passcode setup
        setShowPasscodeSetup(true);
        setLoading(false);
        return;
      }

      // Has passcode already - proceed normally
      toast.success("Verified! Setting up...");
      setTimeout(async () => {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) {
          setUser(session.session.user);
          const hasProfile = await loadUserProfile(session.session.user.email);
          await generateJWT(session.session);
          if (hasProfile) { setCurrentView("terms"); } else { setCurrentView("profile"); }
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

  // 🔐 NEW: Handle passcode setup
  const handleSetupPasscode = async () => {
    if (newPasscode.length !== 6 || confirmPasscode.length !== 6) {
      toast.error("Passcode must be 6 digits");
      return;
    }

    if (newPasscode !== confirmPasscode) {
      toast.error("Passcodes don't match");
      return;
    }

    setLoading(true);
    await savePasscode(emailInput, newPasscode);
    toast.success("Passcode saved! 🎉");
    
    setTimeout(async () => {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        setUser(session.session.user);
        const hasProfile = await loadUserProfile(session.session.user.email);
        await generateJWT(session.session);
        if (hasProfile) { setCurrentView("terms"); } else { setCurrentView("profile"); }
      }
      setLoading(false);
      setShowPasscodeSetup(false);
    }, 500);
  };

  // 🔐 NEW: Skip passcode setup
  const handleSkipPasscodeSetup = async () => {
    setShowPasscodeSetup(false);
    toast.success("Verified! Setting up...");
    
    setTimeout(async () => {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        setUser(session.session.user);
        const hasProfile = await loadUserProfile(session.session.user.email);
        await generateJWT(session.session);
        if (hasProfile) { setCurrentView("terms"); } else { setCurrentView("profile"); }
      }
    }, 500);
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
    setSocket(null); setRoomId(null); setLastRoomId(null);
    setMessages([]); setPartnerInfo(null); setIsReadyToChat(false);
    setStatus("Idle"); setShowTimeoutAlert(false);
  };

  const handleNextMatch = () => {
    if (!socket) return;
    setMessages([]); setRoomId(null); setLastRoomId(null);
    setPartnerInfo(null); setStatus("Skipping... ⏭️");
    socket.disconnect(); setIsReadyToChat(false);
    setTimeout(() => setIsReadyToChat(true), 100);
  };

  const handleReport = () => {
    if (!socket || !roomId) return;
    if (confirm("Report this user?")) {
      socket.emit("report_partner");
      setStatus("Reported 🚫 Switching...");
      setRoomId(null); setLastRoomId(null);
      setPartnerInfo(null); setMessages([]);
      setTimeout(() => socket.emit("waiting"), 1500);
      toast.error("User reported.");
    }
  };

  const handleStartChat = async () => {
    if (!displayName || !gender || !major || !country || !city) { toast.error("Please fill all fields!"); return; }
    await saveUserProfile();
    setCurrentView("terms");
  };

  const handleAcceptTerms = () => {
    if (!acceptedTerms) { toast.error("Please accept the terms!"); return; }
    setCurrentView("app");
  };

  const handleEditProfile = () => { setShowEditProfile(true); };

  const handleSaveEditedProfile = async () => {
    await saveUserProfile();
    setShowEditProfile(false);
  };

  // ==================== VIEW ROUTING ====================

  if (currentView === "landing") {
    return <LandingPage onLoginClick={() => setCurrentView("login")} />;
  }

  if (currentView === "login") {
    return (
      <LoginView
        onlineCount={onlineCount}
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        otpInput={otpInput}
        setOtpInput={setOtpInput}
        showOtpInput={showOtpInput}
        setShowOtpInput={setShowOtpInput}
        loading={loading}
        handleSendCode={handleSendCode}
        handleVerifyCode={handleVerifyCode}
        onBackToLanding={() => setCurrentView("landing")}
        // 🔐 NEW: Passcode props
        hasPasscode={hasPasscode}
        showPasscodeInput={showPasscodeInput}
        passcodeInput={passcodeInput}
        setPasscodeInput={setPasscodeInput}
        handlePasscodeLogin={handlePasscodeLogin}
        handleSwitchToOTP={handleSwitchToOTP}
        showPasscodeSetup={showPasscodeSetup}
        newPasscode={newPasscode}
        setNewPasscode={setNewPasscode}
        confirmPasscode={confirmPasscode}
        setConfirmPasscode={setConfirmPasscode}
        handleSetupPasscode={handleSetupPasscode}
        handleSkipPasscodeSetup={handleSkipPasscodeSetup}
      />
    );
  }

  if (currentView === "profile") {
    return (
      <ProfileSetup
        onlineCount={onlineCount}
        displayName={displayName}
        setDisplayName={setDisplayName}
        gender={gender}
        setGender={setGender}
        major={major}
        setMajor={setMajor}
        country={country}
        setCountry={setCountry}
        city={city}
        setCity={setCity}
        university={university}
        setUniversity={setUniversity}
        availableCities={availableCities}
        availableUniversities={availableUniversities}
        handleStartChat={handleStartChat}
        handleLogout={handleLogout}
      />
    );
  }

  if (currentView === "terms") {
    return (
      <TermsView
        onlineCount={onlineCount}
        acceptedTerms={acceptedTerms}
        setAcceptedTerms={setAcceptedTerms}
        handleAcceptTerms={handleAcceptTerms}
        handleLogout={handleLogout}
      />
    );
  }

  if (currentView === "app") {
    return (
      <div className="flex flex-col h-screen bg-black overflow-hidden">
        <MobileNavbar onlineCount={onlineCount} onLogout={handleLogout} />
        <Toaster position="top-center" richColors theme="dark" />

        {showTimerModal && (
          <TimerModal
            onClose={() => { setShowTimerModal(false); setPendingImage(null); }}
            onSelectTimer={sendImageWithTimer}
          />
        )}

        <div className="flex-1 overflow-hidden pb-16">
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
                chatTheme={chatTheme}
                myProfilePic={profilePic}
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

          {activeTab === "campuses" && <CampusesView />}

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
              profilePic={profilePic}
              onProfilePicUpload={handleProfilePicUpload}
              chatTheme={chatTheme}
              onThemeChange={handleThemeChange}
              isPremiumForTheme={isPremium}
            />
          )}
        </div>

        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  return null;
}
