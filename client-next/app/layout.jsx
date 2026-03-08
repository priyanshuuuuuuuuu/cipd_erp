import './globals.css';
import './Dashboard.css';

export const metadata = {
  title: 'CIPD 360 — Academic ERP',
  description: 'Academic ERP System for CIPD 360',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
