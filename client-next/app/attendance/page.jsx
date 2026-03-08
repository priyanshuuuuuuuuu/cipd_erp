'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Bell, Search, Menu, ChevronLeft, ChevronRight,
    CheckCircle, XCircle, Clock, AlertCircle, Filter, Flame
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

const Donut = ({ pct, size = 120, stroke = 10, color = '#66d9e8', bg = '#f0f0f0' }) => {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
    );
};

const MiniDonut = ({ pct, size = 44, stroke = 5, color }) => {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
    );
};

const COURSE_COLORS = ['#66d9e8', '#a78bfa', '#93c5fd', '#6ee7b7', '#f9a8d4'];

export default function AttendancePage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState('all');
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [sessions, setSessions] = useState([]);

    const fetchData = useCallback(async () => {
        try {
            const [sumRes, sesRes] = await Promise.allSettled([
                api.get('/api/students/attendance/summary'),
                api.get('/api/students/attendance/sessions?limit=30'),
            ]);
            if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
            if (sesRes.status === 'fulfilled') setSessions(sesRes.value.sessions || []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchData(); }, [fetchData, authReady]);

    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const overall = summary?.overall || { attended: 0, missed: 0, total: 0, pct: 0 };
    const streak = summary?.streak || 0;
    const courses = (summary?.by_course || []).map((c, i) => ({
        ...c,
        color: COURSE_COLORS[i % COURSE_COLORS.length],
    }));

    const filteredSessions = selectedCourse === 'all'
        ? sessions
        : sessions.filter(s => s.course_id === selectedCourse);

    const statusIcon = (s) => {
        if (s === 'present') return <CheckCircle size={14} color="#16a34a" />;
        if (s === 'absent') return <XCircle size={14} color="#dc2626" />;
        return <Clock size={14} color="#f59e0b" />;
    };
    const statusColor = (s) => s === 'present' ? '#16a34a' : s === 'absent' ? '#dc2626' : '#f59e0b';

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#0b6861', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => navTo('/profile')}>
                            {user?.firstName?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div onClick={() => navTo('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Home</span></div>
                        <div className="nav-item active"><Users size={18} /> <span>Attendance</span></div>
                        <div onClick={() => navTo('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div onClick={() => navTo('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div onClick={() => navTo('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div onClick={() => navTo('/courses')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Courses</span></div>
                        <div onClick={() => navTo('/calendar')} className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Calendar</span></div>
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
                        <h1>Attendance</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                        <Bell size={20} color="#555" />
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }} />
                    </div>
                </header>

                <div style={{ padding: '1.5rem 2rem', flex: 1 }}>
                    {loading ? (
                        <div style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Loading attendance data...</div>
                    ) : (
                        <>
                            {/* Overall Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', padding: '2rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Donut pct={overall.pct} size={130} stroke={12} color="#66d9e8" />
                                        <div style={{ position: 'absolute', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111' }}>{overall.pct}%</div>
                                            <div style={{ fontSize: '0.65rem', color: '#888', fontWeight: 500 }}>Overall</div>
                                        </div>
                                    </div>
                                    {streak > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600, color: '#dc2626' }}>
                                            <Flame size={14} color="#dc2626" /> {streak} day streak
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        {[
                                            { label: 'Total Sessions', val: overall.total, color: '#111' },
                                            { label: 'Attended', val: overall.attended, color: '#16a34a' },
                                            { label: 'Missed', val: overall.missed, color: '#dc2626' },
                                        ].map((s, i) => (
                                            <div key={i} style={{ flex: 1, padding: '12px 16px', background: '#fafafa', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.val}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {overall.pct < 75 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.78rem', color: '#dc2626', fontWeight: 500 }}>
                                            <AlertCircle size={14} /> Attendance below 75% — at risk of debarment
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Per-Course Breakdown */}
                            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '0.95rem' }}>Per-Course Breakdown</div>
                                {courses.length === 0 ? (
                                    <div style={{ padding: '2rem', color: '#888', textAlign: 'center', fontSize: '0.85rem' }}>No course enrollment data found.</div>
                                ) : courses.map((c, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 1.5rem', borderBottom: i < courses.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                                        <MiniDonut pct={c.pct} color={c.color} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111' }}>{c.course_name}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#888' }}>{c.faculty_name || ''}</div>
                                            <div style={{ height: '5px', background: '#f0f0f0', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                                                <div style={{ width: `${c.pct}%`, height: '100%', background: c.color, borderRadius: '4px', transition: 'width 0.8s ease' }} />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 700, color: c.pct >= 75 ? '#16a34a' : '#dc2626' }}>{c.pct}%</div>
                                            <div style={{ fontSize: '0.7rem', color: '#888' }}>{c.attended}/{c.total}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Session History */}
                            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Session History</div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button onClick={() => setSelectedCourse('all')} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid ' + (selectedCourse === 'all' ? '#111' : '#e8e8e8'), background: selectedCourse === 'all' ? '#111' : '#fff', color: selectedCourse === 'all' ? '#fff' : '#555', fontSize: '0.75rem', cursor: 'pointer' }}>All</button>
                                        {courses.slice(0, 3).map((c, i) => (
                                            <button key={i} onClick={() => setSelectedCourse(c.course_id)} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid ' + (selectedCourse === c.course_id ? c.color : '#e8e8e8'), background: selectedCourse === c.course_id ? c.color + '20' : '#fff', color: '#555', fontSize: '0.75rem', cursor: 'pointer' }}>{c.course_code || c.course_name}</button>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                    {filteredSessions.length === 0 ? (
                                        <div style={{ padding: '2rem', color: '#888', textAlign: 'center', fontSize: '0.85rem' }}>No sessions found.</div>
                                    ) : filteredSessions.map((s, i) => (
                                        <div key={s.id || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 1.5rem', borderBottom: i < filteredSessions.length - 1 ? '1px solid #f8f8f8' : 'none' }}>
                                            {statusIcon(s.status)}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111' }}>{s.course_name} — {s.title}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#888' }}>{new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                            </div>
                                            <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, background: statusColor(s.status) + '15', color: statusColor(s.status) }}>
                                                {s.status || '—'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
