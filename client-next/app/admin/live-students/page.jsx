'use client';
import React, { useState, useEffect, useCallback } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, RefreshCw, Activity,
    CheckCircle, Signal, Users, Monitor, AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminLiveStudentsPage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [data, setData] = useState({ students: [], unidentified: [], stats: { totalDevices: 0, identifiedStudents: 0, unidentifiedDevices: 0, avgSignal: 0 }, lastSnapshot: null });
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(null);

    const navTo = p => router.push(p);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const json = await api.get('/api/admin/live-students');
            if (json.students) setData(json);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('Failed to fetch live students:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 6 * 60 * 1000); // Refresh every 6 minutes
        return () => clearInterval(interval);
    }, [fetchData]);

    const SignalBars = ({ level }) => (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px' }}>
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ width: '3px', height: `${i * 3 + 2}px`, borderRadius: '1px', background: i <= level ? (level >= 4 ? '#16a34a' : level >= 3 ? '#b45309' : '#dc2626') : '#e5e7eb' }} />
            ))}
        </div>
    );

    const getSignalInfo = (level) => {
        if (level >= 4) return { label: 'Strong', color: '#16a34a', bg: '#ecfdf5' };
        if (level >= 3) return { label: 'Good', color: '#b45309', bg: '#fffbeb' };
        return { label: 'Weak', color: '#dc2626', bg: '#fef2f2' };
    };

    const filtered = data.students.filter(s => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return s.name?.toLowerCase().includes(term) || s.enrollmentNo?.toLowerCase().includes(term) || s.macAddress?.toLowerCase().includes(term);
    });

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
                    <div className="nav-item active"><Users size={18} /> <span>Live Students</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours &amp; Honorarium</span></div>
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
                            <h1>Live Students</h1>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.65rem', fontWeight: 500, color: '#16a34a', background: '#ecfdf5', padding: '3px 10px', borderRadius: '6px' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                                Live
                            </span>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search students..." className="search-input" /></div>
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Devices', value: data.stats.totalDevices, icon: Wifi, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Identified Students', value: data.stats.identifiedStudents, icon: Users, color: '#16a34a', bg: '#ecfdf5' },
                            { label: 'Unidentified Devices', value: data.stats.unidentifiedDevices, icon: Monitor, color: '#b45309', bg: '#fffbeb' },
                            { label: 'Avg Signal', value: data.stats.avgSignal, icon: Signal, color: '#7c3aed', bg: '#faf5ff' },
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

                    {/* Info Strip */}
                    <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', marginBottom: '1.2rem', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 1.5rem', gap: '16px', fontSize: '0.72rem', color: '#888', background: '#fafafa' }}>
                            <span>Last snapshot: <span style={{ fontWeight: 600, color: '#555' }}>{data.lastSnapshot ? new Date(data.lastSnapshot).toLocaleString() : '—'}</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>Auto-refresh: <span style={{ fontWeight: 600, color: '#555' }}>Every 6 min</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>Showing: <span style={{ fontWeight: 600, color: '#555' }}>Latest snapshot</span></span>
                            <button onClick={fetchData} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.7rem', color: '#888' }}><RefreshCw size={11} /> Refresh Now</button>
                        </div>
                    </div>

                    {/* Filter */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                                <Activity size={16} /> Connected Students
                                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>({filtered.length} students)</span>
                            </div>
                            <div style={{ position: 'relative', minWidth: '220px' }}>
                                <Search size={14} color="#aaa" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input type="text" placeholder="Search name, enrollment, MAC..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', outline: 'none', background: '#fafafa', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        {['Student', 'Enrollment', 'Signal', 'Device', 'IP Address', 'Duration', 'Status'].map(h => (
                                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                                            <Activity size={24} color="#ddd" /><div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>Loading live data...</div>
                                        </td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                                            <Users size={24} color="#ddd" /><div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>No students currently connected</div>
                                        </td></tr>
                                    ) : filtered.map((s, i) => {
                                        const sig = getSignalInfo(s.signal);
                                        return (
                                            <tr key={i} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#111' }}>{s.name}</td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{s.enrollmentNo}</td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <SignalBars level={s.signal} />
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: sig.color }}>{s.signal}/5</span>
                                                        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: sig.color, background: sig.bg, padding: '2px 6px', borderRadius: '4px' }}>{sig.label}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#666' }}>{s.deviceName || '—'}</td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#888' }}>{s.ip || '—'}</td>
                                                <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#555' }}>{s.duration || '—'}</td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: '#ecfdf5', color: '#166534' }}>
                                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16a34a' }} /> Connected
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Unidentified Devices */}
                    {data.unidentified.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #b45309', overflow: 'hidden', marginBottom: '1.5rem' }}>
                            <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                                <AlertCircle size={16} color="#b45309" /> Unidentified Devices
                                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>({data.unidentified.length} devices — MAC not registered to any student)</span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            {['MAC Address', 'Device Name', 'Signal', 'IP Address', 'Duration'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.unidentified.map((d, i) => {
                                            const sig = getSignalInfo(d.signal);
                                            return (
                                                <tr key={i} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{d.macAddress}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#666' }}>{d.deviceName || '—'}</td>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <SignalBars level={d.signal} />
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: sig.color }}>{d.signal}/5</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#888' }}>{d.ip || '—'}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#555' }}>{d.duration || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
}
