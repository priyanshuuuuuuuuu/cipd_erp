'use client';

import React, { useState } from 'react';
import '../Dashboard.css';
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
    ChevronDown,
    MapPin,
    Clock,
    FileText,
    AlertCircle,
    CheckCircle,
    XCircle,
    Menu,
    ChevronLeft,
    ChevronRight,
    Wifi,
    X,
    Fingerprint
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Cell
} from 'recharts';

const StudentDashboard = () => {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Profile panel state
    const [showProfile, setShowProfile] = useState(false);

    // MAC Address state
    const [registeredMac, setRegisteredMac] = useState('A4:83:E7:2B:9F:01');
    const [macInput, setMacInput] = useState('');
    const [isEditingMac, setIsEditingMac] = useState(false);
    const [showMacConfirm, setShowMacConfirm] = useState(false);
    const [macUpdateLog, setMacUpdateLog] = useState([{ mac: 'A4:83:E7:2B:9F:01', timestamp: '2026-01-15 09:12:34' }]);
    const [macError, setMacError] = useState('');

    const formatMacInput = (value) => {
        const clean = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        const parts = [];
        for (let i = 0; i < clean.length && i < 12; i += 2) {
            parts.push(clean.substring(i, i + 2));
        }
        return parts.join(':');
    };

    const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);

    const handleMacChange = (e) => {
        const formatted = formatMacInput(e.target.value);
        setMacInput(formatted);
        setMacError('');
    };

    const handleMacUpdate = () => {
        if (!isValidMac(macInput)) {
            setMacError('Invalid MAC address format. Use XX:XX:XX:XX:XX:XX');
            return;
        }
        setShowMacConfirm(true);
    };

    const confirmMacUpdate = () => {
        const ts = new Date().toLocaleString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setRegisteredMac(macInput);
        setMacUpdateLog(prev => [...prev, { mac: macInput, timestamp: ts }]);
        setShowMacConfirm(false);
        setIsEditingMac(false);
        setMacInput('');
    };

    const handleLogout = () => {
        router.push('/');
    };

    return (
        <div className="dashboard-container">
            {/* Sidebar Overlay (Mobile) */}
            <div
                className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
                            <img src="/studentPic.png" alt="Student" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        </div>
                        <div className="user-info">
                            <h3>Student</h3>
                            <p>student@gmail.com</p>
                        </div>
                        <div
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            style={{
                                position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)',
                                background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', border: '1px solid #333', color: '#888', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                            }}
                        >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>

                    <nav className="nav-menu">
                        <div className="nav-item active">
                            <LayoutGrid size={18} /> <span>Home</span>
                        </div>
                        <div onClick={() => router.push('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}>
                            <Users size={18} /> <span>Attendance</span>
                        </div>
                        <div onClick={() => router.push('/grades')} className="nav-item" style={{ cursor: 'pointer' }}>
                            <BookOpen size={18} /> <span>Grades</span>
                        </div>
                        <div className="nav-item" onClick={() => router.push('/teachers')} style={{ cursor: 'pointer' }}>
                            <Users size={18} /> <span>Teachers</span>
                        </div>
                        <div onClick={() => router.push('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}>
                            <MessageSquare size={18} /> <span>Feedback</span>
                        </div>
                        <div onClick={() => router.push('/courses')} className="nav-item" style={{ cursor: 'pointer' }}>
                            <BookOpen size={18} /> <span>Courses</span>
                        </div>
                        <div className="nav-item" onClick={() => router.push('/calendar')} style={{ cursor: 'pointer' }}>
                            <Calendar size={18} /> <span>Calendar</span>
                        </div>
                    </nav>
                </div>

                <div className="sidebar-footer">
                    <div onClick={() => router.push('/settings')} className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    <div className="nav-item" onClick={handleLogout} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content">

                {/* Centre Panel */}
                <div className="content-center">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}>
                                <Menu size={24} />
                            </div>
                            <h1>Home</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar">
                                <Search size={16} color="#aaa" />
                                <input type="text" placeholder="Search" className="search-input" />
                            </div>
                            <Bell size={20} color="#555" />
                            <MessageSquare size={20} color="#555" />
                        </div>
                    </header>

                    {/* Today's Schedule */}
                    <section>
                        <div className="section-title">Today's Schedule</div>
                        <div className="schedule-cards">
                            <div className="schedule-card">
                                <div className="icon-container">
                                    <img src="/course1.png" alt="Active Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                </div>
                                <div className="course-title">Course 1</div>
                                <div className="course-info">Topic 1<br />Venue: LHC<br />10:00am</div>
                            </div>
                            <div className="schedule-card active">
                                <div className="next-class-badge">Next Class</div>
                                <div className="icon-container">
                                    <img src="/active.png" alt="Active Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                </div>
                                <div className="course-title">Course 2</div>
                                <div className="course-info">Topic 2<br />Venue: LHC<br />11:00am</div>
                            </div>
                            <div className="schedule-card">
                                <div className="icon-container">
                                    <img src="/course3.png" alt="Active Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                </div>
                                <div className="course-title">Course 3</div>
                                <div className="course-info">Topic 3<br />Venue: LHC<br />12:00pm</div>
                            </div>
                            <div className="schedule-card">
                                <div className="icon-container">
                                    <img src="/course4.png" alt="Active Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                </div>
                                <div className="course-title">Course 4</div>
                                <div className="course-info">Topic 4<br />Venue: LHC<br />1:00pm</div>
                            </div>
                            <div className="schedule-card">
                                <div className="icon-container">
                                    <img src="/course5.png" alt="Active Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                </div>
                                <div className="course-title">Course 5</div>
                                <div className="course-info">Topic 5<br />Venue: LHC<br />2:00pm</div>
                            </div>
                        </div>
                    </section>

                    {/* Weekly Schedule */}
                    <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="section-title" onClick={() => router.push('/calendar')} style={{ cursor: 'pointer' }}>
                            Weekly Schedule
                            <div style={{ fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                Jan 1 - Jan 7, 2026 <ChevronDown size={14} />
                            </div>
                        </div>
                        <div className="calendar-container">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px', marginBottom: '10px' }}>
                                {[1, 2, 3, 4, 5, 6, 7].map(day => (
                                    <div key={day} style={{ textAlign: 'left', paddingLeft: '5px', fontSize: '0.8rem', color: '#888' }}>{day}</div>
                                ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, gap: '10px', position: 'relative' }}>
                                <div className="cal-col" style={{ position: 'relative' }}>
                                    <div className="cal-event blue" style={{ marginTop: 'auto', marginBottom: '10px', position: 'absolute', bottom: '0', width: '100%' }}>
                                        <div className="event-badge">Exam</div>
                                        <strong>Course 3 Exam</strong>
                                        <div>CIPD Room</div>
                                        <div>11 AM</div>
                                    </div>
                                </div>
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9' }}></div>
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9', position: 'relative' }}>
                                    <div className="cal-event teal" style={{ top: '35%', position: 'absolute', width: '100%' }}>
                                        <div className="event-badge">Class</div>
                                        <strong>Course 2</strong>
                                        <div>Old Acad</div>
                                        <div>2 PM</div>
                                    </div>
                                </div>
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9', position: 'relative' }}>
                                    <div className="cal-event purple" style={{ top: '0', position: 'absolute', width: '100%' }}>
                                        <div className="event-badge">Class</div>
                                        <strong>Course 1</strong>
                                        <div>LHC</div>
                                        <div>11 AM</div>
                                    </div>
                                </div>
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9', position: 'relative' }}>
                                    <div className="cal-event green" style={{ bottom: '20px', position: 'absolute', width: '100%' }}>
                                        <div className="event-badge">Class</div>
                                        <strong>Assignment 1</strong>
                                        <div>Subject</div>
                                        <div>Prof. Anuj Grover</div>
                                    </div>
                                </div>
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9' }}></div>
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9', position: 'relative' }}>
                                    <div className="cal-event green" style={{ top: '30%', position: 'absolute', width: '100%' }}>
                                        <div className="event-badge">Class</div>
                                        <strong>Assignment 1</strong>
                                        <div>Subject</div>
                                        <div>Prof. Anuj Grover</div>
                                    </div>
                                </div>
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
                                <BarChart data={[
                                    { day: 'Sun', val: 80 }, { day: 'Mon', val: 30 }, { day: 'Tue', val: 60 },
                                    { day: 'Wed', val: 45 }, { day: 'Thu', val: 75 }, { day: 'Fri', val: 60 }, { day: 'Sat', val: 95 }
                                ]} barSize={10} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                    <CartesianGrid vertical={false} stroke="#eee" strokeDasharray="3 3" />
                                    <XAxis dataKey="day" hide={true} />
                                    <YAxis hide={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} domain={[0, 100]} width={25} />
                                    <Bar dataKey="val" radius={[4, 4, 4, 4]}>
                                        {[80, 30, 60, 45, 75, 60, 95].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 6 ? '#003366' : '#66d9e8'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="attendance-summary">
                            <div className="summary-left">
                                <div className="summary-label">Total Attendance</div>
                                <div className="progress-circle">80%</div>
                            </div>
                            <div className="summary-right">
                                <div className="badge-pill blue">Attended: 20</div>
                                <div className="badge-pill pink">Missed: 4</div>
                            </div>
                        </div>
                    </div>

                    <div className="section-title" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Pending Assignments</div>

                    <div className="assignment-card">
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div className="icon-box"><FileText size={20} /></div>
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>Assignment 1</div>
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>Calculus 1 • Prof. Anuj Grover</div>
                            </div>
                        </div>
                        <div className="score-circle green">98</div>
                    </div>

                    <div className="assignment-card">
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div className="icon-box"><div style={{ fontSize: '16px' }}>🎨</div></div>
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>Assignment 2</div>
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>Modern Art • Dr. Priya Sharma</div>
                            </div>
                        </div>
                        <div className="score-circle peach">72</div>
                    </div>

                    <div className="assignment-card">
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div className="icon-box"><div style={{ fontSize: '16px' }}>🔢</div></div>
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>Assignment 3</div>
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>Linear Algebra • Amit Patel</div>
                            </div>
                        </div>
                        <div className="score-circle pink">34</div>
                    </div>

                    <div className="section-title" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Pending Feedback</div>
                    <div className="feedback-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div className="feedback-text" style={{ fontSize: '0.9rem' }}>You have missed submitting<br />feedback on 27/01/2025</div>
                            <div className="feedback-sub">Required for Course 1: Prof. Anuj Grover</div>
                        </div>
                        <div style={{ width: '40px', height: '40px', background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                            <ChevronDown size={20} style={{ transform: 'rotate(-90deg)' }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* PROFILE PANEL OVERLAY */}
            {showProfile && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.25)', zIndex: 9999,
                    display: 'flex', justifyContent: 'flex-end'
                }} onClick={() => setShowProfile(false)}>
                    <div style={{
                        width: '380px', maxWidth: '90vw', background: '#fff',
                        borderLeft: '1px solid #e8e8e8', height: '100%',
                        overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.05)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111' }}>Student Profile</span>
                            <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '2px' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                                <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #e8e8e8', flexShrink: 0 }}>
                                    <img src="/studentPic.png" alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111' }}>Student</div>
                                    <div style={{ fontSize: '0.78rem', color: '#888' }}>student@gmail.com</div>
                                    <div style={{ fontSize: '0.72rem', color: '#aaa', fontFamily: 'monospace', marginTop: '2px' }}>STU2021078</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem', marginBottom: '24px', padding: '14px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                                {[
                                    ['Program', 'B.Tech CSE'],
                                    ['Semester', '4th'],
                                    ['Section', 'CS-A'],
                                    ['Enrollment', '2021'],
                                    ['Status', 'Active'],
                                ].map(([label, val], i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', borderBottom: i < 4 ? '1px solid #f5f5f5' : 'none' }}>
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
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600,
                                            background: registeredMac ? '#f0fdf4' : '#fef2f2',
                                            color: registeredMac ? '#16a34a' : '#dc2626',
                                            border: '1px solid ' + (registeredMac ? '#bbf7d0' : '#fecaca')
                                        }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: registeredMac ? '#16a34a' : '#dc2626' }} />
                                            {registeredMac ? 'Registered' : 'Not Registered'}
                                        </span>
                                    </div>
                                </div>
                                {!isEditingMac ? (
                                    <button onClick={() => { setIsEditingMac(true); setMacInput(registeredMac || ''); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#555' }}>
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
                                <button onClick={confirmMacUpdate} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: '#111', fontSize: '0.78rem', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Confirm Update</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
