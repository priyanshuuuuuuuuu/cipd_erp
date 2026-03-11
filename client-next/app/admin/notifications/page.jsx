'use client';
import React, { useState } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Send,
    AlertTriangle, Users, RefreshCw, X, Mail, AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminNotificationsPage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [target, setTarget] = useState('all');
    const [triggerType, setTriggerType] = useState('class_reminder');
    const [message, setMessage] = useState('');
    const [courseTarget, setCourseTarget] = useState('');
    const [sending, setSending] = useState(false);
    const [sentSuccess, setSentSuccess] = useState(false);

    const navTo = p => router.push(p);

    const notificationHistory = [
        { id: 1, type: 'Class Reminder', message: 'Reminder: CS301 — Data Structures starts at 09:00 AM tomorrow. Please be on time.', target: 'CS301 Students (42)', sentAt: '2026-02-16 18:00', delivered: 40, failed: 2 },
        { id: 2, type: 'Schedule Change', message: 'PHY201 — Quantum Physics has been rescheduled to 3:00 PM on Thursday.', target: 'PHY201 Students (38)', sentAt: '2026-02-15 10:30', delivered: 38, failed: 0 },
        { id: 3, type: 'Missing Feedback', message: 'You have pending feedback for today\'s session. Please complete it within 24 hours.', target: 'All Students', sentAt: '2026-02-14 17:00', delivered: 142, failed: 3 },
        { id: 4, type: 'Attendance Warning', message: 'Your attendance in CS301 is below 75%. Please ensure regular attendance.', target: '8 Students', sentAt: '2026-02-14 09:00', delivered: 8, failed: 0 },
        { id: 5, type: 'Custom', message: 'Mid-semester examination schedule has been published. Please check your dashboards.', target: 'All Students', sentAt: '2026-02-12 14:00', delivered: 156, failed: 1 },
        { id: 6, type: 'Class Reminder', message: 'Reminder: MATH101 — Calculus II starts at 02:00 PM tomorrow in Room 102, Block A.', target: 'MATH101 Students (45)', sentAt: '2026-02-11 18:00', delivered: 44, failed: 1 },
    ];

    const handleSend = () => {
        if (!message.trim()) return;
        setSending(true);
        setTimeout(() => {
            setSending(false);
            setSentSuccess(true);
            setMessage('');
            setTimeout(() => setSentSuccess(false), 2500);
        }, 1500);
    };

    const typeColors = {
        'Class Reminder': { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
        'Schedule Change': { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
        'Missing Feedback': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        'Attendance Warning': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        'Custom': { bg: '#f5f5f5', color: '#555', border: '#e8e8e8' },
    };

    const totalSent = notificationHistory.reduce((a, n) => a + n.delivered, 0);
    const totalFailed = notificationHistory.reduce((a, n) => a + n.failed, 0);

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
                            { label: 'Total Sent', value: totalSent, icon: Send, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Notifications', value: notificationHistory.length, icon: Bell, color: '#7c3aed', bg: '#faf5ff' },
                            { label: 'Failed', value: totalFailed, icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
                        ].map((stat, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.bg, color: stat.color, flexShrink: 0 }}><stat.icon size={18} /></div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>{stat.value}</div>
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
                                <div style={{ minWidth: '180px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Target Audience</label>
                                    <select value={target} onChange={e => setTarget(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                        <option value="all">All Students</option>
                                        <option value="course">By Course</option>
                                        <option value="specific">Specific Student</option>
                                    </select>
                                </div>
                                {target === 'course' && (
                                    <div style={{ minWidth: '200px' }}>
                                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Select Course</label>
                                        <select value={courseTarget} onChange={e => setCourseTarget(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                            <option value="">Choose...</option>
                                            <option value="CS301">CS301 — Data Structures</option>
                                            <option value="PHY201">PHY201 — Quantum Physics</option>
                                            <option value="MATH101">MATH101 — Calculus II</option>
                                            <option value="ENG102">ENG102 — Technical Writing</option>
                                        </select>
                                    </div>
                                )}
                                {target === 'specific' && (
                                    <div style={{ minWidth: '200px' }}>
                                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Student ID / Name</label>
                                        <input type="text" placeholder="e.g. STU-2023001" style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                                    </div>
                                )}
                                <div style={{ minWidth: '180px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Notification Type</label>
                                    <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                        <option value="class_reminder">Class Reminder</option>
                                        <option value="schedule_change">Schedule Change</option>
                                        <option value="missing_feedback">Missing Feedback</option>
                                        <option value="attendance_warning">Attendance Warning</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Message</label>
                                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your notification message..." rows={3}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: '#fafafa' }}
                                    onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                {sentSuccess && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}><CheckCircle size={14} /> Notification sent successfully!</span>}
                                <button onClick={handleSend} disabled={sending || !message.trim()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', border: 'none', background: sending ? '#555' : '#111', cursor: sending ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', opacity: !message.trim() && !sending ? 0.5 : 1 }}>
                                    {sending ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : <><Send size={14} /> Send Notification</>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Notification History */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16} /> Notification History</div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        {['Type', 'Message', 'Target', 'Sent At', 'Delivered', 'Failed', ''].map(h => (
                                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {notificationHistory.map(n => {
                                        const tc = typeColors[n.type] || typeColors.Custom;
                                        return (
                                            <tr key={n.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 500, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, whiteSpace: 'nowrap' }}>{n.type}</span>
                                                </td>
                                                <td style={{ padding: '10px 16px', maxWidth: '280px', color: '#333', lineHeight: 1.4 }}>
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                                                </td>
                                                <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#555', whiteSpace: 'nowrap' }}>{n.target}</td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>{n.sentAt}</td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#16a34a' }}>{n.delivered}</span>
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: n.failed > 0 ? '#dc2626' : '#aaa' }}>{n.failed}</span>
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    {n.failed > 0 && (
                                                        <button className="change-status-btn" style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontSize: '0.7rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={10} /> Retry</button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
