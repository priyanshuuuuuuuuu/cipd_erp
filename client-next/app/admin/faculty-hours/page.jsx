'use client';
import React, { useState } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Download,
    Eye, IndianRupee, Users, Filter
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminFacultyHoursPage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState('2026-03');
    const [viewingSessions, setViewingSessions] = useState(null);
    const [facultyData, setFacultyData] = useState([]);
    const [loading, setLoading] = useState(true);

    const navTo = p => router.push(p);

    React.useEffect(() => {
        setLoading(true);
        fetch('/api/admin/faculty-hours')
            .then(res => res.json())
            .then(data => {
                if (data.facultyData) {
                    setFacultyData(data.facultyData);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch faculty hours:", err);
                setLoading(false);
            });
    }, []);

    const totalSessions = facultyData.reduce((a, f) => a + (f.sessions || 0), 0);
    const totalHours = facultyData.reduce((a, f) => a + (f.hours || 0), 0);
    const totalHonorarium = facultyData.reduce((a, f) => a + (f.hours || 0) * (f.rate || 0), 0);
    const pendingPayments = facultyData.filter(f => f.status === 'Pending').length;

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
                    <div className="nav-item active"><Clock size={18} /> <span>Faculty Hours & Honorarium</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/reports')} style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/notifications')} style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
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
                            <h1>Faculty Hours & Honorarium</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search faculty..." className="search-input" /></div>
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Sessions', value: totalSessions, icon: Calendar, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Total Hours', value: `${totalHours}h`, icon: Clock, color: '#7c3aed', bg: '#faf5ff' },
                            { label: 'Total Honorarium', value: `₹${(totalHonorarium / 1000).toFixed(1)}K`, icon: IndianRupee, color: '#16a34a', bg: '#ecfdf5' },
                            { label: 'Pending Payments', value: pendingPayments, icon: Users, color: '#b45309', bg: '#fffbeb' },
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

                    {/* Month filter + export */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#555' }}>Month:</span>
                            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', color: '#555', fontFamily: 'inherit' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#555' }}><Download size={12} /> Export CSV</button>
                            <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#555' }}><Download size={12} /> Export PDF</button>
                        </div>
                    </div>

                    {/* Faculty Table */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        {['Faculty', 'Department', 'Sessions', 'Total Hours', 'Rate/Hr', 'Honorarium', 'Status', ''].map(h => (
                                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {facultyData.map(f => (
                                        <tr key={f.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111' }}>{f.name}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 500, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>{f.dept}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#333' }}>{f.sessions}</td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#333' }}>{f.hours.toFixed(1)}h</td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>₹{f.rate.toLocaleString()}</td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#111' }}>₹{(Math.round((f.hours || 0) * (f.rate || 0))).toLocaleString()}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: f.status === 'Paid' ? '#ecfdf5' : '#fffbeb', color: f.status === 'Paid' ? '#166534' : '#92400e' }}>{f.status}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button onClick={() => setViewingSessions(viewingSessions === f.id ? null : f.id)} className="change-status-btn" style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#555', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={12} /> Sessions</button>
                                                    {f.status === 'Pending' && (
                                                        <button className="change-status-btn" style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #16a34a', background: '#ecfdf5', cursor: 'pointer', fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>Mark Paid</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Expandable session details */}
                        {viewingSessions && (
                            <div style={{ borderTop: '2px solid #e8e8e8', padding: '1rem 1.5rem', background: '#fafafa' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111', marginBottom: '10px' }}>Session Details — {facultyData.find(f => f.id === viewingSessions)?.name}</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                        <tr>
                                            {['Date', 'Course', 'Duration', 'Venue'].map(h => (
                                                <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: '#aaa', borderBottom: '1px solid #e8e8e8' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(facultyData.find(f => f.id === viewingSessions)?.sessionDetails || []).length > 0 ? (
                                            (facultyData.find(f => f.id === viewingSessions)?.sessionDetails).map((s, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                    <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#555' }}>{s.date}</td>
                                                    <td style={{ padding: '6px 12px', fontWeight: 500, color: '#333' }}>{s.course}</td>
                                                    <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#555' }}>{s.duration}</td>
                                                    <td style={{ padding: '6px 12px', color: '#888' }}>{s.venue}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan="4" style={{ padding: '10px 12px', color: '#888', textAlign: 'center' }}>No completed sessions found for this faculty member.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Summary footer */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.82rem', color: '#888' }}>Showing {facultyData.length} faculty members</div>
                        <div style={{ display: 'flex', gap: '20px', fontSize: '0.82rem' }}>
                            <span style={{ color: '#888' }}>Total: <strong style={{ color: '#111', fontFamily: 'monospace' }}>₹{Math.round(totalHonorarium).toLocaleString()}</strong></span>
                            <span style={{ color: '#888' }}>Paid: <strong style={{ color: '#16a34a', fontFamily: 'monospace' }}>₹{Math.round(facultyData.filter(f => f.status === 'Paid').reduce((a, f) => a + (f.hours || 0) * (f.rate || 0), 0)).toLocaleString()}</strong></span>
                            <span style={{ color: '#888' }}>Pending: <strong style={{ color: '#b45309', fontFamily: 'monospace' }}>₹{Math.round(facultyData.filter(f => f.status === 'Pending').reduce((a, f) => a + (f.hours || 0) * (f.rate || 0), 0)).toLocaleString()}</strong></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
