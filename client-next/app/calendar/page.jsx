'use client';

import React, { useState, useEffect } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Bell, Search, ChevronLeft, ChevronRight, Menu, Trophy
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
        const startRaw = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
        const endRaw = new Date(viewDate.getFullYear(), viewDate.getMonth() + 2, 0);
        const start = startRaw.toISOString().split('T')[0];
        const end = endRaw.toISOString().split('T')[0];
        api.get(`/api/calendar/sessions?start=${start}&end=${end}`)
            .then(d => setSessions(d.sessions || []))
            .catch(() => {});
    }, [viewDate, authReady]);

    // Helper to group sessions
    const sessionsByDom = {};
    const sessionsByDayOfWeek = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
    const daySessions = [];

    // Week calculations
    const viewDateObj = new Date(viewDate);
    const viewDayOfWeek = viewDateObj.getDay() === 0 ? 6 : viewDateObj.getDay() - 1; // 0 (Mon) - 6 (Sun)
    const weekStartdDate = new Date(viewDateObj);
    weekStartdDate.setDate(weekStartdDate.getDate() - viewDayOfWeek);
    const weekEnddDate = new Date(weekStartdDate);
    weekEnddDate.setDate(weekEnddDate.getDate() + 6);

    const viewDateStr = `${viewDateObj.getFullYear()}-${String(viewDateObj.getMonth() + 1).padStart(2, '0')}-${String(viewDateObj.getDate()).padStart(2, '0')}`;
    const DAY_KEYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    sessions.forEach(s => {
        if (!s.session_date) return;
        const [y, m, d] = s.session_date.split('-');
        const dom = Number(d);
        if (!sessionsByDom[dom]) sessionsByDom[dom] = [];
        sessionsByDom[dom].push(s);

        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        // Day view filter
        if (s.session_date === viewDateStr) {
            daySessions.push(s);
        }
        // Week view filter
        if (dateObj >= weekStartdDate && dateObj <= weekEnddDate) {
            const key = DAY_KEYS[dateObj.getDay()];
            if (sessionsByDayOfWeek[key]) {
                sessionsByDayOfWeek[key].push(s);
            }
        }
    });

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    let firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon=0 .. Sun=6
    
    const today = new Date();
    const isCurrentMonth = viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear();
    const colors = ['#e0f2fe', '#ecfccb', '#f3e8ff', '#fce7f3'];

    const handlePrev = () => {
        if (view === 'month') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
        else if (view === 'week') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() - 7));
        else if (view === 'day') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() - 1));
    };

    const handleNext = () => {
        if (view === 'month') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
        else if (view === 'week') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() + 7));
        else if (view === 'day') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() + 1));
    };
    
    const getHeaderText = () => {
        if (view === 'month') return `${viewDate.toLocaleString('en', { month: 'long' })} ${viewDate.getFullYear()}`;
        if (view === 'week') return `Week of ${weekStartdDate.toLocaleString('en', { month: 'short' })} ${weekStartdDate.getDate()}, ${weekStartdDate.getFullYear()}`;
        if (view === 'day') return `${viewDate.toLocaleString('en', { month: 'long' })} ${viewDate.getDate()}, ${viewDate.getFullYear()}`;
        return '';
    };

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
                        <div onClick={() => navTo('/leaderboard')} className="nav-item" style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
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
                                {getHeaderText()}
                            </h2>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={handlePrev} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
                                <button onClick={handleNext} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><ChevronRight size={20} /></button>
                            </div>
                        </div>
                        <div style={{ background: '#f5f5f5', padding: '4px', borderRadius: '20px', display: 'flex', gap: '5px' }}>
                            {['day', 'week', 'month'].map(v => (
                                <button key={v} onClick={() => setView(v)} style={{ border: 'none', background: view === v ? '#111' : 'transparent', color: view === v ? '#fff' : '#000', padding: '6px 16px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: view === v ? '600' : '400', cursor: 'pointer', textTransform: 'capitalize' }}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
                            ))}
                        </div>
                    </div>

                    <div className="calendar-view-container" style={{ display: 'flex', flex: 1, border: '1px solid #f0f0f0', borderRadius: '12px', padding: '10px', overflowY: 'auto', overflowX: 'hidden', flexDirection: 'column' }}>
                        {/* DAY VIEW */}
                        {view === 'day' && (
                            <div style={{ display: 'flex', minHeight: '100%' }}>
                                <div style={{ width: '80px', display: 'flex', flexDirection: 'column', paddingRight: '10px' }}>
                                    {['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'].map(time => (
                                        <div key={time} style={{ height: '80px', fontSize: '0.75rem', color: '#888', textAlign: 'right', paddingRight: '10px' }}>{time}</div>
                                    ))}
                                </div>
                                <div style={{ flex: 1, borderLeft: '1px solid #f0f0f0', position: 'relative', minHeight: '880px' }}>
                                    {daySessions.map((s, i) => {
                                        let top = i * 100 + 10;
                                        let hOffset = 80;
                                        if (s.start_time) {
                                            const [sh, sm] = s.start_time.split(':').map(Number);
                                            top = (sh - 8) * 80 + (sm / 60) * 80;
                                            if (s.end_time) {
                                                const [eh, em] = s.end_time.split(':').map(Number);
                                                hOffset = ((eh - sh) + (em - sm) / 60) * 80;
                                            }
                                        }
                                        return (
                                            <div key={s.id} style={{ background: colors[i % colors.length], padding: '15px', borderRadius: '12px', position: 'absolute', top: `${top}px`, left: '10px', right: '10px', height: `${hOffset}px`, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{s.start_time ? s.start_time.slice(0, 5) : ''} {s.end_time ? `- ${s.end_time.slice(0, 5)}` : ''}</div>
                                                <h3 style={{ margin: '5px 0', fontSize: '1.1rem' }}>{s.courses?.name || s.title}</h3>
                                                <p style={{ color: '#555', fontSize: '0.85rem' }}>{s.venues?.name || 'TBA'}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* WEEK VIEW */}
                        {view === 'week' && (
                            <div style={{ display: 'flex', flex: 1, minHeight: '800px' }}>
                                <div style={{ width: '80px', display: 'flex', flexDirection: 'column', paddingRight: '10px', marginTop: '50px' }}>
                                    {['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM'].map(time => (
                                        <div key={time} style={{ height: '120px', fontSize: '0.75rem', color: '#888', textAlign: 'right', paddingRight: '10px' }}>{time}</div>
                                    ))}
                                </div>
                                <div style={{ flex: 1, display: 'flex' }}>
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
                                        const dayClasses = sessionsByDayOfWeek[day] || [];
                                        return (
                                            <div key={day} style={{ flex: 1, borderLeft: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ textAlign: 'center', paddingBottom: '20px', paddingTop: '10px', color: '#888', fontSize: '0.9rem', borderBottom: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '0.8rem' }}>{day.slice(0, 3)}</div>
                                                    {(() => {
                                                        const dDate = new Date(weekStartdDate);
                                                        dDate.setDate(dDate.getDate() + index);
                                                        const isToday = dDate.getDate() === new Date().getDate() && dDate.getMonth() === new Date().getMonth() && dDate.getFullYear() === new Date().getFullYear();
                                                        return <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: isToday ? '#111' : 'transparent', color: isToday ? '#fff' : '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '5px', fontWeight: 600 }}>{dDate.getDate()}</div>;
                                                    })()}
                                                </div>
                                                <div style={{ flex: 1, position: 'relative', minHeight: '660px' }}>
                                                    {dayClasses.map((s, si) => {
                                                        let top = si * 130 + 10;
                                                        let hOffset = 60;
                                                        if (s.start_time) {
                                                            const [h, m] = s.start_time.split(':').map(Number);
                                                            top = (h - 8) * 60 + (m / 60) * 60;
                                                            if (s.end_time) {
                                                                const [eh, em] = s.end_time.split(':').map(Number);
                                                                hOffset = ((eh - h) + (em - m) / 60) * 60;
                                                            }
                                                        }
                                                        return (
                                                            <div key={s.id} style={{ background: colors[si % colors.length], padding: '6px', borderRadius: '8px', position: 'absolute', top: `${top}px`, left: '4px', right: '4px', height: `${hOffset}px`, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                                <div style={{ fontWeight: '700', fontSize: '0.75rem' }}>{s.start_time ? s.start_time.slice(0, 5) : ''}</div>
                                                                <div style={{ fontWeight: '700', marginTop: '2px', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.courses?.name || s.title}</div>
                                                                <div style={{ fontSize: '0.65rem', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.venues?.name || 'TBA'}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* MONTH VIEW */}
                        {view === 'month' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: '100%', gridAutoRows: 'minmax(100px, auto)', gap: '1px', background: '#f0f0f0' }}>
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
                                            {daySessions.map((s, si) => (
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
