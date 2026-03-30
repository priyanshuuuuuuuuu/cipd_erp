'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight, TrendingUp
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
    const [search, setSearch] = useState('');

    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const fetchGrades = useCallback(async () => {
        try {
            const data = await api.get('/api/students/assignments');
            const all = data.assignments || [];
            
            // Filter only assignments that have a submission WITH a grade
            const graded = all.filter(a => a.submission && a.submission.grade != null);
            
            setGrades(graded.map(a => {
                const total = a.total_marks || 100; // real DB value (default 100 from Phase 2 migration)
                return {
                    id: a.id,
                    title: a.title,
                    course_name: a.courses?.name || 'Unknown Course',
                    due_date: a.due_date,
                    marks: a.submission.grade,
                    total_marks: total,
                    percentage: Math.round((a.submission.grade / total) * 100)
                };
            }));
        } catch (e) {
            console.error('Failed to fetch grades:', e);
            setGrades([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchGrades(); }, [fetchGrades, authReady]);

    const filtered = grades.filter(g => {
        const q = search.toLowerCase();
        return !q || (g.title || '').toLowerCase().includes(q) || (g.course_name || '').toLowerCase().includes(q);
    });

    const avgPercentage = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + (g.percentage || 0), 0) / grades.length) : 0;

    const pctColor = (p) => p >= 85 ? '#16a34a' : p >= 70 ? '#b45309' : '#dc2626';
    const pctBg = (p) => p >= 85 ? '#dcfce7' : p >= 70 ? '#fef9c3' : '#fee2e2';

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
                        <div className="nav-item active"><BookOpen size={18} /> <span>Grades</span></div>
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
                        <h1>Grades</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search assignments..." className="search-input" value={search} onChange={e => setSearch(e.target.value)} /></div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }} />
                    </div>
                </header>

                {loading ? (
                    <div style={{ color: '#aaa', textAlign: 'center', padding: '4rem' }}>Loading grades...</div>
                ) : (
                    <div style={{ padding: '1.5rem 2rem', flex: 1 }}>
                        {/* Summary bar */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', padding: '1rem 1.5rem', flex: 1, minWidth: '180px' }}>
                                <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px' }}>Average Score</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <span style={{ fontSize: '1.6rem', fontWeight: 700, color: pctColor(avgPercentage) }}>{avgPercentage}%</span>
                                    <TrendingUp size={16} color={pctColor(avgPercentage)} />
                                </div>
                            </div>
                            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', padding: '1rem 1.5rem', flex: 1, minWidth: '180px' }}>
                                <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px' }}>Graded Assignments</div>
                                <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#333' }}>{grades.length}</span>
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8' }}>
                                <TrendingUp size={40} color="#e8e8e8" style={{ marginBottom: '12px' }} />
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#555' }}>No graded assignments yet</div>
                                <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '6px' }}>Grades will appear here once your assignments are evaluated.</div>
                            </div>
                        ) : (
                            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', overflow: 'hidden' }}>
                                {/* Table header */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', padding: '10px 1.5rem', background: '#fafafa', borderBottom: '1px solid #f0f0f0', fontSize: '0.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', gap: '1rem' }}>
                                    <div>Assignment</div>
                                    <div>Course</div>
                                    <div style={{ textAlign: 'center' }}>Score</div>
                                    <div style={{ textAlign: 'center', minWidth: '70px' }}>Grade</div>
                                </div>
                                {filtered.map((g, i) => (
                                    <div key={g.id || i} style={{
                                        display: 'grid', gridTemplateColumns: '1fr 1fr auto auto',
                                        padding: '14px 1.5rem', borderBottom: i < filtered.length - 1 ? '1px solid #f8f8f8' : 'none',
                                        alignItems: 'center', gap: '1rem', transition: 'background 0.15s',
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111' }}>{g.title}</div>
                                            {g.due_date && <div style={{ fontSize: '0.7rem', color: '#bbb', marginTop: '2px' }}>{new Date(g.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#777' }}>{g.course_name || '—'}</div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111', textAlign: 'center', minWidth: '60px' }}>
                                            {g.marks}/{g.total_marks}
                                        </div>
                                        <div style={{ textAlign: 'center', minWidth: '70px' }}>
                                            <span style={{
                                                padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                                                background: pctBg(g.percentage), color: pctColor(g.percentage),
                                            }}>
                                                {g.percentage}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
