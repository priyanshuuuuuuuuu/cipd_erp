import './globals.css';
import './Dashboard.css';
import { Providers } from './providers';

export const metadata = {
  title: 'CIPD 360 — Academic ERP',
  description: 'Academic ERP System for CIPD 360',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
