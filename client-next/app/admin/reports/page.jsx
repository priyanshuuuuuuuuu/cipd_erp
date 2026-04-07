'use client';
import React, { useState, useEffect, useCallback } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Download,
    FileText, BarChart3, RefreshCw, AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

export default function AdminReportsPage() {
    const router = useRouter();
    const { logout } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Filters
    const [reportType, setReportType] = useState('attendance');
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [dateTo,   setDateTo]   = useState(() => new Date().toISOString().split('T')[0]);
    const [courseFilter,  setCourseFilter]  = useState('all');
    const [facultyFilter, setFacultyFilter] = useState('all');

    // Dropdown data (real from DB)
    const [courses, setCourses]   = useState([]);
    const [faculty, setFaculty]   = useState([]);

    // Page data
    const [recentReports, setRecentReports] = useState([]);
    const [metrics, setMetrics] = useState({ totalReports: 0, generatedThisMonth: 0, avgRating: '—' });
    const [loading,    setLoading]    = useState(true);
    const [generating, setGenerating] = useState(false);
    const [genError,   setGenError]   = useState(null);

    const navTo = p => router.push(p);

    // ── fetch page data ────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [reportsRes, lookupRes] = await Promise.allSettled([
                api.get('/api/admin/reports'),
                api.get('/api/admin/lookup'),
            ]);

            if (reportsRes.status === 'fulfilled') {
                const d = reportsRes.value;
                if (d.recentReports) setRecentReports(d.recentReports);
                if (d.metrics) setMetrics(d.metrics);
            }

            if (lookupRes.status === 'fulfilled') {
                const l = lookupRes.value;
                setCourses(l.courses || []);
                setFaculty(l.faculty || []);
            }
        } catch (err) {
            console.error('Reports page load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── CSV download helper ────────────────────────────────────────────────────
    const downloadCSV = (url, filename) => {
        const token = typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('token')) : null;
        const link = document.createElement('a');
        link.href = url + (token ? `${url.includes('?') ? '&' : '?'}_t=${encodeURIComponent(token)}` : '');
        link.download = filename;
        link.click();
    };

    // We use fetch with auth header to get the blob, then trigger a download
    const fetchAndDownload = async (params, filename) => {
        const token = typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('token')) : null;
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(`/api/admin/reports/export?${qs}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || 'Export failed');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── generate report (entire filtered set) ─────────────────────────────────
    const handleGenerate = async () => {
        setGenerating(true);
        setGenError(null);
        const timestamp = new Date().toISOString().split('T')[0];
        try {
            await fetchAndDownload({
                type: reportType,
                ...(dateFrom  && { dateFrom }),
                ...(dateTo    && { dateTo }),
                ...(courseFilter  !== 'all' && { courseId: courseFilter }),
                ...(facultyFilter !== 'all' && { facultyId: facultyFilter }),
            }, `cipd_${reportType}_${timestamp}.csv`);
        } catch (err) {
            setGenError(err.message);
        } finally {
            setGenerating(false);
        }
    };

    // ── download a specific session's report row ───────────────────────────────
    const handleDownloadRow = async (report) => {
        const timestamp = new Date().toISOString().split('T')[0];
        try {
            // Determine best type from report.type label
            const typeMap = {
                'Attendance Summary': 'attendance',
                'Course Feedback':    'feedback',
                'Faculty Evaluation': 'faculty',
            };
            const type = typeMap[report.type] || 'attendance';
            await fetchAndDownload(
                { type, dateFrom: report.sessionDate, dateTo: report.sessionDate },
                `cipd_${type}_${report.sessionDate || timestamp}.csv`
            );
        } catch (err) {
            console.error('Row download error:', err);
        }
    };

    // ── colour helpers ─────────────────────────────────────────────────────────
    const typeColors = {
        'Attendance Summary': { bg: '#ecfdf5', color: '#166534', border: '#bbf7d0' },
        'Course Feedback':    { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
        'Faculty Evaluation': { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
        'Wi-Fi Logs':         { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
        'Session Analytics':  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    };

    // ── sidebar ────────────────────────────────────────────────────────────────
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
                    <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Management</span></div>
                    <div className="nav-item active"><FileBarChart size={18} /> <span>Reports</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/notifications')} style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/settings')} style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                </nav>
            </div>
            <div className="sidebar-footer">
                <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
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
                            <h1>Reports</h1>
                        </div>
                        <div className="header-actions">
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Metric Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { title: 'Total Sessions Completed', value: loading ? '...' : metrics.totalReports, icon: FileText, color: '#3b82f6', bg: '#eff6ff' },
                            { title: 'Completed This Month',     value: loading ? '...' : metrics.generatedThisMonth, icon: Clock, color: '#8b5cf6', bg: '#f5f3ff' },
                            { title: 'Avg. Feedback Rating',     value: loading ? '...' : metrics.avgRating, icon: CheckCircle, color: '#10b981', bg: '#ecfdf5' },
                        ].map((stat, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: stat.bg, borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <stat.icon size={20} color={stat.color} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.72rem', color: '#888', marginBottom: '4px' }}>{stat.title}</p>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#333' }}>{stat.value}</h3>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Report Generator */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BarChart3 size={16} /> Generate & Export Report
                        </div>
                        <div style={{ padding: '1.2rem 1.5rem' }}>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '14px' }}>
                                {/* Report Type */}
                                <div style={{ minWidth: '180px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Report Type</label>
                                    <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                        <option value="attendance">Attendance</option>
                                        <option value="feedback">Feedback</option>
                                        <option value="faculty">Faculty Workload</option>
                                        <option value="wifi">Wi-Fi Logs</option>
                                        <option value="sessions">Session Analytics</option>
                                    </select>
                                </div>

                                {/* Date From */}
                                <div style={{ minWidth: '150px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Date From</label>
                                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                                </div>

                                {/* Date To */}
                                <div style={{ minWidth: '150px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Date To</label>
                                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                                </div>

                                {/* Course — real data from /api/admin/lookup */}
                                {['attendance', 'feedback', 'sessions'].includes(reportType) && (
                                    <div style={{ minWidth: '160px' }}>
                                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Course</label>
                                        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                            <option value="all">All Courses</option>
                                            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {/* Faculty — real data from /api/admin/lookup */}
                                {['faculty', 'sessions'].includes(reportType) && (
                                    <div style={{ minWidth: '160px' }}>
                                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Faculty</label>
                                        <select value={facultyFilter} onChange={e => setFacultyFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                            <option value="all">All Faculty</option>
                                            {faculty.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {genError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '0.78rem', marginBottom: '10px' }}>
                                    <AlertCircle size={14} /> {genError}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={handleGenerate} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', border: 'none', background: generating ? '#ccc' : '#111', cursor: generating ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                                    {generating
                                        ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                                        : <><Download size={14} /> Export CSV</>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Recent Reports Table */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', overflow: 'hidden' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={16} /> Recent Sessions (exportable)
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            {loading ? (
                                <div>
                                    {[1,2,3,4].map(i => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 1.5rem', borderBottom: '1px solid #f5f5f5' }}>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                <div style={{ width: `${50 + i * 12}%`, height: '11px', borderRadius: '4px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                            </div>
                                            <div style={{ width: '90px', height: '20px', borderRadius: '6px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
                                            <div style={{ width: '70px', height: '10px', borderRadius: '3px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                                            <div style={{ width: '65px', height: '22px', borderRadius: '8px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.12}s` }} />
                                            <div style={{ width: '80px', height: '26px', borderRadius: '6px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.18}s` }} />
                                        </div>
                                    ))}
                                </div>
                            ) : recentReports.length === 0 ? (
                                <div style={{ padding: '2rem', color: '#aaa', textAlign: 'center', fontSize: '0.85rem' }}>No completed sessions yet.</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            {['Session / Faculty', 'Type', 'Date', 'Status', ''].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentReports.map(r => {
                                            const tc = typeColors[r.type] || typeColors['Attendance Summary'];
                                            return (
                                                <tr key={r.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111' }}>{r.name}</td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 500, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{r.type}</span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{r.date}</td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 500, background: '#ecfdf5', color: '#166634' }}>
                                                            <CheckCircle size={11} /> {r.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <button
                                                            onClick={() => handleDownloadRow(r)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#555' }}
                                                        >
                                                            <Download size={12} /> Download
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
        </div>
    );
}
