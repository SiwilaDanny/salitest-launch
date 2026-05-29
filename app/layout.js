import "./globals.css";

export const metadata = {
  title: "SaLiTeSt Launch — App Testing Marketplace",
  description:
    "Connect with verified testers to meet Google Play Store and Apple App Store testing requirements. Launch your app with confidence.",
  keywords: "app testing, beta testing, Play Store, App Store, closed testing, TestFlight",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
