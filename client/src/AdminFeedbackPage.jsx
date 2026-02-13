import React, { useState } from 'react';
import './Dashboard.css';
import {
    LayoutGrid,
    Users,
    BookOpen,
    Settings,
    LogOut,
    Search,
    ChevronLeft,
    ChevronRight,
    Shield,
    Calendar,
    MessageSquare,
    Star,
    Filter,
    TrendingUp,
    BarChart3,
    Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminFeedbackPage = () => {
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [filterRating, setFilterRating] = useState('All');
    const [filterProfessor, setFilterProfessor] = useState('All');
    const [sortBy, setSortBy] = useState('Recent');

    // Mock Feedback Data - For Professors
    const feedbacks = [
        { id: 1, student: 'Aarav Gupta', professor: 'Prof. Anuj Grover', course: 'CS101', rating: 5, comment: 'Excellent teaching! Prof. Anuj explains complex concepts very clearly.', date: '2 days ago', timestamp: Date.now() - 172800000 },
        { id: 2, student: 'Vivaan Singh', professor: 'Dr. Priya Sharma', course: 'Physics 201', rating: 3, comment: 'Good knowledge but lectures can be more interactive.', date: '3 days ago', timestamp: Date.now() - 259200000 },
        { id: 3, student: 'Aditya Kumar', professor: 'Prof. Rajesh Mehta', course: 'Math 101', rating: 4, comment: 'Challenging assignments that really help in understanding.', date: '4 days ago', timestamp: Date.now() - 345600000 },
        { id: 4, student: 'Vihaan Shah', professor: 'Prof. Anuj Grover', course: 'CS101', rating: 5, comment: 'Best professor! Very approachable and helpful.', date: '1 week ago', timestamp: Date.now() - 604800000 },
        { id: 5, student: 'Arjun Reddy', professor: 'Dr. Priya Sharma', course: 'Physics 201', rating: 2, comment: 'Pace is too fast, hard to keep up with lectures.', date: '1 week ago', timestamp: Date.now() - 604800000 },
        { id: 6, student: 'Priya Malhotra', professor: 'Prof. Rajesh Mehta', course: 'Math 101', rating: 5, comment: 'Excellent teaching methodology! Makes difficult topics easy.', date: '2 weeks ago', timestamp: Date.now() - 1209600000 },
        { id: 7, student: 'Rohan Patel', professor: 'Prof. Anuj Grover', course: 'CS202', rating: 4, comment: 'Good course delivery, could use more practical examples.', date: '2 weeks ago', timestamp: Date.now() - 1209600000 },
        { id: 8, student: 'Sneha Kumar', professor: 'Dr. Kavita Iyer', course: 'Chemistry 101', rating: 5, comment: 'Dr. Iyer makes chemistry fun and easy to understand!', date: '3 weeks ago', timestamp: Date.now() - 1814400000 },
        { id: 9, student: 'Karan Singh', professor: 'Dr. Kavita Iyer', course: 'Chemistry 101', rating: 4, comment: 'Lab sessions are well organized and informative.', date: '3 weeks ago', timestamp: Date.now() - 1814400000 },
    ];

    const handleLogout = () => {
        navigate('/');
    };

    const renderStars = (rating) => {
        return [...Array(5)].map((_, i) => (
            <Star key={i} size={14} fill={i < rating ? "#f59e0b" : "none"} color={i < rating ? "#f59e0b" : "#ddd"} />
        ));
    };

    // Get unique professors
    const professors = ['All', ...new Set(feedbacks.map(f => f.professor))];

    // Calculate professor-wise stats
    const professorStats = professors.slice(1).map(prof => {
        const profFeedbacks = feedbacks.filter(f => f.professor === prof);
        const avgRating = profFeedbacks.reduce((acc, f) => acc + f.rating, 0) / profFeedbacks.length;
        return {
            name: prof,
            avgRating: avgRating.toFixed(1),
            count: profFeedbacks.length
        };
    }).sort((a, b) => b.avgRating - a.avgRating);

    // Filter and sort
    let filteredFeedbacks = feedbacks;

    if (filterProfessor !== 'All') {
        filteredFeedbacks = filteredFeedbacks.filter(f => f.professor === filterProfessor);
    }

    if (filterRating !== 'All') {
        filteredFeedbacks = filteredFeedbacks.filter(f => f.rating === parseInt(filterRating));
    }

    if (sortBy === 'Highest') {
        filteredFeedbacks = [...filteredFeedbacks].sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'Lowest') {
        filteredFeedbacks = [...filteredFeedbacks].sort((a, b) => a.rating - b.rating);
    } else {
        filteredFeedbacks = [...filteredFeedbacks].sort((a, b) => b.timestamp - a.timestamp);
    }

    // Calculate overall stats
    const avgRating = (feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1);

    return (
        <div className="dashboard-container">
            {/* Sidebar */}
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
                <div>
                    <div className="user-profile">
                        <div className="user-avatar" style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Shield color="#fff" size={24} />
                        </div>
                        <div className="user-info">
                            <h3>Admin</h3>
                            <p>admin@cipd.edu</p>
                        </div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} className="collapse-btn">
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>

                    <nav className="nav-menu">
                        <div className="nav-item" onClick={() => navigate('/admin')}><LayoutGrid size={18} /> <span>Dashboard</span></div>
                        <div className="nav-item" onClick={() => navigate('/admin-attendance')}><Calendar size={18} /> <span>Attendance</span></div>
                        <div className="nav-item active"><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div className="nav-item" onClick={() => navigate('/admin-users')}><Users size={18} /> <span>Manage Users</span></div>
                        <div className="nav-item" onClick={() => navigate('/admin-courses')}><BookOpen size={18} /> <span>Manage Courses</span></div>
                        <div className="nav-item" onClick={() => navigate('/settings')}><Settings size={18} /> <span>Settings</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div className="nav-item" onClick={handleLogout}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content">
                <div className="content-center full-width">
                    <header className="dashboard-header">
                        <h1>Professor Feedback & Ratings</h1>
                        <div className="header-actions">
                            <div className="search-bar">
                                <Search size={16} color="#aaa" />
                                <input type="text" placeholder="Search professor or student..." className="search-input" />
                            </div>
                        </div>
                    </header>

                    {/* Top Rated Professors */}
                    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f0f0f0', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                            <Award size={20} color="#f59e0b" />
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Top Rated Professors</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                            {professorStats.map((prof, idx) => (
                                <div key={idx} style={{ padding: '1rem', background: '#f9fafb', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: idx === 0 ? '#fef3c7' : idx === 1 ? '#e0e7ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700', color: idx === 0 ? '#f59e0b' : idx === 1 ? '#6366f1' : '#16a34a' }}>
                                        {idx + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>{prof.name}</h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                            <div style={{ display: 'flex', gap: '2px' }}>
                                                {renderStars(Math.round(parseFloat(prof.avgRating)))}
                                            </div>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#f59e0b' }}>{prof.avgRating}</span>
                                            <span style={{ fontSize: '0.8rem', color: '#888' }}>({prof.count} reviews)</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Summary Section */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <MessageSquare size={20} color="#3b82f6" />
                                <span style={{ fontSize: '0.85rem', color: '#888' }}>Total Reviews</span>
                            </div>
                            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '700' }}>{feedbacks.length}</h2>
                        </div>
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <TrendingUp size={20} color="#16a34a" />
                                <span style={{ fontSize: '0.85rem', color: '#888' }}>Average Rating</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: '#f59e0b' }}>{avgRating}</h2>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    {renderStars(Math.round(parseFloat(avgRating)))}
                                </div>
                            </div>
                        </div>
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <Users size={20} color="#8b5cf6" />
                                <span style={{ fontSize: '0.85rem', color: '#888' }}>Faculty Members</span>
                            </div>
                            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '700' }}>{professorStats.length}</h2>
                        </div>
                    </div>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Filter size={16} color="#888" />
                            <select
                                value={filterProfessor}
                                onChange={(e) => setFilterProfessor(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem', minWidth: '200px' }}
                            >
                                {professors.map(prof => (
                                    <option key={prof} value={prof}>{prof === 'All' ? 'All Professors' : prof}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <select
                                value={filterRating}
                                onChange={(e) => setFilterRating(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem' }}
                            >
                                <option value="All">All Ratings</option>
                                <option value="5">5 Stars</option>
                                <option value="4">4 Stars</option>
                                <option value="3">3 Stars</option>
                                <option value="2">2 Stars</option>
                                <option value="1">1 Star</option>
                            </select>
                        </div>
                        <div>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem' }}
                            >
                                <option value="Recent">Most Recent</option>
                                <option value="Highest">Highest Rated</option>
                                <option value="Lowest">Lowest Rated</option>
                            </select>
                        </div>
                        <div style={{ marginLeft: 'auto', fontSize: '0.9rem', color: '#888' }}>
                            Showing {filteredFeedbacks.length} of {feedbacks.length} reviews
                        </div>
                    </div>

                    {/* Feedback Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                        {filteredFeedbacks.map(fb => (
                            <div key={fb.id} style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'transform 0.2s, box-shadow 0.2s' }} className="feedback-card-hover">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#2563eb' }}>{fb.professor}</h3>
                                        </div>
                                        <p style={{ margin: '2px 0', fontSize: '0.8rem', color: '#888' }}>{fb.course}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#aaa' }}>Review by {fb.student}</p>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{fb.date}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '2px', margin: '5px 0' }}>
                                    {renderStars(fb.rating)}
                                </div>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#444', lineHeight: '1.5', background: '#f9f9f9', padding: '12px', borderRadius: '8px', borderLeft: `3px solid ${fb.rating >= 4 ? '#16a34a' : fb.rating === 3 ? '#f59e0b' : '#ef4444'}` }}>"{fb.comment}"</p>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AdminFeedbackPage;
