'use client';
import React, { useState, useEffect, useCallback } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle,
    Trophy, RefreshCw, Users, Award, Zap, MessageCircle, Activity, Star
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

const podiumOrder = [1, 0, 2];

export default function AdminLeaderboardPage() {
    const router = useRouter();
    const { authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    const navTo = p => router.push(p);

    const fetchLeaderboard = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/feedback/leaderboard');
            setLeaderboard(res.leaderboard || []);
            setLastUpdated(new Date());
        } catch (e) {
            console.error('Failed to load leaderboard:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchLeaderboard(); }, [fetchLeaderboard, authReady]);

    const top3 = leaderboard.slice(0, 3);

    const rankStyles = {
        0: { bg: '#fff', border: 'rgba(234, 179, 8, 0.3)', accent: '#eab308', shadow: '0 20px 40px -5px rgba(234, 179, 8, 0.15)', height: '280px', label: '1st Place', icon: <Award size={28} color="#eab308" /> },
        1: { bg: '#fff', border: 'rgba(148, 163, 184, 0.3)', accent: '#94a3b8', shadow: '0 15px 35px -5px rgba(148, 163, 184, 0.12)', height: '250px', label: '2nd Place', icon: <Award size={24} color="#94a3b8" /> },
        2: { bg: '#fff', border: 'rgba(217, 119, 6, 0.3)', accent: '#d97706', shadow: '0 15px 35px -5px rgba(217, 119, 6, 0.12)', height: '230px', label: '3rd Place', icon: <Award size={24} color="#d97706" /> }
    };

    return (
        <div className="dashboard-container" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
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
                        <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                        <div className="nav-item active"><Trophy size={18} /> <span>Leaderboard</span></div>
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

            <div className="main-content" style={{ padding: '2rem 3rem' }}>
                <div className="content-center admin-full" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <header className="dashboard-header" style={{ borderBottom: 'none', padding: '0 0 2rem 0', background: 'transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <div>
                                <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Student Rankings</h1>
                                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>Monitor engagement and performance metrics across the cohort.</p>
                            </div>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '100px', padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                <Search size={16} color="#94a3b8" />
                                <input type="text" placeholder="Search students..." className="search-input" style={{ background: 'transparent' }} />
                            </div>
                            <button onClick={fetchLeaderboard} disabled={loading} className="refresh-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '100px', border: '1px solid #e2e8f0', background: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: '0.85rem', color: '#0f172a', fontWeight: 600, boxShadow: '0 2px 10px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}>
                                <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none', color: '#6366f1' }} /> 
                                {loading ? 'Syncing...' : 'Sync Data'}
                            </button>
                        </div>
                    </header>

                    {/* Minimalist Stats Strip */}
                    {!loading && leaderboard.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '3rem' }}>
                            {[
                                { label: 'Total Enrolled', value: leaderboard.length, icon: <Users size={20} color="#6366f1" />, bg: '#eef2ff', color: '#4f46e5' },
                                { label: 'Highest Score', value: leaderboard[0]?.totalPoints || 0, icon: <Star size={20} color="#eab308" />, bg: '#fefce8', color: '#ca8a04' },
                                { label: 'Average Score', value: leaderboard.length > 0 ? Math.round(leaderboard.reduce((a, s) => a + s.totalPoints, 0) / leaderboard.length) : 0, icon: <Activity size={20} color="#10b981" />, bg: '#ecfdf5', color: '#059669' },
                                { label: 'Last Synced', value: lastUpdated ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—', icon: <Clock size={20} color="#64748b" />, bg: '#f8fafc', color: '#475569', isText: true },
                            ].map((s, i) => (
                                <div key={s.label} className="stat-card" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {s.icon}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{s.label}</div>
                                        <div style={{ fontSize: s.isText ? '1.1rem' : '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{s.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6rem', flexDirection: 'column', gap: '16px' }}>
                            <div className="loader-ring"></div>
                            <p style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 500 }}>Analyzing engagement data...</p>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div style={{ background: '#fff', borderRadius: '24px', border: '1px dashed #cbd5e1', padding: '6rem 2rem', textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <Trophy size={32} color="#94a3b8" />
                            </div>
                            <h3 style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: 600, margin: '0 0 8px 0' }}>No Data Available</h3>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>Engagement metrics will populate here once students begin attending sessions and earning points.</p>
                        </div>
                    ) : (
                        <>
                            {/* Human-designed organic podium layout */}
                            {top3.length >= 3 && (
                                <div style={{ marginBottom: '4rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '24px', position: 'relative' }}>
                                    {podiumOrder.map((dataIdx) => {
                                        const entry = top3[dataIdx];
                                        if (!entry) return null;
                                        const style = rankStyles[dataIdx];
                                        const isGold = dataIdx === 0;

                                        return (
                                            <div key={entry.student_id} className={`podium-card rank-${dataIdx}`} style={{ 
                                                flex: isGold ? '0 1 340px' : '0 1 280px', 
                                                display: 'flex', flexDirection: 'column', 
                                                position: 'relative', zIndex: isGold ? 10 : 1,
                                                transform: isGold ? 'translateY(-20px)' : 'none',
                                                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                            }}>
                                                <div style={{
                                                    background: style.bg,
                                                    borderRadius: '24px',
                                                    padding: isGold ? '40px 30px' : '30px 24px',
                                                    textAlign: 'center',
                                                    boxShadow: style.shadow,
                                                    border: `1px solid ${style.border}`,
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}>
                                                    {/* Subtle background glow */}
                                                    <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', height: '100%', background: `radial-gradient(circle at top, ${style.border} 0%, transparent 60%)`, opacity: 0.1, pointerEvents: 'none' }} />
                                                    
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isGold ? '64px' : '52px', height: isGold ? '64px' : '52px', borderRadius: '50%', background: '#fff', border: `2px solid ${style.border}`, boxShadow: `0 8px 20px ${style.border.replace('0.3', '0.2')}`, marginBottom: '20px', position: 'relative', zIndex: 2 }}>
                                                        {style.icon}
                                                    </div>
                                                    
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: style.accent, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{style.label}</div>
                                                    
                                                    <h3 style={{ fontSize: isGold ? '1.4rem' : '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>{entry.name}</h3>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '24px', fontFamily: 'monospace' }}>{entry.enrollment_no}</div>
                                                    
                                                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', marginBottom: '24px' }}>
                                                        <span style={{ fontSize: isGold ? '2.5rem' : '2rem', fontWeight: 800, color: style.accent, letterSpacing: '-1px', lineHeight: 1 }}>{entry.totalPoints}</span>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>pts</span>
                                                    </div>
                                                    
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ color: '#64748b', marginBottom: '4px' }}><CheckCircle size={14} style={{ display: 'inline' }}/></div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{entry.attendancePoints}</div>
                                                        </div>
                                                        <div style={{ width: '1px', background: '#e2e8f0' }} />
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ color: '#64748b', marginBottom: '4px' }}><Zap size={14} style={{ display: 'inline' }}/></div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{entry.bonusPoints}</div>
                                                        </div>
                                                        <div style={{ width: '1px', background: '#e2e8f0' }} />
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ color: '#64748b', marginBottom: '4px' }}><MessageCircle size={14} style={{ display: 'inline' }}/></div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{entry.feedbackPoints}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Clean, Modern Table */}
                            <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                                <div style={{ padding: '24px 30px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '10px', color: '#3b82f6' }}>
                                            <Trophy size={18} />
                                        </div>
                                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Full Cohort Rankings</h2>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, background: '#f8fafc', padding: '6px 12px', borderRadius: '100px', border: '1px solid #e2e8f0' }}>
                                            {leaderboard.length} Active Students
                                        </span>
                                    </div>
                                </div>
                                
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                                        <thead>
                                            <tr>
                                                {['Rank', 'Student', 'ID', 'Total Score', 'Attendance', 'Bonus', 'Feedback', 'Progress'].map((h, i) => (
                                                    <th key={h} style={{ 
                                                        padding: '16px 24px', 
                                                        textAlign: i === 0 ? 'center' : 'left', 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 600, 
                                                        textTransform: 'uppercase', 
                                                        letterSpacing: '0.5px', 
                                                        color: '#64748b', 
                                                        background: '#f8fafc',
                                                        borderBottom: '1px solid #e2e8f0'
                                                    }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaderboard.map((entry, idx) => {
                                                const progressPct = entry.maxPossible > 0 ? Math.min(100, Math.round((entry.totalPoints / entry.maxPossible) * 100)) : 0;
                                                const isTop3 = entry.rank <= 3;
                                                
                                                return (
                                                    <tr key={entry.student_id} className="table-row-hover" style={{ transition: 'background 0.2s' }}>
                                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', width: '80px' }}>
                                                            {isTop3 ? (
                                                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: rankStyles[entry.rank - 1].bg, border: `1px solid ${rankStyles[entry.rank - 1].border}`, color: rankStyles[entry.rank - 1].accent }}>
                                                                    <Award size={16} />
                                                                </div>
                                                            ) : (
                                                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>{entry.rank}</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>{entry.name}</div>
                                                        </td>
                                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>{entry.enrollment_no || '—'}</span>
                                                        </td>
                                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: isTop3 ? rankStyles[entry.rank - 1].accent : '#0f172a' }}>{entry.totalPoints}</span>
                                                        </td>
                                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                            <span style={{ fontWeight: 600, color: '#3b82f6', fontSize: '0.9rem' }}>{entry.attendancePoints}</span>
                                                        </td>
                                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: entry.bonusPoints > 0 ? '#10b981' : '#94a3b8' }}>{entry.bonusPoints}</span>
                                                        </td>
                                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: entry.feedbackPoints > 0 ? '#f59e0b' : '#94a3b8' }}>{entry.feedbackPoints}</span>
                                                        </td>
                                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <div style={{ flex: 1, height: '6px', borderRadius: '100px', background: '#e2e8f0', overflow: 'hidden' }}>
                                                                    <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: '100px', background: progressPct >= 80 ? '#10b981' : progressPct >= 50 ? '#f59e0b' : '#ef4444', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                                                </div>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', width: '36px', textAlign: 'right' }}>{progressPct}%</span>
                                                            </div>
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
            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .loader-ring {
                    width: 48px;
                    height: 48px;
                    border: 4px solid #e0e7ff;
                    border-top-color: #6366f1;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                .refresh-btn:hover:not(:disabled) {
                    background: #f8fafc !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
                    transform: translateY(-1px);
                }
                
                .stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05) !important;
                }
                
                .podium-card:hover {
                    transform: translateY(-24px) scale(1.02) !important;
                }
                .podium-card.rank-1:hover {
                    transform: translateY(-4px) scale(1.02) !important;
                }
                .podium-card.rank-2:hover {
                    transform: translateY(-4px) scale(1.02) !important;
                }
                
                .table-row-hover:hover {
                    background: #f8fafc !important;
                }
            `}</style>
        </div>
    );
}

