'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell,
    Menu, ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart,
    CheckCircle, Send, AlertTriangle, RefreshCw, Mail, Search, User, X, Trophy
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
            // Use the users table via supabase — query enrollments / reports for student list
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
            const data = await api.get('/api/admin/notifications?limit=30');
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
            setTimeout(() => setSentSuccess(false), 3000);
        } catch (err) {
            setSendError(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    const typeColors = {
        'class_reminder':     { label: 'Class Reminder',     bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
        'feedback_reminder':  { label: 'Feedback Reminder',  bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        'schedule_change':    { label: 'Schedule Change',    bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
        'attendance_warning': { label: 'Attendance Warning', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        'general':            { label: 'General',            bg: '#f5f5f5', color: '#555',    border: '#e8e8e8' },
    };
    const getTypeStyle = t => typeColors[t] || { label: t, bg: '#f5f5f5', color: '#555', border: '#e8e8e8' };

    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin' : 'Admin';

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
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Notifications</h1>
                        </div>
                        <div className="header-actions">
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Sent', value: stats.total_sent, icon: Send, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'In History', value: history.length, icon: Bell, color: '#7c3aed', bg: '#faf5ff' },
                            { label: 'Unread', value: stats.unread, icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
                        ].map((stat, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.bg, color: stat.color, flexShrink: 0 }}><stat.icon size={18} /></div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>{loading ? '—' : stat.value}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Compose Panel */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={16} /> Compose Notification</div>
                        <div style={{ padding: '1.2rem 1.5rem' }}>

                            {/* Row 1: Target + Type */}
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                {/* Target Audience */}
                                <div style={{ minWidth: '180px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Target Audience</label>
                                    <select value={target} onChange={e => { setTarget(e.target.value); setSelectedStudent(null); setStudentSearch(''); setStudentResults([]); }}
                                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                        <option value="all">All Students</option>
                                        <option value="specific">Specific Student</option>
                                    </select>
                                </div>

                                {/* Notification Type */}
                                <div style={{ minWidth: '200px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Notification Type</label>
                                    <select value={triggerType} onChange={e => setTriggerType(e.target.value)}
                                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                        <option value="class_reminder">🔔 Class Reminder</option>
                                        <option value="schedule_change">📅 Schedule Change</option>
                                        <option value="feedback_reminder">📝 Feedback Reminder</option>
                                        <option value="attendance_warning">⚠️ Attendance Warning</option>
                                        <option value="general">📢 Custom / General</option>
                                    </select>
                                </div>

                                {triggerType === 'class_reminder' && (
                                    <div style={{ minWidth: '260px', flex: 1 }}>
                                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Session (required for weekly schedule email)</label>
                                        <select
                                            value={sessionId}
                                            onChange={e => setSessionId(e.target.value)}
                                            disabled={sessionsLoading}
                                            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}
                                        >
                                            <option value="">{sessionsLoading ? 'Loading sessions...' : 'Select a session'}</option>
                                            {sessions.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.course || 'Course'} — {s.title} ({s.date} {s.time})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Student search (only when "Specific Student") */}
                            {target === 'specific' && (
                                <div style={{ marginBottom: '14px', position: 'relative' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Search Student</label>
                                    {selectedStudent ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #3B2D82', background: '#f5f3ff' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3B2D82', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                                                {selectedStudent.first_name?.[0]?.toUpperCase() || 'S'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111' }}>{selectedStudent.first_name} {selectedStudent.last_name}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#888' }}>{selectedStudent.email}</div>
                                            </div>
                                            <button onClick={() => { setSelectedStudent(null); setStudentSearch(''); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', padding: '2px' }}><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ position: 'relative' }}>
                                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
                                                <input
                                                    type="text"
                                                    value={studentSearch}
                                                    onChange={e => setStudentSearch(e.target.value)}
                                                    placeholder="Type student name or email..."
                                                    style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', boxSizing: 'border-box' }}
                                                    onFocus={e => e.target.style.borderColor = '#3B2D82'}
                                                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                                                />
                                                {searching && <RefreshCw size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', animation: 'spin 1s linear infinite' }} />}
                                            </div>
                                            {studentResults.length > 0 && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 100, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                                                    {studentResults.map(s => (
                                                        <div key={s.id} onClick={() => { setSelectedStudent(s); setStudentResults([]); setStudentSearch(''); }}
                                                            style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f5f5f5' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#f8f5ff'}
                                                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3B2D82', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                                                                {s.first_name?.[0]?.toUpperCase() || 'S'}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#111' }}>{s.first_name} {s.last_name}</div>
                                                                <div style={{ fontSize: '0.72rem', color: '#888' }}>{s.email}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {studentSearch.length >= 2 && studentResults.length === 0 && !searching && (
                                                <div style={{ padding: '8px 12px', fontSize: '0.78rem', color: '#aaa', background: '#fafafa', borderRadius: '8px', marginTop: '4px', border: '1px solid #f0f0f0' }}>
                                                    No students found for &quot;{studentSearch}&quot;
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Message */}
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Message</label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Type your notification message..."
                                    rows={3}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: '#fafafa' }}
                                    onFocus={e => e.target.style.borderColor = '#3B2D82'}
                                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                                />
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                                {sentSuccess && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
                                        <CheckCircle size={14} /> Notification sent!
                                    </span>
                                )}
                                {sendError && <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>⚠ {sendError}</span>}
                                <button onClick={handleSend} disabled={sending || !message.trim()}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', border: 'none', background: sending ? '#555' : '#3B2D82', cursor: sending ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', opacity: !message.trim() && !sending ? 0.5 : 1, transition: 'background 0.2s' }}>
                                    {sending ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : <><Send size={14} /> Send Notification</>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Notification History */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16} /> Notification History</span>
                            <button onClick={loadHistory} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                <RefreshCw size={12} /> Refresh
                            </button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            {loading ? (
                                <div>
                                    {[1,2,3,4].map(i => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 1.5rem', borderBottom: '1px solid #f5f5f5' }}>
                                            <div style={{ width: '90px', height: '20px', borderRadius: '6px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                <div style={{ width: `${50 + i * 10}%`, height: '11px', borderRadius: '4px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                                <div style={{ width: `${30 + i * 8}%`, height: '9px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                                            </div>
                                            <div style={{ width: '80px', height: '10px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.12}s` }} />
                                            <div style={{ width: '70px', height: '10px', borderRadius: '3px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.18}s` }} />
                                        </div>
                                    ))}
                                </div>
                            ) : history.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: '0.85rem' }}>No notifications sent yet.</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            {['Type', 'Title / Message', 'Recipient', 'Sent At'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map(n => {
                                            const tc = getTypeStyle(n.type);
                                            const recipient = n.recipient
                                                ? `${n.recipient.first_name} ${n.recipient.last_name}`
                                                : 'All Students';
                                            const sentAt = n.created_at
                                                ? new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                : '—';
                                            return (
                                                <tr key={n.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 500, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, whiteSpace: 'nowrap' }}>{tc.label}</span>
                                                    </td>
                                                    <td style={{ padding: '10px 16px', maxWidth: '300px' }}>
                                                        <div style={{ fontWeight: 600, color: '#222', fontSize: '0.82rem', marginBottom: '2px' }}>{n.title}</div>
                                                        <div style={{ color: '#888', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                                                    </td>
                                                    <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#555', whiteSpace: 'nowrap' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <User size={12} color="#aaa" /> {recipient}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>{sentAt}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
        </div>
    );
}
