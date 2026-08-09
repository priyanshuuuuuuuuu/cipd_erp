'use client';
import React, { useState } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Download,
    Eye, IndianRupee, Users, Filter, UserPlus, ChevronDown, ChevronUp, X, Loader2, Pencil, Trophy,
    BookOpen, Star, GraduationCap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// ── Faculty Session Modal ─────────────────────────────────────────────────
function FacultySessionModal({ faculty, onClose }) {
    const rows = faculty.sessionDetails || [];
    const completed = rows.filter(r => r.status === 'completed').length;
    const totalHrs = (faculty.hours || 0);
    const ratings = rows.filter(r => r.avg_rating !== null && r.avg_rating !== undefined).map(r => r.avg_rating);
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
    const initials = faculty.name.split(' ').filter(Boolean).slice(1, 3).map(n => n[0]).join('').toUpperCase() || 'FA';

    React.useEffect(() => {
        const onKey = e => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 1000, backdropFilter: 'blur(6px)' }} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(860px, 100vw)', background: '#f8fafc', zIndex: 1001, display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 50px rgba(0,0,0,0.25)', animation: 'slideIn 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
                {/* Gradient Header */}
                <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)', padding: '2.5rem 2rem', color: '#fff', position: 'relative' }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', color: '#fff', padding: 8, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }} onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}>
                        <X size={18} strokeWidth={2.5} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ width: 84, height: 84, borderRadius: '50%', background: '#fff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 900, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '4px solid rgba(255,255,255,0.3)' }}>{initials}</div>
                        <div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{faculty.name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <BookOpen size={15} /> {faculty.dept || 'Faculty'} &nbsp;·&nbsp; ₹{faculty.rate?.toLocaleString()}/hr
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bento Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '2rem 2rem 1.5rem' }}>
                    {[
                        { label: 'All Sessions', val: rows.length, icon: Calendar, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
                        { label: 'Completed', val: completed, icon: CheckCircle, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
                        { label: 'Teaching Hrs', val: `${totalHrs.toFixed(1)}h`, icon: Clock, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
                        { label: 'Honorarium', val: `₹${(faculty.honorarium || 0).toLocaleString()}`, icon: IndianRupee, color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
                    ].map(item => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} style={{ background: '#fff', padding: '1.25rem', borderRadius: 16, border: `1px solid ${item.border}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 12, transition: 'transform 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ background: item.bg, color: item.color, padding: 8, borderRadius: 10, display: 'flex' }}><Icon size={18} strokeWidth={2.5} /></div>
                                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                                </div>
                                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{item.val}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Session Table */}
                <div style={{ flex: 1, padding: '0 2rem 2rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ background: '#fff', flex: 1, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Session History <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#94a3b8', marginLeft: 6 }}>{rows.length} total</span></div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {rows.length === 0 ? (
                                <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                    <BookOpen size={48} color="#cbd5e1" strokeWidth={1.5} />
                                    <div style={{ fontWeight: 600 }}>No sessions found for this faculty member.</div>
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>
                                        <tr>
                                            {['Date', 'Title', 'Course', 'Duration', 'Venue', 'Rating', 'Status'].map(h => (
                                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r, i) => (
                                            <tr key={r.session_id || i} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff', transition: 'background 0.15s' }}
                                                onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                                                <td style={{ padding: '13px 16px', fontFamily: 'monospace', color: '#475569', whiteSpace: 'nowrap', fontWeight: 600 }}>{r.date}</td>
                                                <td style={{ padding: '13px 16px', fontWeight: 700, color: '#0f172a', maxWidth: 200 }}>
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>{r.title}</div>
                                                </td>
                                                <td style={{ padding: '13px 16px' }}>
                                                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, background: '#f1f5f9', color: '#334155', whiteSpace: 'nowrap' }}>{r.course}</span>
                                                </td>
                                                <td style={{ padding: '13px 16px', fontFamily: 'monospace', color: '#475569', whiteSpace: 'nowrap', fontWeight: 600 }}>{r.duration}</td>
                                                <td style={{ padding: '13px 16px', color: '#475569', whiteSpace: 'nowrap' }}>{r.venue}</td>
                                                <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                                                    {r.avg_rating ? <span style={{ fontWeight: 800, color: '#f59e0b' }}>{r.avg_rating}<span style={{ color: '#cbd5e1', fontWeight: 500 }}>/5</span></span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                                                </td>
                                                <td style={{ padding: '13px 16px' }}>
                                                    <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700, background: r.status === 'completed' ? '#ecfdf5' : r.status === 'cancelled' ? '#fef2f2' : '#fffbeb', color: r.status === 'completed' ? '#10b981' : r.status === 'cancelled' ? '#ef4444' : '#f59e0b' }}>{r.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default function AdminFacultyHoursPage() {

    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState('2026-03');
    const [viewingSessions, setViewingSessions] = useState(null);
    const [modalFaculty, setModalFaculty] = useState(null);
    const [facultyData, setFacultyData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState('name');
    const [sortDir, setSortDir] = useState('asc');

    const toggleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const sortedFaculty = React.useMemo(() => {
        return [...facultyData].sort((a, b) => {
            let av = a[sortField], bv = b[sortField];
            if (sortField === 'yearsExperience') { av = av === '' ? -1 : Number(av); bv = bv === '' ? -1 : Number(bv); }
            if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === 'asc' ? av - bv : bv - av;
        });
    }, [facultyData, sortField, sortDir]);

    // ── Add Faculty panel ──────────────────────────────────────────────────────
    const [showManagePanel, setShowManagePanel] = useState(false);
    const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', yearsExperience: '', designation: '' });
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');
    const [addSuccess, setAddSuccess] = useState('');

    // ── Edit Faculty modal ─────────────────────────────────────────────────────
    const [editFaculty, setEditFaculty] = useState(null); // faculty object being edited
    const [editForm, setEditForm] = useState({});
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');
    const [editSuccess, setEditSuccess] = useState('');

    const navTo = p => router.push(p);

    const fetchFaculty = React.useCallback(() => {
        setLoading(true);
        api.get('/api/admin/faculty-hours')
            .then(data => {
                if (data.facultyData) setFacultyData(data.facultyData);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch faculty hours:', err);
                setLoading(false);
            });
    }, []);

    React.useEffect(() => { fetchFaculty(); }, [fetchFaculty]);

    // ── Add Faculty ────────────────────────────────────────────────────────────
    const handleAddFaculty = async (e) => {
        e.preventDefault();
        setAddError(''); setAddSuccess(''); setAddLoading(true);
        try {
            await api.post('/api/admin/faculty-hours', addForm);
            setAddSuccess(`Faculty "${addForm.firstName} ${addForm.lastName}" added successfully! Default password: cipd@123`);
            setAddForm({ firstName: '', lastName: '', email: '', yearsExperience: '', designation: '' });
            fetchFaculty();
        } catch (err) {
            setAddError(err.message || 'Failed to add faculty.');
        } finally {
            setAddLoading(false);
        }
    };

    // ── Open Edit Modal ────────────────────────────────────────────────────────
    const openEdit = (f) => {
        setEditFaculty(f);
        setEditForm({
            firstName: f.firstName,
            lastName: f.lastName,
            designation: f.designation,
            department: f.department,
            yearsExperience: f.yearsExperience !== '' ? String(f.yearsExperience) : '',
            honorariumRate: f.rate !== 1500 ? String(f.rate) : String(f.rate),
        });
        setEditError('');
        setEditSuccess('');
    };

    const closeEdit = () => { setEditFaculty(null); setEditError(''); setEditSuccess(''); };

    // ── Save Edit ──────────────────────────────────────────────────────────────
    const handleEditSave = async (e) => {
        e.preventDefault();
        if (!editFaculty) return;
        setEditError(''); setEditSuccess(''); setEditLoading(true);
        try {
            await api.patch('/api/admin/faculty-hours', {
                facultyId: editFaculty.id,
                ...editForm,
            });
            setEditSuccess('Details updated successfully.');
            fetchFaculty();
            // keep modal open briefly so user sees success, then auto-close
            setTimeout(() => closeEdit(), 1400);
        } catch (err) {
            setEditError(err.message || 'Failed to update faculty.');
        } finally {
            setEditLoading(false);
        }
    };

    // ── Stats ──────────────────────────────────────────────────────────────────
    const totalSessions   = facultyData.reduce((a, f) => a + (f.sessions || 0), 0);
    const totalHours      = facultyData.reduce((a, f) => a + (f.hours || 0), 0);
    const totalHonorarium = facultyData.reduce((a, f) => a + (f.hours || 0) * (f.rate || 0), 0);
    const pendingPayments = facultyData.filter(f => f.status === 'Pending').length;

    // ── Input style helper ─────────────────────────────────────────────────────
    const inp = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

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
                    <div className="nav-item" onClick={() => navTo('/admin/live-students')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Live Students</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/students')} style={{ cursor: 'pointer' }}><GraduationCap size={18} /> <span>Student Management</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/leaderboard')} style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
                    <div className="nav-item active"><Clock size={18} /> <span>Faculty Management</span></div>
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
                            <h1>Faculty Management</h1>
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
                            { label: 'Total Sessions',    value: totalSessions,                                     icon: Calendar,     color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Total Hours',       value: `${totalHours.toFixed(1)}h`,                       icon: Clock,        color: '#7c3aed', bg: '#faf5ff' },
                            { label: 'Total Honorarium',  value: `₹${(totalHonorarium / 1000).toFixed(1)}K`,        icon: IndianRupee,  color: '#16a34a', bg: '#ecfdf5' },
                            { label: 'Pending Payments',  value: pendingPayments,                                   icon: Users,        color: '#b45309', bg: '#fffbeb' },
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

                    {/* ── Manage Faculty Panel (Add) ────────────────────────── */}
                    <div style={{ marginBottom: '1rem' }}>
                        <button
                            onClick={() => { setShowManagePanel(v => !v); setAddError(''); setAddSuccess(''); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', border: '1.5px solid #3B2D82', background: showManagePanel ? '#3B2D82' : '#fff', color: showManagePanel ? '#fff' : '#3B2D82', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
                        >
                            <UserPlus size={15} />
                            Manage Faculty
                            {showManagePanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showManagePanel && (
                            <div style={{ marginTop: '10px', background: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '14px', padding: '1.4rem 1.6rem', boxShadow: '0 4px 24px rgba(59,45,130,0.07)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111' }}>Add New Faculty</div>
                                        <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px' }}>A default login password <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>cipd@123</code> will be assigned.</div>
                                    </div>
                                    <button onClick={() => setShowManagePanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: '4px' }}><X size={16} /></button>
                                </div>

                                {addError   && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 14px', fontSize: '0.78rem', color: '#dc2626', marginBottom: '12px' }}>⚠ {addError}</div>}
                                {addSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 14px', fontSize: '0.78rem', color: '#16a34a', marginBottom: '12px' }}>✓ {addSuccess}</div>}

                                <form onSubmit={handleAddFaculty}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>First Name <span style={{ color: '#dc2626' }}>*</span></label>
                                            <input type="text" placeholder="e.g. Rajesh" value={addForm.firstName} onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))} required style={inp} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>Last Name <span style={{ color: '#dc2626' }}>*</span></label>
                                            <input type="text" placeholder="e.g. Sharma" value={addForm.lastName} onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))} required style={inp} />
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>Email Address <span style={{ color: '#dc2626' }}>*</span></label>
                                        <input type="email" placeholder="e.g. rajesh.sharma@cipd.edu" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} required style={inp} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>Instructor Experience (years)</label>
                                            <input type="number" min="0" max="60" placeholder="e.g. 10" value={addForm.yearsExperience} onChange={e => setAddForm(f => ({ ...f, yearsExperience: e.target.value }))} style={inp} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>Designation / Dept.</label>
                                            <input type="text" placeholder="e.g. Senior Lecturer" value={addForm.designation} onChange={e => setAddForm(f => ({ ...f, designation: e.target.value }))} style={inp} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button type="submit" disabled={addLoading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 22px', borderRadius: '10px', border: 'none', background: addLoading ? '#9ca3af' : '#3B2D82', color: '#fff', cursor: addLoading ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 600, transition: 'background 0.2s' }}>
                                            {addLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={14} />}
                                            {addLoading ? 'Adding...' : 'Add Faculty'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>

                    {/* Month picker + Export */}
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
                                        {[
                                            { label: 'Faculty',     field: 'name' },
                                            { label: 'Department',  field: 'dept' },
                                            { label: 'Exp.',        field: 'yearsExperience' },
                                            { label: 'Sessions',    field: 'sessions' },
                                            { label: 'Total Hours', field: 'hours' },
                                            { label: 'Rate/Hr',     field: 'rate' },
                                            { label: 'Honorarium',  field: 'honorarium' },
                                            { label: 'Status',      field: 'status' },
                                            { label: '',            field: null },
                                        ].map(({ label, field }) => {
                                            const active = field && sortField === field;
                                            return (
                                                <th key={label}
                                                    onClick={field ? () => toggleSort(field) : undefined}
                                                    style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: active ? '#3B2D82' : '#aaa', borderBottom: '1px solid #f0f0f0', cursor: field ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap', transition: 'color 0.15s' }}
                                                    onMouseOver={e => { if (field) e.currentTarget.style.color = '#3B2D82'; }}
                                                    onMouseOut={e => { if (!active) e.currentTarget.style.color = '#aaa'; }}
                                                >
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        {label}
                                                        {field && (
                                                            <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1, opacity: active ? 1 : 0.3, fontSize: '0.6rem' }}>
                                                                <span style={{ color: active && sortDir === 'asc' ? '#3B2D82' : '#aaa', lineHeight: 0.9 }}>▲</span>
                                                                <span style={{ color: active && sortDir === 'desc' ? '#3B2D82' : '#aaa', lineHeight: 0.9 }}>▼</span>
                                                            </span>
                                                        )}
                                                    </span>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && facultyData.length === 0 ? (
                                        <>{[1,2,3,4].map(i => (
                                            <tr key={`skel-${i}`} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                {[120,80,40,40,50,60,70,65,80].map((w,j) => (
                                                    <td key={j} style={{ padding: '12px 16px' }}><div style={{ width: `${w}px`, height: j===0?'12px':'10px', borderRadius: '4px', background: j%2===0?'#f0f0f0':'#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${(i*9+j)*0.05}s` }} /></td>
                                                ))}
                                            </tr>
                                        ))}</>
                                    ) : sortedFaculty.map(f => (
                                        <tr key={f.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111' }}>{f.name}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 500, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>{f.dept}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>
                                                {f.yearsExperience !== '' ? `${f.yearsExperience}y` : '—'}
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
                                                    <button
                                                        onClick={() => setModalFaculty(f)}
                                                        className="change-status-btn"
                                                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#555', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    ><Eye size={12} /> Sessions</button>

                                                    {/* ── Edit button ── */}
                                                    <button
                                                        onClick={() => openEdit(f)}
                                                        className="change-status-btn"
                                                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #3B2D82', background: '#f5f3ff', cursor: 'pointer', fontSize: '0.72rem', color: '#3B2D82', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                                                    ><Pencil size={12} /> Edit</button>

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

                        {/* Modal rendered outside the table */}
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

            {/* ══ Edit Faculty Modal ══════════════════════════════════════════════ */}
            {editFaculty && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(2px)' }}
                    onClick={closeEdit}
                >
                    <div
                        style={{ background: '#fff', borderRadius: '16px', padding: '1.8rem 2rem', width: '100%', maxWidth: '500px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', border: '1.5px solid #e8e8e8', position: 'relative' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                            <div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111' }}>Edit Faculty Details</div>
                                <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '3px' }}>{editFaculty.name}</div>
                            </div>
                            <button onClick={closeEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: '4px', marginTop: '-4px' }}><X size={18} /></button>
                        </div>

                        {/* Feedback banners */}
                        {editError   && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 14px', fontSize: '0.78rem', color: '#dc2626', marginBottom: '12px' }}>⚠ {editError}</div>}
                        {editSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 14px', fontSize: '0.78rem', color: '#16a34a', marginBottom: '12px' }}>✓ {editSuccess}</div>}

                        <form onSubmit={handleEditSave}>
                            {/* Row 1: First + Last name */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>First Name <span style={{ color: '#dc2626' }}>*</span></label>
                                    <input type="text" value={editForm.firstName || ''} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} required style={inp} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>Last Name <span style={{ color: '#dc2626' }}>*</span></label>
                                    <input type="text" value={editForm.lastName || ''} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} required style={inp} />
                                </div>
                            </div>

                            {/* Row 2: Designation + Department */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>Designation</label>
                                    <input type="text" placeholder="e.g. Senior Lecturer" value={editForm.designation || ''} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} style={inp} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>Department</label>
                                    <input type="text" placeholder="e.g. Computer Science" value={editForm.department || ''} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} style={inp} />
                                </div>
                            </div>

                            {/* Row 3: Experience + Honorarium Rate */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>Experience (years)</label>
                                    <input type="number" min="0" max="60" placeholder="e.g. 10" value={editForm.yearsExperience ?? ''} onChange={e => setEditForm(f => ({ ...f, yearsExperience: e.target.value }))} style={inp} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: '5px' }}>Honorarium Rate (₹/hr)</label>
                                    <input type="number" min="0" step="100" placeholder="e.g. 1500" value={editForm.honorariumRate ?? ''} onChange={e => setEditForm(f => ({ ...f, honorariumRate: e.target.value }))} style={inp} />
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" onClick={closeEdit} style={{ padding: '9px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#555' }}>Cancel</button>
                                <button
                                    type="submit"
                                    disabled={editLoading}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 22px', borderRadius: '10px', border: 'none', background: editLoading ? '#9ca3af' : '#3B2D82', color: '#fff', cursor: editLoading ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 600, transition: 'background 0.2s' }}
                                >
                                    {editLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Pencil size={14} />}
                                    {editLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`@keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

            {/* ══ Faculty Session Modal ══════════════════════════════════════════ */}
            {modalFaculty && <FacultySessionModal faculty={modalFaculty} onClose={() => setModalFaculty(null)} />}
        </div>
    );
}
