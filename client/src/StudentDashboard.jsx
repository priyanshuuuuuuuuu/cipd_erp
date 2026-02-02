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
    ChevronDown,
    MapPin,
    Clock,
    FileText,
    AlertCircle,
    CheckCircle,
    XCircle,
    Menu,        // Hamburger for mobile
    ChevronLeft, // Collapse toggle
    ChevronRight // Expand toggle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Cell
} from 'recharts';

// Simple placeholder images for courses - using unicode for now or svgs
const CourseIcon = ({ type }) => (
    <div style={{ fontSize: '2.5rem' }}>
        {type === 'book' ? '📚' : type === 'body' ? '🧘' : type === 'globe' ? '🌎' : '🔬'}
    </div>
);

const StudentDashboard = () => {
    const navigate = useNavigate();
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
                        <div className="nav-item active">
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
                        <div className="nav-item" onClick={() => navigate('/calendar')} style={{ cursor: 'pointer' }}>
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
            <div className="main-content">

                {/* Centre Panel */}
                <div className="content-center">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Mobile Menu Button - Visible only on mobile via CSS usually, strictly logic here */}
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}>
                                <Menu size={24} />
                            </div>
                            <h1>Home</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar">
                                <Search size={16} color="#aaa" />
                                <input type="text" placeholder="Search" className="search-input" />
                            </div>
                            <Bell size={20} color="#555" />
                            <MessageSquare size={20} color="#555" />
                        </div>
                    </header>

                    {/* Today's Schedule */}
                    <section>
                        <div className="section-title">
                            Today's Schedule
                        </div>
                        <div className="schedule-cards">
                            <div className="schedule-card">
                                <div className="icon-container">
                                    <img src="/course1.png" alt="Active Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                </div>
                                <div className="course-title">Course 1</div>
                                <div className="course-info">Topic 1<br />Venue: LHC<br />10:00am</div>
                            </div>
                            <div className="schedule-card active">
                                <div className="next-class-badge">Next Class</div>
                                <div className="icon-container">
                                    <img src="/active.png" alt="Active Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                </div>
                                <div className="course-title">Course 2</div>
                                <div className="course-info">Topic 2<br />Venue: LHC<br />11:00am</div>
                            </div>
                            <div className="schedule-card">
                                <div className="icon-container">
                                    <img src="/course3.png" alt="Active Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                </div>
                                <div className="course-title">Course 3</div>
                                <div className="course-info">Topic 3<br />Venue: LHC<br />12:00pm</div>
                            </div>
                            <div className="schedule-card">
                                <div className="icon-container">
                                    <img src="/course4.png" alt="Active Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                </div>
                                <div className="course-title">Course 4</div>
                                <div className="course-info">Topic 4<br />Venue: LHC<br />1:00pm</div>
                            </div>
                            <div className="schedule-card">
                                <div className="icon-container">
                                    <img src="/course5.png" alt="Active Course" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
                                </div>
                                <div className="course-title">Course 5</div>
                                <div className="course-info">Topic 5<br />Venue: LHC<br />2:00pm</div>
                            </div>
                        </div>
                    </section>

                    {/* Weekly Schedule */}
                    <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="section-title" onClick={() => navigate('/calendar')} style={{ cursor: 'pointer' }}>
                            Weekly Schedule
                            <div style={{ fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                Jan 1 - Jan 7, 2026 <ChevronDown size={14} />
                            </div>
                        </div>
                        <div className="calendar-container">
                            {/* Weekly Calendar Header */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px', marginBottom: '10px' }}>
                                {[1, 2, 3, 4, 5, 6, 7].map(day => (
                                    <div key={day} style={{ textAlign: 'left', paddingLeft: '5px', fontSize: '0.8rem', color: '#888' }}>{day}</div>
                                ))}
                            </div>

                            {/* Calendar Body */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, gap: '10px', position: 'relative' }}>
                                {/* Day 1 */}
                                <div className="cal-col" style={{ position: 'relative' }}>
                                    <div className="cal-event blue" style={{ marginTop: 'auto', marginBottom: '10px', position: 'absolute', bottom: '0', width: '100%' }}>
                                        <div className="event-badge">Exam</div>
                                        <strong>Course 3 Exam</strong>
                                        <div>CIPD Room</div>
                                        <div>11 AM</div>
                                    </div>
                                </div>
                                {/* Day 2 */}
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9' }}></div>
                                {/* Day 3 */}
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9', position: 'relative' }}>
                                    <div className="cal-event teal" style={{ top: '35%', position: 'absolute', width: '100%' }}>
                                        <div className="event-badge">Class</div>
                                        <strong>Course 2</strong>
                                        <div>Old Acad</div>
                                        <div>2 PM</div>
                                    </div>
                                </div>
                                {/* Day 4 */}
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9', position: 'relative' }}>
                                    <div className="cal-event purple" style={{ top: '0', position: 'absolute', width: '100%' }}>
                                        <div className="event-badge">Class</div>
                                        <strong>Course 1</strong>
                                        <div>LHC</div>
                                        <div>11 AM</div>
                                    </div>
                                </div>
                                {/* Day 5 */}
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9', position: 'relative' }}>
                                    <div className="cal-event green" style={{ bottom: '20px', position: 'absolute', width: '100%' }}>
                                        <div className="event-badge">Class</div>
                                        <strong>Assignment 1</strong>
                                        <div>Subject</div>
                                        <div>Professor</div>
                                    </div>
                                </div>
                                {/* Day 6 */}
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9' }}></div>
                                {/* Day 7 */}
                                <div className="cal-col" style={{ borderLeft: '1px solid #f9f9f9', position: 'relative' }}>
                                    <div className="cal-event green" style={{ top: '30%', position: 'absolute', width: '100%' }}>
                                        <div className="event-badge">Class</div>
                                        <strong>Assignment 1</strong>
                                        <div>Subject</div>
                                        <div>Professor</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Panel */}
                <div className="content-right">
                    <div className="section-title">
                        Weekly Attendance
                        <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                    </div>
                    <div className="stat-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                        {/* Recharts Bar Chart */}
                        <div style={{ position: 'relative', cursor: 'default', width: '290px', height: '110px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { day: 'Sun', val: 80 }, { day: 'Mon', val: 30 }, { day: 'Tue', val: 60 },
                                    { day: 'Wed', val: 45 }, { day: 'Thu', val: 75 }, { day: 'Fri', val: 60 }, { day: 'Sat', val: 95 }
                                ]} barSize={10} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                    <CartesianGrid vertical={false} stroke="#eee" strokeDasharray="3 3" />
                                    <XAxis dataKey="day" hide={true} />
                                    <YAxis hide={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} domain={[0, 100]} width={25} />
                                    <Bar dataKey="val" radius={[4, 4, 4, 4]}>
                                        {
                                            [80, 30, 60, 45, 75, 60, 95].map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 6 ? '#003366' : '#66d9e8'} />
                                            ))
                                        }
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Summary Section */}
                        <div className="attendance-summary">
                            <div className="summary-left">
                                <div className="summary-label">Total Attendance</div>
                                <div className="progress-circle">
                                    80%
                                </div>
                            </div>
                            <div className="summary-right">
                                <div className="badge-pill blue">Attended: 20</div>
                                <div className="badge-pill pink">Missed: 4</div>
                            </div>
                        </div>
                    </div>

                    <div className="section-title" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Pending Assignments</div>

                    <div className="assignment-card">
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div className="icon-box"><FileText size={20} /></div>
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>Assignment 1</div>
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>Detail 1</div>
                            </div>
                        </div>
                        <div className="score-circle green">98</div>
                    </div>

                    <div className="assignment-card">
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div className="icon-box"><div style={{ fontSize: '16px' }}>🎨</div></div>
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>Assignment 2</div>
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>Detail 2</div>
                            </div>
                        </div>
                        <div className="score-circle peach">72</div>
                    </div>

                    <div className="assignment-card">
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div className="icon-box"><div style={{ fontSize: '16px' }}>🔢</div></div>
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>Assignment 3</div>
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>Detail 3</div>
                            </div>
                        </div>
                        <div className="score-circle pink">34</div>
                    </div>

                    <div className="section-title" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Pending Feedback</div>
                    <div className="feedback-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div className="feedback-text" style={{ fontSize: '0.9rem' }}>You have missed submitting<br />feedback on 27/01/2025</div>
                            <div className="feedback-sub">Required for course name: Course 1</div>
                        </div>
                        <div style={{ width: '40px', height: '40px', background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                            <ChevronDown size={20} style={{ transform: 'rotate(-90deg)' }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
