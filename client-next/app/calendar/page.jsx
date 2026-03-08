'use client';

import React, { useState, useEffect } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight, MapPin, Clock, User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EVENT_COLORS = ['#0b6861','#7c3aed','#2563eb','#e91e87','#c2410c','#b45309'];

export default function CalendarPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    useEffect(() => {
        if (!authReady) return;
        const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toISOString().split('T')[0];
        setLoading(true);
        api.get(`/api/calendar/sessions?start=${start}&end=${end}`)
            .then(d => setSessions(d.sessions || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [viewDate, authReady]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const sessionsByDay = {};
    sessions.forEach(s => {
        const d = new Date(s.session_date).getDate();
        if (!sessionsByDay[d]) sessionsByDay[d] = [];
        sessionsByDay[d].push(s);
    });

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const formatTime = (t) => {
        if (!t) return '';
        const [h, m] = t.split(':').map(Number);
        return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
    };

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#0b6861', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                            {user?.firstName?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div onClick={() => navTo('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18}/> <span>Home</span></div>
                        <div onClick={() => navTo('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18}/> <span>Attendance</span></div>
                        <div onClick={() => navTo('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18}/> <span>Grades</span></div>
                        <div onClick={() => navTo('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18}/> <span>Teachers</span></div>
                        <div onClick={() => navTo('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18}/> <span>Feedback</span></div>
                        <div onClick={() => navTo('/courses')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18}/> <span>Courses</span></div>
                        <div className="nav-item active"><Calendar size={18}/> <span>Calendar</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div onClick={() => navTo('/settings')} className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18}/> <span>Settings</span></div>
                    <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18}/> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content" style={{ flexDirection: 'column', overflowY: 'auto' }}>
                <header className="dashboard-header" style={{ padding: '1rem 2rem', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24}/></div>
                        <h1>Calendar</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa"/><input type="text" placeholder="Search" className="search-input"/></div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }}/>
                    </div>
                </header>

                <div style={{ padding: '1.5rem 2rem', flex: 1, display: 'flex', gap: '1.5rem' }}>
                    {/* Calendar */}
                    <div style={{ flex: 1, background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        {/* Month nav */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                            <button onClick={prevMonth} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={16}/></button>
                            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{MONTHS[month]} {year}</div>
                            <button onClick={nextMonth} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={16}/></button>
                        </div>
                        {/* Day headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 1rem' }}>
                            {DAYS.map(d => <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: '0.72rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>{d}</div>)}
                        </div>
                        {/* Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 1rem 1rem', gap: '4px' }}>
                            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                                const daySessions = sessionsByDay[day] || [];
                                return (
                                    <div key={day} onClick={() => daySessions.length > 0 && setSelected({ day, sessions: daySessions })}
                                        style={{ minHeight: '60px', padding: '4px', borderRadius: '8px', background: isToday ? '#0b6861' : '#fff', cursor: daySessions.length > 0 ? 'pointer' : 'default', border: '1px solid #f5f5f5', transition: 'background 0.15s' }}
                                        onMouseEnter={e => !isToday && daySessions.length > 0 && (e.currentTarget.style.background = '#f5f5f5')}
                                        onMouseLeave={e => !isToday && (e.currentTarget.style.background = '#fff')}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: isToday ? 700 : 500, color: isToday ? '#fff' : '#333', marginBottom: '3px' }}>{day}</div>
                                        {daySessions.slice(0, 2).map((s, si) => (
                                            <div key={si} style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: EVENT_COLORS[si % EVENT_COLORS.length] + '20', color: EVENT_COLORS[si % EVENT_COLORS.length], fontWeight: 600, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {s.courses?.name || s.title}
                                            </div>
                                        ))}
                                        {daySessions.length > 2 && <div style={{ fontSize: '0.58rem', color: '#aaa' }}>+{daySessions.length - 2} more</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Side panel: selected day or upcoming */}
                    <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {selected ? (
                            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{MONTHS[month]} {selected.day}</div>
                                    <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.1rem' }}>×</button>
                                </div>
                                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {selected.sessions.map((s, i) => (
                                        <div key={i} style={{ padding: '10px', borderRadius: '10px', border: '1px solid #f0f0f0', borderLeft: `3px solid ${EVENT_COLORS[i % EVENT_COLORS.length]}` }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111' }}>{s.courses?.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '2px' }}>{s.title}</div>
                                            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem', color: '#888' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11}/> {formatTime(s.start_time)} – {formatTime(s.end_time)}</div>
                                                {s.venues && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11}/> {s.venues.name}</div>}
                                                {s.faculty?.users && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={11}/> {s.faculty.users.first_name} {s.faculty.users.last_name}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '0.9rem' }}>Upcoming Sessions</div>
                                <div style={{ padding: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                                    {loading ? (
                                        <div style={{ padding: '1rem', color: '#aaa', fontSize: '0.82rem', textAlign: 'center' }}>Loading...</div>
                                    ) : sessions.filter(s => new Date(s.session_date) >= new Date(today.toISOString().split('T')[0])).slice(0, 8).length === 0 ? (
                                        <div style={{ padding: '1rem', color: '#888', fontSize: '0.82rem', textAlign: 'center' }}>No upcoming sessions this month</div>
                                    ) : sessions
                                        .filter(s => new Date(s.session_date) >= new Date(today.toISOString().split('T')[0]))
                                        .slice(0, 8)
                                        .map((s, i) => (
                                            <div key={i} style={{ padding: '8px 10px', borderRadius: '8px', marginBottom: '4px', borderLeft: `3px solid ${EVENT_COLORS[i % EVENT_COLORS.length]}`, background: '#fafafa', cursor: 'pointer' }}
                                                onClick={() => setSelected({ day: new Date(s.session_date).getDate(), sessions: sessionsByDay[new Date(s.session_date).getDate()] || [s] })}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111' }}>{s.courses?.name || s.title}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                                    {new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} • {formatTime(s.start_time)}
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
