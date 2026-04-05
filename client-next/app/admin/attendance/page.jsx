'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, Download, RefreshCw, Activity,
    CheckCircle, AlertTriangle, Filter, Users, ChevronDown, ChevronUp, XCircle, Timer,
    ShieldCheck, ShieldX, Smartphone
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminAttendancePage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSession, setExpandedSession] = useState(null);
    const [sessionStudents, setSessionStudents] = useState(null);
    const [studentsLoading, setStudentsLoading] = useState(false);
    const [nextRefreshIn, setNextRefreshIn] = useState(null);
    const refreshTimerRef = useRef(null);
    const SNAPSHOT_INTERVAL_MS = 6 * 60 * 1000; // 6 min scanner cadence

    // MAC Approvals state
    const [macPending, setMacPending] = useState([]);
    const [macLoading, setMacLoading] = useState(true);
    const [macActioning, setMacActioning] = useState(null); // studentId being actioned
    const [overrideLoading, setOverrideLoading] = useState(null); // studentId being overridden
    const [confirmOverride, setConfirmOverride] = useState(null); // { studentId, studentName, action, sessionId }

    const handleOverride = async (sessionId, studentId, action) => {
        setOverrideLoading(studentId);
        try {
            const res = await api.post('/api/admin/attendance/override', {
                session_id: sessionId,
                student_id: studentId,
                action,
            });
            // Refresh the student data
            const json = await api.get(`/api/admin/attendance/session-students?session_id=${sessionId}`);
            setSessionStudents(json);
            fetchSessions();
            setConfirmOverride(null);
        } catch (err) {
            console.error('Override failed:', err);
            alert('Override failed: ' + (err.message || 'Unknown error'));
        } finally {
            setOverrideLoading(null);
        }
    };

    const navTo = p => router.push(p);

    const fetchSessions = useCallback(async () => {
        try {
            setLoading(true);
            const json = await api.get(`/api/admin/attendance/sessions-by-date?date=${dateFilter}`);
            setSessions(json.sessions || []);
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        } finally {
            setLoading(false);
        }
    }, [dateFilter]);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    // Fetch pending MAC approvals on mount
    const fetchMacApprovals = useCallback(async () => {
        try {
            setMacLoading(true);
            const json = await api.get('/api/admin/settings/mac-approvals');
            setMacPending(Array.isArray(json.pending) ? json.pending : []);
        } catch (err) {
            console.error('Failed to fetch MAC approvals:', err);
            setMacPending([]);
        } finally {
            setMacLoading(false);
        }
    }, []);

    useEffect(() => { fetchMacApprovals(); }, [fetchMacApprovals]);

    const handleMacAction = async (studentId, action) => {
        setMacActioning(studentId);
        try {
            const res = await api.patch('/api/admin/settings/mac-approvals', { studentId, action });
            if (!res.success) {
                throw new Error(res.error || 'Approval failed');
            }
            console.log(`MAC ${action} confirmed for student ${studentId}:`, res.student);
            // Only remove from list once the server confirms the update
            setMacPending(prev => prev.filter(s => s.id !== studentId));
        } catch (err) {
            console.error('MAC action failed:', err);
            alert(`Failed to ${action} MAC address: ${err.message}. Please try again.`);
        } finally {
            setMacActioning(null);
        }
    };

    // Clear auto-refresh timer
    const clearRefreshTimer = () => {
        if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null; }
        setNextRefreshIn(null);
    };

    // Schedule next refresh synced to server snapshot time (same as live students page)
    const scheduleRefresh = (sessionId, lastSnapshotTime) => {
        clearRefreshTimer();
        if (!lastSnapshotTime) return;

        // next refresh = lastSnapshot + 6 min + 15s buffer
        const nextSnapshotTime = new Date(lastSnapshotTime).getTime() + SNAPSHOT_INTERVAL_MS + 15000;
        const delay = Math.max(30000, nextSnapshotTime - Date.now()); // at least 30s

        setNextRefreshIn(Math.round(delay / 1000));
        refreshTimerRef.current = setTimeout(() => {
            refreshSessionStudents(sessionId);
        }, delay);
    };

    // Silent refresh (no loading spinner) for ongoing session auto-updates
    const refreshSessionStudents = async (sessionId) => {
        try {
            const json = await api.get(`/api/admin/attendance/session-students?session_id=${sessionId}`);
            setSessionStudents(json);
            // Also refresh session list to keep status/counts current
            fetchSessions();
            // Re-schedule if still ongoing
            if (json.isOngoing && json.lastSnapshot) {
                scheduleRefresh(sessionId, json.lastSnapshot);
            } else {
                clearRefreshTimer();
            }
        } catch (err) {
            console.error('Auto-refresh failed:', err);
            // Retry in 30s
            refreshTimerRef.current = setTimeout(() => refreshSessionStudents(sessionId), 30000);
            setNextRefreshIn(30);
        }
    };

    const fetchSessionStudents = async (sessionId) => {
        if (expandedSession === sessionId) {
            setExpandedSession(null);
            setSessionStudents(null);
            clearRefreshTimer();
            return;
        }
        try {
            setStudentsLoading(true);
            setExpandedSession(sessionId);
            clearRefreshTimer();
            const json = await api.get(`/api/admin/attendance/session-students?session_id=${sessionId}`);
            setSessionStudents(json);
            // Set up auto-refresh if ongoing (sync to last snapshot time)
            if (json.isOngoing && json.lastSnapshot) {
                scheduleRefresh(sessionId, json.lastSnapshot);
            }
        } catch (err) {
            console.error('Failed to fetch session students:', err);
        } finally {
            setStudentsLoading(false);
        }
    };

    // Cleanup timer on unmount
    useEffect(() => {
        return () => clearRefreshTimer();
    }, []);

    // Countdown ticker for next refresh
    useEffect(() => {
        if (nextRefreshIn === null || nextRefreshIn <= 0) return;
        const tick = setInterval(() => {
            setNextRefreshIn(prev => (prev !== null && prev > 0) ? prev - 1 : null);
        }, 1000);
        return () => clearInterval(tick);
    }, [nextRefreshIn]);

    const formatTime = (t) => {
        if (!t) return '';
        const [h, m] = t.split(':');
        const hr = parseInt(h);
        const ampm = hr >= 12 ? 'PM' : 'AM';
        return `${hr % 12 || 12}:${m} ${ampm}`;
    };

    const SignalBars = ({ level }) => (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px' }}>
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ width: '3px', height: `${i * 3 + 2}px`, borderRadius: '1px', background: i <= level ? (level >= 4 ? '#16a34a' : level >= 3 ? '#b45309' : '#dc2626') : '#e5e7eb' }} />
            ))}
        </div>
    );

    const getStatusStyle = (status) => {
        switch (status) {
            case 'present': return { bg: '#ecfdf5', color: '#166534', label: 'Present', icon: <CheckCircle size={11} /> };
            case 'partial': return { bg: '#fffbeb', color: '#92400e', label: 'Partial', icon: <Timer size={11} /> };
            case 'absent': return { bg: '#fef2f2', color: '#991b1b', label: 'Absent', icon: <XCircle size={11} /> };
            default: return { bg: '#f5f5f5', color: '#888', label: status, icon: null };
        }
    };

    const getSessionStatusStyle = (status) => {
        switch (status) {
            case 'ongoing': return { bg: '#ecfdf5', color: '#166534', dot: '#16a34a' };
            case 'completed': return { bg: '#f0f0f0', color: '#555', dot: '#888' };
            case 'scheduled': return { bg: '#eff6ff', color: '#1e40af', dot: '#3b82f6' };
            default: return { bg: '#f5f5f5', color: '#888', dot: '#999' };
        }
    };

    const totalDetected = sessions.reduce((a, s) => a + (s.detectedStudents || 0), 0);
    const ongoingCount = sessions.filter(s => s.status === 'ongoing').length;

    const sidebarNav = (
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
                    <div className="nav-item active"><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/live-students')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Live Students</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours &amp; Honorarium</span></div>
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
    );

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            {sidebarNav}
            <div className="main-content">
                <div className="content-center admin-full">
                    {/* Header */}
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Attendance Monitoring</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search students..." className="search-input" /></div>
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Sessions', value: sessions.length, icon: Calendar, color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Ongoing', value: ongoingCount, icon: Activity, color: '#16a34a', bg: '#ecfdf5' },
                            { label: 'Students Detected', value: totalDetected, icon: Users, color: '#7c3aed', bg: '#faf5ff' },
                            { label: 'Completed', value: sessions.filter(s => s.status === 'completed').length, icon: CheckCircle, color: '#b45309', bg: '#fffbeb' },
                        ].map((stat, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.bg, color: stat.color, flexShrink: 0 }}><stat.icon size={18} /></div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>{stat.value}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Date Picker + Info Strip */}
                    <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', marginBottom: '1.2rem', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 1.5rem', gap: '16px', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Select Date</span>
                            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '0.82rem', color: '#555', fontFamily: 'inherit' }} />
                            <span style={{ color: '#bbb', fontSize: '0.72rem' }}>
                                {new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                            <button onClick={fetchSessions} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#888' }}><RefreshCw size={11} /> Refresh</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '7px 1.5rem', gap: '16px', fontSize: '0.7rem', color: '#aaa', background: '#fafafa', flexWrap: 'wrap' }}>
                            <span>Signal: <span style={{ color: '#888', fontWeight: 500 }}>{'>'} 2</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>Window: <span style={{ color: '#888', fontWeight: 500 }}>Start → End + 2 min</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>Points: <span style={{ color: '#888', fontWeight: 500 }}>1.0 max</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>Late: <span style={{ color: '#b45309', fontWeight: 500 }}>−0.5</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>{'<'}75%: <span style={{ color: '#b45309', fontWeight: 500 }}>−0.2</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>{'<'}50%: <span style={{ color: '#dc2626', fontWeight: 500 }}>−0.3</span></span>
                            <span style={{ color: '#ddd' }}>·</span>
                            <span>{'<'}30%: <span style={{ color: '#dc2626', fontWeight: 500 }}>Absent</span></span>
                            {nextRefreshIn !== null && nextRefreshIn > 0 && (
                                <>
                                    <span style={{ color: '#ddd' }}>·</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a' }}>
                                        <RefreshCw size={10} style={{ animation: 'spin 2s linear infinite' }} />
                                        Live — next refresh: <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                            {Math.floor(nextRefreshIn / 60)}m {String(nextRefreshIn % 60).padStart(2, '0')}s
                                        </span>
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Sessions List */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                                <Clock size={16} /> Classes on {new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 500 }}>({sessions.length} sessions)</span>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                                <Activity size={24} color="#ddd" />
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>Loading sessions...</div>
                            </div>
                        ) : sessions.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                                <Calendar size={24} color="#ddd" />
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>No classes scheduled for this date</div>
                            </div>
                        ) : sessions.map((session, idx) => {
                            const ss = getSessionStatusStyle(session.status);
                            const isExpanded = expandedSession === session.id;
                            return (
                                <div key={session.id}>
                                    <div onClick={() => fetchSessionStudents(session.id)}
                                        style={{ display: 'flex', alignItems: 'center', padding: '12px 1.5rem', gap: '16px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: isExpanded ? '#fafafa' : 'transparent', transition: 'background 0.2s' }}
                                        className="attendance-row">
                                        {/* Time */}
                                        <div style={{ minWidth: '120px', flexShrink: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111', fontFamily: 'monospace' }}>{formatTime(session.startTime)} – {formatTime(session.endTime)}</div>
                                            <div style={{ fontSize: '0.68rem', color: '#bbb' }}>{session.venueName}{session.venueBuilding ? `, ${session.venueBuilding}` : ''}</div>
                                        </div>

                                        {/* Course */}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111' }}>{session.courseName || session.title}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#888' }}>{session.facultyName ? `Prof. ${session.facultyName}` : session.title}</div>
                                        </div>

                                        {/* Detected students */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '90px' }}>
                                            <Users size={13} color="#888" />
                                            <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem', color: '#111' }}>{session.detectedStudents || 0} detected</span>
                                        </div>


                                        {/* Status */}
                                        <div style={{ minWidth: '90px' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: ss.bg, color: ss.color }}>
                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ss.dot }} /> {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                                            </span>
                                        </div>

                                        {/* Expand */}
                                        <div style={{ flexShrink: 0 }}>
                                            {isExpanded ? <ChevronUp size={16} color="#888" /> : <ChevronDown size={16} color="#bbb" />}
                                        </div>
                                    </div>

                                    {/* Expanded: Student Detail Table */}
                                    {isExpanded && (
                                        <div style={{ background: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                                            {/* Live indicator for ongoing sessions */}
                                            {session.status === 'ongoing' && !studentsLoading && sessionStudents && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', padding: '8px 1.5rem', gap: '14px',
                                                    fontSize: '0.72rem', background: '#ecfdf5', borderBottom: '1px solid #bbf7d0',
                                                }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#166534', fontWeight: 700 }}>
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                                                        Live Attendance
                                                    </span>
                                                    <span style={{ color: '#86efac' }}>·</span>
                                                    <span style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <RefreshCw size={10} style={{ animation: nextRefreshIn > 0 ? 'none' : 'spin 1s linear infinite' }} />
                                                        Next update: <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                                            {nextRefreshIn !== null && nextRefreshIn > 0
                                                                ? `${Math.floor(nextRefreshIn / 60)}m ${String(nextRefreshIn % 60).padStart(2, '0')}s`
                                                                : 'now'}
                                                        </span>
                                                    </span>
                                                    {sessionStudents.lastSnapshot && (
                                                        <>
                                                            <span style={{ color: '#86efac' }}>·</span>
                                                            <span style={{ color: '#15803d' }}>
                                                                Last snapshot: <span style={{ fontWeight: 600 }}>
                                                                    {new Date(sessionStudents.lastSnapshot).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                                                </span>
                                                            </span>
                                                        </>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); refreshSessionStudents(session.id); }}
                                                        style={{
                                                            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px',
                                                            padding: '4px 10px', borderRadius: '6px', border: '1px solid #bbf7d0',
                                                            background: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, color: '#166534',
                                                        }}>
                                                        <RefreshCw size={10} /> Refresh Now
                                                    </button>
                                                </div>
                                            )}
                                            {studentsLoading ? (
                                                <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: '0.82rem' }}>Loading student data...</div>
                                            ) : !sessionStudents ? (
                                                <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: '0.82rem' }}>No data available</div>
                                            ) : (
                                                <>
                                                    {/* Summary strip */}
                                                    <div style={{ display: 'flex', gap: '20px', padding: '10px 1.5rem', borderBottom: '1px solid #e8e8e8', fontSize: '0.72rem', flexWrap: 'wrap' }}>
                                                        {[
                                                            ['Present', sessionStudents.summary?.present || 0, '#16a34a'],
                                                            ['Partial', sessionStudents.summary?.partial || 0, '#b45309'],
                                                            ['Absent', sessionStudents.summary?.absent || 0, '#dc2626'],
                                                        ].map(([label, val, color]) => (
                                                            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                                                                <span style={{ color: '#888' }}>{label}:</span>
                                                                <span style={{ fontWeight: 700, color, fontFamily: 'monospace' }}>{val}</span>
                                                            </span>
                                                        ))}
                                                        <span style={{ color: '#ddd' }}>·</span>
                                                        <span style={{ color: '#888' }}>Snapshots: <span style={{ fontWeight: 700, color: '#555', fontFamily: 'monospace' }}>{sessionStudents.summary?.snapshotsAnalyzed || 0}</span></span>
                                                        <span style={{ color: '#ddd' }}>·</span>
                                                        <span style={{ color: '#888' }}>Enrolled: <span style={{ fontWeight: 700, color: '#555', fontFamily: 'monospace' }}>{sessionStudents.summary?.enrolled || sessionStudents.summary?.total || 0}</span></span>
                                                    </div>

                                                    {/* Student table */}
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                            <thead>
                                                                <tr style={{ background: '#f0f0f0' }}>
                                                                    {['Student', 'Enrollment', 'Signal', 'First Seen', 'Last Seen', 'Duration', 'Pings', 'Points', 'Status', 'Actions'].map(h => (
                                                                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(sessionStudents.students || []).map((s, i) => {
                                                                    const st = getStatusStyle(s.status);
                                                                    return (
                                                                        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: s.penalty ? '#fef2f2' : s.adminOverride ? '#fffbeb' : s.status === 'absent' ? '#fefefe' : '#fff' }}>
                                                                            <td style={{ padding: '9px 14px' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <span style={{ fontWeight: 600, color: s.status === 'absent' ? '#aaa' : '#111' }}>{s.name}</span>
                                                                                    {s.penalty && (
                                                                                        <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.58rem', fontWeight: 700, background: '#fecaca', color: '#991b1b' }}>PENALTY</span>
                                                                                    )}
                                                                                    {s.adminOverride && !s.penalty && (
                                                                                        <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.58rem', fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>ADMIN</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: '0.76rem', color: '#555' }}>{s.enrollmentNo}</td>
                                                                            <td style={{ padding: '9px 14px' }}>
                                                                                {s.signal > 0 ? (
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                        <SignalBars level={s.signal} />
                                                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: s.signal >= 4 ? '#16a34a' : s.signal >= 3 ? '#b45309' : '#dc2626' }}>{s.signal}</span>
                                                                                        {s.avgSignal > 0 && (
                                                                                            <span style={{ fontSize: '0.62rem', color: '#bbb' }}>avg {s.avgSignal}</span>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span style={{ color: '#ccc', fontSize: '0.75rem' }}>—</span>
                                                                                )}
                                                                            </td>
                                                                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: '0.76rem', color: '#888' }}>
                                                                                {s.firstSeen ? new Date(s.firstSeen).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'}
                                                                            </td>
                                                                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: '0.76rem', color: '#888' }}>
                                                                                {s.lastSeen ? new Date(s.lastSeen).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'}
                                                                            </td>
                                                                            <td style={{ padding: '9px 14px' }}>
                                                                                <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.78rem', color: s.durationMinutes > 0 ? '#555' : '#ccc' }}>
                                                                                    {s.durationMinutes > 0 ? `${s.durationMinutes} min` : '—'}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>{s.pingCount || 0}</td>
                                                                            <td style={{ padding: '9px 14px' }} title={s.pointsBreakdown?.reason || ''}>
                                                                                {s.points !== undefined ? (
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                        <div style={{
                                                                                            width: '36px', height: '6px', borderRadius: '3px', background: '#f0f0f0', overflow: 'hidden',
                                                                                        }}>
                                                                                            <div style={{
                                                                                                width: `${(s.points || 0) * 100}%`, height: '100%', borderRadius: '3px',
                                                                                                background: s.points >= 0.8 ? '#16a34a' : s.points >= 0.5 ? '#b45309' : s.points > 0 ? '#dc2626' : '#e5e5e5',
                                                                                            }} />
                                                                                        </div>
                                                                                        <span style={{
                                                                                            fontWeight: 700, fontFamily: 'monospace', fontSize: '0.78rem',
                                                                                            color: s.points >= 0.8 ? '#16a34a' : s.points >= 0.5 ? '#b45309' : s.points > 0 ? '#dc2626' : '#ccc',
                                                                                        }}>{s.points.toFixed(1)}</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span style={{ color: '#ccc', fontSize: '0.75rem' }}>—</span>
                                                                                )}
                                                                            </td>
                                                                            <td style={{ padding: '9px 14px' }}>
                                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: st.bg, color: st.color }}>
                                                                                    {st.icon} {st.label}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ padding: '9px 14px' }}>
                                                                                {overrideLoading === s.studentId ? (
                                                                                    <span style={{ fontSize: '0.7rem', color: '#aaa' }}>Saving...</span>
                                                                                ) : s.penalty ? (
                                                                                    <span style={{ fontSize: '0.65rem', color: '#991b1b', fontWeight: 600 }} title={s.penaltyReason}>⛔ Penalized</span>
                                                                                ) : (
                                                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); handleOverride(expandedSession, s.studentId, 'present'); }}
                                                                                            disabled={s.adminOverride && s.status === 'present'}
                                                                                            style={{
                                                                                                padding: '3px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                                                                                                border: '1px solid #bbf7d0', background: s.adminOverride && s.status === 'present' ? '#dcfce7' : '#fff',
                                                                                                color: '#166534', opacity: s.adminOverride && s.status === 'present' ? 0.6 : 1,
                                                                                            }}
                                                                                        >✓ Present</button>
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setConfirmOverride({ studentId: s.studentId, studentName: s.name, action: 'absent', sessionId: expandedSession });
                                                                                            }}
                                                                                            style={{
                                                                                                padding: '3px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                                                                                                border: '1px solid #fecaca', background: '#fff', color: '#991b1b',
                                                                                            }}
                                                                                        >✗ Absent</button>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* ── MAC Address Approvals ── */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #E91E87', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                                <Smartphone size={16} />
                                Pending MAC Address Approvals
                                {macPending.length > 0 && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        minWidth: '20px', height: '20px', borderRadius: '10px',
                                        background: '#E91E87', color: '#fff',
                                        fontSize: '0.65rem', fontWeight: 700, padding: '0 5px'
                                    }}>
                                        {macPending.length}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={fetchMacApprovals}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#888' }}
                            >
                                <RefreshCw size={11} /> Refresh
                            </button>
                        </div>

                        {macLoading ? (
                            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#aaa' }}>
                                <Activity size={22} color="#ddd" />
                                <div style={{ fontSize: '0.82rem', marginTop: '8px' }}>Loading pending requests...</div>
                            </div>
                        ) : macPending.length === 0 ? (
                            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#aaa' }}>
                                <ShieldCheck size={28} color="#d1fae5" />
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '8px', color: '#16a34a' }}>All clear — no pending MAC approvals</div>
                                <div style={{ fontSize: '0.72rem', color: '#bbb', marginTop: '4px' }}>Student device registrations are up to date.</div>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            {['Student', 'Enrollment No.', 'Email', 'Pending MAC Address', 'Actions'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {macPending.map(student => {
                                            const isActioning = macActioning === student.id;
                                            return (
                                                <tr key={student.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '11px 16px', fontWeight: 600, color: '#111' }}>{student.name}</td>
                                                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#555' }}>{student.enrollment_no || '—'}</td>
                                                    <td style={{ padding: '11px 16px', fontSize: '0.76rem', color: '#888' }}>{student.email}</td>
                                                    <td style={{ padding: '11px 16px' }}>
                                                        <code style={{
                                                            padding: '4px 10px', background: '#fef9c3',
                                                            border: '1px solid #fde047', borderRadius: '6px',
                                                            fontFamily: 'monospace', fontSize: '0.82rem',
                                                            fontWeight: 700, color: '#713f12', letterSpacing: '0.5px'
                                                        }}>
                                                            {student.mac_address}
                                                        </code>
                                                    </td>
                                                    <td style={{ padding: '11px 16px' }}>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                disabled={isActioning}
                                                                onClick={() => handleMacAction(student.id, 'approve')}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                                    padding: '5px 14px', borderRadius: '7px', border: 'none',
                                                                    background: isActioning ? '#e5e7eb' : '#ecfdf5',
                                                                    color: isActioning ? '#aaa' : '#166534',
                                                                    cursor: isActioning ? 'not-allowed' : 'pointer',
                                                                    fontSize: '0.75rem', fontWeight: 700,
                                                                    transition: 'all 0.15s',
                                                                }}
                                                            >
                                                                <ShieldCheck size={13} />
                                                                {isActioning ? 'Processing...' : 'Approve'}
                                                            </button>
                                                            <button
                                                                disabled={isActioning}
                                                                onClick={() => handleMacAction(student.id, 'reject')}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                                    padding: '5px 14px', borderRadius: '7px', border: 'none',
                                                                    background: isActioning ? '#e5e7eb' : '#fef2f2',
                                                                    color: isActioning ? '#aaa' : '#991b1b',
                                                                    cursor: isActioning ? 'not-allowed' : 'pointer',
                                                                    fontSize: '0.75rem', fontWeight: 700,
                                                                    transition: 'all 0.15s',
                                                                }}
                                                            >
                                                                <ShieldX size={13} />
                                                                {isActioning ? 'Processing...' : 'Reject'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>
            </div>
                {/* ── Absent Override Confirmation Modal ── */}
                {confirmOverride && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 9999,
                    }} onClick={() => setConfirmOverride(null)}>
                        <div style={{
                            background: '#fff', borderRadius: '12px', padding: '1.5rem', maxWidth: '440px', width: '90%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '2px solid #fecaca',
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <AlertTriangle size={20} color="#dc2626" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111' }}>Mark Absent — Faking Penalty</div>
                                    <div style={{ fontSize: '0.75rem', color: '#888' }}>This action has severe consequences</div>
                                </div>
                            </div>

                            <div style={{ padding: '12px', borderRadius: '8px', background: '#fef2f2', marginBottom: '1rem', fontSize: '0.8rem', color: '#991b1b', lineHeight: '1.5' }}>
                                <strong>{confirmOverride.studentName}</strong> will be:
                                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                                    <li>Marked <strong>absent with 0 points</strong> for this session</li>
                                    <li>Penalized with <strong>0 points and absent status</strong> on ALL sessions from <strong>1 week before to 1 week after</strong> this date</li>
                                </ul>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setConfirmOverride(null)}
                                    style={{
                                        padding: '8px 16px', borderRadius: '6px', border: '1px solid #e5e7eb',
                                        background: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#555',
                                    }}
                                >Cancel</button>
                                <button
                                    onClick={() => handleOverride(confirmOverride.sessionId, confirmOverride.studentId, 'absent')}
                                    disabled={overrideLoading === confirmOverride.studentId}
                                    style={{
                                        padding: '8px 16px', borderRadius: '6px', border: 'none',
                                        background: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: '#fff',
                                        opacity: overrideLoading === confirmOverride.studentId ? 0.6 : 1,
                                    }}
                                >{overrideLoading === confirmOverride.studentId ? 'Applying Penalty...' : 'Confirm — Mark Absent'}</button>
                            </div>
                        </div>
                    </div>
                )}

            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
}
