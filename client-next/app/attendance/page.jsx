'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Bell, Search, Menu, ChevronLeft, ChevronRight,
    CheckCircle, XCircle, Clock, AlertCircle, Filter, Flame
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

    // Live data
    const [summaryData, setSummaryData] = useState(null);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const fetchData = useCallback(async () => {
        try {
            const [sumRes, sesRes] = await Promise.allSettled([
                api.get('/api/students/attendance/summary'),
                api.get('/api/students/attendance/sessions'),
            ]);
            if (sumRes.status === 'fulfilled') setSummaryData(sumRes.value);
            if (sesRes.status === 'fulfilled') setSessionHistory(sesRes.value.sessions || []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchData(); }, [fetchData, authReady]);

    // Build from API data
    const overall = {
        total: summaryData?.total || 0,
        attended: summaryData?.attended || 0,
        missed: summaryData?.missed || 0,
        pct: summaryData?.overall_pct || 0,
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

    const sessions = sessionHistory.map(s => ({
        date: new Date(s.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        day: new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'short' }),
        time: s.start_time ? s.start_time.slice(0, 5) : '',
        course: s.course_code || '',
        topic: s.topic || s.course_name || '',
        status: s.status === 'present' ? 'Present' : 'Absent',
        pings: s.ping_count ? `${s.ping_count}/${s.total_pings || 5}` : '0/5',
    }));

    const filtered = selectedCourse === 'all' ? sessions : sessions.filter(s => s.course === selectedCourse);
    const statusTextColor = (p) => p >= 85 ? '#166534' : p >= 75 ? '#854d0e' : '#9f1239';
    const statusBg = (p) => p >= 85 ? '#ecfccb' : p >= 75 ? '#fef9c3' : '#fce7f3';
    const statusLabel = (p) => p >= 85 ? 'On Track' : p >= 75 ? 'Needs Attention' : 'At Risk';

    // Build a simple attendance calendar for current month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const calendarDays = Array(firstDay).fill(-1).concat(
        sessions.map(s => {
            const d = new Date(sessionHistory.find(r => {
                const dd = new Date(r.session_date);
                return `${dd.getDate()} ${dd.toLocaleString('en', { month: 'short' })}` === s.date;
            })?.session_date);
            return d.getDate();
        })
    );
    // Build a simpler approach: mark each day
    const presentDays = new Set(sessionHistory.filter(s => s.status === 'present').map(s => new Date(s.session_date).getDate()));
    const absentDays = new Set(sessionHistory.filter(s => s.status !== 'present').map(s => new Date(s.session_date).getDate()));
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const calDays = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

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
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="stat-card" style={{ padding: '2rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <Donut pct={overall.pct} size={140} stroke={12} color="#66d9e8" bg="#e8f9fb" />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#003366', letterSpacing: '-1px', lineHeight: 1 }}>{Math.round(overall.pct)}%</div>
                                    <div style={{ fontSize: '0.6rem', color: '#aaa', marginTop: '3px' }}>overall</div>
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#000', marginBottom: '14px' }}>Semester Overview</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {[['#ecfccb','#365314','#4d7c0f',overall.attended,'Attended'],['#ffe4e6','#9f1239','#be123c',overall.missed,'Missed'],['#e0e7ff','#3730a3','#4338ca',overall.total,'Total Classes'],['#fef9c3','#854d0e','#a16207',streak,'Day Streak']].map(([bg,tc,sc,val,label],i)=>(
                                        <div key={i} style={{ background: bg, borderRadius: '14px', padding: '12px 14px' }}>
                                            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: tc }}>{val}</div>
                                            <div style={{ fontSize: '0.68rem', color: sc, fontWeight: 500 }}>{label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="stat-card" style={{ padding: '1.5rem 2rem', borderRadius: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#000' }}>{now.toLocaleString('en', { month: 'long' })} {now.getFullYear()}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.65rem', color: '#aaa' }}>
                                    {[['#86efac','Present'],['#fda4af','Absent'],['#f5f5f5','No Class']].map(([c,l])=>(
                                        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '4px', background: c, display: 'inline-block', border: c==='#f5f5f5'?'1px solid #eee':'none' }}></span>{l}</span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
                                {dayLabels.map((d,i)=><div key={i} style={{ textAlign: 'center', fontSize: '0.68rem', fontWeight: 600, color: '#ccc' }}>{d}</div>)}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                                {calDays.map((day, i) => {
                                    let bg='#fafafa', textCol='#ddd', border='1px dashed #e8e8e8';
                                    if (day !== null) {
                                        if (presentDays.has(day)) { bg='#86efac'; textCol='#166534'; border='1px solid #a7f3d0'; }
                                        else if (absentDays.has(day)) { bg='#fda4af'; textCol='#9f1239'; border='1px solid #fecdd3'; }
                                        else { bg='#f5f5f5'; textCol='#ccc'; border='1px solid #eee'; }
                                    }
                                    return <div key={i} style={{ aspectRatio:'1', borderRadius:'8px', background:bg, border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:600, color:textCol }}>{day || ''}</div>;
                                })}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#000', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={16} /> Course-wise Attendance</div>
                        {loading ? (
                            <div style={{ color: '#aaa', fontSize: '0.82rem' }}>Loading...</div>
                        ) : courses.length === 0 ? (
                            <div style={{ color: '#aaa', fontSize: '0.82rem' }}>No courses found.</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(courses.length, 5)}, 1fr)`, gap: '12px' }}>
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
                                        <div style={{ marginTop: '8px', fontSize: '0.6rem', fontWeight: 600, padding: '3px 8px', borderRadius: '10px', display: 'inline-block', background: statusBg(c.pct), color: statusTextColor(c.pct) }}>{statusLabel(c.pct)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="stat-card" style={{ padding: '0', borderRadius: '20px', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#000', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={15} /> Recent Sessions</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Filter size={13} color="#aaa" />
                                <select value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} style={{ padding: '5px 12px', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.78rem', color: '#555', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                                    <option value="all">All Courses</option>
                                    {courses.map(c=><option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ padding: '6px 0' }}>
                            {filtered.length === 0 ? (
                                <div style={{ padding: '1.5rem', color: '#aaa', fontSize: '0.82rem', textAlign: 'center' }}>No sessions found.</div>
                            ) : filtered.map((s,i)=>{
                                const cd=courses.find(c=>c.code===s.course);
                                return(
                                    <div key={i} style={{ display:'flex', alignItems:'stretch', padding:'0 1.5rem' }}>
                                        <div style={{ width:'24px', display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                                            <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:s.status==='Present'?'#86efac':'#fda4af', border:`2.5px solid ${s.status==='Present'?'#dcfce7':'#ffe4e6'}`, marginTop:'18px', zIndex:1 }} />
                                            {i<filtered.length-1&&<div style={{ width:'1.5px', flex:1, background:'#f0f0f0' }} />}
                                        </div>
                                        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0 12px 14px', borderBottom:i<filtered.length-1?'1px solid #fafafa':'none' }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:'14px', flex:1 }}>
                                                <div style={{ width:'40px', height:'40px', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.55rem', fontWeight:700, background:cd?`${cd.color}20`:'#f5f5f5', color:'#555', border:'1px solid #eee' }}>{s.course}</div>
                                                <div>
                                                    <div style={{ fontSize:'0.84rem', fontWeight:600, color:'#111' }}>{s.topic}</div>
                                                    <div style={{ fontSize:'0.7rem', color:'#bbb' }}>{s.date} · {s.day} · {s.time}</div>
                                                </div>
                                            </div>
                                            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                                                <span style={{ fontFamily:'monospace', fontSize:'0.75rem', color:parseInt(s.pings)>=3?'#4d7c0f':'#be123c' }}>{s.pings}</span>
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
        </div>
    );
}
