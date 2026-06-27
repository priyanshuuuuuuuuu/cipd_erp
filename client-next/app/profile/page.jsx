'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight, Mail, Phone,
    MapPin, GraduationCap, CheckCircle, XCircle, Clock, FileText,
    Star, TrendingUp, Award, Trophy
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

const PROFILE_TABS = ['Overview', 'Attendance', 'Feedback', 'Assignments'];

const COURSE_COLORS = ['#66d9e8', '#a78bfa', '#93c5fd', '#6ee7b7', '#f9a8d4', '#fbbf24'];

const MiniDonut = ({ pct, size = 44, stroke = 5, color }) => {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
    );
};

export default function ProfilePage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Overview');
    const [profile, setProfile] = useState(null);
    const [attendance, setAttendance] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);

    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const fetchAll = useCallback(async () => {
        try {
            const [profRes, attRes, asnRes, fbRes] = await Promise.allSettled([
                api.get('/api/students/profile'),
                api.get('/api/students/attendance/summary'),
                api.get('/api/students/assignments'),
                api.get('/api/students/feedback/history'),
            ]);
            if (profRes.status === 'fulfilled') setProfile(profRes.value.profile || profRes.value);
            if (attRes.status === 'fulfilled') setAttendance(attRes.value);
            if (asnRes.status === 'fulfilled') setAssignments(asnRes.value.assignments || []);
            if (fbRes.status === 'fulfilled') setFeedback(fbRes.value.submissions || fbRes.value.feedback || []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchAll(); }, [fetchAll, authReady]);

    const overallPct = attendance?.overall?.pct || 0;
    const attended = attendance?.overall?.attended || 0;
    const missed = attendance?.overall?.missed || 0;
    const total = attendance?.overall?.total || 0;
    const byCourse = attendance?.by_course || [];

    const submittedAsn = assignments.filter(a => a.is_submitted || a.submission_status === 'submitted' || a.submission_status === 'graded');
    const pendingAsn = assignments.filter(a => !a.is_submitted && a.submission_status !== 'graded');

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile">
                        <div className="user-avatar" style={{ background: '#0b6861', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => navTo('/profile')}>
                            {user?.firstName?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                    </div>
                    <nav className="nav-menu">
                        <div onClick={() => navTo('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Home</span></div>
                        <div onClick={() => navTo('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Attendance</span></div>
                        <div onClick={() => navTo('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div onClick={() => navTo('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div onClick={() => navTo('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div onClick={() => navTo('/leaderboard')} className="nav-item" style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
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
                        <h1>My Profile</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }} />
                    </div>
                </header>

                {loading ? (
                    <div style={{ padding: '1.5rem 2rem' }}>
                        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '20px', padding: '1.5rem 2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#f0f0f0', flexShrink: 0, animation: 'shimmer 1.5s infinite' }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ width: '40%', height: '16px', borderRadius: '4px', background: '#f0f0f0', marginBottom: '10px', animation: 'shimmer 1.5s infinite', animationDelay: '0.1s' }} />
                                <div style={{ width: '60%', height: '10px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: '0.2s' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>{[1,2,3].map(i => (<div key={i} style={{ width: '80px', height: '60px', borderRadius: '12px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${i*0.15}s` }} />))}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {[1,2].map(i => (<div key={i} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '1.5rem' }}>
                                {[1,2,3,4].map(j => (<div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8f8f8' }}>
                                    <div style={{ width: '30%', height: '10px', borderRadius: '3px', background: '#f5f5f5', animation: 'shimmer 1.5s infinite', animationDelay: `${(i*4+j)*0.1}s` }} />
                                    <div style={{ width: '40%', height: '10px', borderRadius: '3px', background: '#f0f0f0', animation: 'shimmer 1.5s infinite', animationDelay: `${(i*4+j)*0.12}s` }} />
                                </div>))}
                            </div>))}
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '1.5rem 2rem', flex: 1 }}>
                        {/* Profile header card */}
                        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '20px', padding: '1.5rem 2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#0b6861', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.8rem', fontWeight: 700, flexShrink: 0 }}>
                                {user?.firstName?.[0]?.toUpperCase() || 'S'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 700, color: '#111' }}>{displayName}</h2>
                                <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '6px' }}>
                                    {user?.email && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Mail size={13} color="#bbb" />{user.email}</span>}
                                    {profile?.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Phone size={13} color="#bbb" />{profile.phone}</span>}
                                    {profile?.enrollment_no && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><GraduationCap size={13} color="#bbb" />Enroll: {profile.enrollment_no}</span>}
                                    {profile?.department && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><MapPin size={13} color="#bbb" />{profile.department}</span>}
                                </div>
                            </div>
                            {/* Quick stat pills */}
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ textAlign: 'center', padding: '10px 20px', background: '#f0fdf4', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#16a34a' }}>{overallPct.toFixed(0)}%</div>
                                    <div style={{ fontSize: '0.7rem', color: '#888' }}>Attendance</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '10px 20px', background: '#fef9c3', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#b45309' }}>{pendingAsn.length}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#888' }}>Pending</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '10px 20px', background: '#ede9fe', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#6d28d9' }}>{feedback.length}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#888' }}>Feedbacks</div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: '4px', background: '#f5f5f5', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem', width: 'fit-content' }}>
                            {PROFILE_TABS.map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                                    padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    background: activeTab === tab ? '#fff' : 'transparent',
                                    color: activeTab === tab ? '#111' : '#888',
                                    fontWeight: activeTab === tab ? 600 : 500,
                                    fontSize: '0.85rem',
                                    boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                    transition: 'all 0.15s',
                                }}>{tab}</button>
                            ))}
                        </div>

                        {/* ── OVERVIEW TAB ── */}
                        {activeTab === 'Overview' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {/* Personal Info */}
                                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '1.5rem' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>Personal Information</div>
                                    {[
                                        { label: 'Full Name', value: displayName },
                                        { label: 'Email', value: user?.email },
                                        { label: 'Enrollment No.', value: profile?.enrollment_no },
                                        { label: 'Department', value: profile?.department },
                                        { label: 'Program', value: profile?.program_name },
                                        { label: 'Semester', value: profile?.semester ? `Semester ${profile.semester}` : undefined },
                                        { label: 'Phone', value: profile?.phone },
                                        { label: 'Batch', value: profile?.batch },
                                    ].filter(r => r.value).map((row, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8f8f8', fontSize: '0.82rem' }}>
                                            <span style={{ color: '#888' }}>{row.label}</span>
                                            <span style={{ color: '#111', fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{row.value}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Academic snapshot */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '1.5rem' }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>Academic Snapshot</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                            {[
                                                { label: 'Classes Attended', value: attended, bg: '#f0fdf4', color: '#16a34a' },
                                                { label: 'Classes Missed', value: missed, bg: '#fef2f2', color: '#dc2626' },
                                                { label: 'Total Classes', value: total, bg: '#f5f3ff', color: '#7c3aed' },
                                                { label: 'Submitted Work', value: submittedAsn.length, bg: '#fef9c3', color: '#b45309' },
                                            ].map((s, i) => (
                                                <div key={i} style={{ background: s.bg, borderRadius: '12px', padding: '14px 16px' }}>
                                                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                                                    <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px' }}>{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── ATTENDANCE TAB ── */}
                        {activeTab === 'Attendance' && (
                            <div>
                                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '1.5rem', marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.2rem' }}>Overall Attendance</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                        <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                                            <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
                                                <circle cx={50} cy={50} r={42} fill="none" stroke="#f0f0f0" strokeWidth={10} />
                                                <circle cx={50} cy={50} r={42} fill="none" stroke="#66d9e8" strokeWidth={10}
                                                    strokeDasharray={2 * Math.PI * 42}
                                                    strokeDashoffset={2 * Math.PI * 42 * (1 - overallPct / 100)}
                                                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
                                            </svg>
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111' }}>{overallPct.toFixed(1)}%</div>
                                                <div style={{ fontSize: '0.6rem', color: '#888' }}>overall</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {[
                                                { label: 'Attended', value: attended, color: '#dcfce7', textColor: '#16a34a' },
                                                { label: 'Missed', value: missed, color: '#fee2e2', textColor: '#dc2626' },
                                                { label: 'Total', value: total, color: '#f5f5f5', textColor: '#333' },
                                            ].map((s, i) => (
                                                <div key={i} style={{ padding: '6px 16px', borderRadius: '8px', background: s.color, fontSize: '0.82rem' }}>
                                                    <span style={{ color: '#888' }}>{s.label}: </span>
                                                    <strong style={{ color: s.textColor }}>{s.value}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {byCourse.length > 0 && (
                                    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '1.5rem' }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.2rem' }}>Course-wise Attendance</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                            {byCourse.map((c, i) => {
                                                const color = COURSE_COLORS[i % COURSE_COLORS.length];
                                                const pct = c.pct || 0;
                                                return (
                                                    <div key={c.course_id || i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <MiniDonut pct={pct} color={color} size={44} stroke={5} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111' }}>{c.course_name || c.course_code}</div>
                                                            <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '1px' }}>{c.attended}/{c.total} classes</div>
                                                        </div>
                                                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: pct >= 75 ? '#16a34a' : pct >= 60 ? '#b45309' : '#dc2626' }}>
                                                            {pct.toFixed(0)}%
                                                        </div>
                                                        <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: pct >= 75 ? '#dcfce7' : pct >= 60 ? '#fef9c3' : '#fee2e2', color: pct >= 75 ? '#16a34a' : pct >= 60 ? '#b45309' : '#dc2626' }}>
                                                            {pct >= 75 ? 'On Track' : pct >= 60 ? 'Attention' : 'At Risk'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── FEEDBACK TAB ── */}
                        {activeTab === 'Feedback' && (
                            <div>
                                {feedback.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8' }}>
                                        <MessageSquare size={40} color="#e8e8e8" style={{ marginBottom: '12px' }} />
                                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#555' }}>No feedback submitted yet</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {feedback.map((fb, i) => (
                                            <div key={fb.id || i} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '1rem 1.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111', marginBottom: '3px' }}>{fb.course_name || fb.session_topic || 'Lecture Feedback'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#aaa' }}>{fb.submitted_at ? new Date(fb.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div>
                                                    </div>
                                                    {fb.overall_rating != null && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fef9c3', padding: '4px 10px', borderRadius: '20px' }}>
                                                            <Star size={12} color="#f59e0b" fill="#f59e0b" />
                                                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b45309' }}>{fb.overall_rating}/5</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {fb.comments && <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#777', fontStyle: 'italic' }}>"{fb.comments}"</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── ASSIGNMENTS TAB ── */}
                        {activeTab === 'Assignments' && (
                            <div>
                                {assignments.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8' }}>
                                        <FileText size={40} color="#e8e8e8" style={{ marginBottom: '12px' }} />
                                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#555' }}>No assignments found</div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem' }}>
                                            <span style={{ padding: '4px 14px', background: '#fef9c3', color: '#b45309', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>{pendingAsn.length} Pending</span>
                                            <span style={{ padding: '4px 14px', background: '#dcfce7', color: '#16a34a', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>{submittedAsn.length} Submitted</span>
                                        </div>
                                        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', overflow: 'hidden' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', padding: '10px 1.5rem', background: '#fafafa', borderBottom: '1px solid #f0f0f0', fontSize: '0.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', gap: '1rem' }}>
                                                <div>Assignment</div>
                                                <div>Due</div>
                                                <div>Score</div>
                                                <div>Status</div>
                                            </div>
                                            {assignments.map((asn, i) => {
                                                const hasSub = !!asn.submission;
                                                const isGraded = asn.submission_status === 'graded' || asn.marks != null;
                                                const status = isGraded ? 'graded' : (hasSub ? 'submitted' : (asn.is_overdue ? 'late' : 'pending'));
                                                const statusStyles = {
                                                    submitted: { bg: '#dcfce7', color: '#16a34a', label: 'Submitted' },
                                                    graded: { bg: '#e0e7ff', color: '#3730a3', label: 'Graded' },
                                                    pending: { bg: '#fef9c3', color: '#b45309', label: 'Pending' },
                                                    late: { bg: '#fee2e2', color: '#dc2626', label: 'Late' },
                                                };
                                                const st = statusStyles[status] || statusStyles['pending'];
                                                const total = asn.total_marks ?? '—';
                                                const grade = asn.marks ?? asn.submission?.grade;
                                                return (
                                                    <div key={asn.id || i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', padding: '12px 1.5rem', borderBottom: i < assignments.length - 1 ? '1px solid #f8f8f8' : 'none', alignItems: 'center', gap: '1rem' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111' }}>{asn.title}</div>
                                                            {asn.courses?.name && <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '2px' }}>{asn.courses.name}</div>}
                                                        </div>
                                                        <div style={{ fontSize: '0.78rem', color: '#888', whiteSpace: 'nowrap' }}>
                                                            {asn.due_date ? new Date(asn.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                                                        </div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111', textAlign: 'center' }}>
                                                            {isGraded ? `${grade}/${total}` : '—'}
                                                        </div>
                                                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                            {st.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <style>{`@keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
        </div>
    );
}
