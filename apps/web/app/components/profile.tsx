"use client";

import { useRef, RefObject } from "react";
import { toast } from "sonner";
import { COUNTRIES_CITIES } from "../lib/countries";
import { MAJORS, GENDERS } from "../lib/constants";

export const CHAT_THEMES = [
  { id: 1, name: "Default", preview: "bg-black", free: true },
  { id: 2, name: "Midnight", preview: "bg-zinc-900", free: true },
  { id: 3, name: "Forest", preview: "bg-emerald-950", free: false },
  { id: 4, name: "Sunset", preview: "bg-orange-950", free: false },
  { id: 5, name: "Galaxy", preview: "bg-purple-950", free: false },
];

export function getChatThemeBg(themeId: number): { className: string; style?: React.CSSProperties } {
  switch (themeId) {
    case 1: 
      return { className: "bg-black" };
    case 2: 
      return { 
        className: "", 
        style: { 
          backgroundImage: "url('/themes/bg2.png')", 
          backgroundSize: "cover", 
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        } 
      };
    case 3: 
      return { 
        className: "", 
        style: { 
          backgroundImage: "url('/themes/bg3.png')", 
          backgroundSize: "cover", 
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        } 
      };
    case 4: 
      return { 
        className: "", 
        style: { 
          backgroundImage: "url('/themes/bg4.png')", 
          backgroundSize: "cover", 
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        } 
      };
    case 5: 
      return { 
        className: "", 
        style: { 
          backgroundImage: "url('/themes/bg5.png')", 
          backgroundSize: "cover", 
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        } 
      };
    default: 
      return { className: "bg-black" };
  }
}

interface MobileNavbarProps {
  onlineCount: number;
  onLogout: (() => void) | null;
}

export function MobileNavbar({ onlineCount, onLogout }: MobileNavbarProps) {
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

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tab: "home" | "campuses" | "profile") => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
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

