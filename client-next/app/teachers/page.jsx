'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Bell, Search, ChevronLeft, ChevronRight, Menu, Mail, Phone, MoreHorizontal
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

export default function TeachersPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState('All Teachers');
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);

    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const fetchData = useCallback(async () => {
        try {
            const d = await api.get('/api/faculty');
            setTeachers(d.faculty || []);
        } catch {
            // keep empty
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchData(); }, [fetchData, authReady]);

    const filters = ['All Teachers', ...new Set(teachers.map(t => t.department).filter(Boolean))];
    const filtered = activeFilter === 'All Teachers' ? teachers : teachers.filter(t => t.department === activeFilter);

    const navTo = (p) => router.push(p);

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
                        <div className="nav-item active" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
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
                        <h1>Teachers</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                        <MessageSquare size={20} color="#555" />
                        <img src="/logo.png" alt="Logo" style={{ height: '35px', marginLeft: '0.5rem' }} />
                    </div>
                </header>

                <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="filters-scroll-container" style={{ overflowX: 'auto', paddingBottom: '5px' }}>
                        <div style={{ display: 'flex', gap: '1rem', minWidth: 'max-content' }}>
                            {filters.map(filter => (
                                <button key={filter} onClick={() => setActiveFilter(filter)} style={{ padding: '8px 20px', borderRadius: '25px', border: activeFilter === filter ? '1px solid #111' : '1px solid #e0e0e0', background: activeFilter === filter ? '#111' : 'transparent', color: activeFilter === filter ? '#fff' : '#888', cursor: 'pointer', fontSize: '0.9rem', fontWeight: activeFilter === filter ? '500' : '400', transition: 'all 0.2s' }}>
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="teachers-grid">
                        {loading ? (
                            <div style={{ color: '#aaa', fontSize: '0.85rem' }}>Loading teachers...</div>
                        ) : filtered.length === 0 ? (
                            <div style={{ color: '#aaa', fontSize: '0.85rem' }}>No teachers found.</div>
                        ) : filtered.map((teacher, index) => (
                            <div key={teacher.id || index} className="teacher-card">
                                <span className="dept-pill">{teacher.department || 'Faculty'}</span>
                                <div className="teacher-img-container">
                                    <img src={teacher.photo_url || '/anujsir.jpg'} alt={teacher.name} className="teacher-img"
                                        onError={e => { e.target.src = '/anujsir.jpg'; }} />
                                </div>
                                <h3 style={{ fontSize: '1.1rem', margin: '0 0 5px 0' }}>
                                    {teacher.users ? `${teacher.users.first_name} ${teacher.users.last_name}` : teacher.name}
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#888', margin: 0, textDecoration: 'underline' }}>
                                    {teacher.users?.email || teacher.email || ''}
                                </p>
                                <div className="teacher-actions">
                                    <button className="action-btn"><Mail size={18} /></button>
                                    <button className="action-btn"><Phone size={18} /></button>
                                    <button className="action-btn"><MoreHorizontal size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
