'use client';
import React, { useState, useEffect, useCallback } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Plus,
    MapPin, User, Users, Edit3, Trash2, X, AlertTriangle, RefreshCw, Filter,
    List, CalendarDays, AlertCircle
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

    // Form state — matches the working admin dashboard modal
    const [newClass, setNewClass] = useState({ course_id: '', faculty_id: '', date: '', start_time: '', end_time: '', venue_id: '', title: '' });
    const [lookupData, setLookupData] = useState({ courses: [], faculty: [], venues: [] });
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [scheduleError, setScheduleError] = useState('');

    const navTo = p => router.push(p);

    // Fetch sessions using authenticated api helper
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

    // Fetch lookup data for dropdowns
    const fetchLookup = useCallback(async () => {
        try {
            const data = await api.get('/api/admin/lookup');
            setLookupData({
                courses: data.courses || [],
                faculty: data.faculty || [],
                venues: data.venues || [],
            });
        } catch (err) {
            console.error('Failed to fetch lookup data:', err);
        }
    }, []);

    useEffect(() => {
        if (authReady) {
            fetchSessions();
            fetchLookup();
        }
    }, [fetchSessions, fetchLookup, authReady]);

    const formatDate = d => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const statusBadge = status => {
        const map = { Confirmed: { bg: '#ecfdf5', color: '#166534' }, Pending: { bg: '#fffbeb', color: '#92400e' }, Cancelled: { bg: '#fef2f2', color: '#991b1b' } };
        const s = map[status] || map.Pending;
        return <span style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>;
    };

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
                title: newClass.title.trim(),
                session_date: newClass.date,
                start_time: newClass.start_time,
                end_time: endTime,
            });
            setShowScheduleModal(false);
            setNewClass({ course_id: '', faculty_id: '', date: '', start_time: '', end_time: '', venue_id: '', title: '' });
            setScheduleError('');
            fetchSessions();
        } catch (e) {
            setScheduleError(e.message || 'Failed to schedule class. Please try again.');
        } finally {
            setScheduleLoading(false);
        }
    };

    // Calendar view
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
                        <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours & Honorarium</span></div>
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
                            { label: 'Total Sessions', value: sessions.length, icon: CalendarDays, color: '#2563eb', bg: '#eff6ff' },
                            { label: "Today's Classes", value: totalToday, icon: Clock, color: '#7c3aed', bg: '#faf5ff' },
                            { label: 'Confirmed', value: confirmed, icon: CheckCircle, color: '#16a34a', bg: '#ecfdf5' },
                            { label: 'Pending', value: pending, icon: AlertTriangle, color: '#b45309', bg: '#fffbeb' },
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
                                            {['Course', 'Faculty', 'Venue', 'Date', 'Time', 'Students', 'Status', ''].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#aaa', fontSize: '0.85rem' }}>Loading sessions...</td></tr>
                                        ) : sessions.length === 0 ? (
                                            <tr><td colSpan={8}>
                                                <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                                                    <Calendar size={32} color="#ddd" />
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '8px' }}>No sessions match this filter</div>
                                                </div>
                                            </td></tr>
                                        ) : sessions.map((s) => (
                                            <tr key={s.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111' }}>{s.course}</td>
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
                                                        <button className="change-status-btn" style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#888' }}><Edit3 size={13} /></button>
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

            {/* Schedule Modal — identical to admin dashboard, fully connected to API */}
            {showScheduleModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => { setShowScheduleModal(false); setScheduleError(''); }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '480px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
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
                                <select value={newClass.course_id} onChange={e => setNewClass({ ...newClass, course_id: e.target.value })}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box', background: '#fff', cursor: 'pointer' }}>
                                    <option value=''>Select a course...</option>
                                    {lookupData.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Lecture Title *</label>
                                <input type='text' placeholder='e.g. Lec 15 - AVL Trees' value={newClass.title} onChange={e => setNewClass({ ...newClass, title: e.target.value })}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box' }}
                                    onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Faculty</label>
                                <select value={newClass.faculty_id} onChange={e => setNewClass({ ...newClass, faculty_id: e.target.value })}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box', background: '#fff', cursor: 'pointer' }}>
                                    <option value=''>Select faculty...</option>
                                    {lookupData.faculty.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Date *</label>
                                <input type='date' value={newClass.date} onChange={e => setNewClass({ ...newClass, date: e.target.value })}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box' }}
                                    onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Start Time *</label>
                                    <input type='time' value={newClass.start_time} onChange={e => setNewClass({ ...newClass, start_time: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>End Time</label>
                                    <input type='time' value={newClass.end_time} onChange={e => setNewClass({ ...newClass, end_time: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Venue</label>
                                <select value={newClass.venue_id} onChange={e => setNewClass({ ...newClass, venue_id: e.target.value })}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box', background: '#fff', cursor: 'pointer' }}>
                                    <option value=''>Select venue...</option>
                                    {lookupData.venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
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
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
