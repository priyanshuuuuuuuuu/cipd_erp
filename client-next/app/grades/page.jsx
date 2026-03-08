'use client';

import React, { useState, useEffect } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight, FileText, TrendingUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

export default function GradesPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [grades, setGrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    useEffect(() => {
        if (!authReady) return;
        api.get('/api/grades')
            .then(d => setGrades(d.grades || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [authReady]);

    const getGradeColor = (pct) => {
        if (pct >= 85) return '#16a34a';
        if (pct >= 70) return '#2563eb';
        if (pct >= 55) return '#b45309';
        return '#dc2626';
    };

    const getGradeLetter = (pct) => {
        if (pct >= 90) return 'A+';
        if (pct >= 80) return 'A';
        if (pct >= 70) return 'B';
        if (pct >= 60) return 'C';
        if (pct >= 50) return 'D';
        return 'F';
    };

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
                        <div onClick={() => navTo('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18}/> <span>Home</span></div>
                        <div onClick={() => navTo('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18}/> <span>Attendance</span></div>
                        <div className="nav-item active"><BookOpen size={18}/> <span>Grades</span></div>
                        <div onClick={() => navTo('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18}/> <span>Teachers</span></div>
                        <div onClick={() => navTo('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18}/> <span>Feedback</span></div>
                        <div onClick={() => navTo('/courses')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18}/> <span>Courses</span></div>
                        <div onClick={() => navTo('/calendar')} className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18}/> <span>Calendar</span></div>
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
                        <h1>Grades</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa"/><input type="text" placeholder="Search" className="search-input"/></div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }}/>
                    </div>
                </header>

                <div style={{ padding: '1.5rem 2rem', flex: 1 }}>
                    {loading ? (
                        <div style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Loading grades...</div>
                    ) : grades.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8' }}>
                            <TrendingUp size={40} color="#e8e8e8" style={{ marginBottom: '12px' }} />
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#555' }}>No graded assignments yet</div>
                            <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '6px' }}>Grades will appear here once your assignments are evaluated.</div>
                        </div>
                    ) : (
                        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', padding: '10px 1.5rem', background: '#fafafa', borderBottom: '1px solid #f0f0f0', fontSize: '0.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', gap: '1rem' }}>
                                <div>Assignment</div>
                                <div>Course</div>
                                <div style={{ textAlign: 'center' }}>Marks</div>
                                <div style={{ textAlign: 'center' }}>Grade</div>
                                <div>Date</div>
                            </div>
                            {grades.map((g, i) => {
                                const pct = g.total_marks ? Math.round((g.marks / g.total_marks) * 100) : null;
                                return (
                                    <div key={g.id || i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', padding: '14px 1.5rem', borderBottom: i < grades.length - 1 ? '1px solid #f8f8f8' : 'none', alignItems: 'center', gap: '1rem' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <FileText size={14} color="#16a34a" />
                                                </div>
                                                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111' }}>{g.title}</span>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#777' }}>{g.course_name}</div>
                                        <div style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 700, color: pct !== null ? getGradeColor(pct) : '#888' }}>
                                            {g.marks !== null ? `${g.marks}/${g.total_marks}` : 'Pending'}
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            {pct !== null ? (
                                                <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, background: getGradeColor(pct) + '18', color: getGradeColor(pct) }}>
                                                    {getGradeLetter(pct)}
                                                </span>
                                            ) : '—'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                                            {g.submitted_at ? new Date(g.submitted_at).toLocaleDateString('en-GB') : '—'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
