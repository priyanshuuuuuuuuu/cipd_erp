import "./globals.css";
import "./Dashboard.css";
import { Providers } from "./providers";

export const metadata = {
  title: "CIPD 360 - Academic ERP",
  description: "Academic ERP System for CIPD 360",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CiPD 360", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport = { themeColor: '#1d2d65', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
