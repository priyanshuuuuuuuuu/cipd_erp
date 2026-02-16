import React, { useState } from 'react';
import './Dashboard.css';
import {
    LayoutGrid, Calendar, Users, BookOpen, MessageSquare, Settings,
    LogOut, Bell, Search, Menu, ChevronLeft, ChevronRight,
    CheckCircle, Clock, FileBarChart, Wifi, Shield, Filter,
    Download, RefreshCw, Edit3, Trash2, Plus, ChevronDown,
    ChevronUp, ToggleLeft, ToggleRight, ArrowLeft, GripVertical
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminFeedbackPage = () => {
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview'); // overview | config
    const [viewingLecture, setViewingLecture] = useState(null);
    const [filterRating, setFilterRating] = useState('all');

    const handleLogout = () => { navigate('/'); };

    // ─── Mock Data ───
    const summaryData = {
        totalLectures: 18,
        avgRating: 4.2,
        onTimeRate: 82,
        descriptiveCount: 164,
        totalSubmissions: 312,
        totalEnrolled: 380,
    };

    const ratingDistribution = [
        { rating: 5, count: 82, pct: 45 },
        { rating: 4, count: 60, pct: 32 },
        { rating: 3, count: 25, pct: 14 },
        { rating: 2, count: 10, pct: 6 },
        { rating: 1, count: 5, pct: 3 },
    ];

    const lectureFeedbacks = [
        { id: 1, lecture: 'CS301 – Lec 14', date: '16 Feb', faculty: 'Prof. Anuj Grover', avg: 4.4, submissions: '32/38', descCount: 18, topic: 'Binary Search Trees' },
        { id: 2, lecture: 'CS301 – Lec 13', date: '14 Feb', faculty: 'Prof. Anuj Grover', avg: 4.1, submissions: '30/38', descCount: 14, topic: 'Linked List Operations' },
        { id: 3, lecture: 'PHY201 – Lec 8', date: '15 Feb', faculty: 'Dr. Priya Sharma', avg: 3.8, submissions: '28/35', descCount: 12, topic: 'Wave Optics' },
        { id: 4, lecture: 'MTH101 – Lec 12', date: '14 Feb', faculty: 'Prof. Rajesh Mehta', avg: 4.6, submissions: '40/42', descCount: 22, topic: 'Eigenvalues & Eigenvectors' },
        { id: 5, lecture: 'PHY201 – Lec 7', date: '12 Feb', faculty: 'Dr. Priya Sharma', avg: 3.5, submissions: '25/35', descCount: 10, topic: 'Interference & Diffraction' },
        { id: 6, lecture: 'CS301 – Lec 12', date: '12 Feb', faculty: 'Prof. Anuj Grover', avg: 4.3, submissions: '34/38', descCount: 16, topic: 'Stacks & Queues' },
        { id: 7, lecture: 'CHM101 – Lec 6', date: '13 Feb', faculty: 'Dr. Kavita Iyer', avg: 4.5, submissions: '29/30', descCount: 15, topic: 'Chemical Bonding' },
    ];

    const descriptiveResponses = [
        { student: 'STU2021034', rating: 5, text: 'The step-by-step derivation of BST operations was very helpful. Would appreciate more worked examples for deletion cases.' },
        { student: 'STU2021078', rating: 4, text: 'Good pacing overall. The comparison with hash tables helped clarify when to use BSTs. Slides could have more diagrams.' },
        { student: 'STU2021012', rating: 4, text: 'Clear explanation but the transition from balanced to unbalanced trees was too quick. Please spend more time on edge cases.' },
        { student: 'STU2021091', rating: 3, text: 'Found it hard to follow the recursive traversal explanation. Maybe a visual walkthrough on the board would help.' },
        { student: 'STU2021045', rating: 5, text: 'Excellent session. The live coding demo during class was the highlight — it really helped connect theory to implementation.' },
        { student: 'STU2021067', rating: 2, text: 'Pace was too fast for the complexity of the topic. Need more practice problems discussed in class before moving on.' },
        { student: 'STU2021023', rating: 4, text: 'Would be great if slide PDFs were uploaded before class so we can follow along and annotate.' },
        { student: 'STU2021056', rating: 5, text: 'The analogy used for tree rotations was brilliant. More such real-world analogies would improve understanding.' },
    ];

    const [questions, setQuestions] = useState([
        { id: 1, text: 'Rate the overall quality of this lecture', type: 'Rating (1-5)', mandatory: true, active: true },
        { id: 2, text: 'How clear was the explanation of concepts?', type: 'Rating (1-5)', mandatory: true, active: true },
        { id: 3, text: 'Was the lecture well-structured and organized?', type: 'Rating (1-5)', mandatory: true, active: true },
        { id: 4, text: 'How engaging was the session?', type: 'Rating (1-5)', mandatory: true, active: true },
        { id: 5, text: 'Did the lecture meet your learning expectations?', type: 'Yes / No', mandatory: true, active: true },
        { id: 6, text: 'What specific improvement would you suggest?', type: 'Descriptive', mandatory: false, active: true },
    ]);

    // Trend data (last 7 lectures)
    const trendData = [
        { lecture: 'L8', avg: 3.5, subRate: 71 },
        { lecture: 'L9', avg: 3.8, subRate: 76 },
        { lecture: 'L10', avg: 4.0, subRate: 79 },
        { lecture: 'L11', avg: 4.1, subRate: 80 },
        { lecture: 'L12', avg: 4.3, subRate: 84 },
        { lecture: 'L13', avg: 4.1, subRate: 79 },
        { lecture: 'L14', avg: 4.4, subRate: 84 },
    ];

    // Styles
    const labelStyle = { color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' };
    const valueStyle = { fontWeight: 700, color: '#111', fontFamily: 'monospace', fontSize: '0.78rem' };
    const dividerDot = <span style={{ color: '#ddd', fontSize: '0.7rem' }}>·</span>;
    const tabStyle = (active) => ({
        padding: '6px 16px', borderRadius: '6px', border: '1px solid ' + (active ? '#111' : '#e8e8e8'),
        background: active ? '#111' : '#fff', color: active ? '#fff' : '#888',
        fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
    });

    // Filtered descriptive responses
    const filteredResponses = filterRating === 'all'
        ? descriptiveResponses
        : descriptiveResponses.filter(r => r.rating === parseInt(filterRating));

    // SVG Trend Chart dimensions
    const chartW = 600, chartH = 180;
    const cPad = { top: 20, right: 20, bottom: 30, left: 40 };
    const cW = chartW - cPad.left - cPad.right;
    const cH = chartH - cPad.top - cPad.bottom;

    const renderTrendChart = (dataKey, color, label, minY, maxY) => {
        const xStep = cW / (trendData.length - 1);
        const yScale = (v) => cPad.top + cH - ((v - minY) / (maxY - minY)) * cH;
        const pts = trendData.map((d, i) => ({ x: cPad.left + i * xStep, y: yScale(d[dataKey]), v: d[dataKey] }));
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

        return (
            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>{label}</span>
                    <span style={{ fontSize: '0.68rem', color: '#bbb' }}>Last 7 lectures</span>
                </div>
                <div style={{ padding: '12px 1rem' }}>
                    <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                        {/* Gridlines */}
                        {Array.from({ length: 5 }, (_, i) => {
                            const val = minY + (maxY - minY) * i / 4;
                            const y = yScale(val);
                            return <g key={i}>
                                <line x1={cPad.left} y1={y} x2={chartW - cPad.right} y2={y} stroke="#f0f0f0" strokeWidth="1" />
                                <text x={cPad.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#bbb">{dataKey === 'subRate' ? `${Math.round(val)}%` : val.toFixed(1)}</text>
                            </g>;
                        })}
                        {/* X labels */}
                        {trendData.map((d, i) => (
                            <text key={i} x={cPad.left + i * xStep} y={chartH - 5} textAnchor="middle" fontSize="9" fill="#bbb">{d.lecture}</text>
                        ))}
                        {/* Line */}
                        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
                        {/* Points */}
                        {pts.map((p, i) => (
                            <g key={i}>
                                <circle cx={p.x} cy={p.y} r="3" fill="#fff" stroke={color} strokeWidth="1.5" />
                                <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="#555" fontWeight="600">
                                    {dataKey === 'subRate' ? `${p.v}%` : p.v}
                                </text>
                            </g>
                        ))}
                    </svg>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-container">
            {/* Sidebar */}
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
                <div>
                    <div className="user-profile">
                        <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>AD</div>
                        <div className="user-info"><h3>Admin</h3><p>admin@cipd.edu</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '8px 1rem 4px', marginTop: '2px' }}><span>Main</span></div>
                        <div className="nav-item" onClick={() => navigate('/admin')} style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Dashboard</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                        <div className="nav-item" onClick={() => navigate('/admin-attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                        <div className="nav-item" onClick={() => navigate('/admin-wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>

                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                        <div className="nav-item active"><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours & Honorarium</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>

                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                        <div className="nav-item" onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div className="nav-item" onClick={handleLogout} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content">
                <div className="content-center admin-full">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Feedback Analytics</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar">
                                <Search size={16} color="#aaa" />
                                <input type="text" placeholder="Search lectures..." className="search-input" />
                            </div>
                            <Bell size={20} color="#555" style={{ cursor: 'pointer' }} />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* ═══════ TAB SWITCHER ═══════ */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem' }}>
                        <button style={tabStyle(activeTab === 'overview')} onClick={() => { setActiveTab('overview'); setViewingLecture(null); }}>Overview & Analytics</button>
                        <button style={tabStyle(activeTab === 'config')} onClick={() => { setActiveTab('config'); setViewingLecture(null); }}>Question Configuration</button>
                    </div>

                    {activeTab === 'overview' && !viewingLecture && (
                        <>
                            {/* ═══════ STRUCTURED SUMMARY STRIP ═══════ */}
                            <div style={{
                                background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8',
                                padding: '0', marginBottom: '1.2rem', overflow: 'hidden',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', padding: '10px 1.2rem',
                                    fontSize: '0.78rem', overflowX: 'auto', whiteSpace: 'nowrap'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>Lectures This Week</span>
                                        <span style={valueStyle}>{summaryData.totalLectures}</span>
                                    </div>
                                    <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>Avg Rating</span>
                                        <span style={valueStyle}>{summaryData.avgRating}</span>
                                        <span style={{ color: '#bbb', fontSize: '0.68rem' }}>/5</span>
                                    </div>
                                    <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>On-Time Submissions</span>
                                        <span style={valueStyle}>{summaryData.onTimeRate}%</span>
                                    </div>
                                    <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>Descriptive Responses</span>
                                        <span style={valueStyle}>{summaryData.descriptiveCount}</span>
                                    </div>
                                    <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>Submissions</span>
                                        <span style={valueStyle}>{summaryData.totalSubmissions}/{summaryData.totalEnrolled}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ═══════ RATING DISTRIBUTION + TREND CHARTS ═══════ */}
                            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                {/* Rating Distribution Table */}
                                <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>Rating Distribution</span>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr style={{ background: '#fafafa' }}>
                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>Rating</th>
                                                <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>Count</th>
                                                <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>%</th>
                                                <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0', width: '100px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ratingDistribution.map(r => (
                                                <tr key={r.rating} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '9px 16px', fontWeight: 600, fontFamily: 'monospace', color: '#111' }}>{r.rating}</td>
                                                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#333' }}>{r.count}</td>
                                                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>{r.pct}%</td>
                                                    <td style={{ padding: '9px 16px' }}>
                                                        <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${r.pct}%`, height: '100%', background: '#888', borderRadius: '2px' }} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Trend Charts */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                    {renderTrendChart('avg', '#555', 'Average Rating Trend', 3.0, 5.0)}
                                    {renderTrendChart('subRate', '#888', 'Submission Rate Trend', 60, 100)}
                                </div>
                            </div>

                            {/* ═══════ LECTURE-WISE FEEDBACK TABLE ═══════ */}
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Lecture-wise Feedback</span>
                                    <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, color: '#888' }}><Download size={11} /> Export</button>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr style={{ background: '#fafafa' }}>
                                                {['Lecture', 'Date', 'Faculty', 'Avg Rating', 'Submissions', 'Descriptive', ''].map(h => (
                                                    <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lectureFeedbacks.map(lf => (
                                                <tr key={lf.id} style={{ borderBottom: '1px solid #f5f5f5' }} className="attendance-row">
                                                    <td style={{ padding: '9px 16px', fontWeight: 600, color: '#111' }}>{lf.lecture}</td>
                                                    <td style={{ padding: '9px 16px', color: '#888', fontFamily: 'monospace', fontSize: '0.78rem' }}>{lf.date}</td>
                                                    <td style={{ padding: '9px 16px', color: '#555' }}>{lf.faculty}</td>
                                                    <td style={{ padding: '9px 16px' }}>
                                                        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: lf.avg >= 4.0 ? '#111' : lf.avg >= 3.0 ? '#b45309' : '#dc2626' }}>{lf.avg}</span>
                                                    </td>
                                                    <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{lf.submissions}</td>
                                                    <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>{lf.descCount}</td>
                                                    <td style={{ padding: '9px 16px' }}>
                                                        <button onClick={() => setViewingLecture(lf)} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, color: '#555' }} className="change-status-btn">View Details</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ═══════ LECTURE DETAIL VIEW ═══════ */}
                    {activeTab === 'overview' && viewingLecture && (
                        <>
                            {/* Back + Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <button onClick={() => setViewingLecture(null)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500, color: '#555' }}>
                                    <ArrowLeft size={13} /> Back
                                </button>
                            </div>

                            {/* Lecture Info Strip */}
                            <div style={{
                                background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8',
                                padding: '0', marginBottom: '1.2rem', overflow: 'hidden',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', padding: '10px 1.2rem',
                                    fontSize: '0.78rem', overflowX: 'auto', whiteSpace: 'nowrap'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>Lecture</span>
                                        <span style={valueStyle}>{viewingLecture.lecture}</span>
                                    </div>
                                    <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>Topic</span>
                                        <span style={{ fontWeight: 600, color: '#111', fontSize: '0.78rem' }}>{viewingLecture.topic}</span>
                                    </div>
                                    <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>Faculty</span>
                                        <span style={{ fontWeight: 600, color: '#111', fontSize: '0.78rem' }}>{viewingLecture.faculty}</span>
                                    </div>
                                    <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>Avg Rating</span>
                                        <span style={valueStyle}>{viewingLecture.avg}</span>
                                    </div>
                                    <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>Submissions</span>
                                        <span style={valueStyle}>{viewingLecture.submissions}</span>
                                    </div>
                                    <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                        <span style={labelStyle}>Date</span>
                                        <span style={valueStyle}>{viewingLecture.date} 2026</span>
                                    </div>
                                </div>
                            </div>

                            {/* Descriptive Responses */}
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Descriptive Responses ({filteredResponses.length})</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Filter size={12} color="#888" />
                                        <select value={filterRating} onChange={e => setFilterRating(e.target.value)}
                                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', fontSize: '0.75rem', fontWeight: 500, color: '#555', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                                            <option value="all">All Ratings</option>
                                            <option value="5">Rating 5</option>
                                            <option value="4">Rating 4</option>
                                            <option value="3">Rating 3</option>
                                            <option value="2">Rating 2</option>
                                            <option value="1">Rating 1</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                                    {filteredResponses.map((resp, i) => (
                                        <div key={i} style={{ padding: '12px 1.2rem', borderBottom: '1px solid #f5f5f5', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0, minWidth: '44px' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'monospace', color: '#aaa' }}>{resp.rating}/5</span>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.82rem', color: '#333', lineHeight: '1.55', marginBottom: '4px' }}>{resp.text}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#bbb', fontFamily: 'monospace' }}>{resp.student}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredResponses.length === 0 && (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc', fontSize: '0.82rem' }}>No responses match this filter.</div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ═══════ QUESTION CONFIGURATION ═══════ */}
                    {activeTab === 'config' && (
                        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Question Configuration</span>
                                <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 14px', borderRadius: '6px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}>
                                    <Plus size={12} /> Add Question
                                </button>
                            </div>

                            {/* Config Info Strip */}
                            <div style={{
                                display: 'flex', alignItems: 'center', padding: '7px 1.2rem',
                                gap: '16px', fontSize: '0.68rem', color: '#aaa', background: '#fafafa', borderBottom: '1px solid #f0f0f0'
                            }}>
                                <span>Active Questions <span style={{ fontWeight: 600, color: '#888' }}>{questions.filter(q => q.active).length}</span></span>
                                {dividerDot}
                                <span>Mandatory <span style={{ fontWeight: 600, color: '#888' }}>{questions.filter(q => q.mandatory).length}</span></span>
                                {dividerDot}
                                <span>Rating Type <span style={{ fontWeight: 600, color: '#888' }}>{questions.filter(q => q.type.includes('Rating')).length}</span></span>
                                {dividerDot}
                                <span>Yes/No <span style={{ fontWeight: 600, color: '#888' }}>{questions.filter(q => q.type === 'Yes / No').length}</span></span>
                                {dividerDot}
                                <span>Descriptive <span style={{ fontWeight: 600, color: '#888' }}>{questions.filter(q => q.type === 'Descriptive').length}</span></span>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            {['', '#', 'Question', 'Type', 'Mandatory', 'Active', '', ''].map((h, i) => (
                                                <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0', width: h === '' && i === 0 ? '30px' : h === '' ? '40px' : 'auto' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {questions.map((q, i) => (
                                            <tr key={q.id} style={{ borderBottom: '1px solid #f5f5f5', opacity: q.active ? 1 : 0.5 }} className="attendance-row">
                                                <td style={{ padding: '9px 14px', color: '#ccc', cursor: 'grab' }}><GripVertical size={14} /></td>
                                                <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#aaa', fontSize: '0.78rem' }}>{i + 1}</td>
                                                <td style={{ padding: '9px 14px', fontWeight: 500, color: '#333', maxWidth: '360px' }}>{q.text}</td>
                                                <td style={{ padding: '9px 14px' }}>
                                                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 500, background: q.type.includes('Rating') ? '#f5f5f5' : q.type === 'Yes / No' ? '#f0f9ff' : '#fefce8', color: q.type.includes('Rating') ? '#555' : q.type === 'Yes / No' ? '#0369a1' : '#854d0e', border: '1px solid ' + (q.type.includes('Rating') ? '#e8e8e8' : q.type === 'Yes / No' ? '#bae6fd' : '#fde68a') }}>
                                                        {q.type}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                                                    <span style={{ cursor: 'pointer', color: q.mandatory ? '#16a34a' : '#ddd' }} onClick={() => {
                                                        setQuestions(prev => prev.map(qq => qq.id === q.id ? { ...qq, mandatory: !qq.mandatory } : qq));
                                                    }}>
                                                        <CheckCircle size={16} />
                                                    </span>
                                                </td>
                                                <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                                                    <span style={{ cursor: 'pointer', color: q.active ? '#16a34a' : '#ccc' }} onClick={() => {
                                                        setQuestions(prev => prev.map(qq => qq.id === q.id ? { ...qq, active: !qq.active } : qq));
                                                    }}>
                                                        {q.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '9px 14px' }}>
                                                    <button style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#888' }}><Edit3 size={12} /></button>
                                                </td>
                                                <td style={{ padding: '9px 14px' }}>
                                                    <button style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#ccc' }}><Trash2 size={12} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default AdminFeedbackPage;