// 🔥 Helper function to parse @mentions
function parseMessage(text: string, users: { name: string }[]): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /@(\w+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const mentionedName = match[1];
    const isValidUser = users.some(u => u.name.toLowerCase() === mentionedName.toLowerCase());

    parts.push(
      <span 
        key={match.index} 
        className={isValidUser ? "text-blue-400 font-bold bg-blue-500/10 px-1 rounded" : ""}
      >
        @{mentionedName}
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

interface CampusesViewProps {
  onJoinCampus: (campusId: string) => void;
  activeCampusId: string | null;
  campusMessages: {
    text: string;
    ts: number;
    from: string;
    email: string;
    profilePic?: string;
    isGif?: boolean;
    isImage?: boolean;
  }[];
  campusUsers: {
    name: string;
    uni: string;
    profilePic?: string;
  }[];
  campusInput: string;
  setCampusInput: (input: string) => void;
  onSendMessage: () => void;
  onLeaveCampus: () => void;
  messagesEndRef: RefObject<HTMLDivElement>;
  myProfilePic: string | null;
  myEmail: string | null;
}

export function CampusesView({
  onJoinCampus,
  activeCampusId,
  campusMessages,
  campusUsers,
  campusInput,
  setCampusInput,
  onSendMessage,
  onLeaveCampus,
  messagesEndRef,
  myProfilePic,
  myEmail
}: CampusesViewProps) {
  const campuses = [
    { id: "campus-social", name: "Campus Social", icon: "🥂", color: "pink", desc: "Chill & banter" },
    { id: "campus-career", name: "Campus Career", icon: "💼", color: "blue", desc: "Network & grind" },
    { id: "campus-founder", name: "Campus Founder", icon: "🚀", color: "amber", desc: "Build & pitch" },
    { id: "campus-global", name: "Campus Global", icon: "🌏", color: "teal", desc: "International vibes" },
    { id: "campus-sports", name: "Campus Sports", icon: "⚽", color: "red", desc: "Match talk" },
    { id: "campus-study", name: "Campus Study", icon: "📚", color: "indigo", desc: "Focus sessions" },
  ];
  
  if (activeCampusId) {
    const campus = campuses.find(c => c.id === activeCampusId);
    
    return (
      <div className="flex flex-col h-full">
        <div className="h-14 border-b border-white/5 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{campus?.icon}</span>
            <div>
              <h2 className="font-bold text-white text-sm">{campus?.name}</h2>
              <span className="text-[9px] text-zinc-400">{campusUsers.length} online</span>
            </div>
          </div>
          <button 
            onClick={onLeaveCampus}
            className="px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-[10px] font-medium border border-red-500/20"
          >
            Leave
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-safe bg-black">
          {campusMessages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-zinc-600">
              <div className="mb-3 rounded-full bg-zinc-900/80 p-4 border border-white/5">
                <span className="text-2xl">{campus?.icon}</span>
              </div>
              <p className="text-xs font-medium">No messages yet. Say hi! 👋</p>
            </div>
          )}

          {campusMessages.map((msg, i) => {
            const isMe = msg.email === myEmail;
            return (
              <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  {msg.profilePic ? (
                    <img src={msg.profilePic} alt={msg.from} className="w-5 h-5 rounded-full object-cover flex-shrink-0 mb-1" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mb-1">
                      {msg.from.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl overflow-hidden shadow-sm ${
                    isMe 
                      ? "bg-emerald-600 text-white rounded-tr-none" 
                      : "bg-zinc-800/90 text-zinc-200 rounded-tl-none border border-white/5"
                  }`}>
                    {msg.isGif ? (
                      <img src={msg.text} alt="GIF" className="max-w-full rounded-2xl" />
                    ) : (
                      <div className="px-3 py-2 text-sm">
                        {parseMessage(msg.text, campusUsers)}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[9px] text-zinc-500 mt-0.5 px-1">{msg.from}</span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-zinc-900/80 backdrop-blur-md border-t border-white/5 shrink-0 safe-bottom">
          <div className="flex gap-2">
            <input 
              className="mobile-input input-solid flex-1 rounded-xl px-3 py-2 text-sm" 
              placeholder="Type... (use @username to mention)" 
              value={campusInput} 
              onChange={(e) => setCampusInput(e.target.value)} 
              onKeyDown={(e) => e.key === "Enter" && onSendMessage()}
            />
            <button onClick={onSendMessage} className="btn-emerald rounded-xl px-4 text-sm">Send</button>
          </div>
          <p className="text-[9px] text-zinc-500 mt-1 px-1">Tip: Type @name to mention someone</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 pb-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white mb-1">Find Your Tribe</h1>
        <p className="text-sm text-zinc-400">Join group chats for every aspect of uni life.</p>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {campuses.map((campus) => (
          <button
            key={campus.id}
            onClick={() => onJoinCampus(campus.id)}
            className="p-4 rounded-2xl bg-zinc-900/50 border border-white/10 hover:border-emerald-500/30 transition-all text-left"
          >
            <div className="text-3xl mb-2">{campus.icon}</div>
            <h3 className="text-sm font-bold text-white mb-1">{campus.name}</h3>
            <p className="text-[10px] text-zinc-400 mb-3">{campus.desc}</p>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-emerald-400 font-bold">Join →</span>
              <span className="flex items-center gap-1 text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ProfileViewProps {
  displayName: string;
  email: string;
  isPremium: boolean;
  premiumUntil: Date | null;
  onLogout: () => void;
  onEditProfile: () => void;
  showEditProfile: boolean;
  setDisplayName: (name: string) => void;
  setGender: (gender: string) => void;
  setMajor: (major: string) => void;
  setCountry: (country: string) => void;
  setCity: (city: string) => void;
  setUniversity: (uni: string) => void;
  gender: string;
  major: string;
  country: string;
  city: string;
  university: string;
  availableCities: string[];
  availableUniversities: string[];
  onSave: () => void;
  onCancel: () => void;
  profilePic: string | null;
  onProfilePicUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  chatTheme: number;
  onThemeChange: (themeId: number) => void;
  isPremiumForTheme: boolean;
  // 💎 NEW PAYPAL PROPS
  onUpgradeToPremium: () => void;
  isUpgrading: boolean;
}

export function ProfileView({ 
  displayName, email, isPremium, premiumUntil, onLogout, onEditProfile, showEditProfile,
  setDisplayName, setGender, setMajor, setCountry, setCity, setUniversity,
  gender, major, country, city, university,
  availableCities, availableUniversities, onSave, onCancel,
  profilePic, onProfilePicUpload,
  chatTheme, onThemeChange, isPremiumForTheme,
  onUpgradeToPremium, isUpgrading
}: ProfileViewProps) {
  const picInputRef = useRef<HTMLInputElement>(null);

  if (showEditProfile) {
    return (
      <div className="h-full overflow-y-auto p-4 pb-8">
        <div className="solid-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Edit Profile</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Display Name</label>
              <input 
                className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Gender</label>
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
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Major</label>
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
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Country</label>
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
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">City</label>
              <select 
                className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
                value={city} 
                onChange={(e) => setCity(e.target.value)}
                disabled={!country}
              >
                <option value="" disabled>{country ? "Select City" : "Select Country First"}</option>
                {availableCities.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">University (Optional)</label>
              <select 
                className="mobile-input input-solid w-full mt-1 rounded-xl p-3" 
                value={university} 
                onChange={(e) => setUniversity(e.target.value)}
                disabled={!country}
              >
                <option value="">Skip for now</option>
                {availableUniversities.map((u: string) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={onSave} className="btn-emerald flex-1 rounded-xl py-3">Save Changes</button>
              <button onClick={onCancel} className="px-6 py-3 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 pb-8">
      <div className="space-y-4">
        <div className="solid-panel rounded-2xl p-6 text-center">
          <div className="relative w-20 h-20 mx-auto mb-3">
            {profilePic ? (
              <img 
                src={profilePic} 
                alt="Profile" 
                className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500/30"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-3xl font-bold text-white">
                {displayName?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <button
              onClick={() => picInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs border-2 border-black hover:bg-emerald-400 transition-colors"
            >
              📷
            </button>
            <input
              ref={picInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onProfilePicUpload}
              className="hidden"
            />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{displayName}</h2>
          <p className="text-xs text-zinc-500">{email}</p>
          <p className="text-[10px] text-zinc-600 mt-1">Tap 📷 to change photo</p>
        </div>

        {/* 💎 PREMIUM STATUS CARD */}
        <div className={`solid-panel rounded-2xl p-6 ${isPremium ? "border-emerald-500/30" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Premium Status</h3>
            {isPremium ? (
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20">ACTIVE</span>
            ) : (
              <span className="px-2 py-1 bg-zinc-800 text-zinc-500 text-[10px] font-bold rounded-full">FREE</span>
            )}
          </div>
          {isPremium ? (
            <p className="text-xs text-zinc-400">Active until {premiumUntil?.toLocaleDateString()}</p>
          ) : (
            <div>
              <p className="text-xs text-zinc-400 mb-1">Unlock advanced filters, image uploads & more!</p>
              <p className="text-[10px] text-zinc-500 mb-3">☕ Coffee is $5. This is $3/week. Be smart.</p>
              <button 
                onClick={onUpgradeToPremium}
                disabled={isUpgrading}
                className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold rounded-xl text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:from-yellow-300 hover:to-amber-400 transition-all"
              >
                {isUpgrading ? "Redirecting to PayPal..." : "💎 Upgrade — $3/week via PayPal"}
              </button>
            </div>
          )}
        </div>

        <div className="solid-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Chat Theme</h3>
            <span className="text-[10px] text-zinc-500">2 free · 3 premium</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {CHAT_THEMES.map((theme) => {
              const isLocked = !theme.free && !isPremiumForTheme;
              const isActive = chatTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => onThemeChange(theme.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                    isActive 
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : 'border-white/10 bg-zinc-900/50 hover:border-white/20'
                  }`}
                >
                  <div 
                    className={`w-10 h-10 rounded-lg overflow-hidden border border-white/10 ${theme.preview}`}
                    style={theme.id > 1 ? { backgroundImage: `url('/themes/bg${theme.id}.png')`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                  />
                  <span className="text-[9px] text-zinc-400 font-medium">{theme.name}</span>
                  {isLocked && (
                    <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>
                  )}
                  {isActive && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[8px] text-white">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

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