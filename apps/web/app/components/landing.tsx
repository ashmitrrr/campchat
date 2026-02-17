// Location: /apps/web/app/components/landing.tsx
"use client";

interface LandingPageProps {
  onLoginClick: () => void;
}

export function LandingPage({ onLoginClick }: LandingPageProps) {
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
            {/* LOG IN → Links to /waitlist */}
            <a href="/waitlist" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Join Waitlist</a>
            
            {/* JOIN NOW → Links to login */}
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
                Start Chatting 
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
