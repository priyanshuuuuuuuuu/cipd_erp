'use client';
import React, { useState } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, Download, CheckCircle,
    Filter, Edit3, Trash2, Plus, ToggleLeft, ToggleRight, ArrowLeft, GripVertical
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminFeedbackPage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [viewingLecture, setViewingLecture] = useState(null);
    const [filterRating, setFilterRating] = useState('all');
    const [questions, setQuestions] = useState([
        { id: 1, text: 'Rate the overall quality of this lecture', type: 'Rating (1-5)', mandatory: true, active: true },
        { id: 2, text: 'How clear was the explanation of concepts?', type: 'Rating (1-5)', mandatory: true, active: true },
        { id: 3, text: 'Was the lecture well-structured and organized?', type: 'Rating (1-5)', mandatory: true, active: true },
        { id: 4, text: 'How engaging was the session?', type: 'Rating (1-5)', mandatory: true, active: true },
        { id: 5, text: 'Did the lecture meet your learning expectations?', type: 'Yes / No', mandatory: true, active: true },
        { id: 6, text: 'What specific improvement would you suggest?', type: 'Descriptive', mandatory: false, active: true },
    ]);

    const navTo = p => router.push(p);

    const summaryData = { totalLectures: 18, avgRating: 4.2, onTimeRate: 82, descriptiveCount: 164, totalSubmissions: 312, totalEnrolled: 380 };
    const ratingDistribution = [{ rating: 5, count: 82, pct: 45 }, { rating: 4, count: 60, pct: 32 }, { rating: 3, count: 25, pct: 14 }, { rating: 2, count: 10, pct: 6 }, { rating: 1, count: 5, pct: 3 }];
    const lectureFeedbacks = [
        { id: 1, lecture: 'CS301 – Lec 14', date: '16 Feb', faculty: 'Prof. Anuj Grover', avg: 4.4, submissions: '32/38', descCount: 18, topic: 'Binary Search Trees' },
        { id: 2, lecture: 'CS301 – Lec 13', date: '14 Feb', faculty: 'Prof. Anuj Grover', avg: 4.1, submissions: '30/38', descCount: 14, topic: 'Linked List Operations' },
        { id: 3, lecture: 'PHY201 – Lec 8', date: '15 Feb', faculty: 'Dr. Priya Sharma', avg: 3.8, submissions: '28/35', descCount: 12, topic: 'Wave Optics' },
        { id: 4, lecture: 'MTH101 – Lec 12', date: '14 Feb', faculty: 'Prof. Rajesh Mehta', avg: 4.6, submissions: '40/42', descCount: 22, topic: 'Eigenvalues & Eigenvectors' },
        { id: 5, lecture: 'PHY201 – Lec 7', date: '12 Feb', faculty: 'Dr. Priya Sharma', avg: 3.5, submissions: '25/35', descCount: 10, topic: 'Interference & Diffraction' },
        { id: 6, lecture: 'CHM101 – Lec 6', date: '13 Feb', faculty: 'Dr. Kavita Iyer', avg: 4.5, submissions: '29/30', descCount: 15, topic: 'Chemical Bonding' },
    ];
    const descriptiveResponses = [
        { student: 'STU2021034', rating: 5, text: 'The step-by-step derivation of BST operations was very helpful. Would appreciate more worked examples for deletion cases.' },
        { student: 'STU2021078', rating: 4, text: 'Good pacing overall. The comparison with hash tables helped clarify when to use BSTs. Slides could have more diagrams.' },
        { student: 'STU2021012', rating: 4, text: 'Clear explanation but the transition from balanced to unbalanced trees was too quick. Please spend more time on edge cases.' },
        { student: 'STU2021091', rating: 3, text: 'Found it hard to follow the recursive traversal explanation. Maybe a visual walkthrough would help.' },
        { student: 'STU2021045', rating: 5, text: 'Excellent session. The live coding demo was the highlight — it really helped connect theory to implementation.' },
        { student: 'STU2021067', rating: 2, text: 'Pace was too fast for the complexity. Need more practice problems discussed in class.' },
        { student: 'STU2021056', rating: 5, text: 'The analogy used for tree rotations was brilliant. More such real-world analogies would improve understanding.' },
    ];

    const trendData = [{ l: 'L8', avg: 3.5, sub: 71 }, { l: 'L9', avg: 3.8, sub: 76 }, { l: 'L10', avg: 4.0, sub: 79 }, { l: 'L11', avg: 4.1, sub: 80 }, { l: 'L12', avg: 4.3, sub: 84 }, { l: 'L13', avg: 4.1, sub: 79 }, { l: 'L14', avg: 4.4, sub: 84 }];

    const filteredResponses = filterRating === 'all' ? descriptiveResponses : descriptiveResponses.filter(r => r.rating === parseInt(filterRating));
    const tabStyle = active => ({ padding: '6px 16px', borderRadius: '6px', border: `1px solid ${active ? '#111' : '#e8e8e8'}`, background: active ? '#111' : '#fff', color: active ? '#fff' : '#888', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' });
    const labelStyle = { color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' };
    const valueStyle = { fontWeight: 700, color: '#111', fontFamily: 'monospace', fontSize: '0.78rem' };

    // Mini SVG trend chart
    const TrendChart = ({ dataKey, color, label, minY, maxY }) => {
        const W = 500, H = 160;
        const p = { top: 20, right: 20, bottom: 30, left: 36 };
        const cW = W - p.left - p.right, cH = H - p.top - p.bottom;
        const xStep = cW / (trendData.length - 1);
        const yScale = v => p.top + cH - ((v - minY) / (maxY - minY)) * cH;
        const pts = trendData.map((d, i) => ({ x: p.left + i * xStep, y: yScale(d[dataKey]), v: d[dataKey] }));
        const path = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
        return (
            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                <div style={{ padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>{label}</span>
                    <span style={{ fontSize: '0.68rem', color: '#bbb' }}>Last 7 lectures</span>
                </div>
                <div style={{ padding: '8px 1rem' }}>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                        {Array.from({ length: 5 }, (_, i) => { const v = minY + (maxY - minY) * i / 4; const y = yScale(v); return <g key={i}><line x1={p.left} y1={y} x2={W - p.right} y2={y} stroke="#f0f0f0" strokeWidth="1" /><text x={p.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#bbb">{dataKey === 'sub' ? `${Math.round(v)}%` : v.toFixed(1)}</text></g>; })}
                        {trendData.map((d, i) => <text key={i} x={p.left + i * xStep} y={H - 5} textAnchor="middle" fontSize="9" fill="#bbb">{d.l}</text>)}
                        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
                        {pts.map((pt, i) => <g key={i}><circle cx={pt.x} cy={pt.y} r="3" fill="#fff" stroke={color} strokeWidth="1.5" /><text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize="9" fill="#555" fontWeight="600">{dataKey === 'sub' ? `${pt.v}%` : pt.v}</text></g>)}
                    </svg>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>AD</div>
                        <div className="user-info"><h3>Admin</h3><p>admin@cipd.edu</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '8px 1rem 4px' }}><span>Main</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin')} style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Dashboard</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                        <div className="nav-item active"><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours &amp; Honorarium</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                        <div className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div className="nav-item" onClick={() => navTo('/')} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content">
                <div className="content-center admin-full">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Feedback Analytics</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search lectures..." className="search-input" /></div>
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem' }}>
                        <button style={tabStyle(activeTab === 'overview')} onClick={() => { setActiveTab('overview'); setViewingLecture(null); }}>Overview &amp; Analytics</button>
                        <button style={tabStyle(activeTab === 'config')} onClick={() => { setActiveTab('config'); setViewingLecture(null); }}>Question Configuration</button>
                    </div>

                    {activeTab === 'overview' && !viewingLecture && (
                        <>
                            {/* Summary strip */}
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', marginBottom: '1.2rem', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 1.2rem', fontSize: '0.78rem', overflowX: 'auto', whiteSpace: 'nowrap', gap: 0 }}>
                                    {[
                                        ['Lectures This Week', String(summaryData.totalLectures)],
                                        ['Avg Rating', `${summaryData.avgRating} /5`],
                                        ['On-Time Submissions', `${summaryData.onTimeRate}%`],
                                        ['Descriptive Responses', String(summaryData.descriptiveCount)],
                                        ['Submissions', `${summaryData.totalSubmissions}/${summaryData.totalEnrolled}`],
                                    ].map(([label, val], i) => (
                                        <React.Fragment key={label}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                                <span style={labelStyle}>{label}</span>
                                                <span style={valueStyle}>{val}</span>
                                            </div>
                                            {i < 4 && <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            {/* Rating distribution + trend charts */}
                            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>Rating Distribution</span>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr style={{ background: '#fafafa' }}>
                                                {['Rating', 'Count', '%', ''].map(h => <th key={h} style={{ padding: '8px 16px', textAlign: h === 'Count' || h === '%' ? 'right' : 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ratingDistribution.map(r => (
                                                <tr key={r.rating} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '9px 16px', fontWeight: 600, fontFamily: 'monospace', color: '#111' }}>{r.rating}</td>
                                                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#333' }}>{r.count}</td>
                                                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>{r.pct}%</td>
                                                    <td style={{ padding: '9px 16px', width: '80px' }}>
                                                        <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${r.pct}%`, height: '100%', background: '#888', borderRadius: '2px' }} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                    <TrendChart dataKey="avg" color="#555" label="Average Rating Trend" minY={3.0} maxY={5.0} />
                                    <TrendChart dataKey="sub" color="#888" label="Submission Rate Trend" minY={60} maxY={100} />
                                </div>
                            </div>

                            {/* Lecture table */}
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Lecture-wise Feedback</span>
                                    <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#888' }}><Download size={11} /> Export</button>
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
                                                <tr key={lf.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '9px 16px', fontWeight: 600, color: '#111' }}>{lf.lecture}</td>
                                                    <td style={{ padding: '9px 16px', color: '#888', fontFamily: 'monospace', fontSize: '0.78rem' }}>{lf.date}</td>
                                                    <td style={{ padding: '9px 16px', color: '#555' }}>{lf.faculty}</td>
                                                    <td style={{ padding: '9px 16px' }}><span style={{ fontWeight: 700, fontFamily: 'monospace', color: lf.avg >= 4.0 ? '#111' : lf.avg >= 3.0 ? '#b45309' : '#dc2626' }}>{lf.avg}</span></td>
                                                    <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{lf.submissions}</td>
                                                    <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>{lf.descCount}</td>
                                                    <td style={{ padding: '9px 16px' }}>
                                                        <button onClick={() => setViewingLecture(lf)} className="change-status-btn" style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#555' }}>View Details</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Lecture Detail View */}
                    {activeTab === 'overview' && viewingLecture && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <button onClick={() => setViewingLecture(null)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#555' }}>
                                    <ArrowLeft size={13} /> Back
                                </button>
                            </div>
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', marginBottom: '1.2rem', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 1.2rem', overflowX: 'auto', whiteSpace: 'nowrap', gap: 0 }}>
                                    {[['Lecture', viewingLecture.lecture], ['Topic', viewingLecture.topic], ['Faculty', viewingLecture.faculty], ['Avg Rating', String(viewingLecture.avg)], ['Submissions', viewingLecture.submissions], ['Date', `${viewingLecture.date} 2026`]].map(([label, val], i) => (
                                        <React.Fragment key={label}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', flexShrink: 0 }}>
                                                <span style={labelStyle}>{label}</span>
                                                <span style={valueStyle}>{val}</span>
                                            </div>
                                            {i < 5 && <div style={{ width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 }} />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Descriptive Responses ({filteredResponses.length})</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Filter size={12} color="#888" />
                                        <select value={filterRating} onChange={e => setFilterRating(e.target.value)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', fontSize: '0.75rem', color: '#555', background: '#fff', cursor: 'pointer' }}>
                                            <option value="all">All Ratings</option>
                                            {[5, 4, 3, 2, 1].map(r => <option key={r} value={String(r)}>Rating {r}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                                    {filteredResponses.map((resp, i) => (
                                        <div key={i} style={{ padding: '12px 1.2rem', borderBottom: '1px solid #f5f5f5', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                            <div style={{ flexShrink: 0, minWidth: '44px', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'monospace', color: '#aaa', paddingTop: '2px' }}>{resp.rating}/5</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.82rem', color: '#333', lineHeight: '1.55', marginBottom: '4px' }}>{resp.text}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#bbb', fontFamily: 'monospace' }}>{resp.student}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredResponses.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc', fontSize: '0.82rem' }}>No responses match this filter.</div>}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Question Config */}
                    {activeTab === 'config' && (
                        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Question Configuration</span>
                                <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 14px', borderRadius: '6px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}><Plus size={12} /> Add Question</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '7px 1.2rem', gap: '16px', fontSize: '0.68rem', color: '#aaa', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                                <span>Active <span style={{ fontWeight: 600, color: '#888' }}>{questions.filter(q => q.active).length}</span></span>
                                <span style={{ color: '#ddd' }}>·</span>
                                <span>Mandatory <span style={{ fontWeight: 600, color: '#888' }}>{questions.filter(q => q.mandatory).length}</span></span>
                                <span style={{ color: '#ddd' }}>·</span>
                                <span>Rating <span style={{ fontWeight: 600, color: '#888' }}>{questions.filter(q => q.type.includes('Rating')).length}</span></span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            {['', '#', 'Question', 'Type', 'Mandatory', 'Active', '', ''].map((h, i) => (
                                                <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {questions.map((q, i) => (
                                            <tr key={q.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5', opacity: q.active ? 1 : 0.5 }}>
                                                <td style={{ padding: '9px 14px', color: '#ccc', cursor: 'grab' }}><GripVertical size={14} /></td>
                                                <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#aaa', fontSize: '0.78rem' }}>{i + 1}</td>
                                                <td style={{ padding: '9px 14px', fontWeight: 500, color: '#333', maxWidth: '360px' }}>{q.text}</td>
                                                <td style={{ padding: '9px 14px' }}>
                                                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 500, background: q.type.includes('Rating') ? '#f5f5f5' : q.type === 'Yes / No' ? '#f0f9ff' : '#fefce8', color: q.type.includes('Rating') ? '#555' : q.type === 'Yes / No' ? '#0369a1' : '#854d0e', border: `1px solid ${q.type.includes('Rating') ? '#e8e8e8' : q.type === 'Yes / No' ? '#bae6fd' : '#fde68a'}` }}>
                                                        {q.type}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                                                    <span style={{ cursor: 'pointer', color: q.mandatory ? '#16a34a' : '#ddd' }} onClick={() => setQuestions(prev => prev.map(qq => qq.id === q.id ? { ...qq, mandatory: !qq.mandatory } : qq))}>
                                                        <CheckCircle size={16} />
                                                    </span>
                                                </td>
                                                <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                                                    <span style={{ cursor: 'pointer', color: q.active ? '#16a34a' : '#ccc' }} onClick={() => setQuestions(prev => prev.map(qq => qq.id === q.id ? { ...qq, active: !qq.active } : qq))}>
                                                        {q.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '9px 14px' }}><button style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#888' }}><Edit3 size={12} /></button></td>
                                                <td style={{ padding: '9px 14px' }}><button style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#ccc' }}><Trash2 size={12} /></button></td>
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
}
