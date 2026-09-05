'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings, LogOut, Search,
    ChevronDown, Clock, FileText, AlertCircle, CheckCircle, XCircle, Menu, ChevronLeft,
    ChevronRight, Wifi, X, Fingerprint, ExternalLink, RefreshCw, Trophy
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';
import NotificationBell from '../components/NotificationBell';

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const StudentDashboard = () => {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    // Live data
    const [todaySessions, setTodaySessions] = useState([]);
    const [weekSessions, setWeekSessions] = useState([]);
    const [attendance, setAttendance] = useState(null);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [pendingFeedback, setPendingFeedback] = useState(null);
    const [profile, setProfile] = useState(null);

    // Google Classroom state
    const [gcAssignments, setGcAssignments] = useState([]);
    const [gcConnected, setGcConnected] = useState(null);   // null = loading, true/false
    const [gcLoading, setGcLoading] = useState(false);

    // MAC state
    const [macInput, setMacInput] = useState('');
    const [isEditingMac, setIsEditingMac] = useState(false);
    const [showMacConfirm, setShowMacConfirm] = useState(false);
    const [macError, setMacError] = useState('');
    const [macSaving, setMacSaving] = useState(false);

    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';
    const registeredMac = profile?.mac_address || '';

    const fetchAll = useCallback(async () => {
        // Build today's date in local timezone (avoids IST vs UTC mismatch)
        const now = new Date();
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const [todayRes, weekRes, attRes, sesRes, assRes, fbRes, profRes] = await Promise.allSettled([
            api.get(`/api/students/schedule/today?date=${localDate}`),
            api.get('/api/students/schedule/week'),
            api.get('/api/students/attendance/summary'),
            api.get('/api/students/attendance/sessions?limit=300'),
            api.get('/api/students/assignments'),
            api.get('/api/feedback/pending'),
            api.get('/api/students/profile'),
        ]);
        if (todayRes.status === 'fulfilled') setTodaySessions(todayRes.value.sessions || []);
        if (weekRes.status === 'fulfilled') setWeekSessions(weekRes.value.sessions || []);
        if (attRes.status === 'fulfilled') setAttendance(attRes.value);
        if (sesRes.status === 'fulfilled') setSessionHistory(sesRes.value.sessions || []);
        if (assRes.status === 'fulfilled') setAssignments((assRes.value.assignments || []).filter(a => !a.is_submitted));
        if (fbRes.status === 'fulfilled') setPendingFeedback(fbRes.value.pending);
        if (profRes.status === 'fulfilled') setProfile(profRes.value.profile);
    }, []);

    const fetchGcAssignments = useCallback(async () => {
        setGcLoading(true);
        try {
            const res = await api.get('/api/classroom/assignments');
            setGcConnected(res.connected);
            if (res.connected) setGcAssignments(res.assignments || []);
        } catch {
            setGcConnected(false);
        } finally {
            setGcLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) { fetchAll(); fetchGcAssignments(); } }, [fetchAll, fetchGcAssignments, authReady]);

    // Handle ?gc_connected=1 or ?gc_error= query params after OAuth redirect
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('gc_connected') === '1') {
            fetchGcAssignments();
            window.history.replaceState({}, '', '/dashboard');
        }
        if (params.get('gc_error')) {
            setGcConnected(false);
            window.history.replaceState({}, '', '/dashboard');
        }
    }, [fetchGcAssignments]);

    // Build bar chart data: day-wise attendance % for the current Mon-Sun week
    const weeklyBarData = (() => {
        const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        // Compute the start (Monday) of the current week
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        // Aggregate by day: { attended, total } for sessions falling in this week
        const dayStats = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            dayStats[key] = { attended: 0, total: 0 };
        }

        (sessionHistory || []).forEach(s => {
            const sess = s.sessions || s; // handle both shapes
            const dateStr = sess.session_date || sess.session_date;
            if (!dateStr) return;
            const sessionDate = new Date(`${dateStr}T12:00:00`);
            if (sessionDate < monday || sessionDate > sunday) return;
            const key = dateStr.slice(0, 10);
            if (!dayStats[key]) return;
            dayStats[key].total++;
            if (s.status === 'present' || s.status === 'partial') {
                dayStats[key].attended++;
            }
        });

        return WEEK_DAYS.map((day, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const stats = dayStats[key] || { attended: 0, total: 0 };
            const pct = stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0;
            return { day, val: pct, hasData: stats.total > 0 };
        });
    })();

    const formatMacInput = (value) => {
        const clean = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        const parts = [];
        for (let i = 0; i < clean.length && i < 12; i += 2) parts.push(clean.substring(i, i + 2));
        return parts.join(':');
    };
    const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);
    const handleMacChange = (e) => { setMacInput(formatMacInput(e.target.value)); setMacError(''); };
    const handleMacUpdate = () => {
        if (!isValidMac(macInput)) { setMacError('Invalid MAC address format. Use XX:XX:XX:XX:XX:XX'); return; }
        setShowMacConfirm(true);
    };
    const confirmMacUpdate = async () => {
        setMacSaving(true);
        try {
            await api.patch('/api/students/mac', { mac_address: macInput });
            setShowMacConfirm(false);
            setIsEditingMac(false);
            setMacInput('');
            fetchAll();
        } catch (e) {
            setMacError(e.message);
        } finally {
            setMacSaving(false);
        }
    };

    const courseImages = ['/course1.png', '/active.png', '/course3.png', '/course4.png', '/course5.png'];

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />

            <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
                            <img src="/studentPic.png" alt="Student" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        </div>
                        <div className="user-info">
                            <h3>{displayName}</h3>
                            <p>{user?.email}</p>
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div className="nav-item active"><LayoutGrid size={18} /> <span>Home</span></div>
                        <div onClick={() => router.push('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Attendance</span></div>
                        <div onClick={() => router.push('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div className="nav-item" onClick={() => router.push('/teachers')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div onClick={() => router.push('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div onClick={() => router.push('/leaderboard')} className="nav-item" style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
                        <div onClick={() => router.push('/courses')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Courses</span></div>
                        <div className="nav-item" onClick={() => router.push('/calendar')} style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Calendar</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div onClick={() => router.push('/settings')} className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    <div className="nav-item" onClick={async () => { await logout(); router.push('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content">
                {/* Centre Panel */}
                <div className="content-center">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Home</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                            <NotificationBell />
                            <MessageSquare size={20} color="#555" />
                        </div>
                    </header>

                    {/* Today's Schedule */}
                    <section>
                        <div className="section-title">Today&apos;s Schedule</div>
                        <div className="schedule-cards">
                            {todaySessions.length === 0 && !attendance ? (
                                <div style={{ display: 'flex', gap: '1rem' }}>{[1,2,3].map(i => (
                                    <div key={i} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '1.2rem', flex: 1, minWidth: '180px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f0f0f0', marginBottom: '10px', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                        <div style={{ width: '80%', height: '12px', borderRadius: '4px', background: '#f0f0f0', marginBottom: '8px', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                                        <div style={{ width: '50%', height: '9px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.25}s` }} />
                                    </div>
                                ))}</div>
                            ) : todaySessions.map((s, i) => (
                                <div key={s.id} className={`schedule-card${i === 1 ? ' active' : ''}`}>
                                    {i === 1 && <div className="next-class-badge">Next Class</div>}
                                    <div className="icon-container">
                                        <img src={courseImages[i % courseImages.length]} alt="Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                    </div>
                                    <div className="course-title">{s.courses?.name || s.title}</div>
                                    <div className="course-info">
                                        {s.topic || ''}<br />
                                        Venue: {s.venues?.name || 'TBA'}<br />
                                        {s.start_time ? s.start_time.slice(0, 5) : ''}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Weekly Schedule */}
                    <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="section-title" onClick={() => router.push('/calendar')} style={{ cursor: 'pointer' }}>
                            Weekly Schedule
                            <div style={{ fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                This Week <ChevronDown size={14} />
                            </div>
                        </div>
                        <div className="calendar-container">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px', marginBottom: '10px' }}>
                                {DAY_KEYS.map((d, i) => (
                                    <div key={i} style={{ textAlign: 'left', paddingLeft: '5px', fontSize: '0.8rem', color: '#888' }}>{d}</div>
                                ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, gap: '6px' }}>
                                {DAY_KEYS.map((day, idx) => {
                                    const dayS = weekSessions.filter(s => {
                                        const d = new Date(s.session_date);
                                        return DAY_KEYS[d.getDay()] === day;
                                    });
                                    return (
                                        <div key={day} className="cal-col" style={{ borderLeft: idx > 0 ? '1px solid #f9f9f9' : 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {dayS.slice(0, 2).map((s, si) => {
                                                const colors = ['blue', 'teal', 'purple', 'green'];
                                                return (
                                                    <div key={s.id} className={`cal-event ${colors[si % colors.length]}`}>
                                                        <div className="event-badge">Class</div>
                                                        <strong>{s.courses?.name || s.title}</strong>
                                                        <div>{s.venues?.name || 'TBA'}</div>
                                                        <div>{s.start_time ? s.start_time.slice(0, 5) : ''}</div>
                                                    </div>
                                                );
                                            })}
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
                        <div style={{ position: 'relative', cursor: 'default', width: '100%', height: '130px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyBarData} barSize={10} margin={{ top: 5, right: 5, left: 5, bottom: 15 }}>
                                    <CartesianGrid vertical={false} stroke="#eee" strokeDasharray="3 3" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#aaa' }} dy={4} />
                                    <YAxis hide={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} domain={[0, 100]} width={25} />
                                    <Bar dataKey="val" radius={[4, 4, 4, 4]} minPointSize={3}>
                                        {weeklyBarData.map((entry, index) => {
                                            const todayDayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
                                            const isToday = index === todayDayIdx;
                                            const color = isToday ? '#003366' : entry.hasData ? '#66d9e8' : '#e8e8e8';
                                            return <Cell key={`cell-${index}`} fill={color} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="attendance-summary">
                            <div className="summary-left">
                                <div className="summary-label">Total Attendance</div>
                                <div className="progress-circle">{attendance ? `${Math.round(attendance.overall?.pct || 0)}%` : '—'}</div>
                            </div>
                            <div className="summary-right">
                                <div className="badge-pill blue">Attended: {attendance?.overall?.attended || 0}</div>
                                <div className="badge-pill pink">Missed: {attendance?.overall?.absent || 0}</div>
                            </div>
                        </div>
                    </div>

                    {/* ── Pending Assignments ── */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                        <div className="section-title" style={{ margin: 0 }}>Pending Assignments</div>
                        {gcConnected && (
                            <button
                                onClick={fetchGcAssignments}
                                title="Refresh Google Classroom"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#888', display: 'flex', alignItems: 'center' }}
                            >
                                <RefreshCw size={13} style={{ animation: gcLoading ? 'spin 1s linear infinite' : 'none' }} />
                            </button>
                        )}
                    </div>

                    {/* Google Classroom not set up */}
                    {gcConnected === false && (
                        <div style={{ marginBottom: '10px', padding: '10px 12px', background: '#fafafa', borderRadius: '10px', border: '1px solid #ebebeb' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <img src="https://ssl.gstatic.com/classroom/favicon.png" alt="GC" width={13} height={13} style={{ opacity: 0.5 }} />
                                Google Classroom
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#aaa', lineHeight: 1.4 }}>Classroom sync not set up yet. Contact your admin.</div>
                        </div>
                    )}

                    {/* Loading state */}
                    {gcConnected === null && (
                        <div>{[1,2].map(i => (
                            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 0' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ width: `${60 + i * 15}%`, height: '10px', borderRadius: '4px', background: '#f0f0f0', marginBottom: '5px', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                                    <div style={{ width: '40%', height: '8px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.25}s` }} />
                                </div>
                            </div>
                        ))}</div>
                    )}

                    {/* Merged assignment list: ERP + Google Classroom */}
                    {(() => {
                        // Build unified list
                        const erpItems = assignments.map(a => ({
                            id: a.id,
                            title: a.title,
                            courseName: a.courses?.name || '',
                            subtitle: a.faculty?.users ? `${a.faculty.users.first_name} ${a.faculty.users.last_name}` : '',
                            dueDate: a.due_date,
                            source: 'erp',
                            link: null,
                        }));

                        const gcItems = gcAssignments.map(a => ({
                            id: `gc_${a.id}`,
                            title: a.title,
                            courseName: a.courseName,
                            subtitle: '',
                            dueDate: a.dueDate,
                            source: 'google_classroom',
                            link: a.alternateLink,
                        }));

                        const combined = [...erpItems, ...gcItems].sort((a, b) => {
                            if (!a.dueDate && !b.dueDate) return 0;
                            if (!a.dueDate) return 1;
                            if (!b.dueDate) return -1;
                            return new Date(a.dueDate) - new Date(b.dueDate);
                        }).slice(0, 5);

                        if (combined.length === 0) {
                            return <div style={{ padding: '0.75rem', color: '#aaa', fontSize: '0.82rem' }}>No pending assignments!</div>;
                        }

                        return combined.map((a) => {
                            let daysLeft = null;
                            if (a.dueDate) {
                                const due = new Date(a.dueDate);
                                const today = new Date();
                                due.setHours(0, 0, 0, 0);
                                today.setHours(0, 0, 0, 0);
                                daysLeft = Math.round((due - today) / (1000 * 60 * 60 * 24));
                            }
                            const daysColor = daysLeft !== null ? (daysLeft <= 0 ? '#ef4444' : daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#22c55e') : '#ccc';
                            const daysLabel = daysLeft !== null ? (daysLeft < 0 ? 'Late' : daysLeft === 0 ? 'Today' : `${daysLeft}d`) : '—';
                            const isGC = a.source === 'google_classroom';

                            return (
                                <div
                                    key={a.id}
                                    className="assignment-card"
                                    onClick={() => { if (a.link) window.open(a.link, '_blank'); }}
                                    style={{ cursor: a.link ? 'pointer' : 'default', transition: 'box-shadow 0.15s', position: 'relative' }}
                                    onMouseEnter={e => { if (a.link) e.currentTarget.style.boxShadow = '0 2px 12px rgba(26,86,219,0.10)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                                >
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <div className="icon-box" style={{ background: isGC ? '#e8f0fe' : undefined, color: isGC ? '#1a56db' : undefined, flexShrink: 0 }}>
                                            {isGC
                                                ? <img src="https://ssl.gstatic.com/classroom/favicon.png" alt="GC" width={16} height={16} />
                                                : <FileText size={16} />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <div style={{ fontSize: '0.80rem', fontWeight: 700, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>{a.title}</div>
                                                {isGC && (
                                                    <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: '#e8f0fe', color: '#1a56db', flexShrink: 0 }}>GC</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.67rem', color: '#888', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.courseName}</div>
                                            {a.subtitle && <div style={{ fontSize: '0.63rem', color: '#aaa' }}>{a.subtitle}</div>}
                                        </div>
                                        {a.link && <ExternalLink size={11} color="#aaa" style={{ flexShrink: 0 }} />}
                                    </div>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.63rem', fontWeight: 700, color: daysColor, border: `2px solid ${daysColor}`, background: `${daysColor}10`, flexShrink: 0 }}>
                                        {daysLabel}
                                    </div>
                                </div>
                            );
                        });
                    })()}

                    <div className="section-title" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Pending Feedback</div>
                    {pendingFeedback ? (
                        <div className="feedback-box" onClick={() => router.push('/feedback')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                            <div>
                                <div className="feedback-text" style={{ fontSize: '0.9rem' }}>Feedback pending<br />for {pendingFeedback.courses?.name || 'a session'}</div>
                                <div className="feedback-sub">Tap to submit your feedback</div>
                            </div>
                            <div style={{ width: '40px', height: '40px', background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                                <ChevronDown size={20} style={{ transform: 'rotate(-90deg)' }} />
                            </div>
                        </div>
                    ) : (
                        <div className="feedback-box" style={{ color: '#888', fontSize: '0.82rem' }}>No pending feedback.</div>
                    )}
                </div>
            </div>

            {/* PROFILE PANEL OVERLAY */}
            {showProfile && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.25)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setShowProfile(false)}>
                    <div style={{ width: '380px', maxWidth: '90vw', background: '#fff', borderLeft: '1px solid #e8e8e8', height: '100%', overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.05)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111' }}>Student Profile</span>
                            <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><X size={16} /></button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                                <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #e8e8e8', flexShrink: 0 }}>
                                    <img src="/studentPic.png" alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                                    ['Email', user?.email || '—'],
                                    ['Status', 'Active'],
                                ].map(([label, val], i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', borderBottom: i < 3 ? '1px solid #f5f5f5' : 'none' }}>
                                        <span style={{ color: '#888' }}>{label}</span>
                                        <span style={{ fontWeight: 600, color: '#333', fontFamily: 'monospace', fontSize: '0.76rem' }}>{val}</span>
                                    </div>
                                ))}
                            </div>
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
                                        <input type="text" value={macInput} onChange={handleMacChange} placeholder="XX:XX:XX:XX:XX:XX" maxLength={17}
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

            {/* MAC UPDATE CONFIRMATION MODAL */}
            {showMacConfirm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', width: '340px', maxWidth: '90vw', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Confirm Device Update</span>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ fontSize: '0.82rem', color: '#555', lineHeight: '1.6', marginBottom: '16px' }}>Are you sure you want to update your registered device?</div>
                            <div style={{ padding: '10px 14px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                                    <span style={{ color: '#888' }}>Current</span>
                                    <span style={{ fontFamily: 'monospace', color: '#999', fontWeight: 500 }}>{registeredMac || 'None'}</span>
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
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
        </div>
    );
};

export default StudentDashboard;
