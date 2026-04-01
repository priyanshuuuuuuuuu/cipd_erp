'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell,
    Menu, ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart,
    CheckCircle, Send, AlertTriangle, RefreshCw, Mail
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import '../../Dashboard.css';

export default function AdminNotificationsPage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Compose form state
    const [target, setTarget] = useState('all');
    const [triggerType, setTriggerType] = useState('class_reminder');
    const [message, setMessage] = useState('');
    const [courseTarget, setCourseTarget] = useState('');
    const [sending, setSending] = useState(false);
    const [sentSuccess, setSentSuccess] = useState(false);
    const [sendError, setSendError] = useState('');

    // Data state
    const [courses, setCourses] = useState([]);
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState({ total_sent: 0, unread: 0 });
    const [loading, setLoading] = useState(true);

    const navTo = p => router.push(p);

    // Load courses for the dropdown
    useEffect(() => {
        const token = localStorage.getItem('cipd_token');
        fetch('/api/admin/sessions', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => {
                const seen = new Set();
                const unique = [];
                for (const s of (data.sessions || [])) {
                    const id = s.course_id || s.courses?.id;
                    const name = s.courses?.name || s.title;
                    if (id && !seen.has(id)) { seen.add(id); unique.push({ id, name }); }
                }
                setCourses(unique);
            })
            .catch(() => {});
    }, []);

    // Load notification history
    const loadHistory = useCallback(() => {
        const token = localStorage.getItem('cipd_token');
        fetch('/api/admin/notifications?limit=20', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => {
                setHistory(data.notifications || []);
                setStats(data.stats || { total_sent: 0, unread: 0 });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    // Real send handler
    const handleSend = async () => {
        if (!message.trim()) return;
        setSending(true);
        setSendError('');
        const token = localStorage.getItem('cipd_token');

        const body = {
            type: triggerType,
            message: message.trim(),
            title: triggerType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        };
        if (target === 'course' && courseTarget) body.course_id = courseTarget;

        try {
            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send');
            setSentSuccess(true);
            setMessage('');
            setCourseTarget('');
            loadHistory(); // refresh history
            setTimeout(() => setSentSuccess(false), 3000);
        } catch (err) {
            setSendError(err.message);
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

    const sidebarNav = (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
            <div>
                <div className="user-profile" style={{ position: 'relative' }}>
                    <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>AD</div>
                    <div className="user-info"><h3>Admin</h3><p>admin@cipd.edu</p></div>
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
                    <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours & Honorarium</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/reports')} style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                    <div className="nav-item active"><Bell size={18} /> <span>Notifications</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/settings')} style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                </nav>
            </div>
            <div className="sidebar-footer">
                <div className="nav-item" onClick={() => navTo('/')} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
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
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>{loading ? 'â€”' : stat.value}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Compose Panel */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={16} /> Compose Notification</div>
                        <div style={{ padding: '1.2rem 1.5rem' }}>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                {/* Target Audience */}
                                <div style={{ minWidth: '180px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Target Audience</label>
                                    <select value={target} onChange={e => setTarget(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                        <option value="all">All Students</option>
                                        <option value="course">By Course</option>
                                    </select>
                                </div>

                                {/* Course picker (only when target = course) */}
                                {target === 'course' && (
                                    <div style={{ minWidth: '220px' }}>
                                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Select Course</label>
                                        <select value={courseTarget} onChange={e => setCourseTarget(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                            <option value="">Choose...</option>
                                            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {/* Notification Type */}
                                <div style={{ minWidth: '180px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Notification Type</label>
                                    <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                        <option value="class_reminder">Class Reminder</option>
                                        <option value="schedule_change">Schedule Change</option>
                                        <option value="feedback_reminder">Feedback Reminder</option>
                                        <option value="attendance_warning">Attendance Warning</option>
                                        <option value="general">Custom / General</option>
                                    </select>
                                </div>
                            </div>

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

                            {/* Actions row */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                                {sentSuccess && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
                                        <CheckCircle size={14} /> Notification sent successfully!
                                    </span>
                                )}
                                {sendError && (
                                    <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>
                                        âš  {sendError}
                                    </span>
                                )}
                                <button
                                    onClick={handleSend}
                                    disabled={sending || !message.trim()}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', border: 'none', background: sending ? '#555' : '#3B2D82', cursor: sending ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', opacity: !message.trim() && !sending ? 0.5 : 1, transition: 'background 0.2s' }}
                                >
                                    {sending
                                        ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                                        : <><Send size={14} /> Send Notification</>}
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
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: '0.85rem' }}>Loading...</div>
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
                                                : 'â€”';
                                            return (
                                                <tr key={n.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 500, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, whiteSpace: 'nowrap' }}>{tc.label}</span>
                                                    </td>
                                                    <td style={{ padding: '10px 16px', maxWidth: '300px' }}>
                                                        <div style={{ fontWeight: 600, color: '#222', fontSize: '0.82rem', marginBottom: '2px' }}>{n.title}</div>
                                                        <div style={{ color: '#888', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                                                    </td>
                                                    <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#555', whiteSpace: 'nowrap' }}>{recipient}</td>
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
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

