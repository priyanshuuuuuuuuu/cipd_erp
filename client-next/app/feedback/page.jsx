'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Bell, Search, Menu, ChevronLeft, ChevronRight,
    CheckCircle, Clock, FileText, Send, Lock, Trophy, Award, ArrowLeft,
    AlertTriangle, Eye, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

/* ─── MCQ options for engagement question ─── */
const MCQ_OPTIONS = ['Highly Engaging', 'Engaging', 'Average', 'Poor'];

/* ─── Category display config ─── */
const CATEGORY_CONFIG = {
    Structure:  { label: 'I. Structure of the Session',  icon: '🏗️' },
    Content:    { label: 'II. Content',                  icon: '📚' },
    Faculty:    { label: 'III. Faculty / Instructor',    icon: '👨‍🏫' },
    Logistics:  { label: 'IV. Logistics and Support',    icon: '🏢' },
    Engagement: { label: 'V. Engagement Level',          icon: '🎯' },
    General:    { label: 'VI. Additional Comments',      icon: '💬' },
};

export default function FeedbackPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('feedback');

    // Data states
    const [forms, setForms] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [stats, setStats] = useState({ totalSubmitted: 0, totalPending: 0 });
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form fill states
    const [selectedForm, setSelectedForm] = useState(null);
    const [responses, setResponses] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [justSubmitted, setJustSubmitted] = useState(false);

    // View submitted response modal
    const [viewResponseForm, setViewResponseForm] = useState(null);
    const [viewResponseData, setViewResponseData] = useState([]);
    const [viewResponseLoading, setViewResponseLoading] = useState(false);

    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    /* ─── Initialize responses with optimal defaults ─── */
    const initializeDefaults = useCallback((qs) => {
        const defaults = {};
        qs.forEach(q => {
            if (q.type === 'yes_no') defaults[q.id] = true;
            else if (q.type === 'rating') defaults[q.id] = 5;
            else if (q.type === 'mcq') defaults[q.id] = 'Highly Engaging';
        });
        setResponses(defaults);
    }, []);

    /* ─── Fetch data ─── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        const [fbRes, lbRes] = await Promise.allSettled([
            api.get('/api/feedback/pending'),
            api.get('/api/feedback/leaderboard').catch(() => ({ leaderboard: [] })),
        ]);
        if (fbRes.status === 'fulfilled') {
            setForms(fbRes.value.forms || []);
            setQuestions(fbRes.value.questions || []);
            setStats(fbRes.value.stats || {});
        }
        if (lbRes.status === 'fulfilled') {
            setLeaderboard(lbRes.value.leaderboard || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => { if (authReady) fetchData(); }, [fetchData, authReady]);

    /* ─── Open a form to fill ─── */
    const openForm = (form) => {
        setSelectedForm(form);
        setJustSubmitted(false);
        initializeDefaults(questions);
    };

    const closeForm = () => {
        setSelectedForm(null);
        setResponses({});
        setJustSubmitted(false);
    };

    /* ─── Open submitted response viewer ─── */
    const openViewResponse = async (form) => {
        setViewResponseForm(form);
        setViewResponseLoading(true);
        setViewResponseData([]);
        try {
            const data = await api.get(`/api/feedback/my-response?session_id=${form.session_id}`);
            setViewResponseData(data.responses || []);
        } catch (e) {
            console.error('Failed to load response:', e);
        } finally {
            setViewResponseLoading(false);
        }
    };

    const closeViewResponse = () => {
        setViewResponseForm(null);
        setViewResponseData([]);
    };

    /* ─── Response change handler ─── */
    const handleResponseChange = (questionId, value) => {
        setResponses(prev => ({ ...prev, [questionId]: value }));
    };

    /* ─── Submit handler ─── */
    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const responseArray = questions.map(q => {
                const val = responses[q.id];
                return {
                    question_id: q.id,
                    rating: q.type === 'rating' ? (parseInt(val) || null) : null,
                    yes_no: q.type === 'yes_no' ? val : null,
                    text_answer: q.type === 'text' ? (val || null) : (q.type === 'mcq' ? (val || null) : null),
                };
            }).filter(r => r.rating !== null || r.yes_no !== null || r.text_answer !== null);

            await api.post('/api/feedback/submit', {
                session_id: selectedForm?.session_id,
                responses: responseArray,
            });
            setJustSubmitted(true);
            fetchData();
        } catch (e) {
            alert('Failed to submit feedback: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    /* ─── Group questions by category ─── */
    const groupedQuestions = questions.reduce((acc, q) => {
        const cat = q.category || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(q);
        return acc;
    }, {});

    /* ─── Styles ─── */
    const labelStyle = { color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' };
    const tabStyle = (active) => ({
        padding: '6px 16px', borderRadius: '6px', border: '1px solid ' + (active ? '#111' : '#e8e8e8'),
        background: active ? '#111' : '#fff', color: active ? '#fff' : '#888',
        fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
    });

    const navTo = (p) => router.push(p);

    /* ─── Time helpers ─── */
    const getDeadlineDisplay = (form) => {
        if (!form.deadline) return '—';
        const d = new Date(form.deadline);
        const now = new Date();
        const diff = d - now;
        if (diff <= 0) return 'Expired';
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (hrs > 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h left`;
        if (hrs > 0) return `${hrs}h ${mins}m left`;
        return `${mins}m left`;
    };

    const pendingForms   = forms.filter(f => !f.submitted && !f.expired);
    const expiredForms   = forms.filter(f => !f.submitted && f.expired);
    const submittedForms = forms.filter(f => f.submitted);

    return (
        <div className="dashboard-container">
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
                        <div className="nav-item" onClick={() => navTo('/dashboard')} style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Home</span></div>
                        <div className="nav-item" onClick={() => navTo('/attendance')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Attendance</span></div>
                        <div className="nav-item" onClick={() => navTo('/grades')} style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div className="nav-item" onClick={() => navTo('/teachers')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div className="nav-item active"><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div className="nav-item" onClick={() => navTo('/leaderboard')} style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
                        <div className="nav-item" onClick={() => navTo('/courses')} style={{ cursor: 'pointer' }}><FileText size={18} /> <span>Courses</span></div>
                        <div className="nav-item" onClick={() => navTo('/calendar')} style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Calendar</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div onClick={() => navTo('/settings')} className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content">
                <div className="content-center full-width" style={{ height: 'fit-content', minHeight: '100%' }}>
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Lecture Feedback</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                            <Bell size={20} color="#555" /><MessageSquare size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem' }}>
                        <button style={tabStyle(activeTab === 'feedback')} onClick={() => { setActiveTab('feedback'); closeForm(); }}>Lecture Feedback</button>
                        <button style={tabStyle(activeTab === 'leaderboard')} onClick={() => { setActiveTab('leaderboard'); closeForm(); }}>Leaderboard</button>
                    </div>

                    {activeTab === 'feedback' && !selectedForm && (
                        <>
                            {/* Stats bar */}
                            {loading ? (
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '1.2rem' }}>{[1,2,3,4].map(i => (
                                    <div key={i} style={{ flex: 1, borderRadius: '10px', border: '1px solid #f0f0f0', padding: '14px 18px' }}>
                                        <div style={{ width: '50px', height: '9px', borderRadius: '3px', background: '#f5f5f5', marginBottom: '8px', animation: 'shimmer 1.5s infinite', animationDelay: `${i*0.1}s` }} />
                                        <div style={{ width: '40px', height: '18px', borderRadius: '4px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${i*0.2}s` }} />
                                    </div>
                                ))}</div>
                            ) : (
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '1.2rem' }}>
                                    {[
                                        { label: 'Pending',        value: stats.totalPending   || 0, color: '#b45309', bg: '#fffbeb' },
                                        { label: 'Submitted',      value: stats.totalSubmitted || 0, color: '#16a34a', bg: '#f0fdf4' },
                                        { label: 'Expired',        value: stats.totalExpired   || 0, color: '#dc2626', bg: '#fef2f2' },
                                        { label: 'Total Sessions', value: stats.totalAttended  || 0, color: '#6355F1', bg: '#f5f3ff' },
                                    ].map(s => (
                                        <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: '10px', border: `1px solid ${s.color}22`, padding: '14px 18px' }}>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: s.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{s.label}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pending forms */}
                            {pendingForms.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Clock size={14} color="#b45309" /> Pending Feedback ({pendingForms.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {pendingForms.map(form => (
                                            <div key={form.session_id} onClick={() => openForm(form)} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}
                                                onMouseOver={e => { e.currentTarget.style.borderColor = '#6355F1'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,85,241,0.1)'; }}
                                                onMouseOut={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.02)'; }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#6355F1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{form.course?.name || 'Course'}</div>
                                                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111', marginBottom: '4px' }}>{form.title}</div>
                                                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.72rem', color: '#999' }}>
                                                            <span>📅 {form.session_date ? new Date(form.session_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                                                            <span>👤 {form.faculty?.users ? `${form.faculty.users.first_name} ${form.faculty.users.last_name}` : 'Faculty'}</span>
                                                            <span>📍 {form.venue?.name || 'TBA'}</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: form.hoursLeft < 4 ? '#dc2626' : '#b45309', marginBottom: '4px' }}>
                                                            ⏰ {getDeadlineDisplay(form)}
                                                        </div>
                                                        <div style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: '#6355F1', color: '#fff' }}>
                                                            Fill Now →
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Expired forms */}
                            {expiredForms.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <AlertTriangle size={14} color="#dc2626" /> Expired ({expiredForms.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {expiredForms.map(form => (
                                            <div key={form.session_id} style={{ background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca', padding: '14px 18px', opacity: 0.7 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{form.course?.name || 'Course'}</div>
                                                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#555' }}>{form.title}</div>
                                                    </div>
                                                    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, background: '#dc2626', color: '#fff' }}>Expired</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Submitted forms */}
                            {submittedForms.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <CheckCircle size={14} color="#16a34a" /> Submitted ({submittedForms.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {submittedForms.map(form => (
                                            <div key={form.session_id} style={{ background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', padding: '12px 18px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{form.course?.name || 'Course'}</div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>{form.title}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <button
                                                            onClick={() => openViewResponse(form)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#fff', color: '#16a34a', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                                                        >
                                                            <Eye size={12} /> View Response
                                                        </button>
                                                        <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: '#16a34a', color: '#fff' }}>✓ Done</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No forms */}
                            {forms.length === 0 && !loading && (
                                <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '3rem', textAlign: 'center', color: '#888' }}>
                                    <CheckCircle size={40} color="#16a34a" style={{ marginBottom: '1rem' }} />
                                    <h3 style={{ color: '#333', margin: '0 0 0.5rem' }}>No Feedback Forms</h3>
                                    <p style={{ fontSize: '0.85rem' }}>Feedback forms will appear here after you attend a lecture.</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ═══════════════════ FORM FILL VIEW ═══════════════════ */}
                    {activeTab === 'feedback' && selectedForm && !justSubmitted && (
                        <>
                            <div style={{ marginBottom: '1rem' }}>
                                <button onClick={closeForm} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', color: '#555', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', marginBottom: '10px' }}>
                                    <ArrowLeft size={14} /> Back to list
                                </button>
                                <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '0', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 1.2rem', fontSize: '0.78rem', borderBottom: '1px solid #f0f0f0', overflowX: 'auto', whiteSpace: 'nowrap', gap: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={labelStyle}>Course</span><span style={{ fontWeight: 700, color: '#111', fontSize: '0.78rem' }}>{selectedForm.course?.name || 'N/A'}</span></div>
                                        <div style={{ width: '1px', height: '20px', background: '#e8e8e8' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={labelStyle}>Date</span><span style={{ fontWeight: 700, color: '#111', fontSize: '0.78rem' }}>{new Date(selectedForm.session_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                                        <div style={{ width: '1px', height: '20px', background: '#e8e8e8' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={labelStyle}>Deadline</span><span style={{ fontWeight: 700, color: selectedForm.hoursLeft < 4 ? '#dc2626' : '#b45309', fontSize: '0.78rem' }}>{getDeadlineDisplay(selectedForm)}</span></div>
                                        <div style={{ width: '1px', height: '20px', background: '#e8e8e8' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /><span style={{ fontWeight: 600, color: '#16a34a', fontSize: '0.78rem' }}>Open</span></div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 1.2rem', gap: '16px', fontSize: '0.68rem', color: '#aaa', background: '#fafafa' }}>
                                        <span>Faculty <span style={{ color: '#888', fontWeight: 500 }}>{selectedForm.faculty?.users ? `${selectedForm.faculty.users.first_name} ${selectedForm.faculty.users.last_name}` : 'Faculty'}</span></span>
                                        <span style={{ color: '#ddd' }}>·</span>
                                        <span>Venue <span style={{ color: '#888', fontWeight: 500 }}>{selectedForm.venue?.name || 'TBA'}</span></span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 16px', marginBottom: '1rem', fontSize: '0.78rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle size={14} color="#16a34a" />
                                <span><strong>Pre-filled with positive defaults.</strong> Just review and submit, or change any answer you disagree with.</span>
                            </div>

                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                <div style={{ padding: '12px 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={14} color="#888" /><span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Session Feedback Form</span>
                                    <span style={{ fontSize: '0.7rem', color: '#bbb', marginLeft: 'auto' }}>All fields pre-filled · Change only what you want</span>
                                </div>
                                <div style={{ padding: '0.8rem 1.5rem 1.5rem' }}>
                                    {Object.entries(groupedQuestions).map(([category, qs], catIdx) => {
                                        const config = CATEGORY_CONFIG[category] || { label: category, icon: '📋' };
                                        return (
                                            <div key={category} style={{ marginBottom: catIdx < Object.keys(groupedQuestions).length - 1 ? '1.5rem' : '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '8px', borderBottom: '2px solid #f0f0f0' }}>
                                                    <span style={{ fontSize: '1rem' }}>{config.icon}</span>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>{config.label}</span>
                                                </div>
                                                {qs.map((q, idx) => (
                                                    <div key={q.id} style={{ marginBottom: idx < qs.length - 1 ? '1.2rem' : '0', paddingBottom: idx < qs.length - 1 ? '1.2rem' : '0', borderBottom: idx < qs.length - 1 ? '1px solid #f9f9f9' : 'none' }}>
                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#333' }}>{q.question}</span>
                                                            {q.type === 'text' && <span style={{ fontSize: '0.68rem', color: '#bbb' }}>(Optional)</span>}
                                                        </div>
                                                        {q.type === 'rating' && (
                                                            <div style={{ display: 'flex', gap: '0', marginLeft: '0' }}>
                                                                {[1,2,3,4,5].map(n => (
                                                                    <label key={n} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',padding:'8px 16px',cursor:'pointer',border:'1px solid #e8e8e8',borderLeft:n===1?'1px solid #e8e8e8':'none',borderRadius:n===1?'6px 0 0 6px':n===5?'0 6px 6px 0':'0',background:responses[q.id]===n?'#111':'#fff',transition:'background 0.15s' }}>
                                                                        <input type="radio" name={q.id} value={n} checked={responses[q.id]===n} onChange={()=>handleResponseChange(q.id, n)} style={{ display:'none' }} />
                                                                        <span style={{ fontSize:'0.82rem',fontWeight:600,fontFamily:'monospace',color:responses[q.id]===n?'#fff':'#555' }}>{n}</span>
                                                                    </label>
                                                                ))}
                                                                <div style={{ marginLeft:'12px',display:'flex',alignItems:'center',gap:'16px',fontSize:'0.68rem',color:'#bbb' }}><span>1 = Poor</span><span>5 = Excellent</span></div>
                                                            </div>
                                                        )}
                                                        {q.type === 'yes_no' && (
                                                            <div style={{ display:'flex',gap:'0' }}>
                                                                {[true, false].map(opt => (
                                                                    <button key={String(opt)} onClick={()=>handleResponseChange(q.id, opt)} style={{ padding:'8px 24px',cursor:'pointer',fontSize:'0.82rem',fontWeight:600,border:'1px solid #e8e8e8',borderLeft:!opt?'none':'1px solid #e8e8e8',borderRadius:opt?'6px 0 0 6px':'0 6px 6px 0',background:responses[q.id]===opt?'#111':'#fff',color:responses[q.id]===opt?'#fff':'#555',transition:'background 0.15s' }}>{opt ? 'Yes' : 'No'}</button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {q.type === 'mcq' && (
                                                            <div style={{ display:'flex',gap:'0',flexWrap:'wrap' }}>
                                                                {MCQ_OPTIONS.map((opt, oi) => (
                                                                    <button key={opt} onClick={()=>handleResponseChange(q.id, opt)} style={{ padding:'8px 18px',cursor:'pointer',fontSize:'0.78rem',fontWeight:600,border:'1px solid #e8e8e8',borderLeft:oi===0?'1px solid #e8e8e8':'none',borderRadius:oi===0?'6px 0 0 6px':oi===MCQ_OPTIONS.length-1?'0 6px 6px 0':'0',background:responses[q.id]===opt?'#111':'#fff',color:responses[q.id]===opt?'#fff':'#555',transition:'background 0.15s' }}>{opt}</button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {q.type === 'text' && (
                                                            <textarea value={responses[q.id] || ''} onChange={e=>handleResponseChange(q.id, e.target.value)} placeholder="Write your response here..." rows={3} style={{ width:'100%',padding:'10px 14px',borderRadius:'8px',border:'1px solid #e8e8e8',fontSize:'0.85rem',fontFamily:'inherit',color:'#333',resize:'vertical',outline:'none',background:'#fafafa',lineHeight:'1.5',boxSizing:'border-box' }} />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                    <div style={{ display:'flex',justifyContent:'flex-end',paddingTop:'12px',borderTop:'1px solid #f0f0f0',gap:'10px',alignItems:'center' }}>
                                        <span style={{ fontSize: '0.72rem', color: '#bbb' }}>Pre-filled answers will be submitted as-is</span>
                                        <button onClick={handleSubmit} disabled={submitting} style={{ display:'flex',alignItems:'center',gap:'6px',padding:'10px 24px',borderRadius:'8px',border:'none',background:'#6355F1',color:'#fff',fontSize:'0.85rem',fontWeight:700,cursor:'pointer',transition:'opacity 0.15s',opacity:submitting?0.6:1 }}>
                                            <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Feedback'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ═══════════════════ SUCCESS VIEW ═══════════════════ */}
                    {activeTab === 'feedback' && justSubmitted && (
                        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', overflow: 'hidden', maxWidth: '640px' }}>
                            <div style={{ padding: '12px 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle size={14} color="#16a34a" /><span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Feedback Submitted</span>
                            </div>
                            <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                                <CheckCircle size={48} color="#16a34a" style={{ marginBottom: '12px' }} />
                                <h3 style={{ color: '#111', margin: '0 0 8px', fontSize: '1.1rem' }}>Thank you for your feedback!</h3>
                                <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 20px' }}>Your responses have been recorded for <strong>{selectedForm?.course?.name}</strong>.</p>
                                <button onClick={() => { closeForm(); }} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #e8e8e8', background: '#fff', color: '#555', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                                    ← Back to forms
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════ LEADERBOARD ═══════════════════ */}
                    {activeTab === 'leaderboard' && (() => {
                        const myEntry = leaderboard.find(e => e.student_id === user?.id);
                        const top3 = leaderboard.slice(0, 3);
                        const rankColors = ['#f59e0b', '#94a3b8', '#ea580c'];
                        const rankGlows = ['rgba(245,158,11,0.4)', 'rgba(148,163,184,0.3)', 'rgba(234,88,12,0.35)'];
                        // DiceBear cartoon avatar — stable per name seed
                        const avatarUrl = (name) => 'https://api.dicebear.com/7.x/adventurer/svg?seed=' + encodeURIComponent(name || 'student') + '&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';
                        const Av = ({ name, size }) => (
                            <img
                                src={avatarUrl(name)}
                                alt={name}
                                width={size} height={size}
                                style={{ borderRadius: '50%', display: 'block', flexShrink: 0, background: '#f0f0f0' }}
                            />
                        );
                        return (
                            <div style={{ animationName: 'fadeIn', animationDuration: '0.4s', animationFillMode: 'forwards' }}>
                                {/* Heading */}
                                <div style={{ marginBottom: '28px' }}>
                                    <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#111', letterSpacing: '-1px', margin: '0 0 4px', lineHeight: 1 }}>LEADERBOARD</h1>
                                    <p style={{ fontSize: '0.85rem', color: '#71717a', margin: 0 }}>Students ranked by total engagement points — attendance, bonus &amp; feedback.</p>
                                </div>

                                {/* ── Glassmorphic Top 3 Hero ── */}
                                {top3.length > 0 && (
                                    <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', marginBottom: '20px', padding: '32px 24px 28px', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
                                        {/* Blob lights */}
                                        <div style={{ position: 'absolute', top: '-60px', left: '-60px', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,85,241,0.5) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                                        <div style={{ position: 'absolute', bottom: '-80px', right: '-40px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.35) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
                                        <div style={{ position: 'absolute', top: '40px', right: '30%', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,88,12,0.25) 0%, transparent 70%)', filter: 'blur(35px)', pointerEvents: 'none' }} />

                                        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', alignItems: 'end' }}>
                                            {[top3[1], top3[0], top3[2]].map((entry, i) => {
                                                if (!entry) return <div key={i} />;
                                                const pi = [1, 0, 2][i];
                                                const gold = pi === 0;
                                                const c = rankColors[pi];
                                                const glow = rankGlows[pi];
                                                return (
                                                    <div key={entry.rank}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.07)',
                                                            backdropFilter: 'blur(20px)',
                                                            WebkitBackdropFilter: 'blur(20px)',
                                                            borderRadius: '18px',
                                                            padding: gold ? '28px 20px 22px' : '20px 16px 18px',
                                                            textAlign: 'center',
                                                            border: '1px solid rgba(255,255,255,0.15)',
                                                            boxShadow: gold ? '0 0 40px ' + glow + ', inset 0 1px 0 rgba(255,255,255,0.2)' : '0 0 20px ' + glow + ', inset 0 1px 0 rgba(255,255,255,0.1)',
                                                            position: 'relative',
                                                            overflow: 'hidden',
                                                            transition: 'transform 0.25s, box-shadow 0.25s',
                                                            outline: gold ? '2px solid ' + c : '1px solid rgba(255,255,255,0.08)',
                                                            outlineOffset: gold ? '2px' : '0',
                                                        }}
                                                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 16px 48px ' + glow; }}
                                                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = gold ? '0 0 40px ' + glow + ', inset 0 1px 0 rgba(255,255,255,0.2)' : '0 0 20px ' + glow; }}
                                                    >
                                                        {/* Ghost rank number */}
                                                        <div style={{ position: 'absolute', top: 6, left: 12, fontSize: gold ? '3rem' : '2.4rem', fontWeight: 900, color: 'rgba(255,255,255,0.06)', lineHeight: 1, userSelect: 'none', letterSpacing: '-2px' }}>0{pi + 1}</div>
                                                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                                            {/* Avatar with glowing ring */}
                                                            <div style={{ padding: '3px', borderRadius: '50%', background: 'linear-gradient(135deg, ' + c + ', rgba(255,255,255,0.3))', boxShadow: '0 0 16px ' + glow }}>
                                                                <div style={{ borderRadius: '50%', background: '#1a1a2e', padding: '2px' }}>
                                                                    <Av name={entry.name} size={gold ? 64 : 54} />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 800, color: '#fff', fontSize: gold ? '0.95rem' : '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>{entry.name}</div>
                                                                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{entry.enrollment_no || '—'}</div>
                                                            </div>
                                                            <div style={{ background: c, color: '#fff', fontWeight: 900, fontSize: gold ? '0.95rem' : '0.82rem', padding: '5px 18px', borderRadius: '8px', letterSpacing: '0.3px', boxShadow: '0 4px 12px ' + glow }}>
                                                                {entry.totalPoints} PTS
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Your current rank indicator */}
                                {myEntry && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '9px', marginBottom: '14px', color: '#6355F1', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        <Trophy size={13} color="#6355F1" />
                                        Your Current Rank — #{myEntry.rank} of {leaderboard.length}
                                    </div>
                                )}

                                {/* Full List */}
                                {loading ? (
                                    <div style={{ padding: '4rem', textAlign: 'center', color: '#a1a1aa' }}>
                                        <div style={{ width: '34px', height: '34px', border: '3px solid #f0f0f0', borderTopColor: '#6355F1', borderRadius: '50%', margin: '0 auto 12px', animationName: 'spin', animationDuration: '1s', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }} />
                                        Loading rankings...
                                    </div>
                                ) : leaderboard.length === 0 ? (
                                    <div style={{ padding: '4rem', textAlign: 'center', color: '#a1a1aa' }}>
                                        <Trophy size={48} color="#f4f4f5" style={{ marginBottom: '16px' }} />
                                        <p style={{ fontWeight: 600, color: '#71717a', margin: '0 0 6px' }}>No engagement data yet</p>
                                        <p style={{ fontSize: '0.85rem', margin: 0 }}>Points will appear once sessions are completed.</p>
                                    </div>
                                ) : (
                                    <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #efefef', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 100px 100px 70px 80px 80px', padding: '10px 20px', background: '#f9f9f9', borderBottom: '1px solid #efefef', gap: '8px' }}>
                                            {['Rank', 'Student', 'Total', 'Attendance', 'Bonus', 'Feedback', 'Sessions'].map(h => (
                                                <div key={h} style={{ fontSize: '0.62rem', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                                            ))}
                                        </div>
                                        {leaderboard.map((entry, idx) => {
                                            const isMe = entry.student_id === user?.id;
                                            const isTop3 = entry.rank <= 3;
                                            const rc = isTop3 ? rankColors[entry.rank - 1] : isMe ? '#6355F1' : '#d4d4d8';
                                            const delay = (idx * 0.02).toFixed(2) + 's';
                                            return (
                                                <div key={entry.student_id} style={{
                                                    display: 'grid', gridTemplateColumns: '70px 1fr 100px 100px 70px 80px 80px',
                                                    padding: '13px 20px', alignItems: 'center', gap: '8px',
                                                    borderBottom: '1px solid #f5f5f5',
                                                    background: isMe ? 'rgba(99,85,241,0.04)' : '#fff',
                                                    borderLeft: isMe ? '3px solid #6355F1' : '3px solid transparent',
                                                    transition: 'background 0.15s',
                                                    animationName: 'slideUp', animationDuration: '0.3s',
                                                    animationTimingFunction: 'ease', animationFillMode: 'forwards',
                                                    animationDelay: delay, opacity: 0,
                                                }}
                                                onMouseOver={e => { if (!isMe) e.currentTarget.style.background = '#fafafa'; }}
                                                onMouseOut={e => { if (!isMe) e.currentTarget.style.background = '#fff'; }}
                                                >
                                                    <div style={{ fontSize: isTop3 ? '1.5rem' : '1rem', fontWeight: 900, color: isTop3 ? rankColors[entry.rank - 1] : '#d1d5db', letterSpacing: '-0.5px', lineHeight: 1 }}>
                                                        {String(entry.rank).padStart(2, '0')}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                                                        <div style={{ padding: '2px', borderRadius: '50%', background: rc, flexShrink: 0 }}>
                                                            <Av name={entry.name} size={34} />
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontWeight: isMe ? 700 : 600, color: isMe ? '#6355F1' : '#111', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                                {entry.name}
                                                                {isMe && <span style={{ fontSize: '0.55rem', background: '#6355F1', color: '#fff', padding: '1px 5px', borderRadius: '3px', fontWeight: 800, letterSpacing: '0.4px' }}>YOU</span>}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.enrollment_no || '—'}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isTop3 ? rankColors[entry.rank - 1] : isMe ? '#6355F1' : '#27272a', fontFamily: 'monospace' }}>{entry.totalPoints}</div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#16a34a', fontFamily: 'monospace' }}>{entry.attendancePoints}</div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: entry.bonusPoints > 0 ? '#d97706' : '#d1d5db', fontFamily: 'monospace' }}>{entry.bonusPoints}</div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: entry.feedbackPoints > 0 ? '#2563eb' : '#d1d5db', fontFamily: 'monospace' }}>{entry.feedbackPoints}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#71717a', fontFamily: 'monospace' }}>{entry.sessionsAttended}/{entry.sessionsEnrolled}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* How Points Are Calculated */}
                                <div style={{ marginTop: '24px', borderRadius: '14px', border: '1px solid #efefef', background: '#fafafa', padding: '20px 24px' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#a1a1aa', marginBottom: '14px' }}>How Points Are Calculated</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                        {[
                                            { color: '#16a34a', bg: '#f0fdf4', label: 'Full Attendance (P/PO/C)', pts: '+5 pts', desc: 'Per session marked as fully present' },
                                            { color: '#71717a', bg: '#f4f4f5', label: 'Partial Attendance (H)', pts: '+3 pts', desc: 'Per session marked as half-present' },
                                            { color: '#d97706', bg: '#fffbeb', label: 'Punctuality Bonus', pts: '+1 pt', desc: 'Only for full-presence sessions (P/PO/C)' },
                                            { color: '#2563eb', bg: '#eff6ff', label: 'Feedback Submitted', pts: '+3 pts', desc: 'Per session where feedback was submitted' },
                                        ].map(item => (
                                            <div key={item.label} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #efefef', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#27272a' }}>{item.label}</span>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, fontFamily: 'monospace', background: item.bg, color: item.color, padding: '2px 8px', borderRadius: '5px', whiteSpace: 'nowrap' }}>{item.pts}</span>
                                                </div>
                                                <span style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>{item.desc}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#a1a1aa', paddingTop: '10px', borderTop: '1px solid #efefef' }}>
                                        Max per session: <strong style={{ color: '#27272a' }}>9 pts</strong> &nbsp;&middot;&nbsp; Absence (A/L) earns <strong style={{ color: '#27272a' }}>0 pts</strong> &nbsp;&middot;&nbsp; Points never decrease
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* ═══════════ VIEW RESPONSE MODAL ═══════════ */}
            {viewResponseForm && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                    onClick={closeViewResponse}
                >
                    <div
                        style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{viewResponseForm.course?.name}</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111' }}>{viewResponseForm.title}</div>
                                <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '2px' }}>Your submitted responses</div>
                            </div>
                            <button onClick={closeViewResponse} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', padding: '4px', lineHeight: 1 }}><X size={20} /></button>
                        </div>

                        {/* Body */}
                        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
                            {viewResponseLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>Loading your responses...</div>
                            ) : viewResponseData.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>No response data found.</div>
                            ) : (() => {
                                const grouped = viewResponseData.reduce((acc, r) => {
                                    const cat = r.feedback_questions?.category || 'General';
                                    if (!acc[cat]) acc[cat] = [];
                                    acc[cat].push(r);
                                    return acc;
                                }, {});

                                const renderAnswer = (r) => {
                                    const q = r.feedback_questions;
                                    if (!q) return null;
                                    let answer = null;
                                    if (q.type === 'rating') answer = (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: '#111', color: '#fff', fontWeight: 800, fontSize: '0.95rem', fontFamily: 'monospace' }}>{r.rating}</span>
                                            <span style={{ fontSize: '0.72rem', color: '#aaa' }}>out of 5</span>
                                        </div>
                                    );
                                    else if (q.type === 'yes_no') answer = (
                                        <span style={{ padding: '4px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, background: r.yes_no ? '#f0fdf4' : '#fef2f2', color: r.yes_no ? '#16a34a' : '#dc2626', border: `1px solid ${r.yes_no ? '#bbf7d0' : '#fecaca'}` }}>{r.yes_no ? 'Yes' : 'No'}</span>
                                    );
                                    else if (q.type === 'mcq') answer = (
                                        <span style={{ padding: '4px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, background: '#f5f3ff', color: '#6355F1', border: '1px solid #e0d9ff' }}>{r.text_answer}</span>
                                    );
                                    else if (q.type === 'text') answer = r.text_answer
                                        ? <span style={{ fontSize: '0.85rem', color: '#333', lineHeight: 1.6, fontStyle: 'italic' }}>"{r.text_answer}"</span>
                                        : <span style={{ fontSize: '0.78rem', color: '#ccc' }}>No comment</span>;

                                    return (
                                        <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#444', marginBottom: '8px' }}>{q.question}</div>
                                            {answer}
                                        </div>
                                    );
                                };

                                return Object.entries(grouped).map(([cat, rows]) => {
                                    const cfg = CATEGORY_CONFIG[cat] || { label: cat, icon: '📋' };
                                    return (
                                        <div key={cat} style={{ marginBottom: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', paddingBottom: '6px', borderBottom: '2px solid #f0f0f0' }}>
                                                <span style={{ fontSize: '0.9rem' }}>{cfg.icon}</span>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111' }}>{cfg.label}</span>
                                            </div>
                                            {rows.map(r => renderAnswer(r))}
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={closeViewResponse} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #e8e8e8', background: '#fff', color: '#555', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
