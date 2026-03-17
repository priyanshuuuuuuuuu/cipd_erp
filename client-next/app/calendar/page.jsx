'use client';

import React, { useState, useEffect } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Bell, Search, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

export default function CalendarPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [view, setView] = useState('week');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [sessions, setSessions] = useState([]);

    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    useEffect(() => {
        if (!authReady) return;
        const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toISOString().split('T')[0];
        api.get(`/api/calendar/sessions?start=${start}&end=${end}`)
            .then(d => setSessions(d.sessions || []))
            .catch(() => {});
    }, [viewDate, authReady]);

    // Group sessions by day-of-week for week view
    const DAY_KEYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sessionsByDay = {};
    sessions.forEach(s => {
        // Safe string parsing to avoid UTC timezone backward shifts
        const [y, m, d] = s.session_date.split('-');
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        const key = DAY_KEYS[dateObj.getDay()];
        if (!sessionsByDay[key]) sessionsByDay[key] = [];
        sessionsByDay[key].push(s);
    });

    // Group sessions by day-of-month for month view
    const sessionsByDom = {};
    sessions.forEach(s => {
        const dom = Number(s.session_date.split('-')[2]);
        if (!sessionsByDom[dom]) sessionsByDom[dom] = [];
        sessionsByDom[dom].push(s);
    });

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const today = new Date();
    const isCurrentMonth = viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear();
    const colors = ['#e0f2fe', '#ecfccb', '#f3e8ff', '#fce7f3'];

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />

            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar"><img src="/studentPic.png" alt="Student" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /></div>
                        <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div onClick={() => navTo('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Home</span></div>
                        <div onClick={() => navTo('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Attendance</span></div>
                        <div onClick={() => navTo('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div className="nav-item" onClick={() => navTo('/teachers')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div onClick={() => navTo('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div onClick={() => navTo('/courses')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Courses</span></div>
                        <div className="nav-item active"><Calendar size={18} /> <span>Calendar</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div onClick={() => navTo('/settings')} className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content" style={{ flexDirection: 'column', overflowY: 'auto' }}>
                <header className="dashboard-header" style={{ padding: '1rem 2rem', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                        <h1>Calendar</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                        <Bell size={20} color="#555" />
                        <MessageSquare size={20} color="#555" />
                        <img src="/logo.png" alt="Logo" style={{ height: '35px', marginLeft: '0.5rem' }} />
                    </div>
                </header>

                <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
                                {viewDate.toLocaleString('en', { month: 'long' })} {viewDate.getFullYear()}
                            </h2>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
                                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><ChevronRight size={20} /></button>
                            </div>
                        </div>
                        <div style={{ background: '#f5f5f5', padding: '4px', borderRadius: '20px', display: 'flex', gap: '5px' }}>
                            {['day', 'week', 'month'].map(v => (
                                <button key={v} onClick={() => setView(v)} style={{ border: 'none', background: view === v ? '#111' : 'transparent', color: view === v ? '#fff' : '#000', padding: '6px 16px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: view === v ? '600' : '400', cursor: 'pointer', textTransform: 'capitalize' }}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
                            ))}
                        </div>
                    </div>

                    <div className="calendar-view-container" style={{ display: 'flex', flex: 1, border: '1px solid #f0f0f0', borderRadius: '12px', padding: '10px', overflow: 'hidden', flexDirection: 'column' }}>
                        {/* DAY VIEW */}
                        {view === 'day' && (
                            <div style={{ display: 'flex', height: '100%', overflowY: 'auto' }}>
                                <div style={{ width: '80px', display: 'flex', flexDirection: 'column', paddingRight: '10px' }}>
                                    {['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'].map(time => (
                                        <div key={time} style={{ height: '80px', fontSize: '0.75rem', color: '#888', textAlign: 'right', paddingRight: '10px' }}>{time}</div>
                                    ))}
                                </div>
                                <div style={{ flex: 1, borderLeft: '1px solid #f0f0f0', position: 'relative' }}>
                                    {sessions.slice(0, 3).map((s, i) => (
                                        <div key={s.id} style={{ background: colors[i % colors.length], padding: '15px', borderRadius: '12px', position: 'absolute', top: `${i * 170 + 10}px`, left: '10px', right: '10px', height: '140px' }}>
                                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{s.start_time ? s.start_time.slice(0, 5) : ''}</div>
                                            <h3 style={{ margin: '5px 0', fontSize: '1.1rem' }}>{s.courses?.name || s.title}</h3>
                                            <p style={{ color: '#555', fontSize: '0.85rem' }}>{s.venues?.name || 'TBA'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* WEEK VIEW */}
                        {view === 'week' && (
                            <div style={{ display: 'flex', flex: 1 }}>
                                <div style={{ width: '80px', display: 'flex', flexDirection: 'column', paddingRight: '10px', marginTop: '50px' }}>
                                    {['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM'].map(time => (
                                        <div key={time} style={{ height: '120px', fontSize: '0.75rem', color: '#888', textAlign: 'right', paddingRight: '10px' }}>{time}</div>
                                    ))}
                                </div>
                                <div style={{ flex: 1, display: 'flex' }}>
                                    {DAY_KEYS.map((day, index) => {
                                        const daySessions = sessionsByDay[day] || [];
                                        return (
                                            <div key={day} style={{ flex: 1, borderLeft: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ textAlign: 'center', paddingBottom: '20px', color: '#888', fontSize: '0.9rem', borderBottom: '1px solid #f0f0f0' }}>
                                                    <div style={{ fontSize: '0.8rem' }}>{day.slice(0, 3)}</div>
                                                </div>
                                                <div style={{ flex: 1, position: 'relative' }}>
                                                    {daySessions.slice(0, 2).map((s, si) => (
                                                        <div key={s.id} style={{ background: colors[si % colors.length], padding: '10px', borderRadius: '12px', position: 'absolute', top: `${si * 130 + 20}px`, left: '5px', right: '5px', minHeight: '100px' }}>
                                                            <div style={{ fontWeight: '700', fontSize: '0.8rem' }}>{s.start_time ? s.start_time.slice(0, 5) : ''}</div>
                                                            <div style={{ fontWeight: '700', marginTop: '5px', fontSize: '0.9rem' }}>{s.courses?.name || s.title}</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#555' }}>{s.venues?.name || 'TBA'}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* MONTH VIEW */}
                        {view === 'month' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%', gap: '1px', background: '#f0f0f0' }}>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(h => (
                                    <div key={h} style={{ background: '#fff', padding: '10px', textAlign: 'center', fontWeight: '600', color: '#555', fontSize: '0.9rem' }}>{h}</div>
                                ))}
                                {Array.from({ length: firstDay }).map((_, i) => (
                                    <div key={`empty-${i}`} style={{ background: '#fafafa', minHeight: '100px', padding: '8px' }} />
                                ))}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const dayNum = i + 1;
                                    const isToday = isCurrentMonth && dayNum === today.getDate();
                                    const daySessions = sessionsByDom[dayNum] || [];
                                    return (
                                        <div key={dayNum} style={{ background: '#fff', minHeight: '100px', padding: '8px', position: 'relative' }}>
                                            <div style={{ textAlign: 'right', color: isToday ? '#fff' : '#333' }}>
                                                <span style={{ background: isToday ? '#111' : 'transparent', borderRadius: '50%', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{dayNum}</span>
                                            </div>
                                            {daySessions.slice(0, 2).map((s, si) => (
                                                <div key={s.id} style={{ background: colors[si % colors.length], fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', marginTop: '3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                                    {s.courses?.name || s.title}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
