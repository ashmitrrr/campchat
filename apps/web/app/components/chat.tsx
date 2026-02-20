// Location: /apps/web/app/components/chat.tsx
"use client";

import { RefObject } from "react";
import { toast } from "sonner";
import { COUNTRY_FLAGS, COUNTRIES_CITIES } from "../lib/countries";
import { MAJORS } from "../lib/constants";
import { getChatThemeBg } from "./profile";

// ==================== TIMER MODAL ====================

interface TimerModalProps {
  onClose: () => void;
  onSelectTimer: (seconds: number) => void;
}

export function TimerModal({ onClose, onSelectTimer }: TimerModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="solid-panel w-full max-w-sm rounded-2xl p-6 text-center">
        <h3 className="text-xl font-bold text-white mb-2">Choose Timer</h3>
        <p className="text-sm text-zinc-400 mb-6">Image will disappear after:</p>
        <div className="space-y-3">
          <button onClick={() => onSelectTimer(10)} className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all">10 Seconds ⚡</button>
          <button onClick={() => onSelectTimer(30)} className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all">30 Seconds ⏱️</button>
          <button onClick={() => onSelectTimer(60)} className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all">60 Seconds 🕐</button>
        </div>
        <button onClick={onClose} className="mt-4 text-sm text-zinc-500 hover:text-white">Cancel</button>
      </div>
    </div>
  );
}

// ==================== START CHAT VIEW ====================

interface StartChatViewProps {
  isPremium: boolean;
  filterGender: string;
  setFilterGender: (gender: string) => void;
  filterCountry: string;
  setFilterCountry: (country: string) => void;
  filterUni: string;
  setFilterUni: (uni: string) => void;
  filterMajor: string;
  setFilterMajor: (major: string) => void;
  onStartChat: () => void;
  showPremiumPaywall: () => void;
  availableUniversities: string[];
  availableCities: string[];
}

