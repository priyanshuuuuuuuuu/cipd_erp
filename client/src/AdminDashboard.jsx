import React, { useState } from 'react';
import './Dashboard.css';
import {
    LayoutGrid,
    Calendar,
    BookOpen,
    Users,
    MessageSquare,
    Settings,
    LogOut,
    Bell,
    Search,
    Menu,
    ChevronLeft,
    ChevronRight,
    Wifi,
    Radio,
    Clock,
    FileBarChart,
    Download,
    RefreshCw,
    Activity,
    CheckCircle,
    AlertTriangle,
    Filter,
    ChevronDown,
    Plus,
    Send,
    Mail,
    MapPin,
    User,
    AlertCircle,
    ArrowRight,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [notifyStatus, setNotifyStatus] = useState(null); // null | 'sending' | 'sent'

    // Schedule form state
    const [newClass, setNewClass] = useState({
        course: '', date: '', time: '', venue: '', faculty: ''
    });

    // Mock Data
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

    const totalPending = feedbackPending.reduce((acc, c) => acc + c.pending, 0);
    const totalStudents = feedbackPending.reduce((acc, c) => acc + c.total, 0);

    const handleNotifyAll = (className) => {
        setNotifyStatus('sending');
        setTimeout(() => {
            setNotifyStatus('sent');
            setTimeout(() => setNotifyStatus(null), 2500);
        }, 1500);
    };

    const handleScheduleSubmit = () => {
        setShowScheduleModal(false);
        setNewClass({ course: '', date: '', time: '', venue: '', faculty: '' });
    };

    const handleLogout = () => {
        navigate('/');
    };

    return (
        <div className="dashboard-container">
            {/* Mobile Sidebar Overlay */}
            <div
                className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>
                            AD
                        </div>
                        <div className="user-info">
                            <h3>Admin</h3>
                            <p>admin@cipd.edu</p>
                        </div>
                        <div
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            style={{
                                position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)',
                                background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                border: '1px solid #333', color: '#888', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                            }}
                        >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>

                    <nav className="nav-menu">
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '8px 1rem 4px', marginTop: '2px' }}><span>Main</span></div>
                        <div className="nav-item active"><LayoutGrid size={18} /> <span>Dashboard</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                        <div className="nav-item" onClick={() => navigate('/admin-attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>

                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                        <div className="nav-item" onClick={() => navigate('/admin-feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours & Honorarium</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>

                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                        <div className="nav-item" onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    </nav>
                </div>

                <div className="sidebar-footer">
                    <div className="nav-item" onClick={handleLogout} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content">
                <div className="content-center admin-full">
                    {/* Header */}
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}>
                                <Menu size={24} />
                            </div>
                            <h1>Dashboard</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar">
                                <Search size={16} color="#aaa" />
                                <input type="text" placeholder="Search sessions, students..." className="search-input" />
                            </div>
                            <Bell size={20} color="#555" style={{ cursor: 'pointer' }} />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Sessions', value: '42', sub: 'This week', trend: '↑ 8%', trendColor: '#16a34a', accent: '#3B2D82' },
                            { label: 'Avg. Attendance', value: '78.4%', sub: 'All courses', trend: '↓ 2.1%', trendColor: '#dc2626', accent: '#00A5A0' },
                            { label: 'Pending Feedback', value: `${totalPending}`, sub: `${totalPending} of ${totalStudents} students`, trend: '—', trendColor: '#888', accent: '#E91E87' },
                            { label: 'Faculty Hours', value: '312h', sub: 'This month', trend: '↑ 12%', trendColor: '#16a34a', accent: '#3B2D82' },
                        ].map((stat, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '1.2rem 1.5rem', border: '1px solid #e8e8e8', borderLeft: `3px solid ${stat.accent}`, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 500, marginBottom: '6px' }}>{stat.label}</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#111', letterSpacing: '-0.5px' }}>{stat.value}</div>
                                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '4px' }}>
                                    {stat.sub} · <span style={{ color: stat.trendColor, fontWeight: 600 }}>{stat.trend}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Two Column: Upcoming Classes + Feedback Overview */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

                        {/* Left — Upcoming Classes + Scheduling */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}>
                                    <Calendar size={16} /> Upcoming Classes
                                </div>
                                <button
                                    onClick={() => setShowScheduleModal(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#fff', transition: 'all 0.15s' }}
                                >
                                    <Plus size={13} /> Schedule Class
                                </button>
                            </div>
                            <div style={{ padding: '0' }}>
                                {upcomingClasses.map((cls, i) => (
                                    <div key={i} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '14px 1.5rem', borderBottom: i < upcomingClasses.length - 1 ? '1px solid #f5f5f5' : 'none',
                                        transition: 'background 0.1s', cursor: 'default'
                                    }} className="attendance-row">
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
                                            <span style={{
                                                padding: '3px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600,
                                                background: cls.status === 'Confirmed' ? '#ecfdf5' : '#fffbeb',
                                                color: cls.status === 'Confirmed' ? '#166534' : '#92400e',
                                            }}>
                                                {cls.status}
                                            </span>
                                            <button
                                                onClick={() => handleNotifyAll(cls.course)}
                                                disabled={notifyStatus === 'sending'}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    padding: '5px 12px', borderRadius: '8px', border: '1px solid #eee',
                                                    background: notifyStatus === 'sent' ? '#ecfdf5' : '#fff',
                                                    cursor: notifyStatus === 'sending' ? 'wait' : 'pointer',
                                                    fontSize: '0.75rem', fontWeight: 500,
                                                    color: notifyStatus === 'sent' ? '#166534' : '#555',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {notifyStatus === 'sending' ? (
                                                    <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                                                ) : notifyStatus === 'sent' ? (
                                                    <><CheckCircle size={11} /> Sent!</>
                                                ) : (
                                                    <><Send size={11} /> Notify All</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right — Feedback Overview */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #E91E87', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}>
                                    <MessageSquare size={16} /> Feedback Status
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertCircle size={12} /> {totalPending} pending
                                </div>
                            </div>
                            <div style={{ padding: '0' }}>
                                {feedbackPending.map((item, i) => {
                                    const pct = Math.round((item.submitted / item.total) * 100);
                                    return (
                                        <div key={i} style={{
                                            padding: '12px 1.5rem', borderBottom: i < feedbackPending.length - 1 ? '1px solid #f5f5f5' : 'none',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111' }}>{item.course}</span>
                                                <span style={{
                                                    fontSize: '0.7rem', fontWeight: 600,
                                                    color: item.pending === 0 ? '#16a34a' : item.pending > 15 ? '#dc2626' : '#b45309'
                                                }}>
                                                    {item.pending === 0 ? '✓ Complete' : `${item.pending} pending`}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ flex: 1, height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${pct}%`, height: '100%', borderRadius: '3px', transition: 'width 0.4s',
                                                        background: pct === 100 ? '#16a34a' : pct > 60 ? '#111' : '#dc2626'
                                                    }}></div>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500, minWidth: '55px', textAlign: 'right' }}>
                                                    {item.submitted}/{item.total}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Remind All Button */}
                            <div style={{ padding: '10px 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                                <button style={{
                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    padding: '8px', borderRadius: '8px', border: '1px solid #eee', background: '#fff',
                                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#555', transition: 'all 0.15s'
                                }} className="change-status-btn">
                                    <Mail size={13} /> Send Reminder to All Pending
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Quick Actions + Recent Activity */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
                        {/* Quick Actions */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Activity size={16} /> Quick Actions
                            </div>
                            <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                    { label: 'Schedule a New Class', icon: Plus, bg: '#eff6ff', color: '#2563eb', action: () => setShowScheduleModal(true) },
                                    { label: 'View Attendance Monitoring', icon: CheckCircle, bg: '#ecfdf5', color: '#16a34a', action: () => navigate('/admin-attendance') },
                                    { label: 'Send Bulk Notification', icon: Send, bg: '#faf5ff', color: '#7c3aed', action: () => { } },
                                    { label: 'Generate Reports', icon: FileBarChart, bg: '#fff7ed', color: '#c2410c', action: () => { } },
                                    { label: 'View Feedback Analytics', icon: MessageSquare, bg: '#fef2f2', color: '#dc2626', action: () => navigate('/admin-feedback') },
                                ].map((item, i) => (
                                    <button key={i} onClick={item.action} style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                                        borderRadius: '10px', border: '1px solid #f0f0f0', background: '#fff',
                                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#333',
                                        transition: 'all 0.15s', textAlign: 'left', width: '100%'
                                    }} className="change-status-btn">
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '8px', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', background: item.bg, color: item.color, flexShrink: 0
                                        }}>
                                            <item.icon size={15} />
                                        </div>
                                        {item.label}
                                        <ArrowRight size={14} color="#ccc" style={{ marginLeft: 'auto' }} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={16} /> Recent Activity
                            </div>
                            <div style={{ padding: '0' }}>
                                {recentActivity.map((item, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                                        padding: '14px 1.5rem', borderBottom: i < recentActivity.length - 1 ? '1px solid #f5f5f5' : 'none',
                                    }}>
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%', background: item.color,
                                            marginTop: '6px', flexShrink: 0
                                        }}></div>
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
            </div>

            {/* Schedule Class Modal */}
            {showScheduleModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2000
                }} onClick={() => setShowScheduleModal(false)}>
                    <div style={{
                        background: '#fff', borderRadius: '16px', width: '480px', maxWidth: '90vw',
                        padding: '0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden'
                    }} onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Schedule New Class</h3>
                            <button onClick={() => setShowScheduleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '4px' }}>
                                <X size={18} />
                            </button>
                        </div>
                        {/* Modal Body */}
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
                                    <input
                                        type={field.type}
                                        placeholder={field.placeholder}
                                        value={newClass[field.key]}
                                        onChange={e => setNewClass({ ...newClass, [field.key]: e.target.value })}
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: '8px',
                                            border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit',
                                            color: '#333', outline: 'none', boxSizing: 'border-box',
                                            transition: 'border-color 0.15s'
                                        }}
                                        onFocus={e => e.target.style.borderColor = '#111'}
                                        onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                                    />
                                </div>
                            ))}
                        </div>
                        {/* Modal Footer */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                            <button onClick={() => setShowScheduleModal(false)} style={{
                                padding: '8px 20px', borderRadius: '8px', border: '1px solid #eee',
                                background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#555'
                            }}>
                                Cancel
                            </button>
                            <button onClick={handleScheduleSubmit} style={{
                                padding: '8px 20px', borderRadius: '8px', border: 'none',
                                background: '#111', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff',
                                display: 'flex', alignItems: 'center', gap: '5px'
                            }}>
                                <Plus size={14} /> Schedule & Notify
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyframes for spinner */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AdminDashboard;
