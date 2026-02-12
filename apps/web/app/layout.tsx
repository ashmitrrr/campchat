import "./globals.css"; // 👈 This connects the "Jungle" theme

export const metadata = {
  title: "CampChat - The Campfire for Uni Students",
  description: "Skip the awkward small talk. Connect anonymously with verified students from your university or around the world. Safe, exclusive, and totally free.",
  keywords: "university chat, student chat, anonymous chat, college social, campus social network",
  authors: [{ name: "CampChat" }],
  openGraph: {
    title: "CampChat - The Campfire for Uni Students",
    description: "Connect anonymously with verified students from your university. Safe, exclusive, and totally free.",
    url: "https://campchat.app",
    siteName: "CampChat",
    images: [
      {
        url: "https://campchat.app/og-image.png", // You'll need to create this
        width: 1200,
        height: 630,
        alt: "CampChat - University Student Chat",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CampChat - The Campfire for Uni Students",
    description: "Connect anonymously with verified students. Safe, exclusive, and free.",
    images: ["https://campchat.app/og-image.png"], // Same image as above
  },
  icons: {
    icon: "/logo.png", // Your logo as favicon
    apple: "/logo.png", // For iPhone home screen
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">{children}</body>
    </html>
  );
}