'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell,
    Menu, ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart,
    CheckCircle, Send, AlertTriangle, RefreshCw, Mail, Search, User, X, Trophy, GraduationCap, Users, Plus
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import '../../Dashboard.css';

export default function AdminNotificationsPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Modal & Tab state
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    // Compose form state
    const [target, setTarget] = useState('all');
    const [triggerType, setTriggerType] = useState('class_reminder');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sentSuccess, setSentSuccess] = useState(false);
    const [sendError, setSendError] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    // Student search state (for "Specific Student" target)
    const [studentSearch, setStudentSearch] = useState('');
    const [studentResults, setStudentResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [searching, setSearching] = useState(false);

    // Data state
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState({ total_sent: 0, unread: 0 });
    const [loading, setLoading] = useState(true);

    const navTo = p => router.push(p);

    // Search students from DB
    const searchStudents = useCallback(async (query) => {
        if (!query || query.length < 2) { setStudentResults([]); return; }
        setSearching(true);
        try {
            const data = await api.get(`/api/admin/students/search?q=${encodeURIComponent(query)}`);
            setStudentResults(data.students || []);
        } catch {
            setStudentResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => searchStudents(studentSearch), 300);
        return () => clearTimeout(timer);
    }, [studentSearch, searchStudents]);

    // Load notification history
    const loadHistory = useCallback(async () => {
        try {
            const data = await api.get('/api/admin/notifications?limit=100');
            setHistory(data.notifications || []);
            setStats(data.stats || { total_sent: 0, unread: 0 });
        } catch {}
        finally { setLoading(false); }
    }, []);

    useEffect(() => { if (authReady) loadHistory(); }, [loadHistory, authReady]);

    const loadSessions = useCallback(async () => {
        setSessionsLoading(true);
        try {
            const data = await api.get('/api/admin/schedule?filter=week');
            setSessions(data.sessions || []);
        } catch {
            setSessions([]);
        } finally {
            setSessionsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (triggerType === 'class_reminder' && authReady) {
            loadSessions();
        } else {
            setSessionId('');
        }
    }, [triggerType, authReady, loadSessions]);

    // Real send handler
    const handleSend = async () => {
        if (!message.trim()) return;
        if (triggerType === 'class_reminder' && !sessionId) {
            setSendError('Please select a session for the class reminder.');
            return;
        }
        if (target === 'specific' && !selectedStudent) {
            setSendError('Please select a student first.');
            return;
        }
        setSending(true);
        setSendError('');

        const body = {
            type: triggerType,
            message: message.trim(),
            title: triggerType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        };
        if (target === 'specific' && selectedStudent) {
            body.recipients = [selectedStudent.id];
        }
        if (triggerType === 'class_reminder' && sessionId) {
            body.session_id = sessionId;
        }

        try {
            await api.post('/api/admin/notifications', body);
            setSentSuccess(true);
            setMessage('');
            setSessionId('');
            setSelectedStudent(null);
            setStudentSearch('');
            loadHistory();
            setTimeout(() => {
                setSentSuccess(false);
                setIsComposeOpen(false);
            }, 2000);
        } catch (err) {
            setSendError(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    const typeColors = {
        'class_reminder':     { label: 'Class Reminder',     bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
        'feedback_reminder':  { label: 'Feedback Reminder',  bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        'feedback_available': { label: 'Feedback Available', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        'schedule_change':    { label: 'Schedule Change',    bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
        'attendance_warning': { label: 'Attendance Warning', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        'leave_request':      { label: 'Leave Request',      bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
        'general':            { label: 'General',            bg: '#f5f5f5', color: '#555',    border: '#e8e8e8' },
    };
    const getTypeStyle = t => typeColors[t] || { label: (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), bg: '#f5f5f5', color: '#555', border: '#e8e8e8' };

    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin' : 'Admin';

    const filteredHistory = history.filter(n => {
        if (activeTab === 'all') return true;
        if (activeTab === 'leaves') return n.type.includes('leave');
        if (activeTab === 'feedback') return n.type.includes('feedback');
        if (activeTab === 'reminders') return ['class_reminder', 'attendance_warning', 'schedule_change'].includes(n.type) || n.type.includes('reminder');
        if (activeTab === 'general') return !n.type.includes('leave') && !n.type.includes('feedback') && !['class_reminder', 'attendance_warning', 'schedule_change'].includes(n.type) && !n.type.includes('reminder');
        return true;
    });

    const tabs = [
        { id: 'all', label: 'All Notifications' },
        { id: 'reminders', label: 'Reminders' },
        { id: 'feedback', label: 'Feedback' },
        { id: 'leaves', label: 'Leaves' },
        { id: 'general', label: 'General' },
    ];

    const sidebarNav = (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
            <div>
                <div className="user-profile" style={{ position: 'relative' }}>
                    <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                        {user?.firstName?.[0]?.toUpperCase() || 'A'}
                    </div>
                    <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                    <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </div>
                </div>
                <nav className="nav-menu">
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '8px 1rem 4px' }}><span>Main</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin')} style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Dashboard</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/schedule')} style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/live-students')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Live Students</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/students')} style={{ cursor: 'pointer' }}><GraduationCap size={18} /> <span>Student Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/leave-requests')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Leave Requests</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/leaderboard')} style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/reports')} style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                        <div className="nav-item active"><Bell size={18} /> <span>Notifications</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/settings')} style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    </nav>
            </div>
            <div className="sidebar-footer">
                <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
            </div>
        </aside>
    );

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            {sidebarNav}
            <div className="main-content">
                <div className="content-center admin-full">
                    <header className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Notifications</h1>
                        </div>
                        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button onClick={() => setIsComposeOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#3B2D82', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
                                <Plus size={16} /> New Notification
                            </button>
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                        {[
                            { label: 'Total Sent', value: stats.total_sent, icon: Send, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'In History', value: history.length, icon: Bell, color: '#7c3aed', bg: '#faf5ff' },
                            { label: 'Unread', value: stats.unread, icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
                        ].map((stat, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.bg, color: stat.color, flexShrink: 0 }}><stat.icon size={18} /></div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>{loading ? '—' : stat.value}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    border: '1px solid',
                                    borderColor: activeTab === tab.id ? '#3B2D82' : '#e8e8e8',
                                    background: activeTab === tab.id ? '#3B2D82' : '#fff',
                                    color: activeTab === tab.id ? '#fff' : '#555',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Notification History */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: `3px solid ${activeTab === 'all' ? '#00A5A0' : '#3B2D82'}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={18} color="#3B2D82" /> {tabs.find(t => t.id === activeTab)?.label}
                            </div>
                            <button onClick={loadHistory} style={{ border: 'none', background: '#f5f5f5', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#e8e8e8'} onMouseLeave={e => e.currentTarget.style.background = '#f5f5f5'}>
                                <RefreshCw size={12} /> Refresh
                            </button>
                        </div>
                        <div style={{ overflowX: 'auto', minHeight: '300px' }}>
                            {loading ? (
                                <div>
                                    {[1,2,3,4].map(i => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 1.5rem', borderBottom: '1px solid #f5f5f5' }}>
                                            <div style={{ width: '90px', height: '22px', borderRadius: '6px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ width: `${50 + i * 10}%`, height: '14px', borderRadius: '4px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                                <div style={{ width: `${30 + i * 8}%`, height: '10px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                                            </div>
                                            <div style={{ width: '80px', height: '12px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.12}s` }} />
                                            <div style={{ width: '70px', height: '12px', borderRadius: '3px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.18}s` }} />
                                        </div>
                                    ))}
                                </div>
                            ) : filteredHistory.length === 0 ? (
                                <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <Bell size={40} color="#e5e7eb" />
                                    <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No notifications found</div>
                                    <div style={{ fontSize: '0.8rem' }}>There are no notifications in the "{tabs.find(t => t.id === activeTab)?.label}" category.</div>
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            {['Type', 'Title / Message', 'Recipient', 'Sent At'].map(h => (
                                                <th key={h} style={{ padding: '12px 1.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', borderBottom: '1px solid #e8e8e8' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredHistory.map(n => {
                                            const tc = getTypeStyle(n.type);
                                            const recipient = n.recipient
                                                ? `${n.recipient.first_name} ${n.recipient.last_name}`
                                                : 'All Students';
                                            const sentAt = n.created_at
                                                ? new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                : '—';
                                            return (
                                                <tr key={n.id} style={{ borderBottom: '1px solid #f5f5f5', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    <td style={{ padding: '14px 1.5rem', verticalAlign: 'top' }}>
                                                        <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, whiteSpace: 'nowrap' }}>{tc.label}</span>
                                                    </td>
                                                    <td style={{ padding: '14px 1.5rem', maxWidth: '350px', verticalAlign: 'top' }}>
                                                        <div style={{ fontWeight: 700, color: '#111', fontSize: '0.88rem', marginBottom: '4px', lineHeight: '1.4' }}>{n.title}</div>
                                                        <div style={{ color: '#666', fontSize: '0.8rem', lineHeight: '1.5' }}>{n.message}</div>
                                                    </td>
                                                    <td style={{ padding: '14px 1.5rem', fontSize: '0.8rem', color: '#555', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <User size={12} color="#888" />
                                                            </div>
                                                            <span style={{ fontWeight: 500 }}>{recipient}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#888', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{sentAt}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Compose Modal */}
                    {isComposeOpen && (
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '1rem' }}>
                            <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '600px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                                <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={18} color="#3B2D82" /> Compose Notification</div>
                                    <button onClick={() => setIsComposeOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', padding: '4px' }}><X size={20} /></button>
                                </div>
                                
                                <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                        {/* Target Audience */}
                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '6px' }}>Target Audience</label>
                                            <select value={target} onChange={e => { setTarget(e.target.value); setSelectedStudent(null); setStudentSearch(''); setStudentResults([]); }}
                                                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', background: '#fff', outline: 'none', cursor: 'pointer', width: '100%', transition: 'border 0.2s' }}
                                                onFocus={e => e.target.style.borderColor = '#3B2D82'} onBlur={e => e.target.style.borderColor = '#e5e7eb'}>
                                                <option value="all">All Students</option>
                                                <option value="specific">Specific Student</option>
                                            </select>
                                        </div>

                                        {/* Notification Type */}
                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '6px' }}>Notification Type</label>
                                            <select value={triggerType} onChange={e => setTriggerType(e.target.value)}
                                                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', background: '#fff', outline: 'none', cursor: 'pointer', width: '100%', transition: 'border 0.2s' }}
                                                onFocus={e => e.target.style.borderColor = '#3B2D82'} onBlur={e => e.target.style.borderColor = '#e5e7eb'}>
                                                <option value="class_reminder">🔔 Class Reminder</option>
                                                <option value="schedule_change">📅 Schedule Change</option>
                                                <option value="feedback_reminder">📝 Feedback Reminder</option>
                                                <option value="attendance_warning">⚠️ Attendance Warning</option>
                                                <option value="general">📢 Custom / General</option>
                                            </select>
                                        </div>
                                    </div>

                                    {triggerType === 'class_reminder' && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '6px' }}>Session (Required)</label>
                                            <select
                                                value={sessionId}
                                                onChange={e => setSessionId(e.target.value)}
                                                disabled={sessionsLoading}
                                                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', background: '#fff', outline: 'none', cursor: 'pointer', width: '100%', transition: 'border 0.2s' }}
                                                onFocus={e => e.target.style.borderColor = '#3B2D82'} onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                                            >
                                                <option value="">{sessionsLoading ? 'Loading sessions...' : 'Select a session to remind students about'}</option>
                                                {sessions.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.course || 'Course'} — {s.title} ({s.date} {s.time})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Student search */}
                                    {target === 'specific' && (
                                        <div style={{ marginBottom: '16px', position: 'relative' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '6px' }}>Search Student</label>
                                            {selectedStudent ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #3B2D82', background: '#f5f3ff' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3B2D82', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
                                                        {selectedStudent.first_name?.[0]?.toUpperCase() || 'S'}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111' }}>{selectedStudent.first_name} {selectedStudent.last_name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#888' }}>{selectedStudent.email}</div>
                                                    </div>
                                                    <button onClick={() => { setSelectedStudent(null); setStudentSearch(''); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', padding: '4px' }}><X size={16} /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ position: 'relative' }}>
                                                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
                                                        <input
                                                            type="text"
                                                            value={studentSearch}
                                                            onChange={e => setStudentSearch(e.target.value)}
                                                            placeholder="Type student name or email..."
                                                            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', background: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' }}
                                                            onFocus={e => e.target.style.borderColor = '#3B2D82'}
                                                            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                                                        />
                                                        {searching && <RefreshCw size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', animation: 'spin 1s linear infinite' }} />}
                                                    </div>
                                                    {studentResults.length > 0 && (
                                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '200px', overflowY: 'auto', marginTop: '6px' }}>
                                                            {studentResults.map(s => (
                                                                <div key={s.id} onClick={() => { setSelectedStudent(s); setStudentResults([]); setStudentSearch(''); }}
                                                                    style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f5f5f5' }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = '#f8f5ff'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e5e7eb', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
                                                                        {s.first_name?.[0]?.toUpperCase() || 'S'}
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111' }}>{s.first_name} {s.last_name}</div>
                                                                        <div style={{ fontSize: '0.75rem', color: '#888' }}>{s.email}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {studentSearch.length >= 2 && studentResults.length === 0 && !searching && (
                                                        <div style={{ padding: '10px 14px', fontSize: '0.85rem', color: '#888', background: '#fafafa', borderRadius: '8px', marginTop: '6px', border: '1px solid #f0f0f0' }}>
                                                            No students found matching "{studentSearch}"
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Message */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '6px' }}>Message</label>
                                        <textarea
                                            value={message}
                                            onChange={e => setMessage(e.target.value)}
                                            placeholder="Write the notification content here..."
                                            rows={4}
                                            style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.9rem', fontFamily: 'inherit', color: '#333', outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: '#fff', transition: 'border 0.2s' }}
                                            onFocus={e => e.target.style.borderColor = '#3B2D82'}
                                            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                                        />
                                    </div>
                                </div>

                                <div style={{ padding: '1.2rem 1.5rem', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {sentSuccess && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600, background: '#dcfce7', padding: '6px 12px', borderRadius: '20px' }}>
                                                <CheckCircle size={16} /> Notification Sent Successfully!
                                            </span>
                                        )}
                                        {sendError && <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={14}/> {sendError}</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button onClick={() => setIsComposeOpen(false)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>
                                            Cancel
                                        </button>
                                        <button onClick={handleSend} disabled={sending || !message.trim()}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: sending ? '#888' : '#3B2D82', cursor: sending ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#fff', opacity: !message.trim() && !sending ? 0.5 : 1, transition: 'background 0.2s' }}>
                                            {sending ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : <><Send size={16} /> Send</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
        </div>
    );
}
