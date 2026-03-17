'use client';
import React, { useState } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Plus,
    MapPin, User, Users, Edit3, Trash2, X, AlertTriangle, RefreshCw, Filter,
    ChevronDown, List, CalendarDays
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminSchedulePage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
    const [activeFilter, setActiveFilter] = useState('all');
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [showConflictWarning, setShowConflictWarning] = useState(false);
    const [newClass, setNewClass] = useState({ course: '', faculty: '', date: '', time: '', endTime: '', duration: '60', venue: '', recurrence: 'one-time' });
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    const navTo = p => router.push(p);

    React.useEffect(() => {
        setLoading(true);
        fetch(`/api/admin/schedule?filter=${activeFilter}`)
            .then(res => res.json())
            .then(data => {
                if (data.sessions) {
                    setSessions(data.sessions);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch schedule:", err);
                setLoading(false);
            });
    }, [activeFilter]);

    // Format for Week Calendar View parsing
    const filteredSessions = sessions; // Filtering is handled server-side now

    const formatDate = d => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const statusBadge = status => {
        const map = { Confirmed: { bg: '#ecfdf5', color: '#166534' }, Pending: { bg: '#fffbeb', color: '#92400e' }, Cancelled: { bg: '#fef2f2', color: '#991b1b' } };
        const s = map[status] || map.Pending;
        return <span style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>;
    };

    const handleScheduleSubmit = () => {
        // Simulate conflict detection
        if (newClass.venue === 'Room 204, Block A' && newClass.time === '09:00' && newClass.date === '2026-02-17') {
            setShowConflictWarning(true);
            return;
        }
        setShowScheduleModal(false);
        setNewClass({ course: '', faculty: '', date: '', time: '', endTime: '', duration: '60', venue: '', recurrence: 'one-time' });
        setShowConflictWarning(false);
    };

    const calendarDays = [];
    const todayStrFull = new Date();
    // Generate the next 5 days dynamically for the calendar view header
    for (let i = 0; i < 5; i++) {
        const d = new Date(todayStrFull);
        d.setDate(d.getDate() + i);
        const dayStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
        calendarDays.push({ 
            label: dayStr, 
            dateKey: d.toISOString().split('T')[0] // 'YYYY-MM-DD'
        });
    }

    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

    const getSessionsForSlot = (dateKey, time) => {
        return sessions.filter(s => s.date === dateKey && s.time?.startsWith(time.split(':')[0]));
    };

    const todayStr = todayStrFull.toISOString().split('T')[0];
    const totalToday = sessions.filter(s => s.date === todayStr).length;
    const confirmed = sessions.filter(s => s.status === 'Confirmed').length;
    const pending = sessions.filter(s => s.status === 'Pending').length;

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
                    <div className="nav-item active"><Calendar size={18} /> <span>Schedule Management</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
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
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>{stat.value}</div>
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
                            <button onClick={() => { setShowScheduleModal(true); setEditingSession(null); setShowConflictWarning(false); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 16px', borderRadius: '8px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}><Plus size={14} /> Schedule Class</button>
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
                                        {filteredSessions.map((s, i) => (
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
                                {filteredSessions.length === 0 && (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                                        <Calendar size={32} color="#ddd" />
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '8px' }}>No sessions match this filter</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Calendar View */}
                    {viewMode === 'calendar' && (
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden' }}>
                            <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}><CalendarDays size={16} /> Weekly Calendar</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <button style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#888' }}><ChevronLeft size={14} /></button>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#333' }}>Upcoming</span>
                                    <button style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#888' }}><ChevronRight size={14} /></button>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(5, 1fr)', minWidth: '700px' }}>
                                    {/* Header row */}
                                    <div style={{ padding: '8px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }} />
                                    {calendarDays.map(dayObj => (
                                        <div key={dayObj.dateKey} style={{ padding: '10px 8px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0', fontSize: '0.75rem', fontWeight: 600, color: '#555', textAlign: 'center' }}>{dayObj.label}</div>
                                    ))}
                                    {/* Time slots */}
                                    {timeSlots.map(time => (
                                        <React.Fragment key={time}>
                                            <div style={{ padding: '8px', borderBottom: '1px solid #f5f5f5', borderRight: '1px solid #f0f0f0', fontSize: '0.7rem', color: '#aaa', fontFamily: 'monospace', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '60px' }}>{time}</div>
                                            {calendarDays.map(dayObj => {
                                                const daySession = getSessionsForSlot(dayObj.dateKey, time);
                                                return (
                                                    <div key={`${dayObj.dateKey}-${time}`} style={{ padding: '4px', borderBottom: '1px solid #f5f5f5', borderRight: '1px solid #f0f0f0', minHeight: '60px' }}>
                                                        {daySession.map(s => (
                                                            <div key={s.id} style={{
                                                                padding: '6px 8px', borderRadius: '6px', marginBottom: '2px',
                                                                background: s.status === 'Confirmed' ? '#ecfdf5' : s.status === 'Pending' ? '#fffbeb' : '#fef2f2',
                                                                border: `1px solid ${s.status === 'Confirmed' ? '#bbf7d0' : s.status === 'Pending' ? '#fde68a' : '#fecaca'}`,
                                                                cursor: 'pointer'
                                                            }}>
                                                                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#111', lineHeight: 1.3 }}>{s.course.split('—')[0].trim()}</div>
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

            {/* Schedule Modal */}
            {showScheduleModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowScheduleModal(false)}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '520px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Schedule New Class</h3>
                            <button onClick={() => setShowScheduleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
                        </div>

                        {showConflictWarning && (
                            <div style={{ margin: '12px 1.5rem 0', padding: '10px 14px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <AlertTriangle size={16} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e', marginBottom: '2px' }}>Schedule Conflict Detected</div>
                                    <div style={{ fontSize: '0.72rem', color: '#b45309' }}>Room 204, Block A is already booked for CS301 at 09:00 on this date. Override?</div>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                        <button onClick={() => { setShowConflictWarning(false); setShowScheduleModal(false); }} style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: '#111', color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>Override & Schedule</button>
                                        <button onClick={() => setShowConflictWarning(false)} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', color: '#555', cursor: 'pointer', fontSize: '0.72rem' }}>Change Details</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {[
                                { label: 'Course', key: 'course', type: 'text', placeholder: 'e.g. CS301 — Data Structures' },
                                { label: 'Faculty', key: 'faculty', type: 'text', placeholder: 'e.g. Prof. Anuj Grover' },
                                { label: 'Venue', key: 'venue', type: 'text', placeholder: 'e.g. Room 204, Block A' },
                            ].map(field => (
                                <div key={field.key}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>{field.label}</label>
                                    <input type={field.type} placeholder={field.placeholder} value={newClass[field.key]} onChange={e => setNewClass({ ...newClass, [field.key]: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                            ))}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Date</label>
                                    <input type="date" value={newClass.date} onChange={e => setNewClass({ ...newClass, date: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Start Time</label>
                                    <input type="time" value={newClass.time} onChange={e => setNewClass({ ...newClass, time: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Duration (minutes)</label>
                                    <select value={newClass.duration} onChange={e => setNewClass({ ...newClass, duration: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', cursor: 'pointer', boxSizing: 'border-box', background: '#fff' }}>
                                        <option value="30">30 min</option><option value="60">60 min</option><option value="90">90 min</option><option value="120">120 min</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Recurrence</label>
                                    <select value={newClass.recurrence} onChange={e => setNewClass({ ...newClass, recurrence: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', cursor: 'pointer', boxSizing: 'border-box', background: '#fff' }}>
                                        <option value="one-time">One-time</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                            <button onClick={() => setShowScheduleModal(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>Cancel</button>
                            <button onClick={handleScheduleSubmit} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Plus size={14} /> Schedule & Notify
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
