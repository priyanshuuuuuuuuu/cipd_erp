'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Bell, Search, Menu, ChevronLeft, ChevronRight,
    Trophy, Award,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

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

    const myEntry = leaderboard.find(e => e.student_id === user?.id);
    const top3 = leaderboard.slice(0, 3);
    const medalEmoji = ['🥇', '🥈', '🥉'];
    const medalGradient = [
        'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%)',
        'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #cbd5e1 100%)',
        'linear-gradient(135deg, #fed7aa 0%, #fdba74 50%, #fb923c 100%)',
    ];
    const medalBorder = ['#f59e0b', '#94a3b8', '#ea580c'];
    const medalShadow = [
        '0 4px 20px rgba(245,158,11,0.25)',
        '0 4px 20px rgba(148,163,184,0.25)',
        '0 4px 20px rgba(234,88,12,0.25)',
    ];
    // Olympic podium order: 2nd (silver) | 1st (gold, center+taller) | 3rd (bronze)
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
    const podiumStyleIdx = top3.length >= 3 ? [1, 0, 2] : top3.map((_, i) => i);

    return (
        <div className="dashboard-container">
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
                            <h1>Leaderboard</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                            <Bell size={20} color="#555" /><MessageSquare size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {loading ? (
                        /* ── Skeleton ── */
                        <div>
                            {/* Podium skeleton */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'flex-end' }}>
                                {[80, 110, 80].map((h, i) => (
                                    <div key={i} style={{ flex: 1, height: `${h}px`, borderRadius: '12px', background: '#f0f0f0', animation: `shimmer 1.5s infinite`, animationDelay: `${i * 0.1}s` }} />
                                ))}
                            </div>
                            {/* Table skeleton */}
                            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} style={{ display: 'flex', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #f5f5f5', alignItems: 'center' }}>
                                        <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#f0f0f0', animation: `shimmer 1.5s infinite`, animationDelay: `${i * 0.08}s` }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ width: `${50 + i * 8}%`, height: '10px', borderRadius: '4px', background: '#f0f0f0', marginBottom: '6px', animation: `shimmer 1.5s infinite`, animationDelay: `${i * 0.1}s` }} />
                                            <div style={{ width: '30%', height: '6px', borderRadius: '3px', background: '#f5f5f5', animation: `shimmer 1.5s infinite`, animationDelay: `${i * 0.12}s` }} />
                                        </div>
                                        {[1, 2, 3].map(j => (
                                            <div key={j} style={{ width: '40px', height: '10px', borderRadius: '4px', background: '#f0f0f0', animation: `shimmer 1.5s infinite`, animationDelay: `${j * 0.06}s` }} />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', padding: '4rem', textAlign: 'center', color: '#aaa' }}>
                            <Trophy size={48} color="#e8e8e8" style={{ marginBottom: '16px' }} />
                            <p style={{ fontSize: '0.92rem', fontWeight: 600, color: '#999' }}>No engagement data yet</p>
                            <p style={{ fontSize: '0.82rem' }}>Points will appear once sessions are completed.</p>
                        </div>
                    ) : (
                        <>
                            {/* ── Your Rank Card ── */}
                            {myEntry && (
                                <div style={{
                                    background: 'linear-gradient(135deg, #6355F1 0%, #7c6cf5 50%, #9b8afb 100%)',
                                    borderRadius: '12px', padding: '18px 22px', marginBottom: '16px',
                                    color: '#fff', boxShadow: '0 4px 20px rgba(99,85,241,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, marginBottom: '4px' }}>Your Rank</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                            <span style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}>#{myEntry.rank}</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.85 }}>of {leaderboard.length} students</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                        {[
                                            { label: 'Total', value: myEntry.totalPoints },
                                            { label: 'Attendance', value: myEntry.attendancePoints },
                                            { label: 'Bonus', value: myEntry.bonusPoints },
                                            { label: 'Feedback', value: myEntry.feedbackPoints },
                                        ].map(s => (
                                            <div key={s.label} style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1 }}>{s.value}</div>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.7, marginTop: '2px' }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {meta && (
                                        <div style={{ fontSize: '0.68rem', opacity: 0.65, width: '100%', marginTop: '-4px' }}>
                                            {meta.totalSessions} sessions tracked · {meta.breakdown}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Top 3 Podium ── */}
                            {top3.length > 0 && (
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'flex-end' }}>
                                    {podiumOrder.map((entry, idx) => {
                                        const styleI = podiumStyleIdx[idx];
                                        const isGold = styleI === 0;
                                        return (
                                            <div key={entry.rank} style={{
                                                flex: 1, background: medalGradient[styleI], borderRadius: '12px',
                                                border: `1.5px solid ${medalBorder[styleI]}`,
                                                padding: isGold ? '24px 16px' : '16px',
                                                boxShadow: medalShadow[styleI], textAlign: 'center',
                                                transition: 'transform 0.2s', cursor: 'default',
                                                transform: isGold ? 'scale(1.04)' : 'none',
                                                zIndex: isGold ? 1 : 0,
                                            }}
                                            onMouseOver={e => e.currentTarget.style.transform = isGold ? 'scale(1.06)' : 'translateY(-3px)'}
                                            onMouseOut={e => e.currentTarget.style.transform = isGold ? 'scale(1.04)' : 'none'}
                                            >
                                                <div style={{ fontSize: isGold ? '2.2rem' : '1.8rem', marginBottom: '4px' }}>{medalEmoji[styleI]}</div>
                                                <div style={{ fontSize: isGold ? '0.95rem' : '0.88rem', fontWeight: 800, color: '#111', marginBottom: '2px' }}>{entry.name}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#666', marginBottom: '8px' }}>{entry.enrollment_no || '—'}</div>
                                                <div style={{ fontSize: isGold ? '1.8rem' : '1.5rem', fontWeight: 900, color: '#111', fontFamily: 'monospace', marginBottom: '4px' }}>{entry.totalPoints}</div>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>points</div>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px', fontSize: '0.62rem', color: '#777' }}>
                                                    <span title="Attendance">📋 {entry.attendancePoints}</span>
                                                    <span title="Bonus">⚡ {entry.bonusPoints}</span>
                                                    <span title="Feedback">💬 {entry.feedbackPoints}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ── Full Table ── */}
                            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Trophy size={15} color="#6355F1" />
                                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Global Engagement Rankings</span>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', color: '#bbb' }}>
                                        {leaderboard.length} students • {leaderboard[0]?.totalPoints || 0} top score
                                    </span>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                            <tr style={{ background: '#fafafa' }}>
                                                {['#', 'Student', 'Total', 'Attendance', 'Bonus', 'Feedback', 'Sessions'].map(h => (
                                                    <th key={h} style={{
                                                        padding: '10px 14px', textAlign: h === '#' ? 'center' : 'left',
                                                        fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                                                        letterSpacing: '0.5px', color: '#999', borderBottom: '1px solid #f0f0f0',
                                                    }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaderboard.map(entry => {
                                                const isMe = entry.student_id === user?.id;
                                                const progressPct = entry.maxPossible > 0
                                                    ? Math.round((entry.totalPoints / entry.maxPossible) * 100)
                                                    : 0;

                                                return (
                                                    <tr key={entry.student_id} style={{
                                                        borderBottom: '1px solid #f5f5f5',
                                                        background: isMe ? '#f5f3ff' : 'transparent',
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onMouseOver={e => { if (!isMe) e.currentTarget.style.background = '#fafafa'; }}
                                                    onMouseOut={e => { if (!isMe) e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        <td style={{ padding: '10px 14px', textAlign: 'center', width: '50px' }}>
                                                            {entry.rank <= 3 ? (
                                                                <span style={{ fontSize: '1.1rem' }}>{medalEmoji[entry.rank - 1]}</span>
                                                            ) : (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                    width: '26px', height: '26px', borderRadius: '6px',
                                                                    fontWeight: 700, fontFamily: 'monospace', fontSize: '0.78rem',
                                                                    background: isMe ? '#6355F1' : '#f5f5f5',
                                                                    color: isMe ? '#fff' : '#666',
                                                                }}>{entry.rank}</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <div style={{ fontWeight: isMe ? 700 : 500, color: isMe ? '#6355F1' : '#333', fontSize: '0.85rem' }}>
                                                                {entry.name} {isMe && <span style={{ fontSize: '0.65rem', background: '#6355F1', color: '#fff', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 600 }}>YOU</span>}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                                <div style={{ flex: 1, maxWidth: '120px', height: '4px', borderRadius: '2px', background: '#f0f0f0', overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        width: `${progressPct}%`, height: '100%', borderRadius: '2px',
                                                                        background: progressPct >= 80 ? '#16a34a' : progressPct >= 50 ? '#d97706' : '#dc2626',
                                                                        transition: 'width 0.5s ease',
                                                                    }} />
                                                                </div>
                                                                <span style={{ fontSize: '0.62rem', color: '#bbb', fontFamily: 'monospace' }}>{progressPct}%</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: '1rem', color: entry.rank <= 3 ? '#111' : '#444' }}>{entry.totalPoints}</span>
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#6355F1', fontSize: '0.85rem' }}>{entry.attendancePoints}</span>
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem', color: entry.bonusPoints > 0 ? '#059669' : '#ccc' }}>{entry.bonusPoints}</span>
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem', color: entry.feedbackPoints > 0 ? '#d97706' : '#ccc' }}>{entry.feedbackPoints}</span>
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#777' }}>
                                                                {entry.sessionsAttended}/{entry.sessionsEnrolled}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <style>{`@keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
        </div>
    );
}
