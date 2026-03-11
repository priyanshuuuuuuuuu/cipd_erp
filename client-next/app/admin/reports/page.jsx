'use client';
import React, { useState } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Download,
    FileText, BarChart3, Filter, RefreshCw, Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminReportsPage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [reportType, setReportType] = useState('attendance');
    const [dateFrom, setDateFrom] = useState('2026-02-01');
    const [dateTo, setDateTo] = useState('2026-02-28');
    const [courseFilter, setCourseFilter] = useState('all');
    const [facultyFilter, setFacultyFilter] = useState('all');
    const [format, setFormat] = useState('csv');
    const [generating, setGenerating] = useState(false);

    const navTo = p => router.push(p);

    const recentReports = [
        { id: 1, name: 'Attendance Report — Feb 2026', type: 'Attendance', date: '14 Feb 2026', range: '01 Feb – 14 Feb', format: 'CSV', status: 'Ready' },
        { id: 2, name: 'Feedback Summary — Week 6', type: 'Feedback', date: '12 Feb 2026', range: '10 Feb – 14 Feb', format: 'PDF', status: 'Ready' },
        { id: 3, name: 'Faculty Workload — Jan 2026', type: 'Faculty', date: '01 Feb 2026', range: '01 Jan – 31 Jan', format: 'CSV', status: 'Ready' },
        { id: 4, name: 'Wi-Fi Log Audit — CS301', type: 'Wi-Fi Logs', date: '10 Feb 2026', range: '03 Feb – 10 Feb', format: 'CSV', status: 'Ready' },
        { id: 5, name: 'Session Analytics — Monthly', type: 'Sessions', date: '01 Feb 2026', range: '01 Jan – 31 Jan', format: 'PDF', status: 'Ready' },
    ];

    const handleGenerate = () => {
        setGenerating(true);
        setTimeout(() => setGenerating(false), 2000);
    };

    const typeColors = {
        Attendance: { bg: '#ecfdf5', color: '#166534', border: '#bbf7d0' },
        Feedback: { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
        Faculty: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
        'Wi-Fi Logs': { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
        Sessions: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    };

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
                    <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours & Honorarium</span></div>
                    <div className="nav-item active"><FileBarChart size={18} /> <span>Reports</span></div>
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
                            <h1>Reports</h1>
                        </div>
                        <div className="header-actions">
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Report Generator */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart3 size={16} /> Generate Report</div>
                        <div style={{ padding: '1.2rem 1.5rem' }}>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '14px' }}>
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
                                <div style={{ minWidth: '150px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Date From</label>
                                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ minWidth: '150px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Date To</label>
                                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ minWidth: '150px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Course</label>
                                    <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                        <option value="all">All Courses</option>
                                        <option value="CS301">CS301 — Data Structures</option>
                                        <option value="PHY201">PHY201 — Quantum Physics</option>
                                        <option value="MATH101">MATH101 — Calculus II</option>
                                    </select>
                                </div>
                                <div style={{ minWidth: '150px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '4px' }}>Faculty</label>
                                    <select value={facultyFilter} onChange={e => setFacultyFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', width: '100%' }}>
                                        <option value="all">All Faculty</option>
                                        <option value="anuj">Prof. Anuj Grover</option>
                                        <option value="priya">Dr. Priya Sharma</option>
                                        <option value="rajesh">Prof. Rajesh Mehta</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888' }}>Format:</span>
                                    {['csv', 'pdf'].map(f => (
                                        <button key={f} onClick={() => setFormat(f)} style={{ padding: '5px 14px', borderRadius: '6px', border: `1px solid ${format === f ? '#111' : '#e8e8e8'}`, background: format === f ? '#111' : '#fff', color: format === f ? '#fff' : '#888', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase' }}>{f}</button>
                                    ))}
                                </div>
                                <button onClick={handleGenerate} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#111', cursor: generating ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                                    {generating ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><FileBarChart size={14} /> Generate Report</>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Recent Reports Table */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', overflow: 'hidden' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={16} /> Recent Reports</div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        {['Report Name', 'Type', 'Generated', 'Date Range', 'Format', 'Status', ''].map(h => (
                                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentReports.map(r => {
                                        const tc = typeColors[r.type] || typeColors.Attendance;
                                        return (
                                            <tr key={r.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111' }}>{r.name}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 500, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{r.type}</span>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{r.date}</td>
                                                <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#888' }}>{r.range}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, background: '#f5f5f5', color: '#555', textTransform: 'uppercase' }}>{r.format}</span>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 500, background: '#ecfdf5', color: '#166534' }}>
                                                        <CheckCircle size={11} /> {r.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <button className="change-status-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#555' }}><Download size={12} /> Download</button>
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
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
