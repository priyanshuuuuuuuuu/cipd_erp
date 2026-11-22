'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Calendar, QrCode, CheckCircle, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AttendanceQrScanner from './AttendanceQrScanner';

const studentRoutes = ['/dashboard', '/calendar', '/attendance', '/notifications', '/grades', '/teachers', '/feedback', '/leaderboard', '/courses', '/settings', '/profile'];
const moreLinks = [
  ['/notifications', 'Reminders & notifications'], ['/grades', 'Grades'], ['/courses', 'Courses'],
  ['/teachers', 'Teachers'], ['/feedback', 'Feedback'], ['/leaderboard', 'Leaderboard'],
  ['/profile', 'Profile'], ['/settings', 'Settings'],
];

export default function StudentMobileNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const enabled = user?.role === 'student' && studentRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => { setMoreOpen(false); setScannerOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.classList.toggle('has-student-mobile-nav', enabled);
    return () => document.body.classList.remove('has-student-mobile-nav');
  }, [enabled]);
  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = event => { if (event.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [moreOpen]);
  if (!enabled) return null;

  return <>
    {scannerOpen && <AttendanceQrScanner onClose={() => { setScannerOpen(false); router.refresh(); }} />}
    {moreOpen && <div className="student-more-backdrop" onClick={() => setMoreOpen(false)}>
      <div className="student-more-sheet" role="dialog" aria-modal="true" aria-label="More student pages" onClick={event => event.stopPropagation()}>
        <div className="student-more-heading"><strong>More</strong><button type="button" aria-label="Close menu" onClick={() => setMoreOpen(false)}><X size={20} /></button></div>
        <div className="student-more-links">{moreLinks.map(([href, label]) => <Link href={href} key={href} onClick={() => setMoreOpen(false)}>{label}</Link>)}</div>
      </div>
    </div>}
    <nav className="student-bottom-nav" aria-label="Student navigation">
      <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''} aria-current={pathname === '/dashboard' ? 'page' : undefined}><LayoutGrid size={20} /><span>Home</span></Link>
      <Link href="/calendar" className={pathname === '/calendar' ? 'active' : ''} aria-current={pathname === '/calendar' ? 'page' : undefined}><Calendar size={20} /><span>Calendar</span></Link>
      <button type="button" className="student-bottom-scan" onClick={() => setScannerOpen(true)}><QrCode size={21} /><span>Scan</span></button>
      <Link href="/attendance" className={pathname === '/attendance' ? 'active' : ''} aria-current={pathname === '/attendance' ? 'page' : undefined}><CheckCircle size={20} /><span>Attendance</span></Link>
      <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}><Menu size={20} /><span>More</span></button>
    </nav>
  </>;
}
