'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Bell, Search, Menu, ChevronLeft, ChevronRight,
    CheckCircle, XCircle, Clock, AlertCircle, Filter, Flame, Wifi, WifiOff
} from 'lucide-react';
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

    // Live data
    const [summaryData, setSummaryData] = useState(null);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // Presence indicator
    const [presence, setPresence] = useState({ present: false, signal: 0, lastUpdated: null });

    // Date filter for session history — defer to useEffect to avoid hydration mismatch
    const [sessionDate, setSessionDate] = useState('');

    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const fetchData = useCallback(async () => {
        try {
            const [sumRes, sesRes, presRes] = await Promise.allSettled([
                api.get('/api/students/attendance/summary'),
                api.get(`/api/students/attendance/sessions?date=${sessionDate}`),
                api.get('/api/students/attendance/presence'),
            ]);
            if (sumRes.status === 'fulfilled') setSummaryData(sumRes.value);
            if (sesRes.status === 'fulfilled') setSessionHistory(sesRes.value.sessions || []);
            if (presRes.status === 'fulfilled') setPresence(presRes.value);
        } finally {
            setLoading(false);
        }
    }, [sessionDate]);

    useEffect(() => { if (authReady && sessionDate) fetchData(); }, [fetchData, authReady, sessionDate]);

    // Set today's date on mount (avoids SSR hydration mismatch)
    useEffect(() => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        setSessionDate(today);
        setCurrentCalendarMonth(new Date());
    }, []);

    // Build from API data
    const overall = {
        total: summaryData?.overall?.total || 0,
        attended: summaryData?.overall?.attended || 0,
        missed: summaryData?.overall?.missed || 0,
        pct: summaryData?.overall?.pct || 0,
    };
    const streak = summaryData?.streak || 0;
    const courses = (summaryData?.courses || []).map((c, i) => ({
        code: c.course_code || `C${i + 1}`,
        name: c.course_name,
        faculty: c.faculty || '',
        total: c.total || 0,
        attended: c.attended || 0,
        pct: c.pct || 0,
        color: ['#66d9e8', '#a78bfa', '#93c5fd', '#f9a8d4', '#fdba74'][i % 5],
    }));

    // Sessions for selected date
    const sessions = sessionHistory.map((s, i) => {
        const sess = s.sessions || {};
        const sessionDate = sess.session_date ? new Date(sess.session_date + 'T00:00:00') : null;
        const courseName = sess.courses?.name || '';
        const courseCode = courseName ? courseName.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase() : `C${i + 1}`;
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
                        <div className="stat-card att-donut-section" style={{ padding: '2rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                            <div className="att-donut-wrap" style={{ position: 'relative', flexShrink: 0 }}>
                                <Donut pct={overall.pct} size={140} stroke={12} color="#66d9e8" bg="#e8f9fb" />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#003366', letterSpacing: '-1px', lineHeight: 1 }}>{Math.round(overall.pct)}%</div>
                                    <div style={{ fontSize: '0.6rem', color: '#aaa', marginTop: '3px' }}>overall</div>
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#000', marginBottom: '14px' }}>Semester Overview</div>
                                <div className="att-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {[['#ecfccb','#365314','#4d7c0f',overall.attended,'Attended'],['#ffe4e6','#9f1239','#be123c',overall.missed,'Missed'],['#e0e7ff','#3730a3','#4338ca',overall.total,'Total Classes'],['#fef9c3','#854d0e','#a16207',streak,'Day Streak']].map(([bg,tc,sc,val,label],i)=>(
                                        <div key={i} style={{ background: bg, borderRadius: '14px', padding: '12px 14px' }}>
                                            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: tc }}>{val}</div>
                                            <div style={{ fontSize: '0.68rem', color: sc, fontWeight: 500 }}>{label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="stat-card att-calendar-card" style={{ padding: '1.5rem 2rem', borderRadius: '20px' }}>
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

                    {/* Course-wise Attendance as Donut Circles */}
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
                            <div className="att-course-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(courses.length, 5)}, 1fr)`, gap: '12px' }}>
                                {courses.map((c,i)=>(
                                    <div key={i} className="stat-card" style={{ padding: '1.2rem 1rem', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: selectedCourse===c.code?`2px solid ${c.color}`:'1px solid #eee' }}
                                        onClick={()=>setSelectedCourse(c.code===selectedCourse?'all':c.code)}>
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', position: 'relative' }}>
                                            <MiniDonut pct={c.pct} size={52} stroke={5} color={c.color} />
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '0.68rem', fontWeight: 700, color: '#333' }}>{Math.round(c.pct)}</div>
                                        </div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#000', marginBottom: '2px' }}>{c.code}</div>
                                        <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: '8px' }}>{c.name}</div>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', fontSize: '0.65rem' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: '8px', background: '#ecfccb', color: '#365314', fontWeight: 600 }}>{c.attended}</span>
                                            <span style={{ padding: '2px 8px', borderRadius: '8px', background: '#ffe4e6', color: '#9f1239', fontWeight: 600 }}>{c.total-c.attended}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Session History with Date Filter */}
                    <div className="stat-card" style={{ padding: '0', borderRadius: '20px', overflow: 'hidden' }}>
                        <div className="att-session-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#000', display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={15} /> Session History</span>
                            <div className="att-session-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                                    style={{ padding: '5px 10px', borderRadius: '10px', border: '1px solid #eee', fontSize: '0.78rem', color: '#555', fontFamily: 'inherit', cursor: 'pointer' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Filter size={13} color="#aaa" />
                                    <select value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} style={{ padding: '5px 12px', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.78rem', color: '#555', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                                        <option value="all">All Courses</option>
                                        {courses.map(c=><option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '6px 0' }}>
                            {loading ? (
                                <div>{[1,2,3].map(i => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 1.5rem', borderBottom: '1px solid #f5f5f5' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ width: `${50 + i * 10}%`, height: '12px', borderRadius: '4px', background: '#f0f0f0', marginBottom: '6px', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                                            <div style={{ width: `${30 + i * 8}%`, height: '9px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.25}s` }} />
                                        </div>
                                        <div style={{ width: '70px', height: '24px', borderRadius: '12px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.12}s` }} />
                                    </div>
                                ))}</div>
                            ) : filtered.length === 0 ? (
                                <div style={{ padding: '1.5rem', color: '#aaa', fontSize: '0.82rem', textAlign: 'center' }}>No sessions found for this date.</div>
                            ) : filtered.map((s,i)=>{
                                const cd=courses.find(c=>c.code===s.course);
                                return(
                                    <div key={i} style={{ display:'flex', alignItems:'stretch', padding:'0 1.5rem' }}>
                                        <div style={{ width:'24px', display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                                            <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:s.status==='Present'?'#86efac':'#fda4af', border:`2.5px solid ${s.status==='Present'?'#dcfce7':'#ffe4e6'}`, marginTop:'18px', zIndex:1 }} />
                                            {i<filtered.length-1&&<div style={{ width:'1.5px', flex:1, background:'#f0f0f0' }} />}
                                        </div>
                                        <div className="att-session-row-inner" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0 12px 14px', borderBottom:i<filtered.length-1?'1px solid #fafafa':'none' }}>
                                            <div className="att-session-row-left" style={{ display:'flex', alignItems:'center', gap:'14px', flex:1 }}>
                                                <div className="att-course-badge" style={{ width:'40px', height:'40px', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.55rem', fontWeight:700, background:cd?`${cd.color}20`:'#f5f5f5', color:'#555', border:'1px solid #eee' }}>{s.course}</div>
                                                <div>
                                                    <div style={{ fontSize:'0.84rem', fontWeight:600, color:'#111' }}>{s.topic}</div>
                                                    <div style={{ fontSize:'0.7rem', color:'#bbb' }}>{s.startTime} – {s.endTime} · {s.courseName}</div>
                                                </div>
                                            </div>
                                            <div className="att-session-row-right" style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                                                <span style={{ fontFamily:'monospace', fontSize:'0.75rem', color: s.pings >= 3 ? '#4d7c0f' : '#be123c' }}>{s.pings} pings</span>
                                                <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'4px 12px', borderRadius:'12px', fontSize:'0.72rem', fontWeight:600, background:s.status==='Present'?'#ecfccb':'#ffe4e6', color:s.status==='Present'?'#365314':'#9f1239' }}>
                                                    {s.status==='Present'?<CheckCircle size={12}/>:<XCircle size={12}/>}{s.status}
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
                    /* Top grid: stack donut & calendar */
                    .att-top-grid {
                        grid-template-columns: 1fr !important;
                        gap: 1rem !important;
                    }
                    /* Donut section: stack vertically */
                    .att-donut-section {
                        flex-direction: column !important;
                        gap: 1.2rem !important;
                        padding: 1.2rem !important;
                        align-items: center !important;
                    }
                    .att-donut-section .att-donut-wrap {
                        margin: 0 auto;
                    }
                    .att-stats-grid {
                        grid-template-columns: 1fr 1fr !important;
                        gap: 8px !important;
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
                    .att-stats-grid {
                        grid-template-columns: 1fr 1fr !important;
                    }
                    .att-session-row-left .att-course-badge {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