export function StartChatView({ 
  isPremium, 
  filterGender, setFilterGender,
  filterCountry, setFilterCountry,
  filterUni, setFilterUni,
  filterMajor, setFilterMajor,
  onStartChat, 
  showPremiumPaywall, 
  availableUniversities,
  availableCities 
}: StartChatViewProps) {
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

        <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {/* Filter: Gender */}
          <div className={`p-3 rounded-xl border transition-all ${isPremium ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900/30 border-zinc-800 opacity-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Filter by Gender</label>
              {!isPremium && <span className="text-xs">🔒</span>}
            </div>
            <select className="mobile-input input-solid w-full rounded-xl p-3 text-sm" value={filterGender} onChange={(e) => isPremium ? setFilterGender(e.target.value) : showPremiumPaywall()} disabled={!isPremium} onClick={() => !isPremium && showPremiumPaywall()}>
              <option value="Any">Any Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
            </select>
          </div>

          {/* Filter: Country */}
          <div className={`p-3 rounded-xl border transition-all ${isPremium ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900/30 border-zinc-800 opacity-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Filter by Country</label>
              {!isPremium && <span className="text-xs">🔒</span>}
            </div>
            <select className="mobile-input input-solid w-full rounded-xl p-3 text-sm" value={filterCountry} onChange={(e) => isPremium ? setFilterCountry(e.target.value) : showPremiumPaywall()} disabled={!isPremium} onClick={() => !isPremium && showPremiumPaywall()}>
              <option value="Any">Any Country</option>
              {Object.keys(COUNTRIES_CITIES).sort().map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Filter: University */}
          <div className={`p-4 rounded-xl border transition-all ${isPremium ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900/30 border-zinc-800 opacity-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Filter by University</label>
              {!isPremium && <span className="text-xs">🔒</span>}
            </div>
            <select className="mobile-input input-solid w-full rounded-xl p-3 text-sm" value={filterUni} onChange={(e) => isPremium ? setFilterUni(e.target.value) : showPremiumPaywall()} disabled={!isPremium} onClick={() => !isPremium && showPremiumPaywall()}>
              <option value="Any">Any University</option>
              {availableUniversities.map((u: string) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Filter: Major */}
          <div className={`p-4 rounded-xl border transition-all ${isPremium ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900/30 border-zinc-800 opacity-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Filter by Major</label>
              {!isPremium && <span className="text-xs">🔒</span>}
            </div>
            <select className="mobile-input input-solid w-full rounded-xl p-3 text-sm" value={filterMajor} onChange={(e) => isPremium ? setFilterMajor(e.target.value) : showPremiumPaywall()} disabled={!isPremium} onClick={() => !isPremium && showPremiumPaywall()}>
              <option value="Any">Any Major</option>
              {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <button onClick={onStartChat} className="btn-emerald w-full rounded-xl py-4 text-lg">Start Chatting 🚀</button>
      </div>
    </div>
  );
}

// ==================== CHAT VIEW ====================

interface Message {
  text: string;
  ts: number;
  from: "me" | "partner";
  isGif?: boolean;
  isImage?: boolean;
  isBlurred?: boolean;
  timerSeconds?: number;
  fileName?: string;
}

interface ChatViewProps {
  roomId: string | null;
  partnerInfo: { uni: string; name: string; country: string; profilePic?: string } | null;
  messages: Message[];
  input: string;
  isPartnerTyping: boolean;
  isSocketConnected: boolean;
  status: string;
  showTimeoutAlert: boolean;
  showGifPicker: boolean;
  gifSearch: string;
  gifs: any[];
  isSearchingGifs: boolean;
  isPremium: boolean;
  messagesEndRef: RefObject<HTMLDivElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  onTyping: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendMessage: () => void;
  onReport: () => void;
  onNextMatch: () => void;
  onShare: () => void;
  onDisconnect: () => void;
  onShowGifPicker: () => void;
  onCloseGifPicker: () => void;
  onSearchGifs: (query: string) => void;
  onSendGif: (url: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showPremiumPaywall: () => void;
  setGifSearch: (search: string) => void;
  onEndChat: () => void;
  onHandleImageClick: (url: string, fileName: string, timerSeconds: number) => void;
  chatTheme: number;
  myProfilePic: string | null;
}

export function ChatView(props: ChatViewProps) {
  const themeBgData = getChatThemeBg(props.chatTheme);

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="h-14 border-b border-white/5 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          {/* Partner Profile Pic or Flag */}
          {props.roomId && props.partnerInfo ? (
            props.partnerInfo.profilePic ? (
              <img 
                src={props.partnerInfo.profilePic} 
                alt="Partner" 
                className="w-8 h-8 rounded-full object-cover border border-white/10"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold text-white">
                {props.partnerInfo.name?.charAt(0)?.toUpperCase()}
              </div>
            )
          ) : null}
          {props.roomId && props.partnerInfo?.country && !props.partnerInfo?.profilePic && (
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
              <button onClick={props.onReport} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg text-[10px]">🚩</button>
              <button onClick={props.onNextMatch} className="px-2 py-1 bg-white/5 text-white rounded-lg text-[10px] font-medium">Skip</button>
            </>
          )}
          <button onClick={props.onEndChat} className="px-2 py-1 bg-red-500/10 text-red-400 rounded-lg text-[10px] font-medium border border-red-500/20 hover:bg-red-500/20">
            End Chat
          </button>
        </div>
      </div>

      {/* Messages Area - Theme Applied Here */}
      <div 
        className={`flex-1 overflow-y-auto p-3 space-y-2 pb-safe relative ${themeBgData.className}`}
        style={themeBgData.style}
      >
        {/* Overlay for readability on image themes */}
        {props.chatTheme > 1 && (
          <div className="absolute inset-0 bg-black/30 pointer-events-none z-0" />
        )}
        
        {props.messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-zinc-600 relative z-10">
            <div className="mb-3 rounded-full bg-zinc-900/80 p-4 border border-white/5">
              <span className="text-2xl animate-pulse grayscale opacity-50">📡</span>
            </div>
            <p className="text-xs font-medium">Scanning frequency...</p>
          </div>
        )}

        <div className="relative z-10 space-y-2">
          {props.messages.map((m: any, i: number) => (
            <div key={i} className={`flex flex-col ${m.from === "me" ? "items-end" : "items-start"}`}>
              {/* Show my profile pic next to my messages */}
              <div className={`flex items-end gap-1.5 ${m.from === "me" ? "flex-row-reverse" : "flex-row"}`}>
                {m.from === "me" && props.myProfilePic && (
                  <img src={props.myProfilePic} alt="Me" className="w-5 h-5 rounded-full object-cover flex-shrink-0 mb-1" />
                )}
                {m.from === "partner" && props.partnerInfo?.profilePic && (
                  <img src={props.partnerInfo.profilePic} alt="Partner" className="w-5 h-5 rounded-full object-cover flex-shrink-0 mb-1" />
                )}
                <div className={`max-w-[85%] rounded-2xl overflow-hidden shadow-sm ${
                  m.from === "me" 
                    ? "bg-emerald-600 text-white rounded-tr-none" 
                    : "bg-zinc-800/90 text-zinc-200 rounded-tl-none border border-white/5"
                }`}>
                  {m.isGif ? (
                    <img src={m.text} alt="GIF" className="max-w-full rounded-2xl" />
                  ) : m.isImage ? (
                    <div className="relative cursor-pointer" onClick={() => m.isBlurred && props.onHandleImageClick(m.text, m.fileName, m.timerSeconds)}>
                      <img src={m.text} alt="Image" className={`max-w-full rounded-2xl transition-all ${m.isBlurred ? 'blur-xl' : ''}`} />
                      {m.isBlurred && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/70 px-4 py-2 rounded-full text-white text-sm font-bold">Tap to view • {m.timerSeconds}s</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm">{m.text}</div>
                  )}
                </div>
              </div>
              <span className="text-[9px] text-zinc-500 mt-0.5 px-1">
                {m.from === "me" ? "Me" : props.partnerInfo?.name}
              </span>
            </div>
          ))}
        </div>

        {props.isPartnerTyping && (
          <div className="flex items-center gap-2 relative z-10">
            <div className="flex space-x-1 rounded-2xl bg-zinc-900/80 border border-white/5 px-3 py-2 rounded-tl-none">
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
            onClick={() => { if (!props.roomId) { toast.error("Wait for a match first!"); return; } props.onShowGifPicker(); }}
            disabled={!props.roomId}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-lg disabled:opacity-50"
          >
            🎬
          </button>
          <button
            onClick={() => {
              if (!props.roomId) { toast.error("Wait for a match first!"); return; }
              if (!props.isPremium) { props.showPremiumPaywall(); return; }
              props.fileInputRef.current?.click();
            }}
            disabled={!props.roomId}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-lg disabled:opacity-50 relative"
          >
            📸
            {!props.isPremium && <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>}
          </button>
          <input ref={props.fileInputRef} type="file" accept="image/jpeg,image/png,image/gif" onChange={props.onImageUpload} className="hidden" />
          
          <input 
            className="mobile-input input-solid flex-1 rounded-xl px-3 py-2 text-sm" 
            placeholder={props.roomId ? "Type..." : "Waiting..."} 
            value={props.input} 
            onChange={props.onTyping} 
            onKeyDown={(e) => e.key === "Enter" && props.onSendMessage()}
            onFocus={() => { setTimeout(() => { props.messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, 300); }}
            disabled={!props.roomId} 
          />
          <button onClick={props.onSendMessage} disabled={!props.roomId} className="btn-emerald rounded-xl px-4 text-sm">Send</button>
        </div>
      </div>
      
      {/* GIF Picker Modal */}
      {props.showGifPicker && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="solid-panel w-full max-w-lg rounded-xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-3 border-b border-white/10 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-white">Search GIFs</h3>
              <button onClick={props.onCloseGifPicker} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div className="p-3 border-b border-white/10 shrink-0">
              <div className="flex gap-2">
                <input 
                  type="text" placeholder="Search..." 
                  className="mobile-input input-solid flex-1 rounded-lg p-2 text-sm"
                  value={props.gifSearch}
                  onChange={(e) => props.setGifSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && props.onSearchGifs(props.gifSearch)}
                />
                <button onClick={() => props.onSearchGifs(props.gifSearch)} className="btn-emerald rounded-lg px-3 text-xs">Go</button>
              </div>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2 overflow-y-auto flex-1">
              {props.isSearchingGifs ? (
                <div className="col-span-3 text-center text-zinc-500 py-4 text-xs">Loading...</div>
              ) : props.gifs.length === 0 ? (
                <div className="col-span-3 text-center text-zinc-500 py-4 text-xs">Search for GIFs</div>
              ) : (
                props.gifs.map((gif: any) => (
                  <button key={gif.id} onClick={() => props.onSendGif(gif.images.fixed_height.url)} className="aspect-square rounded-lg overflow-hidden hover:opacity-80">
                    <img src={gif.images.fixed_height.url} alt={gif.title} className="w-full h-full object-cover" />
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
