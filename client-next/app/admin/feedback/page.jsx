'use client';
import React, { useState, useEffect, useCallback } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, Download, CheckCircle,
    Filter, Edit3, Trash2, Plus, ToggleLeft, ToggleRight, ArrowLeft, GripVertical, RefreshCw, Trophy, Users, GraduationCap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

export default function AdminFeedbackPage() {
    const router = useRouter();
    const { authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [viewingLecture, setViewingLecture] = useState(null);
    const [filterRating, setFilterRating] = useState('all');
    const [loading, setLoading] = useState(true);

    // Live data states
    const [summaryData, setSummaryData] = useState({ totalLectures: 0, avgRating: 0, onTimeRate: 0, descriptiveCount: 0, totalSubmissions: 0, totalEnrolled: 0 });
    const [ratingDistribution, setRatingDistribution] = useState([]);
    const [lectureFeedbacks, setLectureFeedbacks] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [questions, setQuestions] = useState([]);

    // Detail view data
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Question modal state
    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [questionForm, setQuestionForm] = useState({ question: '', type: 'rating' });

    // Forms tab state
    const [feedbackForms, setFeedbackForms] = useState([]);
    const [formsStats, setFormsStats] = useState({ total: 0, active: 0, expired: 0 });
    const [formsFilter, setFormsFilter] = useState('all');
    const [formsLoading, setFormsLoading] = useState(false);
    const [showDeadlineModal, setShowDeadlineModal] = useState(false);
    const [editingDeadlineForm, setEditingDeadlineForm] = useState(null);
    const [newDeadline, setNewDeadline] = useState('');
    const [savingDeadline, setSavingDeadline] = useState(false);
    const [savingQuestion, setSavingQuestion] = useState(false);

    // Student-wise response state
    const [detailSubTab, setDetailSubTab] = useState('questions');
    const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [studentResponse, setStudentResponse] = useState(null);
    const [loadingStudentResponse, setLoadingStudentResponse] = useState(false);

    // Fetch overview data
    const fetchOverview = useCallback(async () => {
        setLoading(true);
        try {
            const [analyticsRes, questionsRes] = await Promise.allSettled([
                api.get('/api/admin/feedback/analytics'),
                api.get('/api/admin/feedback/questions'),
            ]);

            if (analyticsRes.status === 'fulfilled') {
                const d = analyticsRes.value;
                setSummaryData(d.summary || {});
                setRatingDistribution(d.ratingDistribution || []);
                setLectureFeedbacks(d.lectures || []);
                setTrendData(d.trendData || []);
            }

            if (questionsRes.status === 'fulfilled') {
                setQuestions((questionsRes.value.questions || []).map(q => ({
                    id: q.id,
                    text: q.question,
                    type: q.type === 'rating' ? 'Rating (1-5)' : q.type === 'yes_no' ? 'Yes / No' : q.type === 'mcq' ? 'MCQ' : 'Descriptive',
                    mandatory: true,
                    active: q.active !== false,
                    category: q.category,
                })));
            }
        } catch (e) {
            console.error('Failed to load feedback analytics:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch detail for a specific lecture/session
    const fetchDetail = async (sessionId) => {
        setDetailLoading(true);
        try {
            const res = await api.get(`/api/admin/feedback/analytics?session_id=${sessionId}`);
            setDetailData(res);
        } catch (e) {
            console.error('Failed to load session detail:', e);
        } finally {
            setDetailLoading(false);
        }
    };

    // Fetch forms data
    const fetchForms = useCallback(async () => {
        setFormsLoading(true);
        try {
            const res = await api.get(`/api/admin/feedback/forms?status=${formsFilter}`);
            setFeedbackForms(res.forms || []);
            setFormsStats(res.stats || {});
        } catch (e) {
            console.error('Failed to load forms:', e);
        } finally {
            setFormsLoading(false);
        }
    }, [formsFilter]);

    useEffect(() => { if (authReady) fetchOverview(); }, [fetchOverview, authReady]);
    useEffect(() => { if (authReady && activeTab === 'forms') fetchForms(); }, [fetchForms, authReady, activeTab]);

    // Auto-refresh every 30 seconds for live updates
    useEffect(() => {
        if (!authReady) return;
        const interval = setInterval(() => {
            fetchOverview();
            if (activeTab === 'forms') fetchForms();
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchOverview, fetchForms, authReady, activeTab]);

    // Deadline edit handler
    const handleEditDeadline = (form) => {
        setEditingDeadlineForm(form);
        setNewDeadline(form.deadline ? new Date(form.deadline).toISOString().slice(0, 16) : '');
        setShowDeadlineModal(true);
    };

    const handleSaveDeadline = async () => {
        if (!editingDeadlineForm) return;
        setSavingDeadline(true);
        try {
            await api.patch('/api/admin/feedback/forms', {
                session_id: editingDeadlineForm.session_id,
                feedback_deadline: newDeadline ? new Date(newDeadline).toISOString() : null,
            });
            setShowDeadlineModal(false);
            fetchForms();
        } catch (e) {
            alert('Failed to update deadline: ' + e.message);
        } finally {
            setSavingDeadline(false);
        }
    };

    const handleViewDetail = (lf) => {
        const sessionId = lf.session_id || lf.id;
        setViewingLecture({ ...lf, id: sessionId });
        setActiveTab('overview');
        setDetailSubTab('questions');
        setPrivacyConfirmed(false);
        setConfirmText('');
        setSelectedStudentId('');
        setStudentResponse(null);
        fetchDetail(sessionId);
    };

    const handleFetchStudentResponse = async (studentId) => {
        if (!viewingLecture || !studentId) return;
        setSelectedStudentId(studentId);
        setLoadingStudentResponse(true);
        try {
            const res = await api.get(`/api/admin/feedback/student-response?session_id=${viewingLecture.id}&student_id=${studentId}`);
            setStudentResponse(res);
        } catch (e) {
            console.error('Failed to load student response:', e);
        } finally {
            setLoadingStudentResponse(false);
        }
    };

    // Question CRUD handlers
    const handleToggleQuestion = async (q, field) => {
        const updates = { id: q.id };
        if (field === 'active') updates.active = !q.active;
        try {
            await api.patch('/api/admin/feedback/questions', updates);
            fetchOverview();
        } catch (e) {
            console.error('Failed to update question:', e);
        }
    };

    const handleDeleteQuestion = async (q) => {
        if (!confirm(`Delete "${q.text}"?`)) return;
        try {
            await api.delete(`/api/admin/feedback/questions?id=${q.id}`);
            fetchOverview();
        } catch (e) {
            console.error('Failed to delete question:', e);
        }
    };

    const openAddModal = () => {
        setEditingQuestion(null);
        setQuestionForm({ question: '', type: 'rating' });
        setShowQuestionModal(true);
    };

    const openEditModal = (q) => {
        setEditingQuestion(q);
        setQuestionForm({ question: q.text, type: q.type.includes('Rating') ? 'rating' : q.type === 'Yes / No' ? 'yes_no' : 'text' });
        setShowQuestionModal(true);
    };

    const handleSaveQuestion = async () => {
        if (!questionForm.question.trim()) return;
        setSavingQuestion(true);
        try {
            if (editingQuestion) {
                await api.patch('/api/admin/feedback/questions', { id: editingQuestion.id, question: questionForm.question, type: questionForm.type });
            } else {
                await api.post('/api/admin/feedback/questions', { question: questionForm.question, type: questionForm.type });
            }
            setShowQuestionModal(false);
            fetchOverview();
        } catch (e) {
            console.error('Failed to save question:', e);
            alert('Failed to save question: ' + e.message);
        } finally {
            setSavingQuestion(false);
        }
    };

    const navTo = p => router.push(p);

    const filteredResponses = detailData?.descriptive
        ? (filterRating === 'all' ? detailData.descriptive : detailData.descriptive.filter(r => r.rating === parseInt(filterRating)))
        : [];

    const tabStyle = active => ({ padding: '6px 16px', borderRadius: '6px', border: `1px solid ${active ? '#111' : '#e8e8e8'}`, background: active ? '#111' : '#fff', color: active ? '#fff' : '#888', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' });
    const labelStyle = { color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' };
    const valueStyle = { fontWeight: 700, color: '#111', fontFamily: 'monospace', fontSize: '0.78rem' };

    // Mini SVG trend chart
    const TrendChart = ({ dataKey, color, label, minY, maxY }) => {
        if (!trendData || trendData.length === 0) return (
            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                <div style={{ padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>{label}</span>
                </div>
                <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc', fontSize: '0.82rem' }}>No trend data yet</div>
            </div>
        );
        const W = 500, H = 160;
        const p = { top: 20, right: 20, bottom: 30, left: 36 };
        const cW = W - p.left - p.right, cH = H - p.top - p.bottom;
        const xStep = trendData.length > 1 ? cW / (trendData.length - 1) : cW;
        const yScale = v => p.top + cH - ((v - minY) / (maxY - minY)) * cH;
        const pts = trendData.map((d, i) => ({ x: p.left + i * xStep, y: yScale(d[dataKey] || 0), v: d[dataKey] || 0 }));
        const path = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
        return (
            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                <div style={{ padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>{label}</span>
                    <span style={{ fontSize: '0.68rem', color: '#bbb' }}>Last {trendData.length} lectures</span>
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

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
                        <div className="nav-item" onClick={() => navTo('/admin/schedule')} style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/live-students')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Live Students</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/students')} style={{ cursor: 'pointer' }}><GraduationCap size={18} /> <span>Student Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/leave-requests')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Leave Requests</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                        <div className="nav-item active"><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/leaderboard')} style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/reports')} style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/notifications')} style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/settings')} style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
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
                        <button style={tabStyle(activeTab === 'forms')} onClick={() => { setActiveTab('forms'); setViewingLecture(null); }}>Feedback Forms</button>
                        <button style={tabStyle(activeTab === 'config')} onClick={() => { setActiveTab('config'); setViewingLecture(null); }}>Question Configuration</button>
                    </div>

                    {loading && (
                        <div>
                            {/* Skeleton summary strip */}
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', marginBottom: '1.2rem', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '14px 1.2rem', gap: '14px' }}>
                                    {[1,2,3,4,5].map(i => (
                                        <React.Fragment key={i}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px' }}>
                                                <div style={{ width: '60px', height: '9px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
                                                <div style={{ width: '40px', height: '12px', borderRadius: '4px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                            </div>
                                            {i < 5 && <div style={{ width: '1px', height: '20px', background: '#e8e8e8' }} />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                            {/* Skeleton chart area */}
                            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
                                <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '1.2rem' }}>
                                    {[1,2,3,4,5].map(i => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                            <div style={{ width: '20px', height: '10px', borderRadius: '3px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
                                            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
                                            <div style={{ width: '30px', height: '10px', borderRadius: '3px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '1.2rem' }}>
                                    <div style={{ width: '100%', height: '140px', borderRadius: '6px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite' }} />
                                </div>
                            </div>
                            {/* Skeleton table */}
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                                <div style={{ padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{ width: '160px', height: '12px', borderRadius: '4px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite' }} />
                                </div>
                                {[1,2,3,4].map(i => (
                                    <div key={i} style={{ display: 'flex', gap: '16px', padding: '12px 1.2rem', borderBottom: '1px solid #f5f5f5' }}>
                                        {[120,60,80,40,60,40,70].map((w,j) => (
                                            <div key={j} style={{ width: `${w}px`, height: '10px', borderRadius: '3px', background: j%2===0?'#f0f0f0':'#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${(i*7+j)*0.05}s` }} />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'overview' && !viewingLecture && !loading && (
                        <>
                            {/* Summary strip */}
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', marginBottom: '1.2rem', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 1.2rem', fontSize: '0.78rem', overflowX: 'auto', whiteSpace: 'nowrap', gap: 0 }}>
                                    {[
                                        ['Lectures', String(summaryData.totalLectures || 0)],
                                        ['Avg Rating', `${summaryData.avgRating || 0} /5`],
                                        ['Submission Rate', `${summaryData.onTimeRate || 0}%`],
                                        ['Descriptive Responses', String(summaryData.descriptiveCount || 0)],
                                        ['Submissions', `${summaryData.totalSubmissions || 0}/${summaryData.totalEnrolled || 0}`],
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
                                            {(ratingDistribution.length > 0 ? ratingDistribution : [{ rating: '—', count: 0, pct: 0 }]).map(r => (
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
                                    <TrendChart dataKey="avg" color="#555" label="Average Rating Trend" minY={1.0} maxY={5.0} />
                                    <TrendChart dataKey="sub" color="#888" label="Submission Rate Trend" minY={0} maxY={100} />
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
                                            {lectureFeedbacks.length === 0 ? (
                                                <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#ccc' }}>No feedback data yet. Feedback will appear here when students submit responses.</td></tr>
                                            ) : lectureFeedbacks.map(lf => (
                                                <tr key={lf.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '9px 16px', fontWeight: 600, color: '#111' }}>{lf.lecture}</td>
                                                    <td style={{ padding: '9px 16px', color: '#888', fontFamily: 'monospace', fontSize: '0.78rem' }}>{formatDate(lf.date)}</td>
                                                    <td style={{ padding: '9px 16px', color: '#555' }}>{lf.faculty || 'TBA'}</td>
                                                    <td style={{ padding: '9px 16px' }}><span style={{ fontWeight: 700, fontFamily: 'monospace', color: lf.avg >= 4.0 ? '#111' : lf.avg >= 3.0 ? '#b45309' : '#dc2626' }}>{lf.avg || '—'}</span></td>
                                                    <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{lf.submissions}/{lf.totalEnrolled}</td>
                                                    <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>{lf.descCount}</td>
                                                    <td style={{ padding: '9px 16px' }}>
                                                        <button onClick={() => handleViewDetail(lf)} className="change-status-btn" style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#555' }}>View Details</button>
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
                                <button onClick={() => { setViewingLecture(null); setDetailData(null); setFilterRating('all'); setDetailSubTab('questions'); setPrivacyConfirmed(false); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#555' }}>
                                    <ArrowLeft size={13} /> Back
                                </button>
                            </div>
                            {detailLoading ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc' }}>Loading analytics...</div>
                            ) : detailData ? (
                                <>
                                    {/* Session header strip */}
                                    <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', marginBottom: '1.2rem', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 1.2rem', overflowX: 'auto', whiteSpace: 'nowrap', gap: 0 }}>
                                            {[
                                                ['Lecture', viewingLecture.lecture || viewingLecture.title || ''],
                                                ['Faculty', detailData.session?.faculty_name || viewingLecture.faculty || ''],
                                                ['Avg Rating', String(detailData.avgRating || 0)],
                                                ['Submissions', `${detailData.totalResponses || 0}/${detailData.totalEnrolled || 0}`],
                                                ['Date', formatDate(viewingLecture.date || viewingLecture.session_date)],
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

                                    {/* Sub-tabs: Question Analytics | Student Responses */}
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                                        <button onClick={() => setDetailSubTab('questions')} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid ' + (detailSubTab === 'questions' ? '#111' : '#e8e8e8'), background: detailSubTab === 'questions' ? '#111' : '#fff', color: detailSubTab === 'questions' ? '#fff' : '#555', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Question Analytics</button>
                                        <button onClick={() => setDetailSubTab('students')} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid ' + (detailSubTab === 'students' ? '#111' : '#e8e8e8'), background: detailSubTab === 'students' ? '#111' : '#fff', color: detailSubTab === 'students' ? '#fff' : '#555', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Student-wise Responses</button>
                                    </div>

                                    {/* ===== Question Analytics Sub-tab ===== */}
                                    {detailSubTab === 'questions' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {(detailData.questionAnalytics || []).length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc', fontSize: '0.82rem' }}>No per-question data available.</div>}
                                            {(() => {
                                                const categories = [...new Set((detailData.questionAnalytics || []).map(q => q.category))];
                                                return categories.map(cat => (
                                                    <div key={cat} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                                                        <div style={{ padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                                                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>{cat}</span>
                                                        </div>
                                                        {(detailData.questionAnalytics || []).filter(q => q.category === cat).map(q => (
                                                            <div key={q.id} style={{ padding: '12px 1.2rem', borderBottom: '1px solid #f5f5f5' }}>
                                                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#333', marginBottom: '8px' }}>{q.question}</div>
                                                                <div style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: '6px' }}>{q.total} response{q.total !== 1 ? 's' : ''}</div>

                                                                {/* Yes/No type */}
                                                                {q.type === 'yes_no' && (
                                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                                        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', flex: 1, height: '24px' }}>
                                                                            <div style={{ width: `${q.yesPct}%`, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, color: '#fff', minWidth: q.yesPct > 10 ? 'auto' : '0' }}>{q.yesPct > 10 ? `Yes ${q.yesPct}%` : ''}</div>
                                                                            <div style={{ width: `${q.noPct}%`, background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, color: '#fff', minWidth: q.noPct > 10 ? 'auto' : '0' }}>{q.noPct > 10 ? `No ${q.noPct}%` : ''}</div>
                                                                        </div>
                                                                        <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#888', flexShrink: 0, width: '80px', textAlign: 'right' }}>{q.yesCount}Y / {q.noCount}N</span>
                                                                    </div>
                                                                )}

                                                                {/* Rating type */}
                                                                {q.type === 'rating' && (
                                                                    <div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                                            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace', color: q.avgRating >= 4 ? '#16a34a' : q.avgRating >= 3 ? '#b45309' : '#dc2626' }}>{q.avgRating}</span>
                                                                            <span style={{ fontSize: '0.72rem', color: '#aaa' }}>/ 5 avg</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '3px' }}>
                                                                            {(q.distribution || []).map(d => (
                                                                                <div key={d.value} style={{ flex: 1, textAlign: 'center' }}>
                                                                                    <div style={{ height: `${Math.max(d.pct * 0.5, 2)}px`, background: d.value >= 4 ? '#16a34a' : d.value >= 3 ? '#b45309' : '#dc2626', borderRadius: '2px', transition: 'height 0.3s' }} />
                                                                                    <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#888', marginTop: '2px' }}>{d.value}★ ({d.count})</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* MCQ type */}
                                                                {q.type === 'mcq' && (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        {(q.distribution || []).map(d => (
                                                                            <div key={d.value} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#333', minWidth: '140px' }}>{d.value}</span>
                                                                                <div style={{ flex: 1, height: '16px', background: '#f5f5f5', borderRadius: '4px', overflow: 'hidden' }}>
                                                                                    <div style={{ width: `${d.pct}%`, height: '100%', background: '#6355F1', borderRadius: '4px', transition: 'width 0.3s' }} />
                                                                                </div>
                                                                                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#888', minWidth: '60px', textAlign: 'right' }}>{d.count} ({d.pct}%)</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Text type */}
                                                                {q.type === 'text' && (q.textResponses || []).length > 0 && (
                                                                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '6px', padding: '8px' }}>
                                                                        {(q.textResponses || []).map((t, i) => (
                                                                            <div key={i} style={{ padding: '6px 0', borderBottom: i < q.textResponses.length - 1 ? '1px solid #f5f5f5' : 'none', fontSize: '0.8rem', color: '#555' }}>
                                                                                <span style={{ color: '#333' }}>{t.text}</span>
                                                                                <span style={{ fontSize: '0.68rem', color: '#ccc', marginLeft: '8px' }}>— {t.student}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    )}

                                    {/* ===== Student-wise Responses Sub-tab ===== */}
                                    {detailSubTab === 'students' && (
                                        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                                            {!privacyConfirmed ? (
                                                <div style={{ padding: '2rem', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔒</div>
                                                    <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: '#dc2626' }}>Privacy Notice</h3>
                                                    <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#555', maxWidth: '500px', marginInline: 'auto', lineHeight: '1.6' }}>
                                                        Viewing individual student responses is a <strong>breach of anonymity</strong>. This feature should <strong>only</strong> be used in serious cases such as:
                                                    </p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', margin: '12px 0 16px', fontSize: '0.78rem', color: '#b45309' }}>
                                                        <span>⚠️ False or fabricated data</span>
                                                        <span>⚠️ Foul or abusive language</span>
                                                        <span>⚠️ Serious misconduct evidence</span>
                                                    </div>
                                                    <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#888' }}>Type <strong>confirm</strong> below to proceed:</p>
                                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', maxWidth: '300px', marginInline: 'auto' }}>
                                                        <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder='Type "confirm"' style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #e8e8e8', fontSize: '0.82rem', textAlign: 'center' }} />
                                                        <button disabled={confirmText.toLowerCase() !== 'confirm'} onClick={() => { setPrivacyConfirmed(true); setConfirmText(''); }} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: confirmText.toLowerCase() === 'confirm' ? '#dc2626' : '#f0f0f0', color: confirmText.toLowerCase() === 'confirm' ? '#fff' : '#ccc', fontSize: '0.82rem', fontWeight: 600, cursor: confirmText.toLowerCase() === 'confirm' ? 'pointer' : 'not-allowed' }}>Proceed</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ padding: '1.2rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#555' }}>Select Student:</label>
                                                        <select value={selectedStudentId} onChange={e => handleFetchStudentResponse(e.target.value)} style={{ flex: 1, maxWidth: '400px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e8e8e8', fontSize: '0.82rem' }}>
                                                            <option value=''>— Choose a student —</option>
                                                            {(detailData.submittedStudents || []).map(s => (
                                                                <option key={s.id} value={s.id}>{s.name} ({s.enrollmentNo})</option>
                                                            ))}
                                                        </select>
                                                        <button onClick={() => { setPrivacyConfirmed(false); setSelectedStudentId(''); setStudentResponse(null); }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>🔒 Re-lock</button>
                                                    </div>

                                                    {loadingStudentResponse && <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc' }}>Loading response...</div>}

                                                    {studentResponse && !loadingStudentResponse && (
                                                        <div>
                                                            <div style={{ padding: '10px 14px', background: '#f5f3ff', borderRadius: '8px', marginBottom: '12px', display: 'flex', gap: '16px', fontSize: '0.78rem' }}>
                                                                <span><strong>Student:</strong> {studentResponse.student?.name}</span>
                                                                <span><strong>Roll No:</strong> {studentResponse.student?.enrollmentNo}</span>
                                                            </div>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                                <thead>
                                                                    <tr style={{ background: '#fafafa' }}>
                                                                        {['Category', 'Question', 'Type', 'Answer'].map(h => (
                                                                            <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(studentResponse.responses || []).map((r, i) => (
                                                                        <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                                            <td style={{ padding: '8px 14px', fontSize: '0.72rem', fontWeight: 600, color: '#6355F1' }}>{r.category}</td>
                                                                            <td style={{ padding: '8px 14px', color: '#333' }}>{r.question}</td>
                                                                            <td style={{ padding: '8px 14px' }}>
                                                                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, background: r.type === 'yes_no' ? '#f0fdf4' : r.type === 'rating' ? '#fffbeb' : r.type === 'mcq' ? '#f5f3ff' : '#f0f9ff', color: r.type === 'yes_no' ? '#16a34a' : r.type === 'rating' ? '#b45309' : r.type === 'mcq' ? '#6355F1' : '#0369a1' }}>{r.type === 'yes_no' ? 'Yes/No' : r.type === 'rating' ? 'Rating' : r.type === 'mcq' ? 'MCQ' : 'Text'}</span>
                                                                            </td>
                                                                            <td style={{ padding: '8px 14px', fontWeight: 600, fontFamily: r.type === 'text' ? 'inherit' : 'monospace', color: r.type === 'yes_no' ? (r.answer === 'Yes' ? '#16a34a' : '#dc2626') : r.type === 'rating' ? '#b45309' : '#333' }}>{r.answer}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                    {!studentResponse && !loadingStudentResponse && selectedStudentId === '' && (
                                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc', fontSize: '0.82rem' }}>Select a student from the dropdown above to view their responses.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </>
                    )}

                    {/* Question Config */}
                    {activeTab === 'config' && !loading && (
                        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Question Configuration</span>
                                <button onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 14px', borderRadius: '6px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}><Plus size={12} /> Add Question</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '7px 1.2rem', gap: '16px', fontSize: '0.68rem', color: '#aaa', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                                <span>Active <span style={{ fontWeight: 600, color: '#888' }}>{questions.filter(q => q.active).length}</span></span>
                                <span style={{ color: '#ddd' }}>·</span>
                                <span>Total <span style={{ fontWeight: 600, color: '#888' }}>{questions.length}</span></span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            {['', '#', 'Question', 'Type', 'Active', '', ''].map((h, i) => (
                                                <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {questions.length === 0 ? (
                                            <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#ccc' }}>No questions configured yet.</td></tr>
                                        ) : questions.map((q, i) => (
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
                                                    <span style={{ cursor: 'pointer', color: q.active ? '#16a34a' : '#ccc' }} onClick={() => handleToggleQuestion(q, 'active')}>
                                                        {q.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '9px 14px' }}><button onClick={() => openEditModal(q)} style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#888' }}><Edit3 size={12} /></button></td>
                                                <td style={{ padding: '9px 14px' }}><button onClick={() => handleDeleteQuestion(q)} style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#ccc' }}><Trash2 size={12} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Forms tab */}
                    {activeTab === 'forms' && !loading && (
                        <>
                            {/* Stats strip */}
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '1.2rem' }}>
                                {[
                                    { label: 'Total Forms', value: formsStats.total, color: '#6355F1' },
                                    { label: 'Active', value: formsStats.active, color: '#16a34a' },
                                    { label: 'Expired', value: formsStats.expired, color: '#dc2626' },
                                    { label: 'Total Submissions', value: formsStats.totalSubmissions || 0, color: '#0369a1' },
                                ].map(s => (
                                    <div key={s.label} style={{ flex: 1, background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '14px 18px' }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{s.label}</div>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Filter */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                {['all', 'active', 'expired'].map(f => (
                                    <button key={f} onClick={() => setFormsFilter(f)} style={{ padding: '5px 14px', borderRadius: '6px', border: '1px solid ' + (formsFilter === f ? '#111' : '#e8e8e8'), background: formsFilter === f ? '#111' : '#fff', color: formsFilter === f ? '#fff' : '#888', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{f}</button>
                                ))}
                            </div>

                            {/* Forms table */}
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr style={{ background: '#fafafa' }}>
                                                {['Course', 'Session', 'Date', 'Status', 'Deadline', 'Submissions', 'Avg Rating', 'Actions'].map(h => (
                                                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formsLoading ? (
                                                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#ccc' }}>Loading...</td></tr>
                                            ) : feedbackForms.length === 0 ? (
                                                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#ccc' }}>No feedback forms found.</td></tr>
                                            ) : feedbackForms.map(form => (
                                                <tr key={form.session_id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#6355F1', fontSize: '0.78rem' }}>{form.course?.name || '—'}</td>
                                                    <td style={{ padding: '10px 14px', fontWeight: 500, color: '#333' }}>{form.title}</td>
                                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>{form.session_date ? new Date(form.session_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</td>
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, background: form.expired ? '#fef2f2' : '#f0fdf4', color: form.expired ? '#dc2626' : '#16a34a', border: `1px solid ${form.expired ? '#fecaca' : '#bbf7d0'}` }}>{form.expired ? 'Expired' : 'Active'}</span>
                                                    </td>
                                                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: form.expired ? '#dc2626' : '#b45309', fontWeight: 600 }}>
                                                        {form.expired ? 'Ended' : `${Math.round(form.hoursLeft)}h left`}
                                                    </td>
                                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#111' }}>
                                                        {form.submissions}/{form.enrolled}
                                                        <span style={{ fontSize: '0.68rem', color: '#bbb', fontWeight: 400, marginLeft: '4px' }}>({form.enrolled > 0 ? Math.round((form.submissions / form.enrolled) * 100) : 0}%)</span>
                                                    </td>
                                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: form.avgRating ? '#111' : '#ccc' }}>{form.avgRating || '—'}</td>
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button onClick={() => handleViewDetail(form)} style={{ padding: '3px 10px', borderRadius: '4px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#555' }}>View</button>
                                                            <button onClick={() => handleEditDeadline(form)} style={{ padding: '3px 10px', borderRadius: '4px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#6355F1' }}>Edit Deadline</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Add/Edit Question Modal */}
            {showQuestionModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowQuestionModal(false)}>
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '480px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 1.2rem', fontSize: '1rem', fontWeight: 700 }}>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h3>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: '6px' }}>Question Text</label>
                            <textarea value={questionForm.question} onChange={e => setQuestionForm(prev => ({ ...prev, question: e.target.value }))} placeholder="Enter question text..." rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e8e8e8', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: '6px' }}>Response Type</label>
                            <div style={{ display: 'flex', gap: '0', flexWrap: 'wrap' }}>
                                {[['rating', 'Rating (1-5)'], ['yes_no', 'Yes / No'], ['mcq', 'MCQ'], ['text', 'Descriptive']].map(([val, label], i) => (
                                    <button key={val} onClick={() => setQuestionForm(prev => ({ ...prev, type: val }))} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #e8e8e8', borderLeft: i !== 0 ? 'none' : '1px solid #e8e8e8', borderRadius: i === 0 ? '6px 0 0 6px' : i === 3 ? '0 6px 6px 0' : '0', background: questionForm.type === val ? '#111' : '#fff', color: questionForm.type === val ? '#fff' : '#555', transition: 'all 0.15s' }}>{label}</button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setShowQuestionModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#555' }}>Cancel</button>
                            <button onClick={handleSaveQuestion} disabled={!questionForm.question.trim() || savingQuestion} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: questionForm.question.trim() ? '#111' : '#e5e7eb', cursor: questionForm.question.trim() ? 'pointer' : 'not-allowed', fontSize: '0.8rem', fontWeight: 600, color: questionForm.question.trim() ? '#fff' : '#aaa' }}>{savingQuestion ? 'Saving...' : editingQuestion ? 'Save Changes' : 'Add Question'}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Deadline Edit Modal */}
            {showDeadlineModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowDeadlineModal(false)}>
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700 }}>Edit Feedback Deadline</h3>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#888' }}>Session: {editingDeadlineForm?.title}</p>
                        <div style={{ marginBottom: '1.2rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: '6px' }}>New Deadline</label>
                            <input type="datetime-local" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e8e8e8', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setShowDeadlineModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#555' }}>Cancel</button>
                            <button onClick={handleSaveDeadline} disabled={savingDeadline} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#6355F1', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>{savingDeadline ? 'Saving...' : 'Save Deadline'}</button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
        </div>
    );
}
