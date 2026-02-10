export const metadata = {
  title: "CampChat",
  description: "Uni-only anonymous chat that doesn’t suck.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
