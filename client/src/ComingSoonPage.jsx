import React, { useState } from 'react';
import './Dashboard.css';
import {
    LayoutGrid,
    Calendar,
    BookOpen,
    Users,
    MessageSquare,
    Settings,
    LogOut,
    Bell,
    Search,
    ChevronLeft,
    ChevronRight,
    Menu,
    Construction
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const ComingSoonPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Determine title from path
    const getPageTitle = () => {
        const path = location.pathname.replace('/', '');
        return path.charAt(0).toUpperCase() + path.slice(1);
    };

    const handleLogout = () => {
        navigate('/');
    };

    // Helper to check active link (rough)
    const isActive = (path) => location.pathname === path;

    return (
        <div className="dashboard-container">
            {/* Sidebar Overlay (Mobile) */}
            <div
                className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar">
                            <img src="/studentPic.png" alt="Student" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        </div>
                        <div className="user-info">
                            <h3>Student</h3>
                            <p>student@gmail.com</p>
                        </div>
                        <div
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            style={{
                                position: 'absolute',
                                right: '-12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: '#1a1a1a',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                border: '1px solid #333',
                                color: '#888',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                            }}
                        >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>

                    <nav className="nav-menu">
                        <div onClick={() => navigate('/dashboard')} className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                            <LayoutGrid size={18} /> <span>Home</span>
                        </div>
                        <div onClick={() => navigate('/attendance')} className={`nav-item ${isActive('/attendance') ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                            <Users size={18} /> <span>Attendance</span>
                        </div>
                        <div onClick={() => navigate('/grades')} className={`nav-item ${isActive('/grades') ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                            <BookOpen size={18} /> <span>Grades</span>
                        </div>
                        <div onClick={() => navigate('/teachers')} className={`nav-item ${isActive('/teachers') ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                            <Users size={18} /> <span>Teachers</span>
                        </div>
                        <div onClick={() => navigate('/feedback')} className={`nav-item ${isActive('/feedback') ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                            <MessageSquare size={18} /> <span>Feedback</span>
                        </div>
                        <div onClick={() => navigate('/courses')} className={`nav-item ${isActive('/courses') ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                            <BookOpen size={18} /> <span>Courses</span>
                        </div>
                        <div onClick={() => navigate('/calendar')} className={`nav-item ${isActive('/calendar') ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                            <Calendar size={18} /> <span>Calendar</span>
                        </div>
                    </nav>
                </div>

                <div className="sidebar-footer">
                    <div onClick={() => navigate('/settings')} className={`nav-item ${isActive('/settings') ? 'active' : ''}`} style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    <div className="nav-item" onClick={handleLogout} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content" style={{ flexDirection: 'column', overflowY: 'auto' }}>
                <header className="dashboard-header" style={{ padding: '1rem 2rem', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}>
                            <Menu size={24} />
                        </div>
                        <h1>{getPageTitle()}</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar">
                            <Search size={16} color="#aaa" />
                            <input type="text" placeholder="Search" className="search-input" />
                        </div>
                        <Bell size={20} color="#555" />
                        <MessageSquare size={20} color="#555" />
                        <img src="/logo.png" alt="Logo" style={{ height: '35px', marginLeft: '0.5rem' }} />
                    </div>
                </header>

                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#888',
                    gap: '1rem',
                    textAlign: 'center',
                    padding: '2rem'
                }}>
                    <div style={{
                        background: '#f5f5f5',
                        padding: '3rem',
                        borderRadius: '50%',
                        marginBottom: '1rem'
                    }}>
                        <Construction size={64} strokeWidth={1} color="#aaa" />
                    </div>
                    <h2 style={{ fontSize: '2rem', color: '#333', margin: 0 }}>Work in Progress</h2>
                    <p style={{ maxWidth: '400px' }}>
                        We are currently working hard to bring you the <strong>{getPageTitle()}</strong> feature. Stay tuned!
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{
                            padding: '10px 24px',
                            background: '#111',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginTop: '1rem',
                            fontWeight: '500'
                        }}
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComingSoonPage;
