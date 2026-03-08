'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare,
    Settings, LogOut, Bell, Search, ChevronDown, Clock,
    FileText, Menu, ChevronLeft, ChevronRight, Wifi, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StudentDashboard() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    // Live data
    const [todaySessions, setTodaySessions] = useState([]);
    const [weekSessions, setWeekSessions]   = useState([]);
    const [attendance, setAttendance]        = useState(null);
    const [assignments, setAssignments]      = useState([]);
    const [pendingFeedback, setPendingFeedback] = useState(null);
    const [profile, setProfile]              = useState(null);
    const [loading, setLoading]              = useState(true);

    // MAC state
    const [macInput, setMacInput]           = useState('');
    const [isEditingMac, setIsEditingMac]   = useState(false);
    const [showMacConfirm, setShowMacConfirm] = useState(false);
    const [macError, setMacError]           = useState('');
    const [macSaving, setMacSaving]         = useState(false);

    const fetchAll = useCallback(async () => {
        try {
            const [todayRes, weekRes, attRes, assRes, fbRes, profRes] = await Promise.allSettled([
                api.get('/api/students/schedule/today'),
                api.get('/api/students/schedule/week'),
                api.get('/api/students/attendance/summary'),
                api.get('/api/students/assignments'),
                api.get('/api/feedback/pending'),
                api.get('/api/students/profile'),
            ]);
            if (todayRes.status === 'fulfilled') setTodaySessions(todayRes.value.sessions || []);
            if (weekRes.status === 'fulfilled')  setWeekSessions(weekRes.value.sessions  || []);
            if (attRes.status === 'fulfilled')   setAttendance(attRes.value);
            if (assRes.status === 'fulfilled')   setAssignments((assRes.value.assignments || []).filter(a => !a.is_submitted));
            if (fbRes.status === 'fulfilled')    setPendingFeedback(fbRes.value.pending);
            if (profRes.status === 'fulfilled')  setProfile(profRes.value.profile);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchAll(); }, [fetchAll, authReady]);

    // Build weekly bar data from weekSessions
    const weeklyBarData = (() => {
        const map = {};
        DAY_KEYS.forEach(d => { map[d] = 0; });
        weekSessions.forEach(s => {
            const d = DAY_KEYS[new Date(s.session_date).getDay()];
            map[d]++;
        });
        return DAY_KEYS.slice(1,6).map(d => ({ day: d, val: map[d] > 0 ? 80 : 20 }));
    })();

    const formatTime = (t) => {
        if (!t) return '';
        const [h, m] = t.split(':').map(Number);
        return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
    };

    const formatMacInput = (value) => {
        const clean = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        const parts = [];
        for (let i = 0; i < clean.length && i < 12; i += 2) parts.push(clean.substring(i, i + 2));
        return parts.join(':');
    };
    const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);

    const handleMacUpdate = () => {
        if (!isValidMac(macInput)) { setMacError('Invalid MAC address format. Use XX:XX:XX:XX:XX:XX'); return; }
        setShowMacConfirm(true);
    };

    const confirmMacUpdate = async () => {
        setMacSaving(true);
        try {
            await api.patch('/api/students/mac', { mac_address: macInput });
            setProfile(p => ({ ...p, mac_address: macInput }));
            setShowMacConfirm(false);
            setIsEditingMac(false);
            setMacInput('');
        } catch (e) {
            setMacError(e.message);
        } finally {
            setMacSaving(false);
        }
    };

    const handleLogout = async () => { await logout(); router.push('/'); };

    const registeredMac = profile?.mac_address || '';
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';
    const attPct = attendance?.overall?.pct || 0;

    const courseIcons = ['/course1.png', '/active.png', '/course3.png', '/course4.png', '/course5.png'];
    const now = new Date();

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />

            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" onClick={() => navTo('/profile')} style={{ cursor: 'pointer', background: '#0b6861', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                            {user?.firstName?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div className="user-info">
                            <h3>{displayName}</h3>
                            <p>{user?.email || ''}</p>
                        </div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div className="nav-item active"><LayoutGrid size={18} /> <span>Home</span></div>
                        <div onClick={() => router.push('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Attendance</span></div>
                        <div onClick={() => router.push('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div onClick={() => router.push('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div onClick={() => router.push('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div onClick={() => router.push('/courses')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Courses</span></div>
                        <div onClick={() => router.push('/calendar')} className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Calendar</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div onClick={() => router.push('/settings')} className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    <div className="nav-item" onClick={handleLogout} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content">
                <div className="content-center">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Home</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                            <Bell size={20} color="#555" />
                            <MessageSquare size={20} color="#555" />
                        </div>
                    </header>

                    {/* Today's Schedule */}
                    <section>
                        <div className="section-title">Today's Schedule</div>
                        {loading ? (
                            <div style={{ color: '#aaa', fontSize: '0.85rem', padding: '1rem 0' }}>Loading schedule...</div>
                        ) : todaySessions.length === 0 ? (
                            <div style={{ color: '#888', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center', background: '#fafafa', borderRadius: '10px', border: '1px dashed #e8e8e8' }}>
                                No sessions scheduled for today 🎉
                            </div>
                        ) : (
                            <div className="schedule-cards">
                                {todaySessions.map((s, i) => {
                                    const isNext = todaySessions.findIndex(ss => new Date(`${ss.session_date}T${ss.start_time}`) > now) === i;
                                    return (
                                        <div key={s.id} className={`schedule-card ${isNext ? 'active' : ''}`}>
                                            {isNext && <div className="next-class-badge">Next Class</div>}
                                            <div className="icon-container">
                                                <img src={courseIcons[i % courseIcons.length]} alt="Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                            </div>
                                            <div className="course-title">{s.courses?.name || s.title}</div>
                                            <div className="course-info">
                                                {s.title}<br />
                                                Venue: {s.venues?.name || '—'}<br />
                                                {formatTime(s.start_time)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Weekly Schedule */}
                    <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="section-title" onClick={() => router.push('/calendar')} style={{ cursor: 'pointer' }}>
                            Weekly Schedule
                            <div style={{ fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} <ChevronDown size={14} />
                            </div>
                        </div>
                        <div className="calendar-container">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px', marginBottom: '10px' }}>
                                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                                    <div key={d} style={{ textAlign: 'left', paddingLeft: '5px', fontSize: '0.8rem', color: '#888' }}>{d}</div>
                                ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, gap: '10px', position: 'relative' }}>
                                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, ci) => {
                                    const daySessions = weekSessions.filter(s => DAY_KEYS[new Date(s.session_date).getDay()] === day || (day === 'Mon' && new Date(s.session_date).getDay() === 1));
                                    const colors = ['blue','teal','purple','green','blue','teal','purple'];
                                    return (
                                        <div key={day} className="cal-col" style={{ position: 'relative', borderLeft: ci > 0 ? '1px solid #f9f9f9' : 'none' }}>
                                            {daySessions.slice(0,1).map((s, si) => (
                                                <div key={s.id} className={`cal-event ${colors[ci]}`} style={{ position: 'absolute', top: `${20 * si}%`, width: '100%' }}>
                                                    <div className="event-badge">Class</div>
                                                    <strong>{s.courses?.name || s.title}</strong>
                                                    <div>{s.venues?.name || ''}</div>
                                                    <div>{formatTime(s.start_time)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Panel */}
                <div className="content-right">
                    <div className="section-title">
                        Weekly Attendance
                        <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                    </div>
                    <div className="stat-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ position: 'relative', cursor: 'default', width: '290px', height: '110px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyBarData} barSize={10} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                    <CartesianGrid vertical={false} stroke="#eee" strokeDasharray="3 3" />
                                    <XAxis dataKey="day" hide={true} />
                                    <YAxis hide={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} domain={[0, 100]} width={25} />
                                    <Bar dataKey="val" radius={[4, 4, 4, 4]}>
                                        {weeklyBarData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={index === weeklyBarData.length - 1 ? '#003366' : '#66d9e8'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="attendance-summary">
                            <div className="summary-left">
                                <div className="summary-label">Total Attendance</div>
                                <div className="progress-circle">{loading ? '...' : `${attPct}%`}</div>
                            </div>
                            <div className="summary-right">
                                <div className="badge-pill blue">Attended: {attendance?.overall?.attended ?? '—'}</div>
                                <div className="badge-pill pink">Missed: {attendance?.overall?.missed ?? '—'}</div>
                            </div>
                        </div>
                    </div>

                    <div className="section-title" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Pending Assignments</div>

                    {loading ? (
                        <div style={{ color: '#aaa', fontSize: '0.82rem' }}>Loading...</div>
                    ) : assignments.length === 0 ? (
                        <div style={{ color: '#888', fontSize: '0.82rem', padding: '10px', background: '#fafafa', borderRadius: '8px', textAlign: 'center' }}>
                            No pending assignments ✓
                        </div>
                    ) : assignments.slice(0, 3).map((a, i) => (
                        <div key={a.id} className="assignment-card">
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <div className="icon-box"><FileText size={20} /></div>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{a.title}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                        {a.courses?.name} • {a.faculty?.users ? `${a.faculty.users.first_name} ${a.faculty.users.last_name}` : ''}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: a.is_overdue ? '#dc2626' : '#888', marginTop: '2px' }}>
                                        Due: {new Date(a.due_date).toLocaleDateString('en-GB')}
                                        {a.is_overdue && ' • Overdue'}
                                    </div>
                                </div>
                            </div>
                            <div className={`score-circle ${['green', 'peach', 'pink'][i % 3]}`}>
                                {a.days_left !== undefined ? `${a.days_left}d` : '—'}
                            </div>
                        </div>
                    ))}

                    <div className="section-title" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Pending Feedback</div>
                    {loading ? (
                        <div style={{ color: '#aaa', fontSize: '0.82rem' }}>Loading...</div>
                    ) : !pendingFeedback ? (
                        <div style={{ color: '#888', fontSize: '0.82rem', padding: '10px', background: '#fafafa', borderRadius: '8px', textAlign: 'center' }}>
                            All feedback submitted ✓
                        </div>
                    ) : (
                        <div className="feedback-box" onClick={() => router.push('/feedback')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                            <div>
                                <div className="feedback-text" style={{ fontSize: '0.9rem' }}>
                                    Pending feedback for<br />{new Date(pendingFeedback.session_date).toLocaleDateString('en-GB')}
                                </div>
                                <div className="feedback-sub">
                                    {pendingFeedback.courses?.name} — {pendingFeedback.faculty?.users
                                        ? `${pendingFeedback.faculty.users.first_name} ${pendingFeedback.faculty.users.last_name}`
                                        : ''}
                                </div>
                            </div>
                            <div style={{ width: '40px', height: '40px', background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                                <ChevronDown size={20} style={{ transform: 'rotate(-90deg)' }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* PROFILE PANEL */}
            {showProfile && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.25)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setShowProfile(false)}>
                    <div style={{ width: '380px', maxWidth: '90vw', background: '#fff', borderLeft: '1px solid #e8e8e8', height: '100%', overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.05)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111' }}>Student Profile</span>
                            <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><X size={16} /></button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#0b6861', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1.2rem', flexShrink: 0 }}>
                                    {user?.firstName?.[0]?.toUpperCase() || 'S'}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111' }}>{displayName}</div>
                                    <div style={{ fontSize: '0.78rem', color: '#888' }}>{user?.email}</div>
                                    <div style={{ fontSize: '0.72rem', color: '#aaa', fontFamily: 'monospace', marginTop: '2px' }}>{profile?.enrollment_no || '—'}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem', marginBottom: '24px', padding: '14px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                                {[
                                    ['Program', profile?.program_name || '—'],
                                    ['Enrollment', profile?.enrollment_no || '—'],
                                    ['Status', profile?.is_active ? 'Active' : 'Inactive'],
                                ].map(([label, val], i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', borderBottom: i < 2 ? '1px solid #f5f5f5' : 'none' }}>
                                        <span style={{ color: '#888' }}>{label}</span>
                                        <span style={{ fontWeight: 600, color: '#333', fontFamily: 'monospace', fontSize: '0.76rem' }}>{val}</span>
                                    </div>
                                ))}
                            </div>

                            {/* MAC Section */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                    <Wifi size={14} color="#888" />
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>Device Registration</span>
                                </div>
                                <div style={{ padding: '14px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>Primary Device MAC Address</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: '#111', letterSpacing: '0.5px' }}>{registeredMac || '—'}</span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, background: registeredMac ? '#f0fdf4' : '#fef2f2', color: registeredMac ? '#16a34a' : '#dc2626', border: '1px solid ' + (registeredMac ? '#bbf7d0' : '#fecaca') }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: registeredMac ? '#16a34a' : '#dc2626' }} />
                                            {registeredMac ? 'Registered' : 'Not Registered'}
                                        </span>
                                    </div>
                                </div>
                                {!isEditingMac ? (
                                    <button onClick={() => { setIsEditingMac(true); setMacInput(registeredMac || ''); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#555' }}>
                                        {registeredMac ? 'Update MAC Address' : 'Register MAC Address'}
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <input type="text" value={macInput} onChange={e => { setMacInput(formatMacInput(e.target.value)); setMacError(''); }} placeholder="XX:XX:XX:XX:XX:XX" maxLength={17}
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid ' + (macError ? '#fca5a5' : '#e8e8e8'), fontSize: '0.85rem', fontFamily: 'monospace', color: '#111', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
                                        {macError && <div style={{ fontSize: '0.72rem', color: '#dc2626' }}>{macError}</div>}
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={handleMacUpdate} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#111', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                                            <button onClick={() => { setIsEditingMac(false); setMacInput(''); setMacError(''); }} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', fontSize: '0.75rem', fontWeight: 600, color: '#888', cursor: 'pointer' }}>Cancel</button>
                                        </div>
                                    </div>
                                )}
                                <div style={{ marginTop: '12px', fontSize: '0.72rem', color: '#aaa', lineHeight: '1.5' }}>
                                    This MAC address will be used for Wi-Fi‑based attendance detection during lectures.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MAC CONFIRM MODAL */}
            {showMacConfirm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', width: '340px', maxWidth: '90vw', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Confirm Device Update</span>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ fontSize: '0.82rem', color: '#555', lineHeight: '1.6', marginBottom: '16px' }}>Update your registered device MAC address?</div>
                            <div style={{ padding: '10px 14px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                                    <span style={{ color: '#888' }}>Current</span>
                                    <span style={{ fontFamily: 'monospace', color: '#999' }}>{registeredMac || 'None'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                    <span style={{ color: '#888' }}>New</span>
                                    <span style={{ fontFamily: 'monospace', color: '#111', fontWeight: 700 }}>{macInput}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowMacConfirm(false)} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', fontSize: '0.78rem', fontWeight: 600, color: '#888', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={confirmMacUpdate} disabled={macSaving} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: '#111', fontSize: '0.78rem', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                                    {macSaving ? 'Saving...' : 'Confirm Update'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
