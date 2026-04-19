'use client';
import React, { useState, useEffect, useCallback } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle,
    Trophy, RefreshCw, Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

const medalEmoji = ['🥇', '🥈', '🥉'];
const podiumOrder = [1, 0, 2]; // Silver(idx1) left, Gold(idx0) center, Bronze(idx2) right

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

    const podiumHeight = { 0: '110px', 1: '80px', 2: '65px' }; // gold, silver, bronze
    const podiumGradient = {
        0: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
        1: 'linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%)',
        2: 'linear-gradient(135deg, #f4a261 0%, #e76f51 100%)',
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

            <div className="main-content">
                <div className="content-center admin-full">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Student Leaderboard</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search students..." className="search-input" /></div>
                            <button onClick={fetchLeaderboard} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #e8e8e8', background: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: '0.8rem', color: '#555', fontWeight: 500 }}>
                                <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
                            </button>
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Stats strip */}
                    {!loading && leaderboard.length > 0 && (
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem' }}>
                            {[
                                { label: 'Total Students', value: leaderboard.length, color: '#6355F1' },
                                { label: 'Top Score', value: leaderboard[0]?.totalPoints || 0, color: '#d97706' },
                                { label: 'Avg Score', value: leaderboard.length > 0 ? Math.round(leaderboard.reduce((a, s) => a + s.totalPoints, 0) / leaderboard.length) : 0, color: '#059669' },
                                { label: 'Last Updated', value: lastUpdated ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—', color: '#555' },
                            ].map(s => (
                                <div key={s.label} style={{ flex: 1, background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '14px 18px' }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{s.label}</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', flexDirection: 'column', gap: '12px' }}>
                            <RefreshCw size={28} color="#6355F1" style={{ animation: 'spin 1s linear infinite' }} />
                            <p style={{ color: '#aaa', fontSize: '0.88rem' }}>Loading leaderboard data...</p>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', padding: '4rem', textAlign: 'center' }}>
                            <Trophy size={48} color="#e8e8e8" style={{ marginBottom: '12px' }} />
                            <p style={{ color: '#999', fontWeight: 600 }}>No engagement data yet</p>
                            <p style={{ color: '#bbb', fontSize: '0.82rem' }}>Points will appear once sessions are completed.</p>
                        </div>
                    ) : (
                        <>
                            {/* Podium — Silver | Gold | Bronze */}
                            {top3.length >= 3 && (
                                <div style={{ background: 'linear-gradient(135deg, #f8f6ff 0%, #ede9fe 100%)', borderRadius: '16px', border: '1px solid #e0d9f7', padding: '2rem 1.5rem 0', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '12px', overflow: 'hidden' }}>
                                    {podiumOrder.map((dataIdx, colIdx) => {
                                        const entry = top3[dataIdx];
                                        if (!entry) return null;
                                        const isGold = dataIdx === 0;
                                        return (
                                            <div key={entry.student_id} style={{ flex: 1, maxWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                {/* Card */}
                                                <div style={{
                                                    width: '100%', borderRadius: '14px 14px 0 0', padding: isGold ? '1.8rem 1rem 1.5rem' : '1.4rem 1rem 1.2rem',
                                                    background: podiumGradient[dataIdx], textAlign: 'center', boxShadow: isGold ? '0 8px 32px rgba(253,160,133,0.3)' : 'none',
                                                    transform: isGold ? 'scale(1.04)' : 'scale(1)', transformOrigin: 'bottom center',
                                                }}>
                                                    <div style={{ fontSize: isGold ? '2.2rem' : '1.8rem', marginBottom: '6px' }}>{medalEmoji[dataIdx]}</div>
                                                    <div style={{ fontWeight: 800, fontSize: isGold ? '1rem' : '0.88rem', color: '#111', marginBottom: '2px' }}>{entry.name}</div>
                                                    <div style={{ fontSize: '0.68rem', color: 'rgba(0,0,0,0.5)', marginBottom: '10px' }}>{entry.enrollment_no}</div>
                                                    <div style={{ fontSize: isGold ? '2rem' : '1.6rem', fontWeight: 900, fontFamily: 'monospace', color: '#111' }}>{entry.totalPoints}</div>
                                                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Points</div>
                                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '0.7rem', color: 'rgba(0,0,0,0.55)' }}>
                                                        <span>📋 {entry.attendancePoints}</span>
                                                        <span>⚡ {entry.bonusPoints}</span>
                                                        <span>💬 {entry.feedbackPoints}</span>
                                                    </div>
                                                </div>
                                                {/* Podium block */}
                                                <div style={{ width: '100%', background: podiumGradient[dataIdx], height: podiumHeight[dataIdx], opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'rgba(0,0,0,0.25)' }}>#{entry.rank}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Full Rankings Table */}
                            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 1.2rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Trophy size={15} color="#6355F1" />
                                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Global Engagement Rankings</span>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', color: '#bbb' }}>
                                        {leaderboard.length} students · {leaderboard[0]?.totalPoints || 0} top score
                                    </span>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr style={{ background: '#fafafa' }}>
                                                {['#', 'Student', 'Enrollment No', 'Total', 'Attendance', 'Bonus', 'Feedback', 'Sessions'].map(h => (
                                                    <th key={h} style={{ padding: '10px 14px', textAlign: h === '#' ? 'center' : 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#999', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaderboard.map(entry => {
                                                const progressPct = entry.maxPossible > 0 ? Math.round((entry.totalPoints / entry.maxPossible) * 100) : 0;
                                                return (
                                                    <tr key={entry.student_id} style={{ borderBottom: '1px solid #f5f5f5' }}
                                                        onMouseOver={e => { e.currentTarget.style.background = '#fafafa'; }}
                                                        onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
                                                        <td style={{ padding: '10px 14px', textAlign: 'center', width: '50px' }}>
                                                            {entry.rank <= 3 ? (
                                                                <span style={{ fontSize: '1.1rem' }}>{medalEmoji[entry.rank - 1]}</span>
                                                            ) : (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.78rem', background: '#f5f5f5', color: '#666' }}>{entry.rank}</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <div style={{ fontWeight: 600, color: '#333', fontSize: '0.85rem' }}>{entry.name}</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                                <div style={{ flex: 1, maxWidth: '120px', height: '4px', borderRadius: '2px', background: '#f0f0f0', overflow: 'hidden' }}>
                                                                    <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: '2px', background: progressPct >= 80 ? '#16a34a' : progressPct >= 50 ? '#d97706' : '#dc2626', transition: 'width 0.5s ease' }} />
                                                                </div>
                                                                <span style={{ fontSize: '0.62rem', color: '#bbb', fontFamily: 'monospace' }}>{progressPct}%</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>{entry.enrollment_no || '—'}</span>
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
                                                            <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#777' }}>{entry.sessionsAttended}/{entry.sessionsEnrolled}</span>
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
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
