'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, RefreshCw,
    CheckCircle, AlertTriangle, Filter, Hash, Users, Activity, ArrowUpDown, ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

export default function AdminWifiLogsPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState('captured_at');
    const [sortAsc, setSortAsc] = useState(false);

    // Date/time filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [timeFrom, setTimeFrom] = useState('');
    const [timeTo, setTimeTo] = useState('');

    // Pagination
    const [page, setPage] = useState(1);
    const [allLogs, setAllLogs] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [stats, setStats] = useState({ totalSnapshotsInDB: 0, snapshotsLoaded: 0, totalClients: 0, identifiedCount: 0 });
    const [latestSnapshot, setLatestSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const isMounted = useRef(true);

    const navTo = p => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin' : 'Admin';

    // Build query string for API
    const buildQS = useCallback((pg, searchOverride) => {
        const params = new URLSearchParams();
        params.set('page', String(pg));
        params.set('pageSize', '100');
        const q = searchOverride !== undefined ? searchOverride : searchTerm;
        if (q) params.set('search', q);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        if (timeFrom) params.set('timeFrom', timeFrom);
        if (timeTo) params.set('timeTo', timeTo);
        return params.toString();
    }, [searchTerm, dateFrom, dateTo, timeFrom, timeTo]);

    // Fetch page 1 (reset)
    const fetchLogs = useCallback(async (searchOverride) => {
        setLoading(true);
        setPage(1);
        try {
            const data = await api.get(`/api/admin/wifi-logs?${buildQS(1, searchOverride)}`);
            if (!isMounted.current) return;
            setAllLogs(data.logs || []);
            setHasMore(data.hasMore || false);
            setStats(data.stats || {});
            setLatestSnapshot(data.latestSnapshot || null);
        } catch (err) {
            console.error('Failed to fetch wifi logs:', err);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [buildQS]);

    // Load next page (append) — only when not searching
    const loadMore = async () => {
        const nextPage = page + 1;
        setLoadingMore(true);
        try {
            const data = await api.get(`/api/admin/wifi-logs?${buildQS(nextPage)}`);
            if (!isMounted.current) return;
            setAllLogs(prev => [...prev, ...(data.logs || [])]);
            setHasMore(data.hasMore || false);
            setPage(nextPage);
            setStats(prev => ({
                ...prev,
                snapshotsLoaded: prev.snapshotsLoaded + (data.stats?.snapshotsLoaded || 0),
                totalClients: prev.totalClients + (data.stats?.totalClients || 0),
                identifiedCount: prev.identifiedCount + (data.stats?.identifiedCount || 0),
            }));
        } catch (err) {
            console.error('Failed to load more:', err);
        } finally {
            if (isMounted.current) setLoadingMore(false);
        }
    };

    // Fetch on mount (no search)
    useEffect(() => {
        isMounted.current = true;
        if (authReady) fetchLogs('');
        return () => { isMounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady]);

    // Debounced search — re-fetch from API when search term changes
    useEffect(() => {
        if (!authReady) return;
        const timer = setTimeout(() => fetchLogs(searchTerm), 600);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    // Client-side sorting
    const sortedLogs = [...allLogs].sort((a, b) => {
        let cmp = 0;
        if (sortColumn === 'captured_at') cmp = (a.captured_at || '').localeCompare(b.captured_at || '');
        else if (sortColumn === 'signal') cmp = (a.signal || 0) - (b.signal || 0);
        else if (sortColumn === 'mac') cmp = (a.mac_address || '').localeCompare(b.mac_address || '');
        else if (sortColumn === 'student') cmp = (a.student_name || '').localeCompare(b.student_name || '');
        return sortAsc ? cmp : -cmp;
    });

    const handleSort = col => {
        if (sortColumn === col) setSortAsc(!sortAsc);
        else { setSortColumn(col); setSortAsc(true); }
    };

    const formatTime = (ts) => {
        if (!ts) return '—';
        return new Date(ts).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
        });
    };

    const SortHeader = ({ col, label }) => (
        <th onClick={() => handleSort(col)} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', cursor: 'pointer', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{label} <ArrowUpDown size={11} color={sortColumn === col ? '#111' : '#ccc'} /></div>
        </th>
    );

    const StaticHeader = ({ label }) => (
        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{label}</th>
    );

    const inputStyle = { padding: '7px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', boxSizing: 'border-box' };

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                            {user?.firstName?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '8px 1rem 4px' }}><span>Main</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin')} style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Dashboard</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/schedule')} style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/live-students')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Live Students</span></div>
                        <div className="nav-item active"><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
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
                    <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content">
                <div className="content-center admin-full">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Wi-Fi Snapshot Logs</h1>
                            <span style={{ fontSize: '0.65rem', fontWeight: 500, color: '#888', background: '#f5f5f5', padding: '3px 10px', borderRadius: '6px' }}>wifi_snapshots</span>
                        </div>
                        <div className="header-actions">
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Snapshots (DB)', value: stats.totalSnapshotsInDB, icon: Activity, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Snapshots Loaded', value: stats.snapshotsLoaded, icon: Hash, color: '#7c3aed', bg: '#faf5ff' },
                            { label: 'Total Clients', value: stats.totalClients, icon: Wifi, color: '#111', bg: '#f5f5f5' },
                            { label: 'Identified Students', value: stats.identifiedCount, icon: CheckCircle, color: '#16a34a', bg: '#ecfdf5' },
                        ].map((stat, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.bg, color: stat.color, flexShrink: 0 }}><stat.icon size={18} /></div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>{loading ? '—' : stat.value}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Search + Filters */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Filter size={16} /> Search & Filter</div>
                        <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            {/* Search */}
                            <div style={{ flex: '1.5', minWidth: '240px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>MAC / Student / Enrollment / Device</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} color="#aaa" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                    <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        style={{ ...inputStyle, width: '100%', paddingLeft: '32px' }} />
                                </div>
                            </div>
                            {/* Date From */}
                            <div style={{ minWidth: '140px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Date From</label>
                                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            {/* Time From */}
                            <div style={{ minWidth: '110px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Time From</label>
                                <input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            {/* Date To */}
                            <div style={{ minWidth: '140px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Date To</label>
                                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            {/* Time To */}
                            <div style={{ minWidth: '110px' }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Time To</label>
                                <input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            {/* Apply / Clear */}
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => fetchLogs(searchTerm)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#111', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>
                                    <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                                    {loading ? 'Loading...' : 'Apply'}
                                </button>
                                {(dateFrom || dateTo || timeFrom || timeTo) && (
                                    <button onClick={() => { setDateFrom(''); setDateTo(''); setTimeFrom(''); setTimeTo(''); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#888' }}>
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                        {latestSnapshot && (
                            <div style={{ padding: '4px 1.5rem 10px', fontSize: '0.7rem', color: '#aaa' }}>
                                Latest: <span style={{ fontFamily: 'monospace', color: '#888' }}>{formatTime(latestSnapshot)}</span> IST
                                &nbsp;·&nbsp; Showing <strong style={{ color: '#555' }}>{allLogs.length}</strong> client rows from <strong style={{ color: '#555' }}>{stats.snapshotsLoaded}</strong> snapshots (page {page})
                            </div>
                        )}
                    </div>

                    {/* Log Table */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                                <Wifi size={16} /> Snapshot Client Data
                                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>({sortedLogs.length} rows)</span>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                                        <SortHeader col="captured_at" label="Snapshot Time" />
                                        <SortHeader col="mac" label="MAC Address" />
                                        <SortHeader col="student" label="Student" />
                                        <StaticHeader label="Device" />
                                        <SortHeader col="signal" label="Signal" />
                                        <StaticHeader label="Duration" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && sortedLogs.length === 0 ? (
                                        <>{[1,2,3,4,5].map(i => (
                                            <tr key={`skel-${i}`} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                {[110,100,100,80,50,60].map((w,j) => (
                                                    <td key={j} style={{ padding: '10px 16px' }}><div style={{ width: `${w}px`, height: j===0?'12px':'10px', borderRadius: '4px', background: j%2===0?'#f0f0f0':'#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${(i*7+j)*0.05}s` }} /></td>
                                                ))}
                                            </tr>
                                        ))}</>
                                    ) : sortedLogs.length === 0 ? (
                                        <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                                            <Wifi size={32} color="#ddd" />
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '8px' }}>
                                                {searchTerm || dateFrom || dateTo ? 'No clients match your filters' : 'No snapshot data available'}
                                            </div>
                                        </td></tr>
                                    ) : sortedLogs.map((log, i) => (
                                        <tr key={`${log.snapshot_id}-${log.mac_address}-${i}`} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#444', whiteSpace: 'nowrap' }}>{formatTime(log.captured_at)}</td>
                                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#666' }}>{log.mac_address}</td>
                                            <td style={{ padding: '10px 16px' }}>
                                                {log.student_name ? (
                                                    <div>
                                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#111' }}>{log.student_name}</div>
                                                        <div style={{ fontSize: '0.65rem', color: '#aaa', fontFamily: 'monospace' }}>{log.enrollment_no}</div>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.72rem', color: '#ccc' }}>—</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 16px', fontSize: '0.75rem', color: '#888' }}>{log.device_name || '—'}</td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: (log.signal || 0) > 10 ? '#16a34a' : (log.signal || 0) > 3 ? '#b45309' : '#dc2626' }}>
                                                    {log.signal || 0}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.72rem', color: '#888' }}>{log.duration || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Load More */}
                        {hasMore && !loading && (
                            <div style={{ padding: '1rem', textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
                                <button onClick={loadMore} disabled={loadingMore}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 24px', borderRadius: '8px', border: '1px solid #e8e8e8', background: '#fff', cursor: loadingMore ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#555' }}>
                                    {loadingMore ? (
                                        <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading next 100...</>
                                    ) : (
                                        <><ChevronDown size={14} /> Load Next 100 Snapshots</>
                                    )}
                                </button>
                            </div>
                        )}

                        {!hasMore && allLogs.length > 0 && !loading && (
                            <div style={{ padding: '10px', textAlign: 'center', fontSize: '0.72rem', color: '#ccc', borderTop: '1px solid #f5f5f5' }}>
                                End of data — all matching snapshots loaded
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
            `}</style>
        </div>
    );
}
