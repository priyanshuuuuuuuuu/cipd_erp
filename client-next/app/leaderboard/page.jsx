'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight,
    Trophy, Award,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';
import NotificationBell from '../components/NotificationBell';

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
    const rankColors = ['#f59e0b', '#94a3b8', '#ea580c'];
    const rankGlows = ['rgba(245,158,11,0.4)', 'rgba(148,163,184,0.3)', 'rgba(234,88,12,0.35)'];
    const avatarUrl = (name) => 'https://api.dicebear.com/7.x/adventurer/svg?seed=' + encodeURIComponent(name || 'student') + '&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';
    const Av = ({ name, size }) => (
        <img src={avatarUrl(name)} alt={name} width={size} height={size}
            style={{ borderRadius: '50%', display: 'block', flexShrink: 0, background: '#f0f0f0' }} />
    );

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
                            <NotificationBell /><MessageSquare size={20} color="#555" />
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
                            {/* Your Rank Card */}
                            {myEntry && (
                                <div style={{ background: 'linear-gradient(135deg, #6355F1 0%, #7c6cf5 50%, #9b8afb 100%)', borderRadius: '12px', padding: '18px 22px', marginBottom: '20px', color: '#fff', boxShadow: '0 4px 20px rgba(99,85,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, marginBottom: '4px' }}>Your Rank</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                            <span style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}>#{myEntry.rank}</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.85 }}>of {leaderboard.length} students</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                        {[{ label: 'Total', value: myEntry.totalPoints }, { label: 'Attendance', value: myEntry.attendancePoints }, { label: 'Bonus', value: myEntry.bonusPoints }, { label: 'Feedback', value: myEntry.feedbackPoints }].map(s => (
                                            <div key={s.label} style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1 }}>{s.value}</div>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.7, marginTop: '2px' }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {meta && <div style={{ fontSize: '0.68rem', opacity: 0.65, width: '100%', marginTop: '-4px' }}>{meta.totalSessions} sessions tracked · {meta.breakdown}</div>}
                                </div>
                            )}

                            {/* Glassmorphic Top 3 Hero */}
                            {top3.length > 0 && (
                                <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', marginBottom: '20px', padding: '32px 24px 28px', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
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
                                                <div key={entry.rank} style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '18px', padding: gold ? '28px 20px 22px' : '20px 16px 18px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.15)', boxShadow: gold ? '0 0 40px ' + glow + ', inset 0 1px 0 rgba(255,255,255,0.2)' : '0 0 20px ' + glow, position: 'relative', overflow: 'hidden', transition: 'transform 0.25s', outline: gold ? '2px solid ' + c : '1px solid rgba(255,255,255,0.08)', outlineOffset: gold ? '2px' : '0' }}
                                                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-6px)'; }}
                                                    onMouseOut={e => { e.currentTarget.style.transform = 'none'; }}>
                                                    <div style={{ position: 'absolute', top: 6, left: 12, fontSize: gold ? '3rem' : '2.4rem', fontWeight: 900, color: 'rgba(255,255,255,0.06)', lineHeight: 1, userSelect: 'none', letterSpacing: '-2px' }}>0{pi + 1}</div>
                                                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ padding: '3px', borderRadius: '50%', background: 'linear-gradient(135deg, ' + c + ', rgba(255,255,255,0.3))', boxShadow: '0 0 16px ' + glow }}>
                                                            <div style={{ borderRadius: '50%', background: '#1a1a2e', padding: '2px' }}><Av name={entry.name} size={gold ? 64 : 54} /></div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 800, color: '#fff', fontSize: gold ? '0.95rem' : '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>{entry.name}</div>
                                                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{entry.enrollment_no || '—'}</div>
                                                        </div>
                                                        <div style={{ background: c, color: '#fff', fontWeight: 900, fontSize: gold ? '0.95rem' : '0.82rem', padding: '5px 18px', borderRadius: '8px', boxShadow: '0 4px 12px ' + glow }}>{entry.totalPoints} PTS</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Grid List */}
                            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #efefef', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 100px 100px 80px 80px', padding: '10px 20px', background: '#f9f9f9', borderBottom: '1px solid #efefef', gap: '8px' }}>
                                    {['Rank', 'Student', 'Total', 'Attendance', 'Feedback', 'Sessions'].map(h => (
                                        <div key={h} style={{ fontSize: '0.62rem', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                                    ))}
                                </div>
                                {leaderboard.map((entry, idx) => {
                                    const isMe = entry.student_id === user?.id;
                                    const isTop3 = entry.rank <= 3;
                                    const rc = isTop3 ? rankColors[entry.rank - 1] : isMe ? '#6355F1' : '#d4d4d8';
                                    return (
                                        <div key={entry.student_id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 100px 100px 80px 80px', padding: '13px 20px', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f5f5f5', background: isMe ? 'rgba(99,85,241,0.04)' : '#fff', borderLeft: isMe ? '3px solid #6355F1' : '3px solid transparent', transition: 'background 0.15s' }}
                                            onMouseOver={e => { if (!isMe) e.currentTarget.style.background = '#fafafa'; }}
                                            onMouseOut={e => { if (!isMe) e.currentTarget.style.background = '#fff'; }}>
                                            <div style={{ fontSize: isTop3 ? '1.5rem' : '1rem', fontWeight: 900, color: isTop3 ? rankColors[entry.rank - 1] : '#d1d5db', letterSpacing: '-0.5px', lineHeight: 1 }}>{String(entry.rank).padStart(2, '0')}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                                                <div style={{ padding: '2px', borderRadius: '50%', background: rc, flexShrink: 0 }}><Av name={entry.name} size={34} /></div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: isMe ? 700 : 600, color: isMe ? '#6355F1' : '#111', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                        {entry.name}
                                                        {isMe && <span style={{ fontSize: '0.55rem', background: '#6355F1', color: '#fff', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>YOU</span>}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.enrollment_no || '—'}</div>
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isTop3 ? rankColors[entry.rank - 1] : isMe ? '#6355F1' : '#27272a', fontFamily: 'monospace' }}>{entry.totalPoints}</div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#16a34a', fontFamily: 'monospace' }}>{entry.attendancePoints}</div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: entry.feedbackPoints > 0 ? '#2563eb' : '#d1d5db', fontFamily: 'monospace' }}>{entry.feedbackPoints}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#71717a', fontFamily: 'monospace' }}>{entry.sessionsAttended}/{entry.sessionsEnrolled}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <style>{`@keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
        </div>
    );
}
