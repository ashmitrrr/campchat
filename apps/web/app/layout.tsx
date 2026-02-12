import "./globals.css";

export const metadata = {
  title: "CampChat - The Campfire for Uni Students",
  description: "Skip the awkward small talk. Connect anonymously with verified students from your university or around the world. Safe, exclusive, and totally free.",
  keywords: "university chat, student chat, anonymous chat, college social, campus social network, student community",
  authors: [{ name: "CampChat" }],
  
  // Open Graph
  openGraph: {
    title: "CampChat - The Campfire for Uni Students",
    description: "Connect anonymously with verified students from your university. Safe, exclusive, and totally free.",
    url: "https://campchat.app",
    siteName: "CampChat",
    images: [
      {
        url: "https://campchat.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "CampChat - The Campfire for University Students",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  
  // Twitter
  twitter: {
    card: "summary_large_image",
    title: "CampChat - The Campfire for Uni Students",
    description: "Connect anonymously with verified students. Safe, exclusive, and free.",
    images: ["https://campchat.app/og-image.png"],
  },
  
  // Icons
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
  
  // SEO
  robots: {
    index: true,
    follow: true,
  },
  
  // 🔥 CRITICAL: Mobile viewport configuration to prevent zoom
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1, // Prevents pinch zoom
    userScalable: false, // Prevents zoom
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Additional mobile optimization */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen bg-black text-white">{children}</body>
    </html>
  );
}
