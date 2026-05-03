'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight, Clock, MapPin,
    User, ChevronRight as Arrow, Trophy
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

const COURSE_COLORS = [
    { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af', dot: '#3b82f6' },
    { bg: '#e0fdf4', border: '#6ee7b7', text: '#065f46', dot: '#10b981' },
    { bg: '#fce7f3', border: '#f9a8d4', text: '#9d174d', dot: '#ec4899' },
    { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', dot: '#f59e0b' },
    { bg: '#ede9fe', border: '#c4b5fd', text: '#4c1d95', dot: '#8b5cf6' },
    { bg: '#ffedd5', border: '#fdba74', text: '#7c2d12', dot: '#f97316' },
];

export default function CoursesPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const fetchCourses = useCallback(async () => {
        try {
            const data = await api.get('/api/courses');
            setCourses(data.courses || []);
        } catch (e) {
            console.error('Failed to fetch courses:', e);
            setCourses([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchCourses(); }, [fetchCourses, authReady]);

    const filtered = courses.filter(c => {
        const q = search.toLowerCase();
        return !q
            || (c.name || '').toLowerCase().includes(q)
            || (c.code || '').toLowerCase().includes(q)
            || (c.faculty_name || '').toLowerCase().includes(q);
    });

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
                        <div onClick={() => navTo('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div onClick={() => navTo('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div onClick={() => navTo('/leaderboard')} className="nav-item" style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
                        <div className="nav-item active"><BookOpen size={18} /> <span>Courses</span></div>
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
                        <h1>Courses</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search courses..." className="search-input" value={search} onChange={e => setSearch(e.target.value)} /></div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }} />
                    </div>
                </header>

                {loading ? (
                    <div style={{ padding: '1.5rem 2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>{[1,2,3,4].map(i => (
                            <div key={i} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '1.5rem' }}>
                                <div style={{ width: '60px', height: '20px', borderRadius: '6px', background: '#f0f0f0', marginBottom: '12px', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                <div style={{ width: `${60 + i * 8}%`, height: '14px', borderRadius: '4px', background: '#f0f0f0', marginBottom: '16px', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                                <div style={{ width: '50%', height: '10px', borderRadius: '3px', background: '#f5f5f5', marginBottom: '8px', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.25}s` }} />
                                <div style={{ width: '40%', height: '10px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.3}s` }} />
                            </div>
                        ))}</div>
                    </div>
                ) : (
                    <div style={{ padding: '1.5rem 2rem', flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem' }}>{filtered.length} course{filtered.length !== 1 ? 's' : ''} enrolled</div>

                        {filtered.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8' }}>
                                <BookOpen size={40} color="#e0e0e0" style={{ marginBottom: '12px' }} />
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#555' }}>No courses found</div>
                                <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '6px' }}>Try adjusting your search term.</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                                {filtered.map((course, i) => {
                                    const color = COURSE_COLORS[i % COURSE_COLORS.length];
                                    return (
                                        <div key={course.id || i}
                                            onClick={() => navTo(`/courses/${course.id}`)}
                                            style={{
                                                background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px',
                                                padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s',
                                                position: 'relative', overflow: 'hidden',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        >
                                            {/* Color strip */}
                                            <div style={{ position: 'absolute', top: 0, left: '1.5rem', right: '1.5rem', height: '4px', borderRadius: '0 0 4px 4px', background: color.dot }} />

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.5rem', marginBottom: '0.8rem' }}>
                                                <span style={{ background: color.bg, color: color.text, padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px' }}>{course.code}</span>
                                                <Arrow size={16} color="#ccc" />
                                            </div>

                                            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111', margin: '0 0 0.8rem' }}>{course.name}</h3>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '1rem' }}>
                                                {course.faculty_name && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#888' }}>
                                                        <User size={12} color="#bbb" /> {course.faculty_name}
                                                    </div>
                                                )}
                                                {course.schedule && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#888' }}>
                                                        <Clock size={12} color="#bbb" /> {course.schedule}
                                                    </div>
                                                )}
                                                {course.venue && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#888' }}>
                                                        <MapPin size={12} color="#bbb" /> {course.venue}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.8rem', borderTop: '1px solid #f5f5f5' }}>
                                                {course.sessions_count != null && <span style={{ fontSize: '0.75rem', color: '#888' }}><strong style={{ color: '#333' }}>{course.sessions_count}</strong> sessions</span>}
                                                {course.materials_count != null && <span style={{ fontSize: '0.75rem', color: '#888' }}><strong style={{ color: '#333' }}>{course.materials_count}</strong> materials</span>}
                                                {course.assignments_count != null && <span style={{ fontSize: '0.75rem', color: '#888' }}><strong style={{ color: '#333' }}>{course.assignments_count}</strong> assignments</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <style>{`@keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
        </div>
    );
}
