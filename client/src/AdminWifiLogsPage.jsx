import React, { useState } from 'react';
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
    X,
    Signal,
    MapPin,
    Hash,
    ChevronDown,
    Eye,
    AlertCircle,
    ArrowUpDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminWifiLogsPage = () => {
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Filters
    const [searchStudentId, setSearchStudentId] = useState('');
    const [dateFrom, setDateFrom] = useState('2026-02-14');
    const [dateTo, setDateTo] = useState('2026-02-14');
    const [timeFrom, setTimeFrom] = useState('09:00');
    const [timeTo, setTimeTo] = useState('12:00');
    const [venueFilter, setVenueFilter] = useState('all');
    const [signalFilter, setSignalFilter] = useState('all'); // all | strong | medium | weak
    const [sortColumn, setSortColumn] = useState('timestamp');
    const [sortAsc, setSortAsc] = useState(false);

    // Mock raw Wi-Fi probe log data — the "black box"
    const rawLogs = [
        { timestamp: '2026-02-14 09:00:12', deviceHash: 'a7f3...e1d2', studentId: 'STU-2023001', studentName: 'Aarav Gupta', bssid: 'C4:E9:84:A2:3F:01', rssi: -42, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:06:45', deviceHash: 'b2c1...f4a8', studentId: 'STU-2023002', studentName: 'Sneha Kumar', bssid: 'C4:E9:84:A2:3F:01', rssi: -68, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:12:08', deviceHash: 'b2c1...f4a8', studentId: 'STU-2023002', studentName: 'Sneha Kumar', bssid: 'C4:E9:84:A2:3F:02', rssi: -71, venue: 'Corridor, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:12:14', deviceHash: 'c9d4...b7e3', studentId: 'STU-2023003', studentName: 'Rohan Patel', bssid: 'C4:E9:84:A2:3F:01', rssi: -38, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:12:22', deviceHash: 'a7f3...e1d2', studentId: 'STU-2023001', studentName: 'Aarav Gupta', bssid: 'C4:E9:84:A2:3F:01', rssi: -45, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:18:33', deviceHash: 'e8f2...d6b1', studentId: 'STU-2023005', studentName: 'Karan Singh', bssid: 'C4:E9:84:A2:3F:03', rssi: -82, venue: 'Parking Lot', session: '—' },
        { timestamp: '2026-02-14 09:24:05', deviceHash: 'd1e5...a3c7', studentId: 'STU-2023004', studentName: 'Priya Malhotra', bssid: 'C4:E9:84:A2:3F:01', rssi: -51, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:24:11', deviceHash: 'a7f3...e1d2', studentId: 'STU-2023001', studentName: 'Aarav Gupta', bssid: 'C4:E9:84:A2:3F:01', rssi: -40, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:24:18', deviceHash: 'c9d4...b7e3', studentId: 'STU-2023003', studentName: 'Rohan Patel', bssid: 'C4:E9:84:A2:3F:01', rssi: -36, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:30:02', deviceHash: 'f3a7...c2e9', studentId: 'STU-2023006', studentName: 'Vivaan Singh', bssid: 'C4:E9:84:A2:3F:01', rssi: -55, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:36:09', deviceHash: 'b2c1...f4a8', studentId: 'STU-2023002', studentName: 'Sneha Kumar', bssid: 'C4:E9:84:A2:3F:02', rssi: -74, venue: 'Corridor, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:36:15', deviceHash: 'a7f3...e1d2', studentId: 'STU-2023001', studentName: 'Aarav Gupta', bssid: 'C4:E9:84:A2:3F:01', rssi: -43, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:42:07', deviceHash: 'd1e5...a3c7', studentId: 'STU-2023004', studentName: 'Priya Malhotra', bssid: 'C4:E9:84:A2:3F:01', rssi: -49, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:42:19', deviceHash: 'f3a7...c2e9', studentId: 'STU-2023006', studentName: 'Vivaan Singh', bssid: 'C4:E9:84:A2:3F:01', rssi: -58, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:48:03', deviceHash: 'e8f2...d6b1', studentId: 'STU-2023005', studentName: 'Karan Singh', bssid: 'C4:E9:84:A2:3F:01', rssi: -76, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:48:19', deviceHash: 'c9d4...b7e3', studentId: 'STU-2023003', studentName: 'Rohan Patel', bssid: 'C4:E9:84:A2:3F:01', rssi: -35, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:54:31', deviceHash: 'c9d4...b7e3', studentId: 'STU-2023003', studentName: 'Rohan Patel', bssid: 'C4:E9:84:A2:3F:01', rssi: -37, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:54:44', deviceHash: 'a7f3...e1d2', studentId: 'STU-2023001', studentName: 'Aarav Gupta', bssid: 'C4:E9:84:A2:3F:01', rssi: -41, venue: 'Room 204, Block A', session: 'CS301-A' },
        { timestamp: '2026-02-14 10:00:05', deviceHash: 'g6b8...e5d4', studentId: 'STU-2023007', studentName: 'Aditya Kumar', bssid: 'C4:E9:84:A2:3F:04', rssi: -88, venue: 'Canteen', session: '—' },
        { timestamp: '2026-02-14 10:06:22', deviceHash: 'f3a7...c2e9', studentId: 'STU-2023006', studentName: 'Vivaan Singh', bssid: 'C4:E9:84:A2:3F:01', rssi: -52, venue: 'Room 204, Block A', session: 'CS301-A' },
    ];

    // Signal strength classification
    const getSignalLevel = (rssi) => {
        if (rssi >= -50) return { label: 'Strong', color: '#16a34a', bg: '#ecfdf5' };
        if (rssi >= -70) return { label: 'Medium', color: '#b45309', bg: '#fffbeb' };
        return { label: 'Weak', color: '#dc2626', bg: '#fef2f2' };
    };

    // Signal bar visualization
    const SignalBars = ({ rssi }) => {
        const bars = rssi >= -50 ? 4 : rssi >= -60 ? 3 : rssi >= -70 ? 2 : 1;
        return (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px' }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                        width: '3px',
                        height: `${i * 4}px`,
                        borderRadius: '1px',
                        background: i <= bars ? getSignalLevel(rssi).color : '#e5e7eb',
                        transition: 'background 0.2s'
                    }} />
                ))}
            </div>
        );
    };

    // Filter logs
    const filteredLogs = rawLogs.filter(log => {
        if (searchStudentId && !log.studentId.toLowerCase().includes(searchStudentId.toLowerCase()) && !log.deviceHash.toLowerCase().includes(searchStudentId.toLowerCase()) && !log.studentName.toLowerCase().includes(searchStudentId.toLowerCase())) return false;
        if (venueFilter !== 'all' && log.venue !== venueFilter) return false;
        if (signalFilter === 'strong' && log.rssi < -50) return false;
        if (signalFilter === 'medium' && (log.rssi >= -50 || log.rssi < -70)) return false;
        if (signalFilter === 'weak' && log.rssi >= -70) return false;
        return true;
    });

    // Sort logs
    const sortedLogs = [...filteredLogs].sort((a, b) => {
        let cmp = 0;
        if (sortColumn === 'timestamp') cmp = a.timestamp.localeCompare(b.timestamp);
        else if (sortColumn === 'rssi') cmp = a.rssi - b.rssi;
        else if (sortColumn === 'deviceHash') cmp = a.deviceHash.localeCompare(b.deviceHash);
        else if (sortColumn === 'venue') cmp = a.venue.localeCompare(b.venue);
        return sortAsc ? cmp : -cmp;
    });

    const handleSort = (col) => {
        if (sortColumn === col) setSortAsc(!sortAsc);
        else { setSortColumn(col); setSortAsc(true); }
    };

    // Unique venues for filter
    const venues = [...new Set(rawLogs.map(l => l.venue))];

    // Stats
    const uniqueDevices = new Set(filteredLogs.map(l => l.deviceHash)).size;
    const avgRssi = filteredLogs.length > 0 ? Math.round(filteredLogs.reduce((a, l) => a + l.rssi, 0) / filteredLogs.length) : 0;
    const weakPings = filteredLogs.filter(l => l.rssi < -70).length;

    const handleLogout = () => navigate('/');

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
                        <div className="nav-item" onClick={() => navigate('/admin-attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                        <div className="nav-item active"><Wifi size={18} /> <span>Wi-Fi Logs</span></div>

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="menu-toggle" onClick={() => setIsMobileMenuOpen(true)} style={{ display: 'none', cursor: 'pointer' }}>
                                <Menu size={24} />
                            </div>
                            <h1>Wi-Fi Probe Logs</h1>
                            <span style={{ fontSize: '0.65rem', fontWeight: 500, color: '#888', background: '#f5f5f5', padding: '3px 10px', borderRadius: '6px', marginLeft: '4px' }}>Audit Trail</span>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar">
                                <Search size={16} color="#aaa" />
                                <input type="text" placeholder="Search logs..." className="search-input" />
                            </div>
                            <Bell size={20} color="#555" style={{ cursor: 'pointer' }} />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* ═══════ SUMMARY STATS ═══════ */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Probes', value: filteredLogs.length, icon: Activity, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Unique Devices', value: uniqueDevices, icon: Hash, color: '#7c3aed', bg: '#faf5ff' },
                            { label: 'Avg. Signal', value: `${avgRssi} dBm`, icon: Signal, color: avgRssi >= -50 ? '#16a34a' : avgRssi >= -70 ? '#b45309' : '#dc2626', bg: avgRssi >= -50 ? '#ecfdf5' : avgRssi >= -70 ? '#fffbeb' : '#fef2f2' },
                            { label: 'Weak Pings', value: weakPings, icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
                        ].map((stat, i) => (
                            <div key={i} style={{
                                background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)', padding: '1rem 1.2rem',
                                display: 'flex', alignItems: 'center', gap: '12px'
                            }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '10px', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', background: stat.bg, color: stat.color, flexShrink: 0
                                }}>
                                    <stat.icon size={18} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>{stat.value}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ═══════ FILTERS ═══════ */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Filter size={16} /> Search & Filter
                        </div>
                        <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            {/* Student ID / Device Hash search */}
                            <div style={{ flex: '1.5', minWidth: '220px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Student ID / Device Hash / Name</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} color="#aaa" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                    <input
                                        type="text"
                                        placeholder="e.g. STU-2023001 or a7f3..."
                                        value={searchStudentId}
                                        onChange={e => setSearchStudentId(e.target.value)}
                                        style={{
                                            width: '100%', padding: '8px 10px 8px 32px', borderRadius: '8px', border: '1px solid #e5e7eb',
                                            fontSize: '0.8rem', outline: 'none', background: '#fafafa', fontFamily: 'inherit',
                                            transition: 'border 0.15s'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Date range */}
                            <div style={{ minWidth: '130px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Date From</label>
                                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{
                                    padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none'
                                }} />
                            </div>
                            <div style={{ minWidth: '130px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Date To</label>
                                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{
                                    padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none'
                                }} />
                            </div>

                            {/* Time range */}
                            <div style={{ minWidth: '100px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Time From</label>
                                <input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} style={{
                                    padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none'
                                }} />
                            </div>
                            <div style={{ minWidth: '100px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Time To</label>
                                <input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} style={{
                                    padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none'
                                }} />
                            </div>

                            {/* Venue filter */}
                            <div style={{ minWidth: '150px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Venue</label>
                                <select value={venueFilter} onChange={e => setVenueFilter(e.target.value)} style={{
                                    padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer'
                                }}>
                                    <option value="all">All Venues</option>
                                    {venues.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>

                            {/* Signal filter */}
                            <div style={{ minWidth: '120px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Signal</label>
                                <select value={signalFilter} onChange={e => setSignalFilter(e.target.value)} style={{
                                    padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer'
                                }}>
                                    <option value="all">All Signals</option>
                                    <option value="strong">Strong (≥ -50)</option>
                                    <option value="medium">Medium (-50 to -70)</option>
                                    <option value="weak">Weak (&lt; -70)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ═══════ LOG TABLE ═══════ */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                                <Wifi size={16} /> Raw Probe Logs
                                <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#888' }}>({sortedLogs.length} entries)</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button style={{
                                    padding: '6px 14px', borderRadius: '8px', border: '1px solid #eee', background: '#fff',
                                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: '#555', display: 'flex', alignItems: 'center', gap: '5px'
                                }} className="change-status-btn">
                                    <RefreshCw size={12} /> Refresh
                                </button>
                                <button style={{
                                    padding: '6px 14px', borderRadius: '8px', border: '1px solid #eee', background: '#fff',
                                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: '#555', display: 'flex', alignItems: 'center', gap: '5px'
                                }} className="change-status-btn">
                                    <Download size={12} /> Export CSV
                                </button>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                                        <th onClick={() => handleSort('timestamp')} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Timestamp <ArrowUpDown size={11} color="#bbb" /></div>
                                        </th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student</th>
                                        <th onClick={() => handleSort('deviceHash')} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Device Hash <ArrowUpDown size={11} color="#bbb" /></div>
                                        </th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>BSSID Detected</th>
                                        <th onClick={() => handleSort('rssi')} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Signal (RSSI) <ArrowUpDown size={11} color="#bbb" /></div>
                                        </th>
                                        <th onClick={() => handleSort('venue')} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Mapped Venue <ArrowUpDown size={11} color="#bbb" /></div>
                                        </th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Session</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedLogs.map((log, i) => {
                                        const signal = getSignalLevel(log.rssi);
                                        return (
                                            <tr key={i} style={{
                                                borderBottom: '1px solid #f5f5f5',
                                                transition: 'background 0.1s',
                                                background: log.rssi < -70 ? '#fffbfb' : 'transparent'
                                            }} className="change-status-btn">
                                                <td style={{ padding: '10px 16px', fontFamily: "'Roboto Mono', monospace", fontSize: '0.75rem', color: '#444', whiteSpace: 'nowrap' }}>
                                                    {log.timestamp}
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#111' }}>{log.studentName}</div>
                                                    <div style={{ fontSize: '0.65rem', color: '#aaa', fontFamily: "'Roboto Mono', monospace" }}>{log.studentId}</div>
                                                </td>
                                                <td style={{ padding: '10px 16px', fontFamily: "'Roboto Mono', monospace", fontSize: '0.75rem', color: '#666' }}>
                                                    {log.deviceHash}
                                                </td>
                                                <td style={{ padding: '10px 16px', fontFamily: "'Roboto Mono', monospace", fontSize: '0.75rem', color: '#666' }}>
                                                    {log.bssid}
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <SignalBars rssi={log.rssi} />
                                                        <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: '0.75rem', fontWeight: 600, color: signal.color }}>
                                                            {log.rssi} dBm
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.6rem', fontWeight: 600, color: signal.color, background: signal.bg,
                                                            padding: '2px 6px', borderRadius: '4px'
                                                        }}>
                                                            {signal.label}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#444' }}>
                                                        <MapPin size={12} color="#aaa" />
                                                        {log.venue}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{
                                                        fontSize: '0.7rem', fontWeight: 600,
                                                        color: log.session === '—' ? '#aaa' : '#2563eb',
                                                        background: log.session === '—' ? '#f5f5f5' : '#eff6ff',
                                                        padding: '3px 8px', borderRadius: '6px'
                                                    }}>
                                                        {log.session}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {sortedLogs.length === 0 && (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                                <Wifi size={32} color="#ddd" />
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '8px' }}>No logs match your filters</div>
                                <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Try adjusting the search or filter criteria</div>
                            </div>
                        )}
                    </div>

                    {/* ═══════ DISPUTE RESOLUTION CALLOUT ═══════ */}
                    <div style={{
                        background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #b45309',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden', marginBottom: '1.5rem'
                    }}>
                        <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', background: '#fffbeb', color: '#b45309', flexShrink: 0
                            }}>
                                <AlertCircle size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111', marginBottom: '4px' }}>Dispute Resolution — How to Use</div>
                                <div style={{ fontSize: '0.78rem', color: '#666', lineHeight: 1.6 }}>
                                    If a student claims they were <strong>present but marked absent</strong>, search their Student ID here to check the raw probe data.
                                    Look for their device pings — they may have been detected with fewer pings than the threshold
                                    (e.g., only 2 out of the required 3), or connected to a <strong>different BSSID</strong> (wrong room AP), or had a
                                    <strong> weak signal</strong> below the RSSI threshold. This log is the authoritative record for all attendance disputes.
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AdminWifiLogsPage;
