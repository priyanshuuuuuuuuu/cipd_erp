'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle,
    Download, RefreshCw, AlertCircle, Users, BookOpen, BarChart3,
    TrendingUp, Search, X, Tag,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    LineChart, Line, Area, AreaChart,
} from 'recharts';

// ── Palette ────────────────────────────────────────────────────────────────
// Domain / categorical bars - a rich, varied palette
const DOMAIN_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#fb923c', // orange
  '#ec4899', // pink
  '#84cc16', // lime
];
// Session type donut
const TYPE_COLORS  = ['#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#3b82f6', '#8b5cf6'];
// Area chart
const C_SESSIONS   = '#6366f1';
const C_COMPLETED  = '#10b981';
// Rating line
const C_RATING     = '#f59e0b';
// Hours bar
const C_HOURS      = '#3b82f6';
// Instructor workload
const C_INSTR      = '#8b5cf6';

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtHrs(m) {
    if (!m && m !== 0) return '—';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${min > 0 ? min + 'm' : ''}`.trim() : `${min}m`;
}

// ── Custom tooltips ───────────────────────────────────────────────────────
const TipBox = ({ children }) => (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
        {children}
    </div>
);

const DomainTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
        <TipBox>
            <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{d.domain}</p>
            <p style={{ margin: '4px 0 0', color: '#555' }}>Sessions: <strong>{d.sessions}</strong></p>
            <p style={{ margin: '2px 0 0', color: '#555' }}>Completed: <strong>{d.completed}</strong></p>
            <p style={{ margin: '2px 0 0', color: '#555' }}>Total Hours: <strong>{d.hours}h</strong></p>
            {d.avg_rating && <p style={{ margin: '2px 0 0', color: '#555' }}>Avg Rating: <strong>{d.avg_rating}/5</strong></p>}
        </TipBox>
    );
};

const TimelineTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <TipBox>
            <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{label}</p>
            {payload.map(p => (
                <p key={p.dataKey} style={{ margin: '4px 0 0', color: '#555' }}>
                    {p.name}: <strong>{p.value}{p.dataKey === 'hours' ? 'h' : p.dataKey === 'avg_rating' ? '/5' : ''}</strong>
                </p>
            ))}
        </TipBox>
    );
};

const PieTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return <TipBox><p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{d.name}</p><p style={{ margin: '4px 0 0', color: '#555' }}>Sessions: <strong>{d.value}</strong></p></TipBox>;
};

const InstrTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <TipBox>
            <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{d.name}</p>
            <p style={{ margin: '4px 0 0', color: '#555' }}>Hours: <strong>{d.hours}h</strong></p>
            <p style={{ margin: '2px 0 0', color: '#555' }}>Sessions: <strong>{d.sessions}</strong></p>
        </TipBox>
    );
};

// ── Chart section wrapper ─────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, right, accentColor = '#6366f1' }) {
    return (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', borderTop: `3px solid ${accentColor}`, padding: '1.4rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111' }}>{title}</div>
                    {subtitle && <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 2 }}>{subtitle}</div>}
                </div>
                {right}
            </div>
            {children}
        </div>
    );
}

const EMPTY = (
    <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: '0.82rem', flexDirection: 'column', gap: 8 }}>
        <BarChart3 size={28} color="#ddd" />
        No data yet — sessions will appear here once scheduled.
    </div>
);

export default function AdminReportsPage() {
    const router = useRouter();
    const { logout } = useAuth();
    const [isCollapsed,      setIsCollapsed]      = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab,        setActiveTab]         = useState('analytics');

    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    // Master sheet filters
    const [domainFilter,     setDomainFilter]     = useState('all');
    const [categoryFilter,   setCategoryFilter]   = useState('all');
    const [instructorFilter, setInstructorFilter] = useState('all');
    const [typeFilter,       setTypeFilter]       = useState('all');
    const [searchQ,          setSearchQ]          = useState('');
    const [exporting,        setExporting]        = useState(false);

    const navTo = p => router.push(p);

    const fetchData = useCallback(async () => {
        setLoading(true); setError(null);
        try { setData(await api.get('/api/admin/reports/master')); }
        catch (err) { setError(err.message || 'Failed to load report data'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const domains     = useMemo(() => [...new Set((data?.masterRows || []).map(r => r.domain).filter(d => d !== '—'))].sort(), [data]);
    const categories  = useMemo(() => [...new Set((data?.masterRows || []).map(r => r.category).filter(c => c !== '—'))].sort(), [data]);
    const instructors = useMemo(() => [...new Set((data?.masterRows || []).map(r => r.instructor))].sort(), [data]);
    const types       = useMemo(() => [...new Set((data?.masterRows || []).map(r => r.session_type).filter(t => t !== '—'))].sort(), [data]);

    const filteredRows = useMemo(() => {
        if (!data?.masterRows) return [];
        return data.masterRows.filter(r => {
            if (domainFilter     !== 'all' && r.domain       !== domainFilter)     return false;
            if (categoryFilter   !== 'all' && r.category     !== categoryFilter)   return false;
            if (instructorFilter !== 'all' && r.instructor   !== instructorFilter) return false;
            if (typeFilter       !== 'all' && r.session_type !== typeFilter)       return false;
            if (searchQ) {
                const q = searchQ.toLowerCase();
                if (!`${r.title} ${r.instructor} ${r.domain} ${r.skills}`.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [data, domainFilter, categoryFilter, instructorFilter, typeFilter, searchQ]);

    const handleExportCSV = useCallback(() => {
        if (!filteredRows.length) return;
        setExporting(true);
        const headers = ['#', 'Date', 'Domain', 'Category', 'Title', 'Instructor', 'Exp (yrs)', 'Exp Range', 'Type', 'Venue', 'Duration (min)', 'Skills', 'Avg Rating', 'Status'];
        const rows = filteredRows.map(r => [
            r.row, r.date, r.domain, r.category, r.title, r.instructor,
            r.experience ?? '', r.exp_bucket, r.session_type, r.venue,
            r.duration_mins, r.skills, r.avg_rating ?? '', r.status,
        ]);
        const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
            download: `cipd_master_${new Date().toISOString().split('T')[0]}.csv`,
        });
        a.click();
        setExporting(false);
    }, [filteredRows]);

    // ── Sidebar ───────────────────────────────────────────────────────────
    const sidebar = (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
            <div>
                <div className="user-profile" style={{ position: 'relative' }}>
                    <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>AD</div>
                    <div className="user-info"><h3>Admin</h3><p>admin@cipd.edu</p></div>
                    <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </div>
                </div>
                <nav className="nav-menu">
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '8px 1rem 4px' }}><span>Main</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin')}            style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Dashboard</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/schedule')}   style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')}  style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/feedback')}      style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Management</span></div>
                    <div className="nav-item active"><FileBarChart size={18} /> <span>Reports</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/notifications')} style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/settings')}      style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                </nav>
            </div>
            <div className="sidebar-footer">
                <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
            </div>
        </aside>
    );

    if (loading) return (
        <div className="dashboard-container">
            {sidebar}
            <div className="main-content"><div className="content-center admin-full">
                <header className="dashboard-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div><h1>Master Report</h1></div>
                </header>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
                    <RefreshCw size={28} color="#ccc" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Loading analytics…</p>
                </div>
            </div></div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (error) return (
        <div className="dashboard-container">
            {sidebar}
            <div className="main-content"><div className="content-center admin-full">
                <header className="dashboard-header"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><h1>Master Report</h1></div></header>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
                    <AlertCircle size={28} color="#dc2626" />
                    <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</p>
                    <button onClick={fetchData} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Retry</button>
                </div>
            </div></div>
        </div>
    );

    // Tab button
    const Tab = ({ id, label, Icon }) => (
        <button onClick={() => setActiveTab(id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 8, border: activeTab === id ? '1.5px solid #111' : '1.5px solid #e8e8e8', background: activeTab === id ? '#111' : '#fff', color: activeTab === id ? '#fff' : '#666', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            <Icon size={14} />{label}
        </button>
    );

    // ── Inline summary strip (no big KPI cards) ───────────────────────────
    const s = data?.summary || {};
    const summaryItems = [
        { label: 'Total Sessions',  val: s.total_sessions || 0 },
        { label: 'Completed',       val: s.completed_sessions || 0 },
        { label: 'Teaching Hours',  val: `${((s.total_minutes || 0) / 60).toFixed(0)}h` },
        { label: 'Instructors',     val: s.unique_instructors || 0 },
        { label: 'Domains',         val: s.unique_domains || 0 },
        { label: 'Avg Rating',      val: s.overall_avg_rating ? `${s.overall_avg_rating}/5` : '—' },
    ];

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            {sidebar}
            <div className="main-content">
                <div className="content-center admin-full">

                    {/* ── Header ────────────────────────────────────────── */}
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Master Report</h1>
                            <span style={{ padding: '3px 10px', borderRadius: 6, background: '#f5f5f5', fontSize: '0.72rem', fontWeight: 600, color: '#666' }}>iPD CP Review Sheet</span>
                        </div>
                        <div className="header-actions">
                            <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#555', fontWeight: 600 }}>
                                <RefreshCw size={13} /> Refresh
                            </button>
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: 30 }} />
                        </div>
                    </header>

                    {/* ── Compact summary strip ─────────────────────────── */}
                    <div style={{ display: 'flex', gap: 0, background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, overflow: 'hidden', marginBottom: '1.4rem' }}>
                        {summaryItems.map((item, i) => (
                            <div key={item.label} style={{ flex: 1, padding: '0.85rem 1rem', textAlign: 'center', borderRight: i < summaryItems.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111', lineHeight: 1.1 }}>{item.val}</div>
                                <div style={{ fontSize: '0.64rem', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>{item.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Tab bar ───────────────────────────────────────── */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <Tab id="analytics"    label="Program Analytics" Icon={TrendingUp} />
                        <Tab id="master"       label="Master Sheet"      Icon={FileBarChart} />
                        <Tab id="instructors"  label="Instructors"       Icon={Users} />
                        <Tab id="skills"       label="Skills Matrix"     Icon={BookOpen} />
                    </div>

                    {/* ══════════════════════════════════════════════════════
                        TAB: PROGRAM ANALYTICS
                    ══════════════════════════════════════════════════════ */}
                    {activeTab === 'analytics' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                            {/* Row 1: Sessions per Domain + Session Type Split */}
                            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem' }}>

                                {/* Sessions & Hours per Domain */}
                                <ChartCard title="Sessions by Domain" subtitle="Total sessions and teaching hours per subject domain" accentColor="#6366f1">
                                    {!(data?.domainAnalytics?.length) ? EMPTY : (
                                        <ResponsiveContainer width="100%" height={230}>
                                            <BarChart data={data.domainAnalytics} margin={{ top: 4, right: 10, left: -10, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                                                <XAxis dataKey="domain" tick={{ fontSize: 10, fill: '#666' }} angle={-30} textAnchor="end" interval={0} />
                                                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#888' }} />
                                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#aaa' }} />
                                                <Tooltip content={<DomainTip />} />
                                                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 8 }} />
                                                <Bar yAxisId="left" dataKey="sessions" name="Sessions" radius={[4,4,0,0]} maxBarSize={40}>
                                                    {data.domainAnalytics.map((_, i) => (
                                                        <Cell key={i} fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} />
                                                    ))}
                                                </Bar>
                                                <Bar yAxisId="right" dataKey="hours" name="Hours (right axis)" radius={[4,4,0,0]} maxBarSize={40}>
                                                    {data.domainAnalytics.map((_, i) => (
                                                        <Cell key={i} fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} fillOpacity={0.35} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartCard>

                                {/* Session Type Donut */}
                                <ChartCard title="Session Type Mix" subtitle="Breakdown by class format" accentColor="#f59e0b">
                                    {!(data?.sessionTypeChart?.length) ? EMPTY : (
                                        <ResponsiveContainer width="100%" height={230}>
                                            <PieChart>
                                                <Pie data={data.sessionTypeChart} dataKey="sessions" nameKey="type" cx="50%" cy="45%" innerRadius={55} outerRadius={88} paddingAngle={3}
                                                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                                    labelLine={false}
                                                >
                                                    {data.sessionTypeChart.map((_, i) => (
                                                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<PieTip />} />
                                                <Legend formatter={v => <span style={{ fontSize: '0.72rem', color: '#555' }}>{v}</span>} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartCard>
                            </div>

                            {/* Row 2: Monthly Timeline */}
                            <ChartCard title="Monthly Session Volume" subtitle="How many sessions were scheduled and completed each month" accentColor="#6366f1">
                                {!(data?.monthlyTimeline?.length) ? EMPTY : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={data.monthlyTimeline} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor={C_SESSIONS}  stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor={C_SESSIONS}  stopOpacity={0.02} />
                                                </linearGradient>
                                                <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor={C_COMPLETED} stopOpacity={0.20} />
                                                    <stop offset="95%" stopColor={C_COMPLETED} stopOpacity={0.02} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} />
                                            <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                                            <Tooltip content={<TimelineTip />} />
                                            <Legend wrapperStyle={{ fontSize: '0.72rem' }} />
                                            <Area type="monotone" dataKey="sessions"  name="Sessions"  stroke={C_SESSIONS}  fill="url(#grad1)" strokeWidth={2.5} dot={{ r: 5, fill: C_SESSIONS,  stroke: '#fff', strokeWidth: 2 }} />
                                            <Area type="monotone" dataKey="completed" name="Completed" stroke={C_COMPLETED} fill="url(#grad2)" strokeWidth={2.5} dot={{ r: 4, fill: C_COMPLETED, stroke: '#fff', strokeWidth: 2 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            {/* Row 3: Avg Rating per Domain + Rating Timeline */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

                                {/* Avg Rating per Domain */}
                                <ChartCard title="Average Student Rating by Domain" subtitle="Mean feedback score (out of 5) per subject domain" accentColor="#10b981">
                                    {!(data?.domainAnalytics?.filter(d => d.avg_rating)?.length) ? EMPTY : (
                                        <ResponsiveContainer width="100%" height={220}>
                                            <BarChart
                                                data={data.domainAnalytics.filter(d => d.avg_rating !== null)}
                                                layout="vertical"
                                                margin={{ top: 4, right: 50, left: 10, bottom: 4 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
                                                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: '#888' }} />
                                                <YAxis type="category" dataKey="domain" tick={{ fontSize: 10, fill: '#555' }} width={130} />
                                                <Tooltip content={<DomainTip />} />
                                                <Bar dataKey="avg_rating" name="Avg Rating" radius={[0, 4, 4, 0]} maxBarSize={22}
                                                    label={{ position: 'right', style: { fontSize: '0.7rem', fill: '#555' }, formatter: v => `${v}/5` }}>
                                                    {data.domainAnalytics.filter(d => d.avg_rating !== null).map((_, i) => (
                                                        <Cell key={i} fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartCard>

                                {/* Feedback rating over time */}
                                <ChartCard title="Feedback Rating Trend" subtitle="Average student rating per month across all sessions" accentColor="#f59e0b">
                                    {!(data?.ratingTimeline?.filter(m => m.avg_rating)?.length) ? EMPTY : (
                                        <ResponsiveContainer width="100%" height={220}>
                                            <LineChart
                                                data={data.ratingTimeline.filter(m => m.avg_rating !== null)}
                                                margin={{ top: 4, right: 10, left: -10, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} />
                                                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#888' }} />
                                                <Tooltip content={<TimelineTip />} />
                                                <Line type="monotone" dataKey="avg_rating" name="Avg Rating"
                                                    stroke={C_RATING} strokeWidth={2.5}
                                                    dot={{ r: 6, fill: C_RATING, stroke: '#fff', strokeWidth: 2 }}
                                                    activeDot={{ r: 8, fill: C_RATING }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartCard>
                            </div>

                            {/* Row 4: Instructor Workload Bar */}
                            <ChartCard title="Instructor Workload Distribution" subtitle="Teaching hours per instructor (sorted highest to lowest)" accentColor="#8b5cf6">
                                {!(data?.instructors?.filter(i => i.name !== 'TBA')?.length) ? EMPTY : (
                                    <ResponsiveContainer width="100%" height={Math.max(240, data.instructors.filter(i => i.name !== 'TBA').slice(0, 15).length * 40)}>
                                        <BarChart
                                            data={data.instructors.filter(i => i.name !== 'TBA').slice(0, 15)}
                                            layout="vertical"
                                            margin={{ top: 4, right: 70, left: 10, bottom: 4 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} unit="h" />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#555' }} width={130} />
                                            <Tooltip content={<InstrTip />} />
                                            <Bar dataKey="hours" name="Hours" radius={[0, 4, 4, 0]} maxBarSize={24}
                                                label={{ position: 'right', style: { fontSize: '0.7rem', fill: '#777' }, formatter: v => `${v}h` }}>
                                                {data.instructors.filter(i => i.name !== 'TBA').slice(0, 15).map((_, i) => (
                                                    <Cell key={i} fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            {/* Row 5: Teaching Hours Timeline */}
                            <ChartCard title="Teaching Hours per Month" subtitle="Total program teaching time delivered each month" accentColor="#3b82f6">
                                {!(data?.monthlyTimeline?.length) ? EMPTY : (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={data.monthlyTimeline} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%"   stopColor={C_HOURS} stopOpacity={1} />
                                                    <stop offset="100%" stopColor={C_HOURS} stopOpacity={0.5} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} />
                                            <YAxis tick={{ fontSize: 11, fill: '#888' }} unit="h" />
                                            <Tooltip content={<TimelineTip />} />
                                            <Bar dataKey="hours" name="Hours" fill="url(#hoursGrad)" radius={[5, 5, 0, 0]} maxBarSize={52} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        TAB: MASTER SHEET
                    ══════════════════════════════════════════════════════ */}
                    {activeTab === 'master' && (
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', borderTop: '2px solid #111', overflow: 'hidden' }}>
                            {/* Filters */}
                            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f0f0f0', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', flex: '1 1 180px', minWidth: 160 }}>
                                    <Search size={13} color="#aaa" />
                                    <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search title, instructor, skill…" style={{ border: 'none', outline: 'none', fontSize: '0.8rem', width: '100%', fontFamily: 'inherit' }} />
                                    {searchQ && <X size={13} color="#aaa" style={{ cursor: 'pointer' }} onClick={() => setSearchQ('')} />}
                                </div>
                                {[
                                    { label: 'Domain',     val: domainFilter,     set: setDomainFilter,     opts: domains },
                                    { label: 'Category',   val: categoryFilter,   set: setCategoryFilter,   opts: categories },
                                    { label: 'Instructor', val: instructorFilter, set: setInstructorFilter, opts: instructors },
                                    { label: 'Type',       val: typeFilter,       set: setTypeFilter,       opts: types },
                                ].map(({ label, val, set, opts }) => (
                                    <select key={label} value={val} onChange={e => set(e.target.value)}
                                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.78rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none', cursor: 'pointer', color: val !== 'all' ? '#111' : '#888' }}>
                                        <option value="all">All {label}s</option>
                                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ))}
                                <button onClick={handleExportCSV} disabled={exporting || !filteredRows.length}
                                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 8, border: 'none', background: filteredRows.length ? '#111' : '#ccc', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: filteredRows.length ? 'pointer' : 'not-allowed', marginLeft: 'auto' }}>
                                    {exporting ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />} Export CSV
                                </button>
                            </div>
                            <div style={{ padding: '5px 1.25rem', background: '#fafafa', fontSize: '0.72rem', color: '#888', borderBottom: '1px solid #f0f0f0' }}>
                                Showing <strong style={{ color: '#111' }}>{filteredRows.length}</strong> of {data?.masterRows?.length || 0} sessions
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            {['#', 'Date', 'Domain', 'Category', 'Title / Topic', 'Instructor', 'Exp.', 'Type', 'Duration', 'Skills', 'Avg Rating', 'Status'].map(h => (
                                                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1.5px solid #f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRows.length === 0 ? (
                                            <tr><td colSpan={12} style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>No sessions match the current filters.</td></tr>
                                        ) : filteredRows.map((r, i) => (
                                            <tr key={r.session_id} style={{ borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                                <td style={{ padding: '9px 14px', color: '#ccc', fontWeight: 600 }}>{r.row}</td>
                                                <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#555', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                                                <td style={{ padding: '9px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, background: '#f5f5f5', color: '#333' }}>{r.domain}</span></td>
                                                <td style={{ padding: '9px 14px', color: '#555' }}>{r.category}</td>
                                                <td style={{ padding: '9px 14px', fontWeight: 600, color: '#111', maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div></td>
                                                <td style={{ padding: '9px 14px', color: '#444', whiteSpace: 'nowrap' }}>{r.instructor}</td>
                                                <td style={{ padding: '9px 14px', textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, background: '#f0f0f0', color: '#555' }}>{r.exp_bucket}</span></td>
                                                <td style={{ padding: '9px 14px', color: '#555', whiteSpace: 'nowrap' }}>{r.session_type}</td>
                                                <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#555', whiteSpace: 'nowrap' }}>{fmtHrs(r.duration_mins)}</td>
                                                <td style={{ padding: '9px 14px', color: '#555', maxWidth: 160 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.skills || <span style={{ color: '#ccc' }}>—</span>}</div></td>
                                                <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                                                    {r.avg_rating ? <span style={{ fontWeight: 700 }}>{r.avg_rating}<span style={{ color: '#ccc', fontWeight: 400 }}>/5</span></span> : <span style={{ color: '#ccc' }}>—</span>}
                                                </td>
                                                <td style={{ padding: '9px 14px' }}>
                                                    <span style={{ padding: '2px 9px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600, background: r.status === 'completed' ? '#ecfdf5' : r.status === 'cancelled' ? '#fef2f2' : '#fffbeb', color: r.status === 'completed' ? '#166534' : r.status === 'cancelled' ? '#991b1b' : '#92400e' }}>{r.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        TAB: INSTRUCTORS
                    ══════════════════════════════════════════════════════ */}
                    {activeTab === 'instructors' && (
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', borderTop: '2px solid #111', overflow: 'hidden' }}>
                            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>All Instructors</div>
                                <span style={{ padding: '3px 10px', borderRadius: 6, background: '#f5f5f5', fontSize: '0.72rem', fontWeight: 600, color: '#666' }}>{data?.instructors?.length || 0} instructors</span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        {['Instructor', 'Experience', 'Range', 'Sessions', 'Completed', 'Teaching Hours', 'Avg Rating', 'Domains Taught'].map(h => (
                                            <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1.5px solid #f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data?.instructors || []).length === 0 ? (
                                        <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>No instructor data yet.</td></tr>
                                    ) : data.instructors.map((inst, i) => (
                                        <tr key={inst.name} style={{ borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#111' }}>{inst.name}</td>
                                            <td style={{ padding: '10px 14px', color: '#555' }}>{inst.experience != null ? `${inst.experience} yrs` : '—'}</td>
                                            <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 9px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, background: '#f0f0f0', color: '#444' }}>{inst.exp_bucket}</span></td>
                                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111' }}>{inst.sessions}</td>
                                            <td style={{ padding: '10px 14px', color: '#555' }}>{inst.completed}</td>
                                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#333' }}>{fmtHrs(inst.total_minutes)}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                {inst.avg_rating ? <span style={{ fontWeight: 700 }}>{inst.avg_rating}<span style={{ color: '#ccc', fontWeight: 400 }}>/5</span></span> : <span style={{ color: '#ccc' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {inst.domains.map(d => <span key={d} style={{ padding: '1px 8px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, background: '#f5f5f5', color: '#555' }}>{d}</span>)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        TAB: SKILLS MATRIX
                    ══════════════════════════════════════════════════════ */}
                    {activeTab === 'skills' && (
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', borderTop: '2px solid #111', overflow: 'hidden' }}>
                            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div><div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Skills Coverage Matrix</div><div style={{ fontSize: '0.72rem', color: '#999', marginTop: 2 }}>Which skills from the curriculum have been addressed in class</div></div>
                                <span style={{ padding: '3px 10px', borderRadius: 6, background: '#f5f5f5', fontSize: '0.72rem', fontWeight: 600, color: '#666' }}>
                                    {data?.skillsCoverage?.filter(s => s.covered).length || 0} / {data?.skillsCoverage?.length || 0} covered
                                </span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        {['Domain', 'Category', 'Skill', 'Details', 'Covered?', 'Session Dates'].map(h => (
                                            <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1.5px solid #f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data?.skillsCoverage || []).length === 0 ? (
                                        <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>No skills defined yet. Add skills via Supabase after running the migration.</td></tr>
                                    ) : data.skillsCoverage.map((sk, i) => (
                                        <tr key={sk.skill_id} style={{ borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                            <td style={{ padding: '9px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, background: '#f5f5f5', color: '#333' }}>{sk.domain}</span></td>
                                            <td style={{ padding: '9px 14px', color: '#555' }}>{sk.category}</td>
                                            <td style={{ padding: '9px 14px', fontWeight: 600, color: '#111' }}>{sk.skill_name}</td>
                                            <td style={{ padding: '9px 14px', color: '#777', maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sk.details}</div></td>
                                            <td style={{ padding: '9px 14px' }}><span style={{ padding: '2px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, background: sk.covered ? '#ecfdf5' : '#fef2f2', color: sk.covered ? '#166534' : '#991b1b' }}>{sk.covered ? 'YES' : 'NO'}</span></td>
                                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: '0.72rem', color: '#555' }}>
                                                {sk.session_dates.length > 0 ? sk.session_dates.map(d => fmtDate(d)).join(', ') : <span style={{ color: '#ccc' }}>—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                </div>
            </div>
            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes shimmer { 0%{opacity:.4} 50%{opacity:1} 100%{opacity:.4} }
            `}</style>
        </div>
    );
}
