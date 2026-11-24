'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight,
    Trophy, Award, Zap, MessageCircle, Activity, Star, CheckCircle, RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';
import NotificationBell from '../components/NotificationBell';
import CohortSlot from '@/app/components/CohortSlot';

export default function LeaderboardPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState(null);

    const displayName = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student'
        : 'Student';

    const navTo = (p) => router.push(p);

    const fetchLeaderboard = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/feedback/leaderboard');
            setLeaderboard(res.leaderboard || []);
            setMeta(res.meta || null);
        } catch (e) {
            console.error('Leaderboard fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchLeaderboard(); }, [fetchLeaderboard, authReady]);

    const myEntry = leaderboard.find((e) => e.student_id === user?.id);
    const top3 = leaderboard.slice(0, 3);
    const podiumOrder = [1, 0, 2];
    const tiers = [
        { cls: 'gold', label: '1st Place' },
        { cls: 'silver', label: '2nd Place' },
        { cls: 'bronze', label: '3rd Place' },
    ];
    const avg = leaderboard.length ? Math.round(leaderboard.reduce((a, e) => a + e.totalPoints, 0) / leaderboard.length) : 0;

    return (
        <div className="dashboard-container student-shell">
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar">
                            <img src="/studentPic.png" alt="Student" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        </div>
                        <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <CohortSlot collapsed={isCollapsed} />
                    <nav className="nav-menu">
                        <div className="nav-item" onClick={() => navTo('/dashboard')} style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Home</span></div>
                        <div className="nav-item" onClick={() => navTo('/attendance')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Attendance</span></div>
                        <div className="nav-item" onClick={() => navTo('/grades')} style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div className="nav-item" onClick={() => navTo('/teachers')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div className="nav-item" onClick={() => navTo('/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div className="nav-item active"><Trophy size={18} /> <span>Leaderboard</span></div>
                        <div className="nav-item" onClick={() => navTo('/courses')} style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Courses</span></div>
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
                            <div><h1>Leaderboard</h1><p className="lb-sub">How you rank on attendance and feedback across the cohort.</p></div>
                        </div>
                        <div className="header-actions">
                            <button className="lb-refresh" onClick={fetchLeaderboard} disabled={loading}>
                                <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> {loading ? 'Syncing…' : 'Refresh'}
                            </button>
                            <NotificationBell />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {loading ? (
                        <div className="lb-loading"><div className="lb-ring" /><p>Loading rankings…</p></div>
                    ) : leaderboard.length === 0 ? (
                        <div className="lb-empty">
                            <div className="lb-empty-icon"><Trophy size={30} /></div>
                            <h3>No rankings yet</h3>
                            <p>Points appear here once classes are completed and attendance is recorded.</p>
                        </div>
                    ) : (
                        <>
                            {/* Stats strip */}
                            <div className="lb-stats">
                                {[
                                    { label: 'Students ranked', value: leaderboard.length, icon: Users, tone: 'purple' },
                                    { label: 'Top score', value: leaderboard[0]?.totalPoints || 0, icon: Star, tone: 'pink' },
                                    { label: 'Average score', value: avg, icon: Activity, tone: 'teal' },
                                    { label: 'Your rank', value: myEntry ? `#${myEntry.rank}` : '—', icon: Trophy, tone: 'ink', note: myEntry ? `${myEntry.totalPoints} pts` : 'No points yet' },
                                ].map((st) => (
                                    <div key={st.label} className="lb-stat">
                                        <div className={`lb-stat-icon ${st.tone}`}><st.icon size={20} /></div>
                                        <div>
                                            <div className="lb-stat-label">{st.label}</div>
                                            <div className="lb-stat-value">{st.value}{st.note && <small>{st.note}</small>}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Podium */}
                            {top3.length >= 3 && (
                                <div className="lb-podium">
                                    {podiumOrder.map((idx) => {
                                        const e = top3[idx];
                                        if (!e) return null;
                                        const t = tiers[idx];
                                        const mine = e.student_id === user?.id;
                                        return (
                                            <div key={e.student_id} className={`lb-podium-card ${t.cls} ${idx === 0 ? 'first' : ''} ${mine ? 'mine' : ''}`}>
                                                <div className="lb-medal"><Award size={idx === 0 ? 28 : 24} /></div>
                                                <div className="lb-place">{t.label}</div>
                                                <h3>{e.name}{mine && <em>You</em>}</h3>
                                                <div className="lb-enrol">{e.enrollment_no || '—'}</div>
                                                <div className="lb-score"><b>{e.totalPoints}</b><span>pts</span></div>
                                                <div className="lb-breakdown">
                                                    <div><CheckCircle size={14} /><b>{e.attendancePoints}</b></div>
                                                    <i />
                                                    <div><Zap size={14} /><b>{e.bonusPoints}</b></div>
                                                    <i />
                                                    <div><MessageCircle size={14} /><b>{e.feedbackPoints}</b></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Full table */}
                            <div className="lb-table-card">
                                <div className="lb-table-head">
                                    <div><span className="lb-head-icon"><Trophy size={18} /></span><h2>Full Cohort Rankings</h2></div>
                                    <span className="lb-count">{leaderboard.length} active students</span>
                                </div>
                                <div className="lb-table-scroll">
                                    <table className="lb-table">
                                        <thead>
                                            <tr>{['Rank', 'Student', 'ID', 'Total Score', 'Attendance', 'Feedback', 'Progress'].map((h, i) => <th key={h} style={{ textAlign: i === 0 ? 'center' : 'left' }}>{h}</th>)}</tr>
                                        </thead>
                                        <tbody>
                                            {leaderboard.map((e) => {
                                                const pct = e.maxPossible > 0 ? Math.min(100, Math.round((e.totalPoints / e.maxPossible) * 100)) : 0;
                                                const top = e.rank <= 3;
                                                const mine = e.student_id === user?.id;
                                                return (
                                                    <tr key={e.student_id} className={mine ? 'me' : ''}>
                                                        <td style={{ textAlign: 'center', width: 80 }}>
                                                            {top ? <span className={`lb-rank-badge ${tiers[e.rank - 1].cls}`}><Award size={16} /></span> : <span className="lb-rank-num">{e.rank}</span>}
                                                        </td>
                                                        <td><span className="lb-name">{e.name}</span>{mine && <em className="lb-you">You</em>}</td>
                                                        <td><span className="lb-id">{e.enrollment_no || '—'}</span></td>
                                                        <td><span className={`lb-total ${top ? tiers[e.rank - 1].cls : ''}`}>{e.totalPoints}</span></td>
                                                        <td><span className="lb-att">{e.attendancePoints}</span></td>
                                                        <td><span className={`lb-fb ${e.feedbackPoints > 0 ? 'on' : ''}`}>{e.feedbackPoints}</span></td>
                                                        <td>
                                                            <div className="lb-progress">
                                                                <div className="lb-bar"><div className={pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low'} style={{ width: `${pct}%` }} /></div>
                                                                <span>{pct}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {meta && <div className="lb-note">{meta.totalSessions} sessions tracked · {meta.breakdown}</div>}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
