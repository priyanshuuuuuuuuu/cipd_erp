'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight, Mail, Phone
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

export default function TeachersPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [faculty, setFaculty] = useState([]);
    const [loading, setLoading] = useState(true);

    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    useEffect(() => {
        if (!authReady) return;
        api.get('/api/faculty')
            .then(d => setFaculty(d.faculty || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [authReady]);

    const filtered = faculty.filter(f => {
        const name = `${f.users?.first_name || ''} ${f.users?.last_name || ''}`.toLowerCase();
        const dept = (f.department || '').toLowerCase();
        const q = search.toLowerCase();
        return !q || name.includes(q) || dept.includes(q);
    });

    const getInitials = (f) => {
        const fn = f.users?.first_name?.[0] || '';
        const ln = f.users?.last_name?.[0] || '';
        return (fn + ln).toUpperCase() || 'F';
    };

    const avatarColors = ['#0b6861','#7c3aed','#2563eb','#e91e87','#c2410c','#065f46'];

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
                        <div onClick={() => navTo('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Home</span></div>
                        <div onClick={() => navTo('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Attendance</span></div>
                        <div onClick={() => navTo('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div className="nav-item active"><Users size={18} /> <span>Teachers</span></div>
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
                        <h1>Faculty</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar">
                            <Search size={16} color="#aaa" />
                            <input type="text" placeholder="Search faculty..." className="search-input" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }} />
                    </div>
                </header>

                <div style={{ padding: '1.5rem 2rem' }}>
                    {loading ? (
                        <div style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Loading faculty...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ color: '#888', textAlign: 'center', padding: '3rem', fontSize: '0.88rem' }}>
                            {search ? 'No faculty matching your search.' : 'No faculty members found.'}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                            {filtered.map((f, i) => {
                                const name = `${f.users?.first_name || ''} ${f.users?.last_name || ''}`.trim();
                                const email = f.users?.email || '';
                                const dept = f.department || 'Faculty';
                                return (
                                    <div key={f.id || i} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e8e8e8', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'box-shadow 0.2s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: avatarColors[i % avatarColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
                                                {getInitials(f)}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111' }}>{name || 'Faculty Member'}</div>
                                                <div style={{ fontSize: '0.72rem', color: avatarColors[i % avatarColors.length], fontWeight: 600, marginTop: '2px' }}>{dept}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', color: '#777' }}>
                                            {email && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Mail size={12} /> {email}
                                                </div>
                                            )}
                                            {f.phone && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Phone size={12} /> {f.phone}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ paddingTop: '10px', borderTop: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.72rem', color: '#888' }}>
                                                {f.courses_count || 0} {f.courses_count === 1 ? 'course' : 'courses'}
                                            </span>
                                            <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600, background: '#ecfdf5', color: '#065f46' }}>Active</span>
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
