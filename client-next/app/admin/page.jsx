'use client';

import React, { useState } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, RefreshCw, Activity, CheckCircle,
    AlertTriangle, Filter, Plus, Send, Mail, MapPin, User, AlertCircle, X, BarChart3
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [notifyStatus, setNotifyStatus] = useState(null);
    const [newClass, setNewClass] = useState({ course: '', date: '', time: '', venue: '', faculty: '' });

    const navTo = (p) => router.push(p);

    const upcomingClasses = [
        { course: 'CS301 — Data Structures', faculty: 'Prof. Anuj Grover', date: 'Today', time: '11:00 AM', venue: 'Room 204, Block A', students: 42, status: 'Confirmed' },
        { course: 'PHY201 — Quantum Physics', faculty: 'Dr. Priya Sharma', date: 'Today', time: '2:00 PM', venue: 'LHC 3, Block B', students: 38, status: 'Confirmed' },
        { course: 'MATH101 — Calculus II', faculty: 'Prof. Amit Patel', date: 'Tomorrow', time: '9:00 AM', venue: 'Room 102, Block A', students: 45, status: 'Pending' },
    ];
    const feedbackPending = [
        { course: 'CS301 — Data Structures', total: 42, submitted: 28, pending: 14 },
        { course: 'PHY201 — Quantum Physics', total: 38, submitted: 12, pending: 26 },
        { course: 'MATH101 — Calculus II', total: 45, submitted: 45, pending: 0 },
        { course: 'ENG102 — Technical Writing', total: 40, submitted: 31, pending: 9 },
        { course: 'CS202 — DBMS', total: 36, submitted: 20, pending: 16 },
    ];
    const recentActivity = [
        { type: 'attendance', text: 'CS301-A session completed — 78% attendance', time: '10 min ago', color: '#16a34a' },
        { type: 'feedback', text: '14 students yet to submit feedback for CS301', time: '25 min ago', color: '#b45309' },
        { type: 'schedule', text: 'PHY201 class confirmed for 2:00 PM today', time: '1 hr ago', color: '#2563eb' },
        { type: 'notification', text: 'Notification sent to 42 students for CS301', time: '2 hrs ago', color: '#7c3aed' },
        { type: 'attendance', text: 'ENG102 session — 3 overrides applied by admin', time: '3 hrs ago', color: '#dc2626' },
    ];
    const weeklyAttendance = [
        { day: 'Mon', pct: 82 }, { day: 'Tue', pct: 75 }, { day: 'Wed', pct: 88 },
        { day: 'Thu', pct: 71 }, { day: 'Fri', pct: 85 }, { day: 'Sat', pct: 90 },
    ];
    const totalPending = feedbackPending.reduce((acc, c) => acc + c.pending, 0);

    const handleNotifyAll = () => {
        setNotifyStatus('sending');
        setTimeout(() => { setNotifyStatus('sent'); setTimeout(() => setNotifyStatus(null), 2500); }, 1500);
    };
    const handleScheduleSubmit = () => { setShowScheduleModal(false); setNewClass({ course: '', date: '', time: '', venue: '', faculty: '' }); };

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />

            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>AD</div>
                        <div className="user-info"><h3>Admin</h3><p>admin@cipd.edu</p></div>
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
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours &amp; Honorarium</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div className="nav-item" onClick={() => navTo('/')} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
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

                    {/* Row 1: Quick Actions + Weekly Attendance */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={16} /> Quick Actions</div>
                            <div style={{ padding: '1rem 1.2rem', display: 'flex', gap: '8px' }}>
                                {[
                                    { label: 'Schedule New Class', icon: Plus, bg: '#eff6ff', color: '#2563eb', action: () => setShowScheduleModal(true) },
                                    { label: 'Start Attendance', icon: CheckCircle, bg: '#ecfdf5', color: '#16a34a', action: () => navTo('/admin/attendance') },
                                    { label: 'View Attendance', icon: CheckCircle, bg: '#f0fdf4', color: '#15803d', action: () => navTo('/admin/attendance') },
                                    { label: 'Send Notification', icon: Send, bg: '#faf5ff', color: '#7c3aed', action: () => {} },
                                    { label: 'Generate Reports', icon: FileBarChart, bg: '#fff7ed', color: '#c2410c', action: () => {} },
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
                                    {weeklyAttendance.map((d, i) => (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#555' }}>{d.pct}%</span>
                                            <div style={{ width: '100%', maxWidth: '24px', borderRadius: '5px', height: `${d.pct * 0.65}px`, background: d.pct >= 85 ? '#0b6861' : '#66d9e8', transition: 'height 0.3s' }} />
                                            <span style={{ fontSize: '0.55rem', color: '#aaa', fontWeight: 500 }}>{d.day}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <div style={{ flex: 1, padding: '7px 10px', borderRadius: '10px', background: '#ecfdf5', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#065f46' }}>81.8%</div>
                                        <div style={{ fontSize: '0.58rem', color: '#065f46', fontWeight: 500 }}>Avg. This Week</div>
                                    </div>
                                    <div style={{ flex: 1, padding: '7px 10px', borderRadius: '10px', background: '#fef2f2', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#dc2626' }}>7</div>
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
                                {upcomingClasses.map((cls, i) => (
                                    <div key={i} className="attendance-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 1.5rem', borderBottom: i < upcomingClasses.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111', marginBottom: '3px' }}>{cls.course}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><User size={11} /> {cls.faculty}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={11} /> {cls.venue}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={11} /> {cls.date}, {cls.time}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Users size={11} /> {cls.students} students</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <span style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: cls.status === 'Confirmed' ? '#ecfdf5' : '#fffbeb', color: cls.status === 'Confirmed' ? '#166534' : '#92400e' }}>{cls.status}</span>
                                            <button onClick={handleNotifyAll} disabled={notifyStatus === 'sending'} className="change-status-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', border: '1px solid #eee', background: notifyStatus === 'sent' ? '#ecfdf5' : '#fff', cursor: notifyStatus === 'sending' ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 500, color: notifyStatus === 'sent' ? '#166534' : '#555' }}>
                                                {notifyStatus === 'sending' ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : notifyStatus === 'sent' ? <><CheckCircle size={11} /> Sent!</> : <><Send size={11} /> Notify All</>}
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
                                {feedbackPending.map((item, i) => {
                                    const pct = Math.round((item.submitted / item.total) * 100);
                                    return (
                                        <div key={i} style={{ padding: '12px 1.5rem', borderBottom: i < feedbackPending.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
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

                    {/* Row 3: Recent Activity */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16} /> Recent Activity</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                            {recentActivity.map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 1.5rem', borderBottom: i < recentActivity.length - 2 ? '1px solid #f5f5f5' : 'none', borderRight: i % 2 === 0 ? '1px solid #f5f5f5' : 'none' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, marginTop: '6px', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#333', lineHeight: 1.4 }}>{item.text}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '2px' }}>{item.time}</div>
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
                            {[
                                { label: 'Course', key: 'course', type: 'text', placeholder: 'e.g. CS301 — Data Structures' },
                                { label: 'Faculty', key: 'faculty', type: 'text', placeholder: 'e.g. Prof. Anuj Grover' },
                                { label: 'Date', key: 'date', type: 'date', placeholder: '' },
                                { label: 'Time', key: 'time', type: 'time', placeholder: '' },
                                { label: 'Venue', key: 'venue', type: 'text', placeholder: 'e.g. Room 204, Block A' },
                            ].map(field => (
                                <div key={field.key}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>{field.label}</label>
                                    <input type={field.type} placeholder={field.placeholder} value={newClass[field.key]} onChange={e => setNewClass({ ...newClass, [field.key]: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                            <button onClick={() => setShowScheduleModal(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>Cancel</button>
                            <button onClick={handleScheduleSubmit} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Plus size={14} /> Schedule &amp; Notify
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
