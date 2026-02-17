// Location: /apps/web/app/waitlist/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { toast, Toaster } from "sonner";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    if (!email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Save to Supabase
      const { error } = await supabase
        .from("waitlist")
        .insert({
          email: email.toLowerCase().trim(),
          name: name.trim() || null,
          university: university.trim() || null,
          created_at: new Date().toISOString()
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("You're already on the waitlist!");
        } else {
          console.error("Waitlist error:", error);
          toast.error("Something went wrong. Please try again.");
        }
        setLoading(false);
        return;
      }

      // Step 2: Send confirmation email
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      // Success!
      setSubmitted(true);
      toast.success("Welcome to the waitlist! 🎉");
      
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("Failed to join waitlist. Please try again.");
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <Toaster position="top-center" richColors theme="dark" />
        <div className="text-center max-w-md">
          <div className="mb-6 inline-block rounded-full bg-emerald-500/10 p-6 border border-emerald-500/20">
            <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-4xl font-bold mb-4">You're In!</h1>
          <p className="text-lg text-zinc-400 mb-8">
            Thanks for joining the CampChat waitlist. We'll email you when we launch!
          </p>
          <a 
            href="/"
            className="inline-block px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-center" richColors theme="dark" />
      
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
            <span className="font-bold text-xl tracking-tight">CampChat</span>
          </a>
          <a 
            href="/"
            className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            ← Back
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex items-center justify-center p-6 pt-20">
        <div className="w-full max-w-md">
          {/* Background Gradient */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>

          <div className="solid-panel rounded-2xl p-8 relative">
            <div className="text-center mb-8">
              <div className="mb-4 inline-block rounded-full bg-emerald-500/10 p-4 border border-emerald-500/20">
                <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Join the Waitlist</h1>
              <p className="text-zinc-400 text-sm">
                Be the first to know when CampChat launches at your university.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 block mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="you@university.edu"
                  className="mobile-input input-solid w-full rounded-xl p-4"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 block mb-2">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="mobile-input input-solid w-full rounded-xl p-4"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 block mb-2">
                  University (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Harvard, MIT, Stanford"
                  className="mobile-input input-solid w-full rounded-xl p-4"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-emerald w-full rounded-xl py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Joining..." : "Join Waitlist 🚀"}
              </button>
            </form>

            <p className="text-center text-xs text-zinc-600 mt-6">
              We'll email you when CampChat is ready for your campus.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
