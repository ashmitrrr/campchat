"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PremiumCancel() {
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => {
      router.push("/");
    }, 3000);
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white px-6">
      <div className="text-6xl mb-6">😢</div>
      <h1 className="text-2xl font-bold mb-2">Maybe next time</h1>
      <p className="text-zinc-400 text-center mb-6">
        You cancelled the upgrade. CampChat Premium is still just $3/week — less than your coffee.
      </p>
      <button
        onClick={() => router.push("/")}
        className="px-6 py-3 bg-white text-black rounded-full font-semibold text-sm"
      >
        Back to CampChat
      </button>
    </div>
  );
}