import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import {
    LayoutGrid,
    Calendar,
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
    Clock,
    FileBarChart,
    Download,
    RefreshCw,
    Activity,
    CheckCircle,
    AlertTriangle,
    Filter,
    Fingerprint,
    Shield,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminAttendancePage = () => {
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [sessionFilter, setSessionFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('2026-02-14');

    // Session & Auth State
    const [sessionActive, setSessionActive] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authState, setAuthState] = useState('idle'); // idle | verifying | success | failed
    const [macFilter, setMacFilter] = useState('all'); // all | registered | not-registered

    // Live timer
    const [timer, setTimer] = useState({ min: 7, sec: 24 });
    useEffect(() => {
        const interval = setInterval(() => {
            setTimer(prev => {
                if (prev.sec === 0) {
                    if (prev.min === 0) return { min: 11, sec: 59 };
                    return { min: prev.min - 1, sec: 59 };
                }
                return { ...prev, sec: prev.sec - 1 };
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const pad = (n) => String(n).padStart(2, '0');

    // Mock Data
    const attendanceSnapshot = [
        { id: 'STU-2023001', name: 'Aarav Gupta', rollNo: 'CS21034', hash: 'a7f3...e1d2', pings: 4, status: 'Present', mac: 'A4:83:E7:2B:9F:01', lastSeen: '09:36:15' },
        { id: 'STU-2023002', name: 'Sneha Kumar', rollNo: 'CS21056', hash: 'b2c1...f4a8', pings: 2, status: 'Absent', mac: 'B2:C1:D4:8E:3A:02', lastSeen: '09:36:09' },
        { id: 'STU-2023003', name: 'Rohan Patel', rollNo: 'CS21023', hash: 'c9d4...b7e3', pings: 5, status: 'Present', mac: 'C9:D4:A1:7B:E3:03', lastSeen: '09:48:19' },
        { id: 'STU-2023004', name: 'Priya Malhotra', rollNo: 'CS21045', hash: 'd1e5...a3c7', pings: 3, status: 'Present', mac: null, lastSeen: '09:24:05' },
        { id: 'STU-2023005', name: 'Karan Singh', rollNo: 'CS21067', hash: 'e8f2...d6b1', pings: 1, status: 'Absent', mac: 'E8:F2:B5:6D:1C:05', lastSeen: '09:48:03' },
        { id: 'STU-2023006', name: 'Vivaan Singh', rollNo: 'CS21091', hash: 'f3a7...c2e9', pings: 3, status: 'Present', mac: null, lastSeen: '09:36:02' },
        { id: 'STU-2023007', name: 'Aditya Kumar', rollNo: 'CS21012', hash: 'g6b8...e5d4', pings: 0, status: 'Absent', mac: 'G6:B8:3F:E5:D4:07', lastSeen: '—' },
    ];

    const filteredStudents = attendanceSnapshot.filter(s => {
        if (macFilter === 'registered') return s.mac !== null;
        if (macFilter === 'not-registered') return s.mac === null;
        return true;
    });

    // Fingerprint auth handler
    const handleStartAttendance = () => {
        if (sessionActive) return;
        setShowAuthModal(true);
        setAuthState('idle');
    };

    const handleFingerprint = () => {
        setAuthState('verifying');
        setTimeout(() => {
            // Simulate 90% success rate
            if (Math.random() > 0.1) {
                setAuthState('success');
                setTimeout(() => {
                    setShowAuthModal(false);
                    setSessionActive(true);
                    setAuthState('idle');
                }, 1200);
            } else {
                setAuthState('failed');
            }
        }, 1800);
    };

    const rawLogs = [
        { timestamp: '2026-02-14 09:00:12', hash: 'a7f3...e1d2', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:12:08', hash: 'b2c1...f4a8', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:12:14', hash: 'c9d4...b7e3', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:12:22', hash: 'a7f3...e1d2', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:24:05', hash: 'd1e5...a3c7', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:24:11', hash: 'a7f3...e1d2', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:24:18', hash: 'c9d4...b7e3', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:36:02', hash: 'f3a7...c2e9', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:36:09', hash: 'b2c1...f4a8', bssid: 'C4:E9:84:A2:3F:02', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:36:15', hash: 'a7f3...e1d2', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:48:03', hash: 'e8f2...d6b1', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:48:19', hash: 'c9d4...b7e3', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
    ];

    const handleLogout = () => navigate('/');

    const presentCount = attendanceSnapshot.filter(s => s.status === 'Present').length;
    const absentCount = attendanceSnapshot.filter(s => s.status === 'Absent').length;

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />

            {/* Sidebar */}
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>AD</div>
                        <div className="user-info"><h3>Admin</h3><p>admin@cipd.edu</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '8px 1rem 4px', marginTop: '2px' }}><span>Main</span></div>
                        <div className="nav-item" onClick={() => navigate('/admin')} style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Dashboard</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                        <div className="nav-item active"><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
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
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Attendance Monitoring</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar">
                                <Search size={16} color="#aaa" />
                                <input type="text" placeholder="Search students..." className="search-input" />
                            </div>
                            <Bell size={20} color="#555" style={{ cursor: 'pointer' }} />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* ═══════ SESSION MONITORING STRIP ═══════ */}
                    <div style={{
                        background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8',
                        padding: '0', marginBottom: '1.2rem', overflow: 'hidden',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                    }}>
                        {/* Primary strip — inline session data */}
                        <div style={{
                            display: 'flex', alignItems: 'center', padding: '10px 1.2rem',
                            fontSize: '0.78rem', borderBottom: '1px solid #f0f0f0',
                            overflowX: 'auto', whiteSpace: 'nowrap'
                        }}>
                            {/* Session ID */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '14px', flexShrink: 0 }}>
                                <span style={{ color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Session</span>
                                <span style={{ fontWeight: 700, color: '#111', fontFamily: 'monospace', fontSize: '0.78rem' }}>CS301-A</span>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />

                            {/* Status */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 14px', flexShrink: 0 }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sessionActive ? '#16a34a' : '#999', display: 'inline-block', boxShadow: sessionActive ? '0 0 0 2px rgba(22,163,106,0.15)' : 'none', flexShrink: 0 }} />
                                <span style={{ fontWeight: 600, color: sessionActive ? '#111' : '#999', fontSize: '0.78rem' }}>{sessionActive ? 'Active' : 'Inactive'}</span>
                                <span style={{ color: '#bbb', fontSize: '0.68rem' }}>{sessionActive ? '(Live Tracking)' : '(standby)'}</span>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />

                            {/* Enrolled */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 14px', flexShrink: 0 }}>
                                <span style={{ color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Students</span>
                                <span style={{ fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>{attendanceSnapshot.length}</span>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />

                            {/* Detected */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 14px', flexShrink: 0 }}>
                                <span style={{ color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Detected</span>
                                <span style={{ fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>{presentCount}/{attendanceSnapshot.length}</span>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />

                            {/* Ping Progress — inline bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                <span style={{ color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Ping</span>
                                <span style={{ fontWeight: 700, color: '#111', fontFamily: 'monospace', fontSize: '0.78rem' }}>3/6</span>
                                <div style={{ width: '48px', height: '3px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                                    <div style={{ width: '50%', height: '100%', background: '#111', borderRadius: '2px' }} />
                                </div>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />

                            {/* Next Ping Timer */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 14px', flexShrink: 0 }}>
                                <span style={{ color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Next</span>
                                <span style={{ fontWeight: 700, color: '#111', fontFamily: 'monospace', fontSize: '0.82rem', letterSpacing: '0.5px' }}>{pad(timer.min)}:{pad(timer.sec)}</span>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />

                            {/* Window */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 14px', flexShrink: 0 }}>
                                <span style={{ color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Window</span>
                                <span style={{ fontWeight: 600, color: '#111', fontSize: '0.78rem' }}>09:00–10:00</span>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />

                            {/* Start Attendance Button */}
                            <div style={{ padding: '0 14px', flexShrink: 0, marginLeft: 'auto' }}>
                                <button
                                    onClick={handleStartAttendance}
                                    disabled={sessionActive}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                        padding: '5px 14px', borderRadius: '6px',
                                        border: '1px solid ' + (sessionActive ? '#e8e8e8' : '#111'),
                                        background: sessionActive ? '#fafafa' : '#111',
                                        color: sessionActive ? '#999' : '#fff',
                                        fontSize: '0.72rem', fontWeight: 600,
                                        cursor: sessionActive ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {sessionActive ? <><CheckCircle size={11} /> Live Tracking Enabled</> : <><Shield size={11} /> Start Attendance</>}
                                </button>
                            </div>
                        </div>

                        {/* Secondary strip — system config context */}
                        <div style={{
                            display: 'flex', alignItems: 'center', padding: '7px 1.5rem',
                            gap: '20px', fontSize: '0.7rem', color: '#aaa', background: '#fafafa'
                        }}>
                            <span>BSSID <span style={{ fontFamily: 'monospace', color: '#888', fontWeight: 500 }}>C4:E9:84:A2:3F:01</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>Venue <span style={{ color: '#888', fontWeight: 500 }}>Room 204, Block A</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>Rule <span style={{ color: '#888', fontWeight: 500 }}>≥ 3 pings = Present</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>Interval <span style={{ color: '#888', fontWeight: 500 }}>10 min</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>Faculty <span style={{ color: '#888', fontWeight: 500 }}>Prof. Anuj Grover</span></span>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 500, color: '#888' }}><RefreshCw size={10} /> Refresh</button>
                            </div>
                        </div>
                    </div>

                    {/* Live Detection Progress Graph */}
                    {(() => {
                        // Detection data per interval — students detected at each 10-min ping
                        // Session is at ping 3/5 (30 min mark), so intervals 4-6 are future
                        const intervals = [0, 10, 20, 30, 40, 50, 60]; // minutes
                        const detectedPerInterval = [0, 5, 4, 5, null, null, null]; // null = future
                        const cumulativeUnique = [0, 5, 6, 6, null, null, null]; // cumulative unique students
                        const totalEnrolled = 7;
                        const thresholdDetections = 3; // >=3 pings = Present

                        // Chart dimensions
                        const W = 900, H = 260;
                        const pad = { top: 30, right: 30, bottom: 40, left: 50 };
                        const cW = W - pad.left - pad.right;
                        const cH = H - pad.top - pad.bottom;

                        const maxY = totalEnrolled + 1;
                        const xStep = cW / (intervals.length - 1);
                        const yScale = (v) => pad.top + cH - (v / maxY) * cH;
                        const xScale = (i) => pad.left + i * xStep;

                        // Build path for line (only non-null points)
                        const validPoints = detectedPerInterval
                            .map((v, i) => v !== null ? { x: xScale(i), y: yScale(v), v } : null)
                            .filter(Boolean);

                        const cumulativePoints = cumulativeUnique
                            .map((v, i) => v !== null ? { x: xScale(i), y: yScale(v), v } : null)
                            .filter(Boolean);

                        const linePath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

                        // Current interval marker
                        const currentIdx = detectedPerInterval.filter(v => v !== null).length - 1;

                        return (
                            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}>
                                        <Activity size={16} /> Live Detection Progress — CS301-A
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.75rem', color: '#888' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ width: '14px', height: '2px', background: '#111', display: 'inline-block' }}></span> Per-interval
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ width: '14px', height: '2px', background: '#00A5A0', display: 'inline-block' }}></span> Cumulative unique
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ width: '14px', height: '0', borderTop: '2px dashed #ccc', display: 'inline-block' }}></span> Threshold (≥3)
                                        </span>
                                    </div>
                                </div>
                                <div style={{ padding: '1rem 1.5rem', overflowX: 'auto' }}>
                                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: `${W}px`, height: 'auto', display: 'block', fontFamily: 'inherit' }}>

                                        {/* Horizontal gridlines */}
                                        {Array.from({ length: maxY + 1 }, (_, i) => (
                                            <line key={`gy-${i}`} x1={pad.left} y1={yScale(i)} x2={W - pad.right} y2={yScale(i)}
                                                stroke="#f0f0f0" strokeWidth="1" />
                                        ))}

                                        {/* Y-axis labels */}
                                        {Array.from({ length: maxY + 1 }, (_, i) => (
                                            <text key={`yl-${i}`} x={pad.left - 10} y={yScale(i) + 4}
                                                textAnchor="end" fontSize="11" fill="#aaa" fontWeight="500">{i}</text>
                                        ))}

                                        {/* X-axis labels */}
                                        {intervals.map((t, i) => (
                                            <text key={`xl-${i}`} x={xScale(i)} y={H - pad.bottom + 22}
                                                textAnchor="middle" fontSize="11" fill="#aaa" fontWeight="500">{t} min</text>
                                        ))}

                                        {/* Axis lines */}
                                        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={H - pad.bottom} stroke="#ddd" strokeWidth="1" />
                                        <line x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} stroke="#ddd" strokeWidth="1" />

                                        {/* Y-axis title */}
                                        <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="#aaa" fontWeight="600"
                                            transform={`rotate(-90, 14, ${H / 2})`} letterSpacing="0.5">STUDENTS</text>

                                        {/* Threshold dashed line — at y = 3 (the detection threshold reference ) */}
                                        <line x1={pad.left} y1={yScale(thresholdDetections)} x2={W - pad.right} y2={yScale(thresholdDetections)}
                                            stroke="#ccc" strokeWidth="1" strokeDasharray="6 4" />
                                        <text x={W - pad.right + 4} y={yScale(thresholdDetections) + 4}
                                            fontSize="9" fill="#bbb" fontWeight="500">≥3</text>

                                        {/* Total enrolled reference line */}
                                        <line x1={pad.left} y1={yScale(totalEnrolled)} x2={W - pad.right} y2={yScale(totalEnrolled)}
                                            stroke="#e8e8e8" strokeWidth="1" strokeDasharray="3 3" />
                                        <text x={W - pad.right + 4} y={yScale(totalEnrolled) + 4}
                                            fontSize="9" fill="#ccc" fontWeight="500">All ({totalEnrolled})</text>

                                        {/* Future zone shading — light grey for intervals not yet reached */}
                                        {currentIdx < intervals.length - 1 && (
                                            <rect x={xScale(currentIdx + 1) - xStep / 2} y={pad.top}
                                                width={W - pad.right - xScale(currentIdx + 1) + xStep / 2} height={cH}
                                                fill="#fafafa" />
                                        )}

                                        {/* Per-interval detection line (solid, dark) */}
                                        {validPoints.length > 1 && (
                                            <path d={linePath(validPoints)} fill="none" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
                                        )}

                                        {/* Cumulative unique line (solid, teal) */}
                                        {cumulativePoints.length > 1 && (
                                            <path d={linePath(cumulativePoints)} fill="none" stroke="#00A5A0" strokeWidth="1.5" strokeLinejoin="round" />
                                        )}

                                        {/* Per-interval data points */}
                                        {validPoints.map((p, i) => (
                                            <g key={`dp-${i}`}>
                                                <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#111" strokeWidth="1.5" />
                                                {i > 0 && (
                                                    <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fill="#555" fontWeight="600">{p.v}</text>
                                                )}
                                            </g>
                                        ))}

                                        {/* Cumulative data points */}
                                        {cumulativePoints.map((p, i) => (
                                            <g key={`cp-${i}`}>
                                                <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#00A5A0" strokeWidth="1.5" />
                                                {i > 0 && (
                                                    <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fill="#00A5A0" fontWeight="600">{p.v}</text>
                                                )}
                                            </g>
                                        ))}

                                        {/* Current interval indicator — pulsing dot */}
                                        {currentIdx > 0 && (
                                            <circle cx={xScale(currentIdx)} cy={yScale(detectedPerInterval[currentIdx])} r="5"
                                                fill="none" stroke="#111" strokeWidth="1" opacity="0.4">
                                                <animate attributeName="r" values="5;9;5" dur="2s" repeatCount="indefinite" />
                                                <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                                            </circle>
                                        )}

                                        {/* Vertical interval markers (subtle) */}
                                        {intervals.map((_, i) => (
                                            i > 0 && i < intervals.length - 1 && (
                                                <line key={`vm-${i}`} x1={xScale(i)} y1={pad.top} x2={xScale(i)} y2={H - pad.bottom}
                                                    stroke="#f5f5f5" strokeWidth="1" />
                                            )
                                        ))}

                                    </svg>

                                    {/* Status bar below chart */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '8px 0', borderTop: '1px solid #f5f5f5', fontSize: '0.75rem', color: '#999' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}></span>
                                            Session active · Ping 3 of 5 completed
                                        </div>
                                        <div>
                                            Detection window: 09:00 AM — 10:00 AM · 10 min intervals
                                        </div>
                                        <div style={{ color: '#aaa' }}>
                                            Final status computed after session ends
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ═══════ ATTENDANCE SNAPSHOT ═══════ */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.2rem', marginBottom: '1.5rem' }}>
                        {/* Student table */}
                        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Activity size={14} /> Attendance Snapshot
                                </div>
                                <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, color: '#888' }}><Download size={11} /> Export</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 1.5rem 8px', borderBottom: '1px solid #f0f0f0' }}>
                                <span style={{ fontSize: '0.68rem', color: '#aaa', fontWeight: 500 }}>Filter MAC:</span>
                                {['all', 'registered', 'not-registered'].map(f => (
                                    <button key={f} onClick={() => setMacFilter(f)}
                                        style={{
                                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600,
                                            border: '1px solid ' + (macFilter === f ? '#111' : '#e8e8e8'),
                                            background: macFilter === f ? '#111' : '#fff',
                                            color: macFilter === f ? '#fff' : '#888',
                                            cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize'
                                        }}>
                                        {f === 'not-registered' ? 'Not Registered' : f === 'all' ? 'All' : 'Registered'}
                                    </button>
                                ))}
                                <span style={{ fontSize: '0.68rem', color: '#bbb', marginLeft: 'auto' }}>{filteredStudents.length} students</span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            {['Student Name', 'Roll No', 'Detection Status', 'MAC Address', 'Last Seen', 'Attendance', ''].map(h => (
                                                <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((s, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }} className="attendance-row">
                                                <td style={{ padding: '9px 16px', fontWeight: 600, color: '#111', fontSize: '0.82rem' }}>{s.name}</td>
                                                <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{s.rollNo}</td>
                                                <td style={{ padding: '9px 16px' }}>
                                                    <span style={{ fontWeight: 600, fontFamily: 'monospace', color: s.pings >= 3 ? '#111' : s.pings >= 1 ? '#b45309' : '#dc2626' }}>{s.pings}/5 pings</span>
                                                </td>
                                                <td style={{ padding: '9px 16px' }}>
                                                    {s.mac ? (
                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#999' }}>{s.mac}</span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: '#ccc', fontStyle: 'italic' }}>Not Registered</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>{s.lastSeen}</td>
                                                <td style={{ padding: '9px 16px' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500, background: s.status === 'Present' ? '#ecfdf5' : '#fef2f2', color: s.status === 'Present' ? '#166534' : '#991b1b' }}>
                                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.status === 'Present' ? '#16a34a' : '#dc2626' }}></span>
                                                        {s.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '9px 16px' }}>
                                                    <button style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 500, color: '#999' }} className="change-status-btn">Override</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Summary sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Detection Summary */}
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '1.2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Detection Summary</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#777' }}>Present</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#111', fontSize: '0.9rem' }}>{presentCount}</span>
                                            <span style={{ fontSize: '0.68rem', color: '#aaa' }}>({Math.round(presentCount / attendanceSnapshot.length * 100)}%)</span>
                                        </div>
                                    </div>
                                    <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ width: `${(presentCount / attendanceSnapshot.length) * 100}%`, height: '100%', background: '#16a34a', borderRadius: '2px', transition: 'width 0.4s' }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#777' }}>Absent</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#111', fontSize: '0.9rem' }}>{absentCount}</span>
                                            <span style={{ fontSize: '0.68rem', color: '#aaa' }}>({Math.round(absentCount / attendanceSnapshot.length * 100)}%)</span>
                                        </div>
                                    </div>
                                    <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ width: `${(absentCount / attendanceSnapshot.length) * 100}%`, height: '100%', background: '#dc2626', borderRadius: '2px', transition: 'width 0.4s' }} />
                                    </div>
                                </div>
                            </div>

                            {/* System info */}
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '1.2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', flex: 1 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>System Config</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
                                    {[
                                        ['Detection Rule', '≥ 3 pings'],
                                        ['Ping Interval', '10 min'],
                                        ['Total Pings', '6 per session'],
                                        ['Window', '60 min'],
                                        ['BSSID Verified', 'Yes'],
                                    ].map(([label, val], i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: i < 4 ? '1px solid #f5f5f5' : 'none' }}>
                                            <span style={{ color: '#888' }}>{label}</span>
                                            <span style={{ fontWeight: 600, color: '#333', fontFamily: 'monospace', fontSize: '0.76rem' }}>{val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Raw Wi-Fi Ping Logs */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}><Wifi size={16} /> Raw Wi-Fi Ping Logs</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <Filter size={14} color="#888" />
                                <select value={sessionFilter} onChange={e => setSessionFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '0.8rem', fontWeight: 500, color: '#555', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                                    <option value="all">All Sessions</option>
                                    <option value="CS301-A">CS301-A</option>
                                    <option value="PHY201-B">PHY201-B</option>
                                </select>
                                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '0.8rem', fontFamily: 'inherit', color: '#555', cursor: 'pointer' }} />
                                <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: '#555' }}><RefreshCw size={12} /> Reload</button>
                                <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}><Download size={12} /> Export CSV</button>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ background: '#f9f9f9' }}>
                                        {['#', 'Timestamp', 'Device Hash', 'BSSID Detected', 'Session ID', 'Match'].map(h => (
                                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', borderBottom: '1px solid #eee' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rawLogs.map((log, i) => {
                                        const isMatch = log.bssid === 'C4:E9:84:A2:3F:01';
                                        return (
                                            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }} className="attendance-row">
                                                <td style={{ padding: '10px 16px', color: '#aaa' }}>{i + 1}</td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#333' }}>{log.timestamp}</td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#777' }}>{log.hash}</td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                    <span style={{ color: isMatch ? '#333' : '#dc2626' }}>{log.bssid}</span>
                                                </td>
                                                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{log.session}</td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 500, background: isMatch ? '#ecfdf5' : '#fef2f2', color: isMatch ? '#166534' : '#991b1b' }}>
                                                        {isMatch ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
                                                        {isMatch ? 'Valid' : 'Mismatch'}
                                                    </span>
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

            {/* ═══════ FINGERPRINT AUTHENTICATION MODAL ═══════ */}
            {showAuthModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999
                }} onClick={() => { if (authState !== 'verifying') { setShowAuthModal(false); setAuthState('idle'); } }}>
                    <div style={{
                        background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8',
                        width: '380px', maxWidth: '90vw', boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                        overflow: 'hidden'
                    }} onClick={e => e.stopPropagation()}>
                        {/* Modal header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Shield size={14} color="#555" />
                                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Admin Authentication Required</span>
                            </div>
                            <button onClick={() => { setShowAuthModal(false); setAuthState('idle'); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '2px' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', color: '#888', lineHeight: '1.6', marginBottom: '20px' }}>
                                This action will initiate live attendance tracking for the current session.
                            </div>

                            {/* Fingerprint icon area */}
                            <div style={{
                                width: '80px', height: '80px', margin: '0 auto 16px',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '2px solid ' + (
                                    authState === 'success' ? '#16a34a' :
                                        authState === 'failed' ? '#dc2626' :
                                            authState === 'verifying' ? '#999' : '#e8e8e8'
                                ),
                                background: authState === 'success' ? '#f0fdf4' :
                                    authState === 'failed' ? '#fef2f2' : '#fafafa',
                                transition: 'all 0.3s'
                            }}>
                                {authState === 'success' ? (
                                    <CheckCircle size={32} color="#16a34a" />
                                ) : (
                                    <Fingerprint size={32} color={
                                        authState === 'failed' ? '#dc2626' :
                                            authState === 'verifying' ? '#555' : '#bbb'
                                    } style={authState === 'verifying' ? { animation: 'pulse 1s infinite' } : {}} />
                                )}
                            </div>

                            {/* State text */}
                            <div style={{
                                fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px',
                                color: authState === 'success' ? '#16a34a' :
                                    authState === 'failed' ? '#dc2626' : '#333'
                            }}>
                                {authState === 'idle' && 'Waiting for authentication'}
                                {authState === 'verifying' && 'Verifying...'}
                                {authState === 'success' && 'Authentication Successful ✓'}
                                {authState === 'failed' && 'Authentication Failed — Try Again'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: '20px' }}>
                                {authState === 'idle' && 'Place your registered fingerprint to authenticate.'}
                                {authState === 'verifying' && 'Processing biometric data...'}
                                {authState === 'success' && 'Session will be activated shortly.'}
                                {authState === 'failed' && 'Fingerprint did not match. Please try again.'}
                            </div>

                            {/* Action button */}
                            {(authState === 'idle' || authState === 'failed') && (
                                <button onClick={handleFingerprint}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 20px', borderRadius: '8px', border: 'none',
                                        background: '#111', color: '#fff',
                                        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}>
                                    <Fingerprint size={14} />
                                    {authState === 'failed' ? 'Retry Authentication' : 'Authenticate'}
                                </button>
                            )}

                            {/* Session info footer */}
                            <div style={{
                                marginTop: '18px', padding: '10px 14px', background: '#fafafa',
                                borderRadius: '8px', border: '1px solid #f0f0f0',
                                fontSize: '0.72rem', color: '#aaa',
                                display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Session</span>
                                    <span style={{ fontFamily: 'monospace', color: '#888', fontWeight: 500 }}>CS301-A</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Admin</span>
                                    <span style={{ fontFamily: 'monospace', color: '#888', fontWeight: 500 }}>ADM-001</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Timestamp</span>
                                    <span style={{ fontFamily: 'monospace', color: '#888', fontWeight: 500 }}>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pulse animation for fingerprint verifying state */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
};

export default AdminAttendancePage;
