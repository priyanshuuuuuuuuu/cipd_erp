import React, { useState } from 'react';
import './Dashboard.css'; // Reuse existing styles
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
    Menu // Hamburger
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CalendarPage = () => {
    const navigate = useNavigate();
    const [view, setView] = useState('week'); // 'day', 'week', 'month'
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        navigate('/');
    };

    return (
        <div className="dashboard-container">
            {/* Sidebar Overlay (Mobile) */}
            <div
                className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Sidebar (Reused) */}
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
                        <div onClick={() => navigate('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}>
                            <LayoutGrid size={18} /> <span>Home</span>
                        </div>
                        <div onClick={() => navigate('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}>
                            <Users size={18} /> <span>Attendance</span>
                        </div>
                        <div onClick={() => navigate('/grades')} className="nav-item" style={{ cursor: 'pointer' }}>
                            <BookOpen size={18} /> <span>Grades</span>
                        </div>
                        <div className="nav-item" onClick={() => navigate('/teachers')} style={{ cursor: 'pointer' }}>
                            <Users size={18} /> <span>Teachers</span>
                        </div>
                        <div onClick={() => navigate('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}>
                            <MessageSquare size={18} /> <span>Feedback</span>
                        </div>
                        <div onClick={() => navigate('/courses')} className="nav-item" style={{ cursor: 'pointer' }}>
                            <BookOpen size={18} /> <span>Courses</span>
                        </div>
                        <div className="nav-item active">
                            <Calendar size={18} /> <span>Calendar</span>
                        </div>
                    </nav>
                </div>

                <div className="sidebar-footer">
                    <div onClick={() => navigate('/settings')} className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    <div className="nav-item" onClick={handleLogout} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content" style={{ flexDirection: 'column', overflowY: 'auto' }}>
                <header className="dashboard-header" style={{ padding: '1rem 2rem', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Mobile Menu Button */}
                        <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}>
                            <Menu size={24} />
                        </div>
                        <h1>Calendar</h1>
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

                <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
                    {/* Calendar Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>Jan 2026</h2>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
                                <button style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><ChevronRight size={20} /></button>
                            </div>
                        </div>
                        <div style={{ background: '#f5f5f5', padding: '4px', borderRadius: '20px', display: 'flex', gap: '5px' }}>
                            <button
                                onClick={() => setView('day')}
                                style={{ border: 'none', background: view === 'day' ? '#111' : 'transparent', color: view === 'day' ? '#fff' : '#000', padding: '6px 16px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: view === 'day' ? '600' : '400', cursor: 'pointer' }}>Day</button>
                            <button
                                onClick={() => setView('week')}
                                style={{ border: 'none', background: view === 'week' ? '#111' : 'transparent', color: view === 'week' ? '#fff' : '#000', padding: '6px 16px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: view === 'week' ? '600' : '400', cursor: 'pointer' }}>Week</button>
                            <button
                                onClick={() => setView('month')}
                                style={{ border: 'none', background: view === 'month' ? '#111' : 'transparent', color: view === 'month' ? '#fff' : '#000', padding: '6px 16px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: view === 'month' ? '600' : '400', cursor: 'pointer' }}>Month</button>
                        </div>
                    </div>

                    {/* VIEW RENDRING LOGIC */}
                    <div className="calendar-view-container" style={{ display: 'flex', flex: 1, border: '1px solid #f0f0f0', borderRadius: '12px', padding: '10px', overflow: 'hidden', flexDirection: 'column' }}>

                        {/* ---------------- DAY VIEW ---------------- */}
                        {view === 'day' && (
                            <div style={{ display: 'flex', height: '100%', overflowY: 'auto' }}>
                                <div style={{ width: '80px', display: 'flex', flexDirection: 'column', paddingRight: '10px' }}>
                                    {['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'].map(time => (
                                        <div key={time} style={{ height: '80px', fontSize: '0.75rem', color: '#888', textAlign: 'right', paddingRight: '10px', borderBottom: '1px solid transparent' }}>{time}</div>
                                    ))}
                                </div>
                                <div style={{ flex: 1, borderLeft: '1px solid #f0f0f0', position: 'relative' }}>
                                    {/* Mock Events for Day View */}
                                    <div style={{ background: '#e0f2fe', padding: '15px', borderRadius: '12px', position: 'absolute', top: '10px', left: '10px', right: '10px', height: '140px', border: '1px solid #bae6fd' }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0369a1' }}>8:00 AM - 10:00 AM</div>
                                        <h3 style={{ margin: '5px 0', fontSize: '1.1rem' }}>Course 1: Advanced Mathematics</h3>
                                        <p style={{ color: '#555', fontSize: '0.85rem' }}>Lecture Hall C • Prof. Anuj Grover</p>
                                    </div>
                                    <div style={{ background: '#f3e8ff', padding: '15px', borderRadius: '12px', position: 'absolute', top: '180px', left: '10px', right: '10px', height: '100px', border: '1px solid #e9d5ff' }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#7e22ce' }}>11:00 AM - 12:30 PM</div>
                                        <h3 style={{ margin: '5px 0', fontSize: '1.1rem' }}>Course 3: Physics Lab</h3>
                                        <p style={{ color: '#555', fontSize: '0.85rem' }}>Lab 4 • Dr. Sameer Verma</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ---------------- WEEK VIEW ---------------- */}
                        {view === 'week' && (
                            <div style={{ display: 'flex', flex: 1 }}>
                                {/* Time Column */}
                                <div style={{ width: '80px', display: 'flex', flexDirection: 'column', paddingRight: '10px', marginTop: '50px' }}>
                                    {['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM'].map(time => (
                                        <div key={time} style={{ height: '120px', fontSize: '0.75rem', color: '#888', textAlign: 'right', paddingRight: '10px' }}>{time}</div>
                                    ))}
                                </div>

                                {/* Days Columns */}
                                <div style={{ flex: 1, display: 'flex' }}>
                                    {['Monday 1', 'Tuesday 2', 'Wednesday 3', 'Thursday 4', 'Friday 5', 'Saturday 6', 'Sunday 7'].map((day, index) => (
                                        <div key={day} style={{ flex: 1, borderLeft: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
                                            {/* Header */}
                                            <div style={{ textAlign: 'center', paddingBottom: '20px', color: '#888', fontSize: '0.9rem', borderBottom: '1px solid #f0f0f0' }}>
                                                <div style={{ fontSize: '0.8rem' }}>{day.split(' ')[0]}</div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: index === 3 ? '700' : '400', color: index === 3 ? '#000' : 'inherit' }}>{day.split(' ')[1]}</div>
                                            </div>

                                            {/* Column Body - Events mock (Same as before) */}
                                            <div style={{ flex: 1, position: 'relative', background: index === 3 ? '#fafafa' : 'transparent', borderLeft: index === 3 ? '1px dashed #ccc' : 'none', borderRight: index === 3 ? '1px dashed #ccc' : 'none' }}>
                                                {index === 0 && ( /* Mon */
                                                    <>
                                                        <div style={{ background: '#e0f2fe', padding: '10px', borderRadius: '12px', position: 'absolute', top: '20px', left: '5px', right: '5px', height: '100px', border: '1px solid #bae6fd' }}>
                                                            <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#0369a1' }}>8 AM</div>
                                                            <div style={{ fontWeight: '700', marginTop: '5px', fontSize: '0.9rem' }}>Course 1</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#555' }}>LHC-101 • Prof. Anuj Grover</div>
                                                        </div>
                                                        <div style={{ background: '#f3e8ff', padding: '10px', borderRadius: '12px', position: 'absolute', top: '350px', left: '5px', right: '5px', height: '140px', border: '1px solid #e9d5ff' }}>
                                                            <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#7e22ce' }}>1 PM</div>
                                                            <img src="/course2.png" alt="" style={{ height: '30px', objectFit: 'contain', margin: '5px 0' }} />
                                                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>Course 2</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#555' }}>C-102 • Dr. Priya Sharma</div>
                                                        </div>
                                                    </>
                                                )}

                                                {index === 2 && ( /* Wed */
                                                    <>
                                                        <div style={{ background: '#ecfccb', padding: '10px', borderRadius: '12px', position: 'absolute', top: '150px', left: '5px', right: '5px', height: '140px', border: '1px solid #d9f99d' }}>
                                                            <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#3f6212' }}>9 AM</div>
                                                            <img src="/course4.png" alt="" style={{ height: '40px', objectFit: 'contain', margin: '5px 0' }} />
                                                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>Course 4</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#555' }}>LHC-201 • Prof. Amit Patel</div>
                                                        </div>
                                                        <div style={{ background: '#fce7f3', padding: '10px', borderRadius: '12px', position: 'absolute', top: '300px', left: '5px', right: '5px', height: '80px', border: '1px solid #fbcfe8' }}>
                                                            <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#be185d' }}>12 PM</div>
                                                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>Course 5</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#555' }}>Lab 3 • Dr. Neha Gupta</div>
                                                        </div>
                                                        <div style={{ background: '#e0fcf5', padding: '10px', borderRadius: '12px', position: 'absolute', top: '400px', left: '5px', right: '5px', height: '140px', border: '1px solid #99f6e4' }}>
                                                            <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#0f766e' }}>2 PM</div>
                                                            <img src="/course3.png" alt="" style={{ height: '40px', objectFit: 'contain', margin: '5px 0' }} />
                                                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>Course 3</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#555' }}>Design Studio • Prof. Anuj Grover</div>
                                                        </div>
                                                    </>
                                                )}

                                                {index === 3 && ( /* Thu */
                                                    <div style={{ background: '#e0f2fe', padding: '10px', borderRadius: '12px', position: 'absolute', top: '180px', left: '5px', right: '5px', height: '120px', border: '1px solid #bae6fd' }}>
                                                        <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#0369a1' }}>10 AM</div>
                                                        <img src="/course3.png" alt="" style={{ height: '30px', objectFit: 'contain', margin: '5px 0' }} />
                                                        <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '5px' }}>Course 7</div>
                                                    </div>
                                                )}
                                                {index === 3 && ( /* Thu */
                                                    <div style={{ background: '#eef2ff', padding: '10px', borderRadius: '12px', position: 'absolute', top: '310px', left: '5px', right: '5px', height: '100px', border: '1px solid #c7d2fe' }}>
                                                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>Course 7</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#555' }}>Lecture Hall B • Dr. Sameer Verma</div>
                                                    </div>
                                                )}

                                                {index === 5 && ( /* Sat */
                                                    <div style={{ background: '#ecfccb', padding: '10px', borderRadius: '12px', position: 'absolute', top: '150px', left: '5px', right: '5px', height: '70px', border: '1px solid #d9f99d' }}>
                                                        <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#3f6212' }}>9 AM</div>
                                                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>Course 8</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#555' }}>LHC-301 • Prof. Anuj Grover</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ---------------- MONTH VIEW ---------------- */}
                        {view === 'month' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%', gap: '1px', background: '#f0f0f0' }}>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(h => (
                                    <div key={h} style={{ background: '#fff', padding: '10px', textAlign: 'center', fontWeight: '600', color: '#555', fontSize: '0.9rem' }}>{h}</div>
                                ))}

                                {/* Mock 35 days (5 weeks) */}
                                {Array.from({ length: 35 }).map((_, i) => {
                                    const dayNum = i - 2; // Start from previous month
                                    const isCurrentMonth = dayNum > 0 && dayNum <= 31;
                                    const isToday = dayNum === 4; // Mock today

                                    return (
                                        <div key={i} style={{ background: '#fff', minHeight: '100px', padding: '8px', position: 'relative' }}>
                                            <div style={{ textAlign: 'right', color: isCurrentMonth ? (isToday ? '#fff' : '#333') : '#ccc', fontWeight: isToday ? '700' : '400' }}>
                                                <span style={{
                                                    background: isToday ? '#111' : 'transparent',
                                                    borderRadius: '50%',
                                                    width: '24px',
                                                    height: '24px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {dayNum > 0 && dayNum <= 31 ? dayNum : (dayNum <= 0 ? 31 + dayNum : dayNum - 31)}
                                                </span>
                                            </div>
                                            {/* Mock Month Events */}
                                            {isCurrentMonth && dayNum === 1 && <div style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', marginTop: '5px', truncate: true }}>Course 1 Exam</div>}
                                            {isCurrentMonth && dayNum === 4 && <div style={{ background: '#ecfccb', color: '#3f6212', fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', marginTop: '5px' }}>Assignment Due</div>}
                                            {isCurrentMonth && dayNum === 15 && <div style={{ background: '#fce7f3', color: '#be185d', fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', marginTop: '5px' }}>Holiday</div>}
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
};

export default CalendarPage;
