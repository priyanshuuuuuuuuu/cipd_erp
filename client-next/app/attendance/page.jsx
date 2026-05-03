'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Bell, Search, Menu, ChevronLeft, ChevronRight,
    CheckCircle, XCircle, Clock, AlertCircle, Filter, Flame, Wifi, WifiOff, TrendingUp, Trophy
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

const Donut = ({ pct, size = 120, stroke = 10, color = '#66d9e8', bg = '#f0f0f0' }) => {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
    );
};

const MiniDonut = ({ pct, size = 44, stroke = 5, color }) => {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
    );
};

export default function AttendancePage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState('all');
    const [currentCalendarMonth, setCurrentCalendarMonth] = useState(null);
    const [weeklyPage, setWeeklyPage] = useState(0);

    // Live data
    const [summaryData, setSummaryData] = useState(null);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // Presence indicator
    const [presence, setPresence] = useState({ present: false, signal: 0, lastUpdated: null });

    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const fetchData = useCallback(async () => {
        try {
            const [sumRes, sesRes, presRes] = await Promise.allSettled([
                api.get('/api/students/attendance/summary'),
                api.get(`/api/students/attendance/sessions?limit=300`),
                api.get('/api/students/attendance/presence'),
            ]);
            if (sumRes.status === 'fulfilled') setSummaryData(sumRes.value);
            if (sesRes.status === 'fulfilled') setSessionHistory(sesRes.value.sessions || []);
            if (presRes.status === 'fulfilled') setPresence(presRes.value);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchData(); }, [fetchData, authReady]);

    // Set today's date on mount for calendar
    useEffect(() => {
        setCurrentCalendarMonth(new Date());
    }, []);

    // Build from API data
    const overall = {
        total: summaryData?.overall?.total || 0,
        attended: summaryData?.overall?.attended || 0,
        absent: summaryData?.overall?.absent || 0,
        leave: summaryData?.overall?.leave || 0,
        pct: summaryData?.overall?.pct || 0,
    };
    const streak = summaryData?.streak || 0;
    const courses = (summaryData?.courses || []).map((c, i) => ({
        code: c.course_code || `C${i + 1}`,
        name: c.course_name,
        faculty: c.faculty || '',
        total: c.total || 0,
        attended: c.attended || 0,
        absent:   c.absent  || 0,
        leave:    c.leave   || 0,
        pct: c.pct || 0,
        color: ['#66d9e8', '#a78bfa', '#93c5fd', '#f9a8d4', '#fdba74'][i % 5],
    }));

    // Sessions from API
    const sessions = sessionHistory.map((s, i) => {
        const sess = s.sessions || {};
        const sessionDate = sess.session_date ? new Date(sess.session_date + 'T00:00:00') : null;
        const courseName = sess.courses?.name || '';
        const courseCode = courseName ? courseName.split(/[\s&]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 4).toUpperCase() : `C${i + 1}`;
        return {
            date: sessionDate ? sessionDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A',
            day: sessionDate ? sessionDate.toLocaleDateString('en-GB', { weekday: 'short' }) : '',
            startTime: sess.start_time ? sess.start_time.slice(0, 5) : '',
            endTime: sess.end_time ? sess.end_time.slice(0, 5) : '',
            course: courseCode,
            courseName: courseName,
            topic: sess.title || courseName || 'Session',
            status: s.status === 'present' || s.status === 'present_online' || s.status === 'half' ? 'Present' : 'Absent',
            pings: s.ping_count != null ? s.ping_count : 0,
            points: s.points != null ? s.points : null,
        };
    });

    const filtered = selectedCourse === 'all' ? sessions : sessions.filter(s => s.course === selectedCourse);
    const statusTextColor = (p) => p >= 85 ? '#166534' : p >= 75 ? '#854d0e' : '#9f1239';
    const statusBg = (p) => p >= 85 ? '#ecfccb' : p >= 75 ? '#fef9c3' : '#fce7f3';
    const statusLabel = (p) => p >= 85 ? 'On Track' : p >= 75 ? 'Needs Attention' : 'At Risk';

    // Calendar
    const calYear = currentCalendarMonth ? currentCalendarMonth.getFullYear() : 2026;
    const calMonth = currentCalendarMonth ? currentCalendarMonth.getMonth() : 0;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const calDays = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const prevCalMonth = () => setCurrentCalendarMonth(d => d ? new Date(d.getFullYear(), d.getMonth() - 1, 1) : new Date());
    const nextCalMonth = () => setCurrentCalendarMonth(d => d ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : new Date());

    // Format last updated time
    const formatLastUpdated = (ts) => {
        if (!ts) return '—';
        const d = new Date(ts);
        const now = new Date();
        const diffMin = Math.round((now - d) / 60000);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    const Sidebar = () => (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
            <div>
                <div className="user-profile" style={{ position: 'relative' }}>
                    <div className="user-avatar"><img src="/studentPic.png" alt="Student" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /></div>
                    <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                    <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </div>
                </div>
                <nav className="nav-menu">
                    <div onClick={() => router.push('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Home</span></div>
                    <div className="nav-item active"><Users size={18} /> <span>Attendance</span></div>
                    <div onClick={() => router.push('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                    <div onClick={() => router.push('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                    <div onClick={() => router.push('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
                    <div onClick={() => router.push('/leaderboard')} className="nav-item" style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
                    <div onClick={() => router.push('/courses')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Courses</span></div>
                    <div onClick={() => router.push('/calendar')} className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Calendar</span></div>
                </nav>
            </div>
            <div className="sidebar-footer">
                <div onClick={() => router.push('/settings')} className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                <div className="nav-item" onClick={async () => { await logout(); router.push('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
            </div>
        </aside>
    );

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            <Sidebar />
            <div className="main-content">
                <div className="content-center admin-full">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>My Attendance</h1>
                            {/* Live Presence Indicator */}
                            <div className="att-presence-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: presence.present ? '#ecfdf5' : '#fef2f2', color: presence.present ? '#166534' : '#991b1b', border: `1px solid ${presence.present ? '#a7f3d0' : '#fecaca'}` }}>
                                {presence.present ? <Wifi size={13} /> : <WifiOff size={13} />}
                                {presence.present ? 'In Class' : 'Not Detected'}
                                {presence.present && <span className="att-presence-signal" style={{ fontSize: '0.6rem', color: '#059669' }}>Signal {presence.signal}/5</span>}
                                <span className="att-presence-time" style={{ fontSize: '0.58rem', color: '#aaa', marginLeft: '4px' }}>
                                    {formatLastUpdated(presence.lastUpdated)}
                                </span>
                            </div>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    <div className="att-top-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        {/* BENTO BOX REDESIGN - Left Side */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Main Hero Card */}
                            <div style={{ 
                                background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', 
                                borderRadius: '24px', 
                                padding: '2rem', 
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.4)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* Decorative elements */}
                                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', height: '150px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(20px)' }}></div>
                                <div style={{ position: 'absolute', bottom: '-40px', left: '10%', width: '200px', height: '200px', background: 'rgba(56, 189, 248, 0.15)', borderRadius: '50%', filter: 'blur(30px)' }}></div>

                                <div style={{ position: 'relative', zIndex: 1 }}>
                                    <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Semester Overview</div>
                                    <div style={{ fontSize: '3.2rem', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>{Math.round(overall.pct)}%</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 500, color: '#38bdf8', marginTop: '4px' }}>Overall Attendance</div>
                                    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '12px', backdropFilter: 'blur(10px)', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <Flame size={14} color="#fbbf24" /> {streak} Day Streak
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '12px', backdropFilter: 'blur(10px)', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <BookOpen size={14} color="#94a3b8" /> {overall.total} Total
                                        </div>
                                    </div>
                                </div>
                                <div style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.2))' }}>
                                    <Donut pct={overall.pct} size={120} stroke={12} color="#38bdf8" bg="rgba(255,255,255,0.1)" />
                                </div>
                            </div>

                            {/* Stats Bento Grid */}
                            <div className="att-stats-bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                <div style={{ background: '#fff', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'transform 0.2s ease', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CheckCircle size={18} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{overall.attended}</div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attended</div>
                                    </div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'transform 0.2s ease', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <XCircle size={18} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{overall.absent}</div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Absent</div>
                                    </div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'transform 0.2s ease', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Clock size={18} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{overall.leave}</div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d97706', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leave</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card att-calendar-card" style={{ padding: '1.5rem 2rem', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                            <div className="att-cal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button onClick={prevCalMonth} style={{ background: 'none', border: '1px solid #eee', borderRadius: '8px', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.8rem' }}>
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#000', minWidth: '130px', textAlign: 'center' }}>
                                        {currentCalendarMonth ? `${currentCalendarMonth.toLocaleString('en', { month: 'long' })} ${currentCalendarMonth.getFullYear()}` : ''}
                                    </span>
                                    <button onClick={nextCalMonth} style={{ background: 'none', border: '1px solid #eee', borderRadius: '8px', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.8rem' }}>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                                <div className="att-cal-legend" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.65rem', color: '#aaa' }}>
                                    {[['#86efac','100%'],['#fdba74','Partial'],['#fca5a5','Absent'],['#f5f5f5','No Class']].map(([c,l])=>(
                                        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '4px', background: c, display: 'inline-block', border: c==='#f5f5f5'?'1px solid #eee':'none' }}></span>{l}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
                                {dayLabels.map((d,i)=><div key={i} style={{ textAlign: 'center', fontSize: '0.68rem', fontWeight: 600, color: '#ccc' }}>{d}</div>)}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                                {calDays.map((day, i) => {
                                    let bg='transparent', textCol='#ddd', border='1px dashed #e8e8e8';
                                    const today = new Date();
                                    const isToday = day && calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate();
                                    if (day !== null) {
                                        const mm = String(calMonth + 1).padStart(2, '0');
                                        const dd = String(day).padStart(2, '0');
                                        const dateKey = `${calYear}-${mm}-${dd}`;
                                        const dayStatus = summaryData?.calendarData?.[dateKey] || 'none';
                                        if      (dayStatus === 'full')    { bg='#86efac'; textCol='#166534'; border='1px solid #a7f3d0'; }
                                        else if (dayStatus === 'partial') { bg='#fdba74'; textCol='#92400e'; border='1px solid #fcd34d'; }
                                        else if (dayStatus === 'absent')  { bg='#fca5a5'; textCol='#9f1239'; border='1px solid #fecdd3'; }
                                        else                               { bg='#f8f8f8'; textCol='#ccc';    border='1px solid #eee'; }
                                    }
                                    return <div key={i} style={{ aspectRatio:'1', borderRadius:'8px', background:bg, border: isToday ? '2px solid #111' : border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight: isToday ? 800 : 600, color: isToday ? '#111' : textCol }}>{day || ''}</div>;
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Weekly Attendance Trend */}
                    {!loading && summaryData?.weeklyData && summaryData.weeklyData.length > 0 && (
                        <div style={{ marginBottom: '1.5rem', background: '#fff', borderRadius: '24px', padding: '1.5rem 2rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ background: '#e0f2fe', padding: '6px', borderRadius: '8px', color: '#0284c7', display: 'flex' }}><TrendingUp size={16} /></div> 
                                    Weekly Attendance Trend
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        disabled={weeklyPage >= Math.ceil((summaryData.weeklyData.length || 1) / 10) - 1} 
                                        onClick={() => setWeeklyPage(p => p + 1)} 
                                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: weeklyPage >= Math.ceil((summaryData.weeklyData.length || 1) / 10) - 1 ? 'not-allowed' : 'pointer', color: weeklyPage >= Math.ceil((summaryData.weeklyData.length || 1) / 10) - 1 ? '#cbd5e1' : '#64748b', transition: 'all 0.2s' }}>
                                        Older
                                    </button>
                                    <button 
                                        disabled={weeklyPage === 0} 
                                        onClick={() => setWeeklyPage(p => Math.max(0, p - 1))} 
                                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: weeklyPage === 0 ? 'not-allowed' : 'pointer', color: weeklyPage === 0 ? '#cbd5e1' : '#64748b', transition: 'all 0.2s' }}>
                                        Newer
                                    </button>
                                </div>
                            </div>
                            <div style={{ width: '100%', height: '240px' }}>
                                {(() => {
                                    const allWeeks = summaryData.weeklyData;
                                    const total = allWeeks.length;
                                    const start = Math.max(0, total - (weeklyPage + 1) * 10);
                                    const end = Math.max(0, total - weeklyPage * 10);
                                    const visibleData = allWeeks.slice(start, end);
                                    
                                    return (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={visibleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} domain={[0, 100]} />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', padding: '12px 16px' }}
                                                    itemStyle={{ color: '#0f172a', fontWeight: 700, fontSize: '1.1rem' }}
                                                    labelStyle={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                                                    labelFormatter={(label, payload) => payload && payload.length ? payload[0].payload.dateRange : label}
                                                    formatter={(value) => [`${value}%`, 'Attendance']}
                                                />
                                                <Area type="monotone" dataKey="pct" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorPct)" activeDot={{ r: 6, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 3, boxShadow: '0 0 10px rgba(14,165,233,0.5)' }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Course-wise Attendance */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#000', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={16} /> Course-wise Attendance</div>
                        {loading ? (
                            <div className="att-course-shimmer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>{[1,2,3,4,5].map(i => (
                                <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '20px', padding: '1.2rem 1rem', textAlign: 'center' }}>
                                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#f0f0f0', margin: '0 auto 10px', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                    <div style={{ width: '60%', height: '12px', borderRadius: '4px', background: '#f0f0f0', margin: '0 auto 6px', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                                    <div style={{ width: '80%', height: '9px', borderRadius: '3px', background: '#f5f5f5', margin: '0 auto', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.25}s` }} />
                                </div>
                            ))}</div>
                        ) : courses.length === 0 ? (
                            <div style={{ color: '#aaa', fontSize: '0.82rem' }}>No courses found.</div>
                        ) : (
                            <div className="att-course-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                {courses.map((c,i)=>(
                                    <div key={i} className="course-bento-card" style={{ 
                                        background: '#fff', 
                                        borderRadius: '20px', 
                                        padding: '1.2rem', 
                                        border: selectedCourse === c.code ? `2px solid ${c.color}` : '1px solid #f1f5f9', 
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem'
                                    }}
                                    onClick={()=>setSelectedCourse(c.code===selectedCourse?'all':c.code)}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.05)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)'; }}
                                    >
                                        <div style={{ flexShrink: 0, position: 'relative' }}>
                                            <MiniDonut pct={c.pct} size={64} stroke={6} color={c.color} />
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>{Math.round(c.pct)}</div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{c.code}</div>
                                                <div style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '6px', background: '#f8fafc', color: '#64748b', fontWeight: 600, border: '1px solid #e2e8f0' }}>{c.total} T</div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '10px' }}>{c.name}</div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <span style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', fontWeight: 700 }}>{c.attended} P</span>
                                                <span style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: '8px', background: '#fee2e2', color: '#ef4444', fontWeight: 700 }}>{c.absent} A</span>
                                                {c.leave > 0 && <span style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', fontWeight: 700 }}>{c.leave} L</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Session History */}
                    <div className="stat-card" style={{ padding: '0', borderRadius: '20px', overflow: 'hidden' }}>
                        <div className="att-session-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#000', display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={15} /> Session History</span>
                            <div className="att-session-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Filter size={13} color="#aaa" />
                                    <select value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} style={{ padding: '5px 12px', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.78rem', color: '#555', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                                        <option value="all">All Courses</option>
                                        {courses.map(c=><option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '0 0 24px 24px' }}>
                            {loading ? (
                                <div>{[1,2,3].map(i => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', background: '#fff', borderRadius: '16px', marginBottom: '12px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ width: `${40 + i * 10}%`, height: '14px', borderRadius: '4px', background: '#f1f5f9', marginBottom: '8px', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                                            <div style={{ width: `${20 + i * 8}%`, height: '10px', borderRadius: '3px', background: '#f8fafc', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.25}s` }} />
                                        </div>
                                        <div style={{ width: '80px', height: '30px', borderRadius: '10px', background: '#f8fafc', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.12}s` }} />
                                    </div>
                                ))}</div>
                            ) : filtered.length === 0 ? (
                                <div style={{ padding: '2.5rem', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>No sessions found for this date.</div>
                            ) : filtered.map((s,i)=>{
                                const cd=courses.find(c=>c.code===s.course);
                                return(
                                    <div key={i} style={{ display:'flex', alignItems:'stretch', marginBottom: i < filtered.length - 1 ? '16px' : '0' }}>
                                        <div style={{ width:'32px', display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                                            <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:s.status==='Present'?'#10b981':'#f43f5e', border:`3px solid ${s.status==='Present'?'#d1fae5':'#ffe4e6'}`, marginTop:'22px', zIndex:1, boxShadow: '0 0 0 4px #f8fafc' }} />
                                            {i<filtered.length-1&&<div style={{ width:'2px', flex:1, background:'#e2e8f0', marginTop:'4px' }} />}
                                        </div>
                                        <div className="att-session-row-inner" style={{ flex:1, background:'#fff', borderRadius:'16px', padding:'16px 20px', border:'1px solid #f1f5f9', boxShadow:'0 2px 10px rgba(0,0,0,0.01)', display:'flex', alignItems:'center', justifyContent:'space-between', marginLeft:'12px', transition: 'transform 0.1s ease', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                            <div className="att-session-row-left" style={{ display:'flex', alignItems:'center', gap:'16px', flex:1 }}>
                                                <div className="att-course-badge" style={{ width:'48px', height:'48px', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:800, background:cd?`${cd.color}20`:'#f1f5f9', color:cd?cd.color:'#64748b', border:`1px solid ${cd?`${cd.color}40`:'#e2e8f0'}` }}>{s.course}</div>
                                                <div>
                                                    <div style={{ fontSize:'0.95rem', fontWeight:700, color:'#0f172a', marginBottom: '4px' }}>{s.topic}</div>
                                                    <div style={{ fontSize:'0.75rem', color:'#64748b', fontWeight: 500 }}>{s.date} {s.day} <span style={{ margin: '0 6px', color: '#cbd5e1' }}>•</span> {s.startTime} – {s.endTime} <span style={{ margin: '0 6px', color: '#cbd5e1' }}>•</span> {s.courseName}</div>
                                                </div>
                                            </div>
                                            <div className="att-session-row-right" style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                                                <span style={{ fontFamily:'monospace', fontSize:'0.8rem', fontWeight: 600, color: s.pings >= 3 ? '#16a34a' : '#e11d48', background: s.pings >= 3 ? '#dcfce7' : '#ffe4e6', padding: '4px 10px', borderRadius: '8px' }}>{s.pings} pings</span>
                                                <span style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'6px 14px', borderRadius:'10px', fontSize:'0.8rem', fontWeight:700, background:s.status==='Present'?'#ecfccb':'#ffe4e6', color:s.status==='Present'?'#365314':'#9f1239' }}>
                                                    {s.status==='Present'?<CheckCircle size={14}/>:<XCircle size={14}/>}{s.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }

                /* ── Attendance Page Mobile Responsive ── */
                @media (max-width: 768px) {
                    /* Top grid: stack left side & calendar */
                    .att-top-grid {
                        grid-template-columns: 1fr !important;
                        gap: 1rem !important;
                    }
                    .att-stats-bento {
                        grid-template-columns: 1fr 1fr 1fr !important;
                        gap: 8px !important;
                    }
                    .att-stats-bento > div {
                        padding: 1rem 0.8rem !important;
                    }
                    /* Calendar card */
                    .att-calendar-card {
                        padding: 1rem !important;
                    }
                    .att-cal-header {
                        flex-direction: column !important;
                        gap: 8px !important;
                        align-items: flex-start !important;
                    }
                    .att-cal-legend {
                        flex-wrap: wrap !important;
                        gap: 6px !important;
                    }
                    /* Course-wise grid */
                    .att-course-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 8px !important;
                    }
                    .att-course-shimmer-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 8px !important;
                    }
                    /* Session history header */
                    .att-session-header {
                        flex-direction: column !important;
                        gap: 8px !important;
                        align-items: flex-start !important;
                    }
                    .att-session-controls {
                        flex-direction: column !important;
                        gap: 6px !important;
                        width: 100%;
                    }
                    .att-session-controls input[type="date"],
                    .att-session-controls select {
                        width: 100% !important;
                        box-sizing: border-box;
                    }
                    /* Session rows compact */
                    .att-session-row-inner {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 6px !important;
                    }
                    .att-session-row-left {
                        gap: 10px !important;
                    }
                    .att-session-row-right {
                        align-self: flex-end;
                    }
                    /* Header presence badge */
                    .att-presence-badge {
                        padding: 3px 8px !important;
                        font-size: 0.65rem !important;
                    }
                    .att-presence-signal,
                    .att-presence-time {
                        display: none !important;
                    }
                }

                @media (max-width: 480px) {
                    .att-course-grid {
                        grid-template-columns: 1fr 1fr !important;
                    }
                    .att-stats-bento {
                        grid-template-columns: 1fr !important;
                    }
                    .att-session-row-left .att-course-badge {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
