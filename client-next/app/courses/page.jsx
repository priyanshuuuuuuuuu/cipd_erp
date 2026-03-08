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

    useEffect(() => {
        if (!authReady) return;
        api.get('/api/courses')
            .then(d => setCourses(d.courses || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [authReady]);

    const filtered = courses.filter(c => {
        const q = search.toLowerCase();
        return !q || c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q);
    });

    const COLORS = ['#0b6861','#7c3aed','#2563eb','#e91e87','#c2410c','#065f46','#1d4ed8','#b45309'];

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
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div onClick={() => navTo('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18}/> <span>Home</span></div>
                        <div onClick={() => navTo('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18}/> <span>Attendance</span></div>
                        <div onClick={() => navTo('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18}/> <span>Grades</span></div>
                        <div onClick={() => navTo('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18}/> <span>Teachers</span></div>
                        <div onClick={() => navTo('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18}/> <span>Feedback</span></div>
                        <div className="nav-item active"><BookOpen size={18}/> <span>Courses</span></div>
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
                        <h1>My Courses</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa"/><input value={search} onChange={e => setSearch(e.target.value)} type="text" placeholder="Search courses..." className="search-input"/></div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }}/>
                    </div>
                </header>

                <div style={{ padding: '1.5rem 2rem', flex: 1 }}>
                    {loading ? (
                        <div style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Loading courses...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8' }}>
                            <BookOpen size={40} color="#e8e8e8" style={{ marginBottom: '12px' }} />
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#555' }}>No courses found</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                            {filtered.map((c, i) => {
                                const color = COLORS[i % COLORS.length];
                                const faculty = c.faculty?.users;
                                return (
                                    <div key={c.id} onClick={() => navTo(`/courses/${c.id}`)} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e8e8e8', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                                        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'}>
                                        <div style={{ height: '6px', background: color }} />
                                        <div style={{ padding: '1.2rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{c.code || c.id?.slice(0,6)}</div>
                                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', lineHeight: 1.3 }}>{c.name}</div>
                                                </div>
                                                <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600, background: '#ecfdf5', color: '#065f46', flexShrink: 0 }}>Active</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', color: '#777' }}>
                                                {faculty && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <User size={12} /> {faculty.first_name} {faculty.last_name}
                                                    </div>
                                                )}
                                                {c.venue && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <MapPin size={12} /> {c.venue}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.72rem', color: '#888' }}>{c.enrolled_count || 0} students enrolled</span>
                                                <span style={{ fontSize: '0.72rem', color: '#888' }}>{c.total_sessions || 0} sessions</span>
                                            </div>
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
