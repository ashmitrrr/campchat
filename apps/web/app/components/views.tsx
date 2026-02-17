// Location: /apps/web/app/components/views.tsx
"use client";

import { Toaster } from "sonner";
import { COUNTRIES_CITIES } from "../lib/countries";
import { MAJORS, GENDERS } from "../lib/constants";
import { MobileNavbar } from "./profile";

// ==================== LOGIN VIEW ====================

interface LoginViewProps {
  onlineCount: number;
  emailInput: string;
  setEmailInput: (email: string) => void;
  otpInput: string;
  setOtpInput: (otp: string) => void;
  showOtpInput: boolean;
  setShowOtpInput: (show: boolean) => void;
  loading: boolean;
  handleSendCode: () => void;
  handleVerifyCode: () => void;
  onBackToLanding: () => void;
}

export function LoginView({
  onlineCount,
  emailInput,
  setEmailInput,
  otpInput,
  setOtpInput,
  showOtpInput,
  setShowOtpInput,
  loading,
  handleSendCode,
  handleVerifyCode,
  onBackToLanding
}: LoginViewProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black">
      <MobileNavbar onlineCount={onlineCount} onLogout={null} />
      <Toaster position="top-center" richColors theme="dark" />
      
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <button 
          onClick={onBackToLanding}
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
                onClick={() => { setShowOtpInput(false); }} 
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

// ==================== PROFILE SETUP ====================

interface ProfileSetupProps {
  onlineCount: number;
  displayName: string;
  setDisplayName: (name: string) => void;
  gender: string;
  setGender: (gender: string) => void;
  major: string;
  setMajor: (major: string) => void;
  country: string;
  setCountry: (country: string) => void;
  city: string;
  setCity: (city: string) => void;
  university: string;
  setUniversity: (uni: string) => void;
  availableCities: string[];
  availableUniversities: string[];
  handleStartChat: () => void;
  handleLogout: () => void;
}

export function ProfileSetup({
  onlineCount,
  displayName,
  setDisplayName,
  gender,
  setGender,
  major,
  setMajor,
  country,
  setCountry,
  city,
  setCity,
  university,
  setUniversity,
  availableCities,
  availableUniversities,
  handleStartChat,
  handleLogout
}: ProfileSetupProps) {
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

// ==================== TERMS VIEW ====================

interface TermsViewProps {
  onlineCount: number;
  acceptedTerms: boolean;
  setAcceptedTerms: (accepted: boolean) => void;
  handleAcceptTerms: () => void;
  handleLogout: () => void;
}

export function TermsView({
  onlineCount,
  acceptedTerms,
  setAcceptedTerms,
  handleAcceptTerms,
  handleLogout
}: TermsViewProps) {
  return (
    <div className="flex flex-col h-screen bg-black">
      <MobileNavbar onlineCount={onlineCount} onLogout={handleLogout} />
      <Toaster position="top-center" richColors theme="dark" />
      
      <div className="flex-1 flex flex-col items-center justify-center p-4 pb-24">
        <div className="solid-panel w-full max-w-2xl rounded-2xl p-6 sm:p-8 relative overflow-hidden">
          <h1 className="text-3xl font-bold text-white mb-2">The Vibe Check AKA T&C</h1>
          <p className="text-zinc-400 text-sm mb-6">Quick rules before you enter the CampChat</p>
          
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar mb-6">
            <div className="flex gap-3 items-start">
              <span className="text-2xl shrink-0">1.</span>
              <div>
                <h3 className="font-bold text-white mb-1">Don't be a creep</h3>
                <p className="text-sm text-zinc-400">No harassment, hate speech, or inappropriate behavior. We have zero tolerance.</p>
              </div>
            </div>
            
            <div className="flex gap-3 items-start">
              <span className="text-2xl shrink-0">2.</span>
              <div>
                <h3 className="font-bold text-white mb-1">No bots allowed</h3>
                <p className="text-sm text-zinc-400">This is for real humans only. If you're caught botting, instant ban.</p>
              </div>
            </div>
            
            <div className="flex gap-3 items-start">
              <span className="text-2xl shrink-0">3.</span>
              <div>
                <h3 className="font-bold text-white mb-1">Respect privacy</h3>
                <p className="text-sm text-zinc-400">Don't share personal info, screenshots, or recordings. What happens in the chat stays in the chat.</p>
              </div>
            </div>
            
            <div className="flex gap-3 items-start">
              <span className="text-2xl shrink-0">4.</span>
              <div>
                <h3 className="font-bold text-white mb-1">Students only</h3>
                <p className="text-sm text-zinc-400">Verified .edu emails only. If you're not a student, this is not for you.</p>
              </div>
            </div>
            
            <div className="flex gap-3 items-start">
              <span className="text-2xl shrink-0">5.</span>
              <div>
                <h3 className="font-bold text-white mb-1">Three strikes policy</h3>
                <p className="text-sm text-zinc-400">Get reported 3 times? You're out. Permanently.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-2xl shrink-0">6.</span>
              <div>
                <h3 className="font-bold text-white mb-1">Moderation</h3>
                <p className="text-sm text-zinc-400">We have both AI and human moderation to ensure every chat stays respectful.</p>
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
