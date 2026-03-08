"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function PremiumSuccess() {
  const router = useRouter();

  useEffect(() => {
    toast.success("💎 You're Premium! Welcome to the club.");
    setTimeout(() => {
      router.push("/");
    }, 3000);
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white px-6">
      <div className="text-6xl mb-6">💎</div>
      <h1 className="text-2xl font-bold mb-2">You're Premium!</h1>
      <p className="text-zinc-400 text-center mb-6">
        Welcome to CampChat Premium. Enjoy advanced filters, image sharing, and more.
      </p>
      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      <p className="text-zinc-600 text-sm mt-4">Redirecting you back...</p>
    </div>
  );
}