'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, RefreshCw, Activity,
    CheckCircle, Signal, Users, Monitor, AlertCircle, AlertTriangle, XCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminLiveStudentsPage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [data, setData] = useState({
        students: [], unidentified: [], stats: { totalDevices: 0, identifiedStudents: 0, unidentifiedDevices: 0, avgSignal: 0 },
        lastSnapshot: null, lastUpdated: null, isStale: false, isUnchanged: false, staleMessage: null, minutesAgo: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);
    const previousSnapshotId = useRef(null);
    const [unchangedCount, setUnchangedCount] = useState(0);
    const [nextRefreshIn, setNextRefreshIn] = useState(null); // seconds until next auto-refresh
    const refreshTimerRef = useRef(null);
    const scannerIntervalRef = useRef(6 * 60 * 1000);
    const [scannerIntervalMs, _setScannerIntervalMs] = useState(6 * 60 * 1000);
    const setScannerIntervalMs = (val) => { scannerIntervalRef.current = val; _setScannerIntervalMs(val); };

    const navTo = p => router.push(p);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const json = await api.get('/api/admin/live-students');

            if (json.error) {
                setError(json.error);
                return;
            }

            // Track if snapshotId hasn't changed across refreshes
            if (previousSnapshotId.current !== null && json.snapshotId === previousSnapshotId.current) {
                setUnchangedCount(prev => prev + 1);
            } else {
                setUnchangedCount(0);
            }
            previousSnapshotId.current = json.snapshotId;

            setData(json);
            setLastRefresh(new Date());

            // Schedule next refresh: scannerInterval after last DB snapshot time + 15s buffer for DB write
            if (json.lastUpdated) {
                const nextSnapshotTime = new Date(json.lastUpdated).getTime() + scannerIntervalRef.current + 15000;
                const delay = Math.max(30000, nextSnapshotTime - Date.now()); // at least 30s

                setNextRefreshIn(Math.round(delay / 1000));

                if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = setTimeout(() => fetchData(), delay);
            } else {
                // No snapshot data — fallback to scanner interval
                if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = setTimeout(() => fetchData(), scannerIntervalRef.current);
                setNextRefreshIn(Math.round(scannerIntervalRef.current / 1000));
            }
        } catch (err) {
            console.error('Failed to fetch live students:', err);
            setError(err.message || 'Failed to fetch data');
            // Retry after 30s on error
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = setTimeout(() => fetchData(), 30000);
            setNextRefreshIn(30);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Load scanner interval from settings BEFORE first data fetch
        const init = async () => {
            try {
                const conf = await api.get('/api/admin/settings/config');
                const mins = conf?.scanner_interval_minutes || conf?.ping_interval || 6;
                setScannerIntervalMs(mins * 60 * 1000);
            } catch (e) {}
            fetchData();
        };
        init();
        return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
    }, [fetchData]);

    // Countdown ticker for next refresh display
    useEffect(() => {
        if (nextRefreshIn === null || nextRefreshIn <= 0) return;
        const tick = setInterval(() => {
            setNextRefreshIn(prev => (prev !== null && prev > 0) ? prev - 1 : null);
        }, 1000);
        return () => clearInterval(tick);
    }, [nextRefreshIn]);

    // Format "X minutes ago" / "just now"
    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '—';
        const diff = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
        if (diff < 1) return 'just now';
        if (diff === 1) return '1 minute ago';
        if (diff < 60) return `${diff} minutes ago`;
        const hours = Math.floor(diff / 60);
        if (hours === 1) return '1 hour ago';
        return `${hours} hours ago`;
    };

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
        return s.name?.toLowerCase().includes(term) || s.enrollmentNo?.toLowerCase().includes(term) || s.macAddress?.toLowerCase().includes(term) || s.email?.toLowerCase().includes(term);
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
                    <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Management</span></div>
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
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.65rem', fontWeight: 500, color: data.isStale ? '#dc2626' : '#16a34a', background: data.isStale ? '#fef2f2' : '#ecfdf5', padding: '3px 10px', borderRadius: '6px' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: data.isStale ? '#dc2626' : '#16a34a', display: 'inline-block', animation: data.isStale ? 'none' : 'pulse 2s infinite' }} />
                                {data.isStale ? 'Stale' : 'Live'}
                            </span>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search students..." className="search-input" /></div>
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* ── Stale / Error Banners ── */}
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '1rem' }}>
                            <XCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626' }}>Error Loading Data</div>
                                <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '2px' }}>{error}</div>
                            </div>
                            <button onClick={fetchData} style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <RefreshCw size={12} /> Retry
                            </button>
                        </div>
                    )}

                    {(data.isStale || data.isUnchanged || unchangedCount >= 2) && !error && (
                        <div className="ls-banner" style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px',
                            background: data.isStale ? '#fef2f2' : '#fffbeb',
                            border: `1px solid ${data.isStale ? '#fecaca' : '#fde68a'}`,
                            borderRadius: '10px', marginBottom: '1rem',
                        }}>
                            <AlertTriangle size={18} color={data.isStale ? '#dc2626' : '#b45309'} style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: data.isStale ? '#dc2626' : '#b45309' }}>
                                    {data.isStale ? 'Scanner Data is Stale' : 'Scanner Data Unchanged'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: data.isStale ? '#991b1b' : '#92400e', marginTop: '2px' }}>
                                    {data.staleMessage || (unchangedCount >= 2 ? `Snapshot data has been identical for the last ${unchangedCount + 1} refreshes — the scanner may have stopped updating.` : '')}
                                </div>
                            </div>
                            <button onClick={fetchData} style={{
                                padding: '5px 14px', borderRadius: '8px',
                                border: `1px solid ${data.isStale ? '#fecaca' : '#fde68a'}`,
                                background: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                                color: data.isStale ? '#dc2626' : '#b45309', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                            }}>
                                <RefreshCw size={12} /> Refresh
                            </button>
                        </div>
                    )}

                    {/* Stats Cards */}
                    <div className="ls-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Devices', value: data.stats.totalDevices, icon: Wifi, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Identified Students', value: data.stats.identifiedStudents, icon: Users, color: '#16a34a', bg: '#ecfdf5' },
                            { label: 'Unidentified Devices', value: data.stats.unidentifiedDevices, icon: Monitor, color: '#b45309', bg: '#fffbeb' },
                            { label: 'Avg Signal', value: `${data.stats.avgSignal}/5`, icon: Signal, color: '#7c3aed', bg: '#faf5ff' },
                        ].map((stat, i) => (
                            <div key={i} className="ls-stat-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="ls-stat-icon" style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.bg, color: stat.color, flexShrink: 0 }}><stat.icon size={18} /></div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>{stat.value}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Info Strip — Last Updated */}
                    <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', marginBottom: '1.2rem', overflow: 'hidden' }}>
                        <div className="ls-info-strip" style={{ display: 'flex', alignItems: 'center', padding: '10px 1.5rem', gap: '16px', fontSize: '0.75rem', color: '#888', background: '#fafafa', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Clock size={13} color="#888" />
                                Last Snapshot: <span style={{ fontWeight: 700, color: data.isStale ? '#dc2626' : '#111' }}>
                                    {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }) : '—'}
                                </span>
                            </span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Activity size={12} />
                                <span style={{ fontWeight: 600, color: data.isStale ? '#dc2626' : '#555' }}>
                                    {data.lastUpdated ? formatTimeAgo(data.lastUpdated) : '—'}
                                </span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <RefreshCw size={12} />
                                Next refresh: <span style={{ fontWeight: 700, color: '#555', fontFamily: 'monospace' }}>
                                    {nextRefreshIn !== null && nextRefreshIn > 0
                                        ? `${Math.floor(nextRefreshIn / 60)}m ${(nextRefreshIn % 60).toString().padStart(2, '0')}s`
                                        : 'now'}
                                </span>
                            </span>
                            <button className="ls-refresh-btn" onClick={fetchData} disabled={loading} style={{
                                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '5px 12px', borderRadius: '6px', border: '1px solid #e8e8e8',
                                background: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                                fontSize: '0.72rem', color: '#555', fontWeight: 600,
                            }}>
                                <RefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                                {loading ? 'Refreshing...' : 'Refresh Now'}
                            </button>
                        </div>
                    </div>

                    {/* Connected Students Table */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div className="ls-table-header" style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                                <Activity size={16} /> Connected Students
                                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>({filtered.length} students)</span>
                            </div>
                            <div className="ls-search-wrap" style={{ position: 'relative', minWidth: '220px' }}>
                                <Search size={14} color="#aaa" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input type="text" placeholder="Search name, enrollment, MAC..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', outline: 'none', background: '#fafafa', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ls-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        {[{l:'Student'},{l:'Enrollment'},{l:'Program',c:'ls-col-program'},{l:'MAC Address',c:'ls-col-mac'},{l:'Signal'},{l:'IP Address',c:'ls-col-ip'},{l:'Duration',c:'ls-col-duration'},{l:'Status',c:'ls-col-status'}].map(h => (
                                            <th key={h.l} className={h.c||''} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', borderBottom: '1px solid #f0f0f0' }}>{h.l}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && data.students.length === 0 ? (
                                        <>{[1,2,3,4,5].map(i => (
                                            <tr key={`skel-${i}`} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                {[90,100,80,80,80,60,70,50].map((w,j) => (
                                                    <td key={j} style={{ padding: '10px 16px' }}><div style={{ width: `${w}px`, height: j===0||j===1?'12px':'10px', borderRadius: '4px', background: j%2===0?'#f0f0f0':'#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${(i*8+j)*0.05}s` }} /></td>
                                                ))}
                                            </tr>
                                        ))}</>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                                            <Users size={24} color="#ddd" />
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>
                                                {searchTerm ? 'No students match your search' : 'No students currently connected'}
                                            </div>
                                        </td></tr>
                                    ) : filtered.map((s, i) => {
                                        const sig = getSignalInfo(s.signal);
                                        return (
                                            <tr key={s.studentId || i} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                                                            {s.firstName?.[0]?.toUpperCase() || s.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: '#111', fontSize: '0.84rem' }}>{s.name}</div>
                                                            <div style={{ fontSize: '0.68rem', color: '#aaa' }}>{s.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{s.enrollmentNo || '—'}</td>
                                                <td className="ls-col-program" style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#666' }}>{s.program || '—'}</td>
                                                <td className="ls-col-mac" style={{ padding: '10px 16px' }}>
                                                    <code style={{ padding: '3px 8px', background: '#f5f5f5', borderRadius: '5px', fontSize: '0.72rem', fontFamily: 'monospace', color: '#555', letterSpacing: '0.5px' }}>
                                                        {s.macAddress}
                                                    </code>
                                                    {s.macVerified && (
                                                        <CheckCircle size={11} color="#16a34a" style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <SignalBars level={s.signal} />
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: sig.color }}>{s.signal}/5</span>
                                                        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: sig.color, background: sig.bg, padding: '2px 6px', borderRadius: '4px' }}>{sig.label}</span>
                                                    </div>
                                                </td>
                                                <td className="ls-col-ip" style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#888' }}>{s.ip || '—'}</td>
                                                <td className="ls-col-duration" style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#555' }}>{s.duration || '—'}</td>
                                                <td className="ls-col-status" style={{ padding: '10px 16px' }}>
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
                                            {[{l:'MAC Address'},{l:'Device Name',c:'ls-uid-col-device'},{l:'Signal'},{l:'IP Address',c:'ls-uid-col-ip'},{l:'Duration'}].map(h => (
                                                <th key={h.l} className={h.c||''} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', borderBottom: '1px solid #f0f0f0' }}>{h.l}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.unidentified.map((d, i) => {
                                            const sig = getSignalInfo(d.signal);
                                            return (
                                                <tr key={i} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        <code style={{ padding: '3px 8px', background: '#fef3c7', borderRadius: '5px', fontSize: '0.72rem', fontFamily: 'monospace', color: '#92400e', letterSpacing: '0.5px' }}>
                                                            {d.macAddress}
                                                        </code>
                                                    </td>
                                                    <td className="ls-uid-col-device" style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#666' }}>{d.deviceName || '—'}</td>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <SignalBars level={d.signal} />
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: sig.color }}>{d.signal}/5</span>
                                                        </div>
                                                    </td>
                                                    <td className="ls-uid-col-ip" style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#888' }}>{d.ip || '—'}</td>
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
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes shimmer {
                    0% { opacity: 0.4; }
                    50% { opacity: 1; }
                    100% { opacity: 0.4; }
                }

                /* ── Live Students Mobile Responsive ── */
                @media (max-width: 768px) {
                    .ls-stats-grid {
                        grid-template-columns: 1fr 1fr !important;
                        gap: 8px !important;
                    }
                    .ls-info-strip {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 8px !important;
                        padding: 10px 1rem !important;
                    }
                    .ls-info-strip .ls-refresh-btn {
                        width: 100%;
                        justify-content: center;
                        margin-left: 0 !important;
                    }
                    .ls-table-header {
                        flex-direction: column !important;
                        gap: 8px !important;
                        align-items: flex-start !important;
                    }
                    .ls-search-wrap {
                        min-width: unset !important;
                        width: 100% !important;
                    }
                    /* Hide low-priority columns */
                    .ls-col-program,
                    .ls-col-mac,
                    .ls-col-ip,
                    .ls-col-duration,
                    .ls-col-status {
                        display: none !important;
                    }
                    .ls-table th,
                    .ls-table td {
                        padding: 8px 10px !important;
                    }
                    /* Unidentified table columns */
                    .ls-uid-col-ip,
                    .ls-uid-col-device {
                        display: none !important;
                    }
                    /* Banner stacking */
                    .ls-banner {
                        flex-wrap: wrap !important;
                    }
                }

                @media (max-width: 480px) {
                    .ls-stats-grid {
                        grid-template-columns: 1fr 1fr !important;
                    }
                    .ls-stat-card {
                        padding: 0.8rem !important;
                        gap: 8px !important;
                    }
                    .ls-stat-icon {
                        width: 32px !important;
                        height: 32px !important;
                    }
                }
            `}</style>
        </div>
    );
}
