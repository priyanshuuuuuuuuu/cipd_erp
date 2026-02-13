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
    Radio,
    Clock,
    FileBarChart,
    Download,
    RefreshCw,
    Activity,
    CheckCircle,
    AlertTriangle,
    Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminAttendancePage = () => {
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [sessionFilter, setSessionFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('2026-02-14');

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
        { id: 'STU-2023001', hash: 'a7f3...e1d2', pings: 4, status: 'Present' },
        { id: 'STU-2023002', hash: 'b2c1...f4a8', pings: 2, status: 'Absent' },
        { id: 'STU-2023003', hash: 'c9d4...b7e3', pings: 5, status: 'Present' },
        { id: 'STU-2023004', hash: 'd1e5...a3c7', pings: 3, status: 'Present' },
        { id: 'STU-2023005', hash: 'e8f2...d6b1', pings: 1, status: 'Absent' },
        { id: 'STU-2023006', hash: 'f3a7...c2e9', pings: 3, status: 'Present' },
        { id: 'STU-2023007', hash: 'g6b8...e5d4', pings: 0, status: 'Absent' },
    ];

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

                    {/* Mini Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Active Session', value: 'CS301-A', sub: 'In progress', color: '#16a34a', accent: '#3B2D82' },
                            { label: 'Total Students', value: `${attendanceSnapshot.length}`, sub: 'Enrolled in session', color: '#2563eb', accent: '#00A5A0' },
                            { label: 'Present', value: `${presentCount}`, sub: `${Math.round(presentCount / attendanceSnapshot.length * 100)}% detected`, color: '#16a34a', accent: '#00A5A0' },
                            { label: 'Absent', value: `${absentCount}`, sub: `${Math.round(absentCount / attendanceSnapshot.length * 100)}% missing`, color: '#dc2626', accent: '#E91E87' },
                        ].map((stat, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '1.2rem 1.5rem', border: '1px solid #e8e8e8', borderLeft: `3px solid ${stat.accent}`, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 500, marginBottom: '6px' }}>{stat.label}</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#111', letterSpacing: '-0.5px' }}>{stat.value}</div>
                                <div style={{ fontSize: '0.75rem', color: stat.color, fontWeight: 500, marginTop: '4px' }}>{stat.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Two Column: Engine Status + Attendance Table */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        {/* Wi-Fi Engine */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #E91E87', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}><Radio size={16} /> Wi-Fi Attendance Engine</div>
                                <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: '#555' }}><RefreshCw size={12} /> Refresh</button>
                            </div>
                            <div style={{ padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ background: '#f9f9f9', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>Session Status</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}></span>
                                        Active — CS301-A
                                    </div>
                                </div>
                                <div style={{ background: '#f9f9f9', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>Next Ping In</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111', fontFamily: 'monospace', letterSpacing: '1px' }}>{pad(timer.min)}:{pad(timer.sec)}</div>
                                </div>
                                <div style={{ background: '#f9f9f9', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>Ping Progress</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111' }}>3 / 5 completed</div>
                                    <div style={{ width: '100%', height: '5px', background: '#e5e7eb', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                                        <div style={{ width: '60%', height: '100%', background: '#111', borderRadius: '3px', transition: 'width 0.4s' }}></div>
                                    </div>
                                </div>
                                <div style={{ background: '#f9f9f9', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>Detection Rule</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111' }}>≥ 3 pings = Present</div>
                                </div>
                                <div style={{ background: '#f9f9f9', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>Mapped BSSID</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111', fontFamily: 'monospace' }}>C4:E9:84:A2:3F:01</div>
                                </div>
                                <div style={{ background: '#f9f9f9', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>Venue</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111' }}>Room 204, Block A</div>
                                </div>
                                <div style={{ background: '#f9f9f9', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f0f0f0', gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>Attendance Window</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111' }}>09:00 AM — 10:00 AM · 60 min session</div>
                                </div>
                            </div>
                        </div>

                        {/* Attendance Snapshot Table */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}><Activity size={16} /> Attendance Snapshot — CS301-A</div>
                                <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: '#555' }}><Download size={12} /> Export</button>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f9f9f9' }}>
                                            {['Student ID', 'Device Hash', 'Total Pings', 'Status', 'Action'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', borderBottom: '1px solid #eee' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendanceSnapshot.map((s, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }} className="attendance-row">
                                                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#111' }}>{s.id}</td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#777' }}>{s.hash}</td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{ fontWeight: 600, color: s.pings >= 3 ? '#16a34a' : s.pings >= 1 ? '#b45309' : '#dc2626' }}>{s.pings} / 5</span>
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500, background: s.status === 'Present' ? '#ecfdf5' : '#fef2f2', color: s.status === 'Present' ? '#166534' : '#991b1b' }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.status === 'Present' ? '#16a34a' : '#dc2626' }}></span>
                                                        {s.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <button style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: '#555' }} className="change-status-btn">Override</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
        </div>
    );
};

export default AdminAttendancePage;
