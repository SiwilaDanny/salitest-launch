import "./globals.css";

export const metadata = {
  title: "SaLiTeSt Launch — App Testing Marketplace",
  description:
    "Connect with verified testers to meet Google Play Store and Apple App Store testing requirements. Launch your app with confidence.",
  keywords: "app testing, beta testing, Play Store, App Store, closed testing, TestFlight",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="salitest" suppressHydrationWarning>
      <body className="min-h-screen bg-base-300">{children}</body>
    </html>
  );
}
