'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, RefreshCw, Activity, CheckCircle,
    AlertTriangle, Plus, Send, Mail, MapPin, User, AlertCircle, X, BarChart3
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

export default function AdminDashboard() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [notifyStatus, setNotifyStatus] = useState(null);
    const [newClass, setNewClass] = useState({ course_id: '', faculty_id: '', session_date: '', start_time: '', end_time: '', venue_id: '', title: '' });
    const [scheduling, setScheduling] = useState(false);
    const [scheduleError, setScheduleError] = useState('');

    // Live data
    const [summary, setSummary] = useState(null);
    const [upcomingClasses, setUpcomingClasses] = useState([]);
    const [feedbackStatus, setFeedbackStatus] = useState([]);
    const [recentSessions, setRecentSessions] = useState([]);
    const [weeklyData, setWeeklyData] = useState({ weekly: [], averageAttendance: 0, totalAbsent: 0 });
    const [loading, setLoading] = useState(true);

    const navTo = (p) => router.push(p);

    const fetchAll = useCallback(async () => {
        try {
            const [dashRes, upRes, fbRes, wkRes] = await Promise.allSettled([
                api.get('/api/admin/dashboard'),
                api.get('/api/admin/sessions?upcoming=true'),
                api.get('/api/admin/feedback/status'),
                api.get('/api/admin/attendance/weekly'),
            ]);
            if (dashRes.status === 'fulfilled') {
                setSummary(dashRes.value.summary);
                setRecentSessions(dashRes.value.recent_sessions || []);
            }
            if (upRes.status === 'fulfilled')  setUpcomingClasses((upRes.value.sessions || []).slice(0, 3));
            if (fbRes.status === 'fulfilled')  setFeedbackStatus(fbRes.value.feedback_status || []);
            if (wkRes.status === 'fulfilled')  setWeeklyData(wkRes.value);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchAll(); }, [fetchAll, authReady]);

    const totalPending = feedbackStatus.reduce((a, c) => a + c.pending, 0);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin' : 'Admin';

    const handleNotifyAll = async (sessionId) => {
        setNotifyStatus('sending');
        try {
            await api.post('/api/admin/notifications', { type: 'class_reminder', message: 'Class reminder notification', recipients: 'all' });
            setNotifyStatus('sent');
            setTimeout(() => setNotifyStatus(null), 2500);
        } catch { setNotifyStatus(null); }
    };

    const handleScheduleSubmit = async () => {
        setScheduleError('');
        if (!newClass.title || !newClass.session_date || !newClass.start_time || !newClass.end_time) {
            setScheduleError('Title, date, start time, and end time are required.');
            return;
        }
        setScheduling(true);
        try {
            await api.post('/api/admin/sessions', {
                title: newClass.title,
                course_id: newClass.course_id || undefined,
                faculty_id: newClass.faculty_id || undefined,
                venue_id: newClass.venue_id || undefined,
                session_date: newClass.session_date,
                start_time: newClass.start_time,
                end_time: newClass.end_time,
            });
            setShowScheduleModal(false);
            setNewClass({ course_id: '', faculty_id: '', session_date: '', start_time: '', end_time: '', venue_id: '', title: '' });
            fetchAll(); // reload
        } catch (e) {
            setScheduleError(e.message);
        } finally {
            setScheduling(false);
        }
    };

    const formatDate = (d) => {
        if (!d) return '—';
        const now = new Date().toISOString().split('T')[0];
        const tom = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        if (d === now) return 'Today';
        if (d === tom) return 'Tomorrow';
        return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const formatTime = (t) => {
        if (!t) return '';
        const [h, m] = t.split(':').map(Number);
        return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
    };

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>
                            {user?.firstName?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '8px 1rem 4px' }}><span>Main</span></div>
                        <div className="nav-item active"><LayoutGrid size={18} /> <span>Dashboard</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content">
                <div className="content-center admin-full">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Dashboard</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search sessions, students..." className="search-input" /></div>
                            <Bell size={20} color="#555" style={{ cursor: 'pointer' }} />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Summary Cards */}
                    {summary && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                            {[
                                { label: 'Total Students', value: summary.total_students || 0, color: '#0b6861' },
                                { label: 'Total Faculty', value: summary.total_faculty || 0, color: '#3B2D82' },
                                { label: 'Total Sessions', value: summary.total_sessions || 0, color: '#E91E87' },
                            ].map((c, i) => (
                                <div key={i} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: `3px solid ${c.color}`, padding: '1rem 1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                                    <div style={{ fontSize: '0.78rem', color: '#888', fontWeight: 500 }}>{c.label}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Row 1: Quick Actions + Weekly Attendance */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={16} /> Quick Actions</div>
                            <div style={{ padding: '1rem 1.2rem', display: 'flex', gap: '8px' }}>
                                {[
                                    { label: 'Schedule New Class', icon: Plus, bg: '#eff6ff', color: '#2563eb', action: () => setShowScheduleModal(true) },
                                    { label: 'Attendance Monitor', icon: CheckCircle, bg: '#ecfdf5', color: '#16a34a', action: () => navTo('/admin/attendance') },
                                    { label: 'Wi-Fi Logs', icon: Wifi, bg: '#faf5ff', color: '#7c3aed', action: () => navTo('/admin/wifi-logs') },
                                    { label: 'Feedback Analytics', icon: MessageSquare, bg: '#fef2f2', color: '#E91E87', action: () => navTo('/admin/feedback') },
                                    { label: 'Reports', icon: FileBarChart, bg: '#fff7ed', color: '#c2410c', action: () => {} },
                                ].map((item, i) => (
                                    <button key={i} onClick={item.action} className="change-status-btn" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 6px', borderRadius: '10px', border: '1px solid #f0f0f0', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, color: '#555', transition: 'all 0.15s', textAlign: 'center' }}>
                                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.bg, color: item.color }}><item.icon size={16} /></div>
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}><BarChart3 size={16} /> Weekly Attendance</div>
                                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>This Week</span>
                            </div>
                            <div style={{ flex: 1, padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px', padding: '0 2px' }}>
                                    {(weeklyData.weekly.length > 0 ? weeklyData.weekly : [
                                        { day: 'Mon', pct: 0 }, { day: 'Tue', pct: 0 }, { day: 'Wed', pct: 0 },
                                        { day: 'Thu', pct: 0 }, { day: 'Fri', pct: 0 }, { day: 'Sat', pct: 0 }
                                    ]).map((d, i) => (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#555' }}>{d.pct}%</span>
                                            <div style={{ width: '100%', maxWidth: '24px', borderRadius: '5px', height: `${Math.max(4, d.pct * 0.65)}px`, background: d.pct >= 85 ? '#0b6861' : '#66d9e8', transition: 'height 0.3s' }} />
                                            <span style={{ fontSize: '0.55rem', color: '#aaa', fontWeight: 500 }}>{d.day}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <div style={{ flex: 1, padding: '7px 10px', borderRadius: '10px', background: '#ecfdf5', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#065f46' }}>{weeklyData.averageAttendance}%</div>
                                        <div style={{ fontSize: '0.58rem', color: '#065f46', fontWeight: 500 }}>Avg. This Week</div>
                                    </div>
                                    <div style={{ flex: 1, padding: '7px 10px', borderRadius: '10px', background: '#fef2f2', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#dc2626' }}>{weeklyData.totalAbsent}</div>
                                        <div style={{ fontSize: '0.58rem', color: '#dc2626', fontWeight: 500 }}>Absent Today</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Upcoming Classes + Feedback Status */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}><Calendar size={16} /> Upcoming Classes</div>
                                <button onClick={() => setShowScheduleModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                                    <Plus size={13} /> Schedule Class
                                </button>
                            </div>
                            <div>
                                {loading ? (
                                    <div style={{ padding: '1.5rem', color: '#aaa', fontSize: '0.85rem', textAlign: 'center' }}>Loading...</div>
                                ) : upcomingClasses.length === 0 ? (
                                    <div style={{ padding: '1.5rem', color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>No upcoming classes scheduled</div>
                                ) : upcomingClasses.map((cls, i) => (
                                    <div key={cls.id} className="attendance-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 1.5rem', borderBottom: i < upcomingClasses.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111', marginBottom: '3px' }}>{cls.courses?.name} — {cls.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                {cls.faculty?.users && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><User size={11} /> {cls.faculty.users.first_name} {cls.faculty.users.last_name}</span>}
                                                {cls.venues && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={11} /> {cls.venues.name}</span>}
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={11} /> {formatDate(cls.session_date)}, {formatTime(cls.start_time)}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Users size={11} /> {cls.enrolled_students} students</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <span style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: cls.status === 'scheduled' ? '#ecfdf5' : '#fffbeb', color: cls.status === 'scheduled' ? '#166534' : '#92400e' }}>
                                                {cls.status === 'scheduled' ? 'Confirmed' : cls.status}
                                            </span>
                                            <button onClick={() => handleNotifyAll(cls.id)} disabled={notifyStatus === 'sending'} className="change-status-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', border: '1px solid #eee', background: notifyStatus === 'sent' ? '#ecfdf5' : '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: notifyStatus === 'sent' ? '#166534' : '#555' }}>
                                                {notifyStatus === 'sending' ? <><RefreshCw size={11} /> Sending...</> : notifyStatus === 'sent' ? <><CheckCircle size={11} /> Sent!</> : <><Send size={11} /> Notify All</>}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #E91E87', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}><MessageSquare size={16} /> Feedback Status</div>
                                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} /> {totalPending} pending</div>
                            </div>
                            <div>
                                {loading ? (
                                    <div style={{ padding: '1.5rem', color: '#aaa', fontSize: '0.85rem', textAlign: 'center' }}>Loading...</div>
                                ) : feedbackStatus.length === 0 ? (
                                    <div style={{ padding: '1.5rem', color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>No courses found</div>
                                ) : feedbackStatus.map((item, i) => {
                                    const pct = item.total > 0 ? Math.round((item.submitted / item.total) * 100) : 0;
                                    return (
                                        <div key={i} style={{ padding: '12px 1.5rem', borderBottom: i < feedbackStatus.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111' }}>{item.course}</span>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: item.pending === 0 ? '#16a34a' : item.pending > 15 ? '#dc2626' : '#b45309' }}>
                                                    {item.pending === 0 ? '✓ Complete' : `${item.pending} pending`}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ flex: 1, height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', transition: 'width 0.4s', background: pct === 100 ? '#16a34a' : pct > 60 ? '#111' : '#dc2626' }} />
                                                </div>
                                                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500, minWidth: '55px', textAlign: 'right' }}>{item.submitted}/{item.total}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ padding: '10px 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                                <button className="change-status-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>
                                    <Mail size={13} /> Send Reminder to All Pending
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Recent Sessions */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16} /> Recent Sessions</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                            {recentSessions.slice(0, 6).map((s, i) => (
                                <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 1.5rem', borderBottom: i < Math.min(recentSessions.length, 6) - 2 ? '1px solid #f5f5f5' : 'none', borderRight: i % 2 === 0 ? '1px solid #f5f5f5' : 'none' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.status === 'completed' ? '#16a34a' : s.status === 'cancelled' ? '#dc2626' : '#2563eb', marginTop: '6px', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#333', lineHeight: 1.4 }}>{s.courses?.name ? `${s.courses.name} — ` : ''}{s.title}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '2px' }}>{formatDate(s.session_date)} • {s.status}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Modal */}
            {showScheduleModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowScheduleModal(false)}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '480px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Schedule New Class</h3>
                            <button onClick={() => setShowScheduleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {scheduleError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', color: '#dc2626' }}>{scheduleError}</div>}
                            {[
                                { label: 'Session Title *', key: 'title', type: 'text', placeholder: 'e.g. Data Structures — Lecture 5' },
                                { label: 'Date *', key: 'session_date', type: 'date', placeholder: '' },
                                { label: 'Start Time *', key: 'start_time', type: 'time', placeholder: '' },
                                { label: 'End Time *', key: 'end_time', type: 'time', placeholder: '' },
                            ].map(field => (
                                <div key={field.key}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>{field.label}</label>
                                    <input type={field.type} placeholder={field.placeholder} value={newClass[field.key]} onChange={e => setNewClass({ ...newClass, [field.key]: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                            <button onClick={() => setShowScheduleModal(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>Cancel</button>
                            <button onClick={handleScheduleSubmit} disabled={scheduling} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: scheduling ? '#aaa' : '#111', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Plus size={14} /> {scheduling ? 'Scheduling...' : 'Schedule & Notify'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
