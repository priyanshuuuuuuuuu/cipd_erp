'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight, Clock, MapPin,
    User, ChevronRight as Arrow
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

const MOCK_COURSES = [
    { id: 'cs301', code: 'CS301', name: 'Data Structures & Algorithms', faculty_name: 'Prof. Anuj Grover', schedule: 'Mon, Wed, Fri · 9:00 AM', venue: 'LHC-101', sessions_count: 24, materials_count: 18, assignments_count: 5 },
    { id: 'phy201', code: 'PHY201', name: 'Quantum Physics', faculty_name: 'Dr. Priya Sharma', schedule: 'Tue, Thu · 11:00 AM', venue: 'C-102', sessions_count: 20, materials_count: 12, assignments_count: 3 },
    { id: 'math101', code: 'MATH101', name: 'Calculus II', faculty_name: 'Prof. Amit Patel', schedule: 'Mon, Wed · 2:00 PM', venue: 'LHC-201', sessions_count: 22, materials_count: 15, assignments_count: 4 },
    { id: 'eng102', code: 'ENG102', name: 'Technical Writing', faculty_name: 'Dr. Neha Gupta', schedule: 'Tue · 10:00 AM', venue: 'Lab 3', sessions_count: 14, materials_count: 8, assignments_count: 6 },
    { id: 'cs202', code: 'CS202', name: 'Database Management Systems', faculty_name: 'Dr. Sameer Verma', schedule: 'Wed, Fri · 3:00 PM', venue: 'Lecture Hall B', sessions_count: 18, materials_count: 10, assignments_count: 3 },
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
            const data = await api.get('/api/students/courses');
            const fetched = data.courses || [];
            setCourses(fetched.length > 0 ? fetched : MOCK_COURSES);
        } catch {
            setCourses(MOCK_COURSES);
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
                        <div
                            className="user-avatar"
                            style={{ background: '#0b6861', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                            onClick={() => navTo('/profile')}
                        >
                            {user?.firstName?.[0]?.toUpperCase() || 'S'}
                        </div>
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
                        <div className="search-bar">
                            <Search size={16} color="#aaa" />
                            <input
                                type="text"
                                placeholder="Search courses..."
                                className="search-input"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }} />
                    </div>
                </header>

                <div style={{ padding: '1.5rem 2rem', flex: 1 }}>
                    {loading ? (
                        <div style={{ color: '#aaa', textAlign: 'center', padding: '4rem' }}>Loading courses...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8' }}>
                            <BookOpen size={40} color="#e8e8e8" style={{ marginBottom: '12px' }} />
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#555' }}>
                                {search ? 'No courses match your search' : 'No enrolled courses found'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '6px' }}>
                                Courses you are enrolled in will appear here.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#888' }}>
                                {filtered.length} course{filtered.length !== 1 ? 's' : ''} enrolled
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                                {filtered.map((course, i) => {
                                    const palette = COURSE_COLORS[i % COURSE_COLORS.length];
                                    return (
                                        <div
                                            key={course.id || i}
                                            onClick={() => navTo(`/courses/${course.id}`)}
                                            style={{
                                                background: '#fff',
                                                borderRadius: '16px',
                                                border: '1px solid #e8e8e8',
                                                padding: '1.5rem',
                                                cursor: 'pointer',
                                                transition: 'transform 0.2s, box-shadow 0.2s',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.07)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'; }}
                                        >
                                            {/* Color accent strip */}
                                            <div style={{ width: '100%', height: '4px', background: palette.dot, borderRadius: '4px', marginBottom: '1.2rem', opacity: 0.7 }} />

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: palette.text, background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: '20px', padding: '2px 10px', display: 'inline-block', marginBottom: '6px' }}>
                                                        {course.code || 'Course'}
                                                    </div>
                                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111', lineHeight: 1.3 }}>
                                                        {course.name || 'Unnamed Course'}
                                                    </h3>
                                                </div>
                                                <Arrow size={16} color="#aaa" style={{ marginTop: '4px', flexShrink: 0 }} />
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: '#777', borderTop: '1px solid #f5f5f5', paddingTop: '1rem' }}>
                                                {course.faculty_name && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <User size={12} color="#aaa" /> {course.faculty_name}
                                                    </div>
                                                )}
                                                {course.schedule && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Clock size={12} color="#aaa" /> {course.schedule}
                                                    </div>
                                                )}
                                                {course.venue && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <MapPin size={12} color="#aaa" /> {course.venue}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quick stats row */}
                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                                {course.sessions_count != null && (
                                                    <div style={{ fontSize: '0.72rem', color: '#888' }}>
                                                        <span style={{ fontWeight: 700, color: '#333', fontSize: '0.9rem' }}>{course.sessions_count}</span> sessions
                                                    </div>
                                                )}
                                                {course.materials_count != null && (
                                                    <div style={{ fontSize: '0.72rem', color: '#888' }}>
                                                        <span style={{ fontWeight: 700, color: '#333', fontSize: '0.9rem' }}>{course.materials_count}</span> materials
                                                    </div>
                                                )}
                                                {course.assignments_count != null && (
                                                    <div style={{ fontSize: '0.72rem', color: '#888' }}>
                                                        <span style={{ fontWeight: 700, color: '#333', fontSize: '0.9rem' }}>{course.assignments_count}</span> assignments
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
