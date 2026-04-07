'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Plus,
    MapPin, User, Users, Edit3, Trash2, X, AlertTriangle, RefreshCw, Filter,
    List, CalendarDays, AlertCircle, Loader2, Tag, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

export default function AdminSchedulePage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [viewMode, setViewMode] = useState('list');
    const [activeFilter, setActiveFilter] = useState('all');
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Date sorting
    const [dateSortDir, setDateSortDir] = useState('asc'); // 'asc' | 'desc'

    // ── Add-session form state ───────────────────────────────────────────────
    const [newClass, setNewClass] = useState({ course_id: '', faculty_id: '', date: '', start_time: '', end_time: '', venue_id: '', title: '', session_type_id: '' });
    const [lookupData, setLookupData] = useState({ courses: [], faculty: [], venues: [], sessionTypes: [] });
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [scheduleError, setScheduleError] = useState('');

    // ── Add-type inline state ────────────────────────────────────────────────
    const [showAddType, setShowAddType] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [addTypeLoading, setAddTypeLoading] = useState(false);
    const [addTypeError, setAddTypeError] = useState('');

    // ── Edit-session modal state ─────────────────────────────────────────────
    const [editSession, setEditSession] = useState(null);   // full session object
    const [editForm, setEditForm] = useState({});
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');
    const [editSuccess, setEditSuccess] = useState('');

    // Same add-type for edit modal
    const [editShowAddType, setEditShowAddType] = useState(false);
    const [editNewTypeName, setEditNewTypeName] = useState('');
    const [editAddTypeLoading, setEditAddTypeLoading] = useState(false);
    const [editAddTypeError, setEditAddTypeError] = useState('');

    const navTo = p => router.push(p);

    // ── Fetch sessions ───────────────────────────────────────────────────────
    const fetchSessions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get(`/api/admin/schedule?filter=${activeFilter}`);
            setSessions(data.sessions || []);
        } catch (err) {
            console.error('Failed to fetch schedule:', err);
        } finally {
            setLoading(false);
        }
    }, [activeFilter]);

    // ── Fetch lookup data ────────────────────────────────────────────────────
    const fetchLookup = useCallback(async () => {
        try {
            const data = await api.get('/api/admin/lookup');
            setLookupData({
                courses: data.courses || [],
                faculty: data.faculty || [],
                venues: data.venues || [],
                sessionTypes: data.sessionTypes || [],
            });
        } catch (err) {
            console.error('Failed to fetch lookup data:', err);
        }
    }, []);

    // ── Add new session type (shared helper) ─────────────────────────────────
    const addSessionType = async (name, onSuccess) => {
        try {
            const res = await api.post('/api/admin/session-types', { name: name.trim() });
            const refreshed = await api.get('/api/admin/session-types');
            setLookupData(prev => ({ ...prev, sessionTypes: refreshed.sessionTypes || [] }));
            onSuccess(res.sessionType.id);
        } catch (err) {
            throw err;
        }
    };

    const handleAddType = async () => {
        if (!newTypeName.trim()) return;
        setAddTypeError('');
        setAddTypeLoading(true);
        try {
            await addSessionType(newTypeName, (newId) => {
                setNewClass(prev => ({ ...prev, session_type_id: newId }));
                setNewTypeName('');
                setShowAddType(false);
            });
        } catch (err) {
            setAddTypeError(err.message || 'Failed to add type.');
        } finally {
            setAddTypeLoading(false);
        }
    };

    const handleEditAddType = async () => {
        if (!editNewTypeName.trim()) return;
        setEditAddTypeError('');
        setEditAddTypeLoading(true);
        try {
            await addSessionType(editNewTypeName, (newId) => {
                setEditForm(prev => ({ ...prev, session_type_id: newId }));
                setEditNewTypeName('');
                setEditShowAddType(false);
            });
        } catch (err) {
            setEditAddTypeError(err.message || 'Failed to add type.');
        } finally {
            setEditAddTypeLoading(false);
        }
    };

    useEffect(() => {
        if (authReady) {
            fetchSessions();
            fetchLookup();
        }
    }, [fetchSessions, fetchLookup, authReady]);

    // ── Date-sorted sessions ─────────────────────────────────────────────────
    const sortedSessions = useMemo(() => {
        return [...sessions].sort((a, b) => {
            const da = a.date || '';
            const db = b.date || '';
            if (da === db) {
                return (a.time || '') < (b.time || '') ? -1 : 1;
            }
            if (dateSortDir === 'asc') return da < db ? -1 : 1;
            return da > db ? -1 : 1;
        });
    }, [sessions, dateSortDir]);

    const toggleDateSort = () => setDateSortDir(d => d === 'asc' ? 'desc' : 'asc');

    // ── Open Edit Modal ──────────────────────────────────────────────────────
    const openEdit = (s) => {
        setEditSession(s);
        setEditForm({
            title: s.title,
            course_id: s.course_id,
            faculty_id: s.faculty_id,
            venue_id: s.venue_id,
            session_type_id: s.session_type_id,
            session_date: s.date,
            start_time: s.time,
            end_time: s.endTime,
        });
        setEditError('');
        setEditSuccess('');
        setEditShowAddType(false);
        setEditNewTypeName('');
    };

    const closeEdit = () => {
        setEditSession(null);
        setEditError('');
        setEditSuccess('');
    };

    // ── Save Edit ────────────────────────────────────────────────────────────
    const handleEditSave = async (e) => {
        e.preventDefault();
        if (!editSession) return;
        if (!editForm.title?.trim()) { setEditError('Lecture title is required.'); return; }
        if (!editForm.session_date) { setEditError('Date is required.'); return; }
        if (!editForm.start_time) { setEditError('Start time is required.'); return; }
        if (editForm.end_time && editForm.end_time <= editForm.start_time) {
            setEditError('End time must be after start time.'); return;
        }

        setEditError('');
        setEditSuccess('');
        setEditLoading(true);
        try {
            await api.patch(`/api/admin/sessions/${editSession.id}`, editForm);
            setEditSuccess('Session updated successfully.');
            fetchSessions();
            setTimeout(() => closeEdit(), 1200);
        } catch (err) {
            setEditError(err.message || 'Failed to update session.');
        } finally {
            setEditLoading(false);
        }
    };

    // ── Helpers ──────────────────────────────────────────────────────────────
    const formatDate = d => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const statusBadge = status => {
        const map = {
            Confirmed:  { bg: '#ecfdf5', color: '#166534' },
            Pending:    { bg: '#fffbeb', color: '#92400e' },
            Cancelled:  { bg: '#fef2f2', color: '#991b1b' },
            Completed:  { bg: '#eff6ff', color: '#1d4ed8' },
        };
        const s = map[status] || map.Pending;
        return <span style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>;
    };

    // ── Add new session submit ────────────────────────────────────────────────
    const handleScheduleSubmit = async () => {
        setScheduleError('');
        if (!newClass.course_id) { setScheduleError('Please select a course.'); return; }
        if (!newClass.title.trim()) { setScheduleError('Please enter a lecture title.'); return; }
        if (!newClass.date) { setScheduleError('Please select a date.'); return; }
        if (!newClass.start_time) { setScheduleError('Please select a start time.'); return; }
        if (newClass.end_time && newClass.end_time <= newClass.start_time) {
            setScheduleError('End time must be after start time.'); return;
        }

        let endTime = newClass.end_time;
        if (!endTime && newClass.start_time) {
            const [h, m] = newClass.start_time.split(':').map(Number);
            const endH = String((h + 1) % 24).padStart(2, '0');
            endTime = `${endH}:${String(m).padStart(2, '0')}`;
        }

        setScheduleLoading(true);
        try {
            await api.post('/api/admin/sessions', {
                course_id: newClass.course_id,
                faculty_id: newClass.faculty_id || null,
                venue_id: newClass.venue_id || null,
                session_type_id: newClass.session_type_id || null,
                title: newClass.title.trim(),
                session_date: newClass.date,
                start_time: newClass.start_time,
                end_time: endTime,
            });
            setShowScheduleModal(false);
            setNewClass({ course_id: '', faculty_id: '', date: '', start_time: '', end_time: '', venue_id: '', title: '', session_type_id: '' });
            setScheduleError('');
            setShowAddType(false);
            setNewTypeName('');
            fetchSessions();
        } catch (e) {
            setScheduleError(e.message || 'Failed to schedule class. Please try again.');
        } finally {
            setScheduleLoading(false);
        }
    };

    // Calendar view helpers
    const calendarDays = [];
    const todayFull = new Date();
    for (let i = 0; i < 5; i++) {
        const d = new Date(todayFull);
        d.setDate(d.getDate() + i);
        calendarDays.push({
            label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
            dateKey: d.toISOString().split('T')[0],
        });
    }
    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    const getSessionsForSlot = (dateKey, time) =>
        sessions.filter(s => s.date === dateKey && s.time?.startsWith(time.split(':')[0]));

    const todayStr = todayFull.toISOString().split('T')[0];
    const totalToday = sessions.filter(s => s.date === todayStr).length;
    const confirmed = sessions.filter(s => s.status === 'Confirmed').length;
    const pending = sessions.filter(s => s.status === 'Pending').length;
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin' : 'Admin';

    // Shared input style
    const inp = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box' };

    // ── Class type dropdown + inline add (reusable JSX) ───────────────────────
    const typeField = (formKey, setForm, showAdd, setShowAdd, newName, setNewName, addLoad, setAddLoad, addErr, setAddErr, onAddFn) => (
        <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>
                <Tag size={12} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                Class Type
            </label>
            <select
                value={formKey}
                onChange={e => setForm(f => ({ ...f, session_type_id: e.target.value }))}
                style={{ ...inp, cursor: 'pointer', background: '#fff', color: '#333' }}
            >
                <option value='' disabled style={{ color: '#aaa' }}>Select class type...</option>
                {lookupData.sessionTypes.map(t => (
                    <option key={t.id} value={t.id} style={{ color: '#333' }}>{t.name}</option>
                ))}
            </select>

            {!showAdd ? (
                <button
                    type="button"
                    onClick={() => { setShowAdd(true); setAddErr(''); }}
                    style={{ marginTop: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#3B2D82', fontWeight: 600, padding: '2px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    <Plus size={12} /> Add new type
                </button>
            ) : (
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                        autoFocus
                        type="text"
                        placeholder="e.g. Guest Lecture"
                        value={newName}
                        onChange={e => { setNewName(e.target.value); setAddErr(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddFn(); } if (e.key === 'Escape') setShowAdd(false); }}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: '7px', border: `1px solid ${addErr ? '#fca5a5' : '#e5e7eb'}`, fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none' }}
                    />
                    <button
                        type="button"
                        onClick={onAddFn}
                        disabled={addLoad || !newName.trim()}
                        style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', background: '#3B2D82', color: '#fff', cursor: addLoad ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                    >
                        {addLoad ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
                        Save
                    </button>
                    <button
                        type="button"
                        onClick={() => { setShowAdd(false); setNewName(''); setAddErr(''); }}
                        style={{ padding: '6px 8px', borderRadius: '7px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#888' }}
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
            {addErr && <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '4px' }}>⚠ {addErr}</div>}
        </div>
    );

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />

            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>
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
                        <div className="nav-item active"><Calendar size={18} /> <span>Schedule Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/live-students')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Live Students</span></div>
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
                    <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content">
                <div className="content-center admin-full">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Schedule Management</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search sessions..." className="search-input" /></div>
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Stats strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Sessions',  value: sessions.length, icon: CalendarDays, color: '#2563eb', bg: '#eff6ff' },
                            { label: "Today's Classes", value: totalToday,     icon: Clock,        color: '#7c3aed', bg: '#faf5ff' },
                            { label: 'Confirmed',       value: confirmed,      icon: CheckCircle,  color: '#16a34a', bg: '#ecfdf5' },
                            { label: 'Pending',         value: pending,        icon: AlertTriangle,color: '#b45309', bg: '#fffbeb' },
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

                    {/* Controls row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[['all', 'All'], ['today', 'Today'], ['week', 'This Week'], ['confirmed', 'Confirmed'], ['pending', 'Pending']].map(([key, label]) => (
                                <button key={key} onClick={() => setActiveFilter(key)} style={{ padding: '6px 16px', borderRadius: '6px', border: `1px solid ${activeFilter === key ? '#111' : '#e8e8e8'}`, background: activeFilter === key ? '#111' : '#fff', color: activeFilter === key ? '#fff' : '#888', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>{label}</button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', border: '1px solid #e8e8e8', borderRadius: '6px', overflow: 'hidden' }}>
                                <button onClick={() => setViewMode('list')} style={{ padding: '5px 10px', border: 'none', background: viewMode === 'list' ? '#111' : '#fff', color: viewMode === 'list' ? '#fff' : '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600 }}><List size={13} /> List</button>
                                <button onClick={() => setViewMode('calendar')} style={{ padding: '5px 10px', border: 'none', borderLeft: '1px solid #e8e8e8', background: viewMode === 'calendar' ? '#111' : '#fff', color: viewMode === 'calendar' ? '#fff' : '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600 }}><CalendarDays size={13} /> Calendar</button>
                            </div>
                            <button onClick={() => { setShowScheduleModal(true); setScheduleError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 16px', borderRadius: '8px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}><Plus size={14} /> Schedule Class</button>
                        </div>
                    </div>

                    {/* List View */}
                    {viewMode === 'list' && (
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>Course</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>Type</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>Faculty</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>Venue</th>
                                            {/* Sortable DATE column */}
                                            <th
                                                onClick={toggleDateSort}
                                                style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3B2D82', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                            >
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    Date
                                                    {dateSortDir === 'asc'
                                                        ? <ArrowUp size={12} />
                                                        : <ArrowDown size={12} />}
                                                </span>
                                            </th>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>Time</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>Students</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>Status</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <>{[1,2,3,4].map(i => (
                                                <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    {[120,70,90,80,80,90,50,65,50].map((w,j) => (
                                                        <td key={j} style={{ padding: '12px 16px' }}><div style={{ width: `${w}px`, height: j===0?'12px':'10px', borderRadius: '4px', background: j%2===0?'#f0f0f0':'#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${(i*9+j)*0.05}s` }} /></td>
                                                    ))}
                                                </tr>
                                            ))}</>
                                        ) : sortedSessions.length === 0 ? (
                                            <tr><td colSpan={9}>
                                                <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                                                    <Calendar size={32} color="#ddd" />
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '8px' }}>No sessions match this filter</div>
                                                </div>
                                            </td></tr>
                                        ) : sortedSessions.map((s) => (
                                            <tr key={s.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111' }}>{s.course}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {s.sessionType
                                                        ? <span style={{ padding: '2px 9px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, background: '#f5f3ff', color: '#3B2D82', border: '1px solid #ddd6fe', whiteSpace: 'nowrap' }}>{s.sessionType}</span>
                                                        : <span style={{ color: '#ccc', fontSize: '0.75rem' }}>—</span>}
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#555' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><User size={12} color="#aaa" />{s.faculty}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#555' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><MapPin size={12} color="#aaa" />{s.venue}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{formatDate(s.date)}</td>
                                                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{s.time} – {s.endTime}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#555' }}><Users size={12} color="#aaa" />{s.students}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>{statusBadge(s.status)}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button
                                                            onClick={() => openEdit(s)}
                                                            className="change-status-btn"
                                                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #3B2D82', background: '#f5f3ff', cursor: 'pointer', color: '#3B2D82' }}
                                                            title="Edit session"
                                                        ><Edit3 size={13} /></button>
                                                        <button className="change-status-btn" style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#ccc' }}><Trash2 size={13} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Calendar View */}
                    {viewMode === 'calendar' && (
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden' }}>
                            <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}><CalendarDays size={16} /> Weekly Calendar</div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(5, 1fr)', minWidth: '700px' }}>
                                    <div style={{ padding: '8px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }} />
                                    {calendarDays.map(dayObj => (
                                        <div key={dayObj.dateKey} style={{ padding: '10px 8px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0', fontSize: '0.75rem', fontWeight: 600, color: '#555', textAlign: 'center' }}>{dayObj.label}</div>
                                    ))}
                                    {timeSlots.map(time => (
                                        <React.Fragment key={time}>
                                            <div style={{ padding: '8px', borderBottom: '1px solid #f5f5f5', borderRight: '1px solid #f0f0f0', fontSize: '0.7rem', color: '#aaa', fontFamily: 'monospace', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '60px' }}>{time}</div>
                                            {calendarDays.map(dayObj => {
                                                const daySessions = getSessionsForSlot(dayObj.dateKey, time);
                                                return (
                                                    <div key={`${dayObj.dateKey}-${time}`} style={{ padding: '4px', borderBottom: '1px solid #f5f5f5', borderRight: '1px solid #f0f0f0', minHeight: '60px' }}>
                                                        {daySessions.map(s => (
                                                            <div key={s.id} style={{ padding: '6px 8px', borderRadius: '6px', marginBottom: '2px', background: s.status === 'Confirmed' ? '#ecfdf5' : '#fffbeb', border: `1px solid ${s.status === 'Confirmed' ? '#bbf7d0' : '#fde68a'}`, cursor: 'pointer' }}>
                                                                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#111', lineHeight: 1.3 }}>{s.course}</div>
                                                                <div style={{ fontSize: '0.58rem', color: '#888' }}>{s.time}–{s.endTime}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ══ Schedule New Class Modal ═════════════════════════════════════ */}
            {showScheduleModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => { setShowScheduleModal(false); setScheduleError(''); }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '480px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Schedule New Class</h3>
                            <button onClick={() => { setShowScheduleModal(false); setScheduleError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {scheduleError && (
                                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.82rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertCircle size={14} />{scheduleError}
                                </div>
                            )}
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Course *</label>
                                <select value={newClass.course_id} onChange={e => setNewClass({ ...newClass, course_id: e.target.value })} style={{ ...inp, cursor: 'pointer', background: '#fff' }}>
                                    <option value=''>Select a course...</option>
                                    {lookupData.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Lecture Title *</label>
                                <input type='text' placeholder='e.g. Lec 15 - AVL Trees' value={newClass.title} onChange={e => setNewClass({ ...newClass, title: e.target.value })} style={inp}
                                    onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Faculty</label>
                                <select value={newClass.faculty_id} onChange={e => setNewClass({ ...newClass, faculty_id: e.target.value })} style={{ ...inp, cursor: 'pointer', background: '#fff' }}>
                                    <option value=''>Select faculty...</option>
                                    {lookupData.faculty.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Date *</label>
                                <input type='date' value={newClass.date} onChange={e => setNewClass({ ...newClass, date: e.target.value })} style={inp}
                                    onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Start Time *</label>
                                    <input type='time' value={newClass.start_time} onChange={e => setNewClass({ ...newClass, start_time: e.target.value })} style={inp}
                                        onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>End Time</label>
                                    <input type='time' value={newClass.end_time} onChange={e => setNewClass({ ...newClass, end_time: e.target.value })} style={inp}
                                        onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Venue</label>
                                <select value={newClass.venue_id} onChange={e => setNewClass({ ...newClass, venue_id: e.target.value })} style={{ ...inp, cursor: 'pointer', background: '#fff' }}>
                                    <option value=''>Select venue...</option>
                                    {lookupData.venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
                            {typeField(
                                newClass.session_type_id,
                                setNewClass,
                                showAddType, setShowAddType,
                                newTypeName, setNewTypeName,
                                addTypeLoading, setAddTypeLoading,
                                addTypeError, setAddTypeError,
                                handleAddType
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                            <button onClick={() => { setShowScheduleModal(false); setScheduleError(''); }} disabled={scheduleLoading} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: scheduleLoading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>Cancel</button>
                            <button onClick={handleScheduleSubmit} disabled={scheduleLoading} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: scheduleLoading ? '#555' : '#111', cursor: scheduleLoading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px', minWidth: '150px', justifyContent: 'center' }}>
                                {scheduleLoading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Scheduling...</> : <><Plus size={14} /> Schedule & Notify</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ Edit Session Modal ════════════════════════════════════════════ */}
            {editSession && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(2px)' }}
                    onClick={closeEdit}
                >
                    <div
                        style={{ background: '#fff', borderRadius: '16px', width: '500px', maxWidth: '90vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', border: '1.5px solid #e8e8e8' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                            <div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111' }}>Edit Session</div>
                                <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px' }}>{editSession.course} — {formatDate(editSession.date)}</div>
                            </div>
                            <button onClick={closeEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleEditSave}>
                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {editError   && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={14} />{editError}</div>}
                                {editSuccess && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', fontSize: '0.82rem' }}>✓ {editSuccess}</div>}

                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Course *</label>
                                    <select value={editForm.course_id || ''} onChange={e => setEditForm(f => ({ ...f, course_id: e.target.value }))} style={{ ...inp, cursor: 'pointer', background: '#fff' }}>
                                        <option value=''>Select a course...</option>
                                        {lookupData.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Lecture Title *</label>
                                    <input type='text' value={editForm.title || ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inp}
                                        onFocus={e => e.target.style.borderColor = '#3B2D82'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Faculty</label>
                                    <select value={editForm.faculty_id || ''} onChange={e => setEditForm(f => ({ ...f, faculty_id: e.target.value }))} style={{ ...inp, cursor: 'pointer', background: '#fff' }}>
                                        <option value=''>Select faculty...</option>
                                        {lookupData.faculty.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Date *</label>
                                    <input type='date' value={editForm.session_date || ''} onChange={e => setEditForm(f => ({ ...f, session_date: e.target.value }))} style={inp}
                                        onFocus={e => e.target.style.borderColor = '#3B2D82'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Start Time *</label>
                                        <input type='time' value={editForm.start_time || ''} onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))} style={inp}
                                            onFocus={e => e.target.style.borderColor = '#3B2D82'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>End Time</label>
                                        <input type='time' value={editForm.end_time || ''} onChange={e => setEditForm(f => ({ ...f, end_time: e.target.value }))} style={inp}
                                            onFocus={e => e.target.style.borderColor = '#3B2D82'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Venue</label>
                                    <select value={editForm.venue_id || ''} onChange={e => setEditForm(f => ({ ...f, venue_id: e.target.value }))} style={{ ...inp, cursor: 'pointer', background: '#fff' }}>
                                        <option value=''>Select venue...</option>
                                        {lookupData.venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                                {typeField(
                                    editForm.session_type_id || '',
                                    setEditForm,
                                    editShowAddType, setEditShowAddType,
                                    editNewTypeName, setEditNewTypeName,
                                    editAddTypeLoading, setEditAddTypeLoading,
                                    editAddTypeError, setEditAddTypeError,
                                    handleEditAddType
                                )}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Status</label>
                                    <select value={editForm.status || 'scheduled'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={{ ...inp, cursor: 'pointer', background: '#fff' }}>
                                        <option value='scheduled'>Confirmed</option>
                                        <option value='completed'>Completed</option>
                                        <option value='cancelled'>Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                                <button type="button" onClick={closeEdit} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>Cancel</button>
                                <button
                                    type="submit"
                                    disabled={editLoading}
                                    style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: editLoading ? '#555' : '#3B2D82', cursor: editLoading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px', minWidth: '140px', justifyContent: 'center' }}
                                >
                                    {editLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Edit3 size={14} /> Save Changes</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
        </div>
    );
}
