'use client';
import React, { useState, useEffect, useCallback } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Users, Trophy, GraduationCap,
    Layers, Plus, RefreshCw, Archive, ArchiveRestore, Star, Pencil, RotateCcw, X, AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useCohort } from '../../contexts/CohortContext';
import { api } from '@/lib/api';

const STATUS_STYLE = {
    running: { bg: '#dcfce7', fg: '#166534', label: 'Running' },
    archived: { bg: '#fef3c7', fg: '#92400e', label: 'Archived' },
    provisioning: { bg: '#e0e7ff', fg: '#3730a3', label: 'Provisioning' },
    failed: { bg: '#fee2e2', fg: '#991b1b', label: 'Failed' },
    deleting: { bg: '#f1f5f9', fg: '#475569', label: 'Deleting' },
};

const date = (d) => (d ? String(d).slice(0, 10) : '');
const btn = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#334155' };

function EditModal({ cohort, onClose, onSaved }) {
    const [form, setForm] = useState({ label: cohort.label, program: cohort.program || '', starts_on: date(cohort.starts_on), ends_on: date(cohort.ends_on) });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const input = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' };
    const lab = { display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', margin: '10px 0 4px', textTransform: 'uppercase' };

    const save = async () => {
        setError('');
        try {
            setSaving(true);
            await api.patch(`/api/admin/cohorts/${cohort.id}`, {
                label: form.label, program: form.program || null, starts_on: form.starts_on || null, ends_on: form.ends_on || null,
            });
            onSaved();
        } catch (e) { setError(e.message); } finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700 }}>Edit cohort</div>
                    <X size={18} style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>schema: {cohort.schema} (cannot be changed)</div>
                <label style={lab}>Label</label><input style={input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                <label style={lab}>Program</label><input style={input} value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={lab}>Starts on</label><input type="date" style={input} value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></div>
                    <div><label style={lab}>Ends on</label><input type="date" style={input} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></div>
                </div>
                {error && <div style={{ marginTop: 10, color: '#b91c1c', fontSize: '0.8rem' }}>{error}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                    <button style={btn} onClick={onClose}>Cancel</button>
                    <button style={{ ...btn, background: '#09090b', color: '#fff', border: 'none' }} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
            </div>
        </div>
    );
}

export default function AdminCohortsPage() {
    const router = useRouter();
    const { authReady } = useAuth();
    const { openCreateModal, refreshCohorts, switchCohort } = useCohort();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(null);
    const [editing, setEditing] = useState(null);

    const navTo = (p) => router.push(p);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get('/api/admin/cohorts');
            setRows(data.cohorts || []);
            setError('');
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    }, []);

    useEffect(() => { if (authReady) load(); }, [authReady, load]);

    const run = async (id, fn, okReload = true) => {
        setBusy(id); setError('');
        try { await fn(); if (okReload) { await load(); await refreshCohorts(); } }
        catch (e) { setError(e.message); await load(); }
        finally { setBusy(null); }
    };

    const patch = (c, body) => run(c.id, () => api.patch(`/api/admin/cohorts/${c.id}`, body));

    const th = { padding: '10px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', borderBottom: '1px solid #f0f0f0' };
    const td = { padding: '12px 14px', borderBottom: '1px solid #f8fafc', fontSize: '0.82rem', verticalAlign: 'top' };

    return (
        <div className="dashboard-container" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>AD</div>
                        <div className="user-info"><h3>Admin</h3><p>Cohorts</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <div id="cohort-switcher-portal" style={{ padding: '0 1rem 1rem', display: isCollapsed ? 'none' : 'block', width: '100%', boxSizing: 'border-box' }}></div>
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
                        <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/leaderboard')} style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/reports')} style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                        <div className="nav-item active"><Layers size={18} /> <span>Cohorts</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/notifications')} style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/settings')} style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div className="nav-item" onClick={() => navTo('/')} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content" style={{ padding: '2rem 3rem' }}>
                <div className="content-center admin-full" style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <header className="dashboard-header" style={{ borderBottom: 'none', padding: '0 0 1.5rem 0', background: 'transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <div>
                                <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Cohorts</h1>
                                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
                                    Each cohort is its own isolated set of sessions, attendance and student data. Archived cohorts are read-only.
                                </p>
                            </div>
                        </div>
                        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
                            <button style={btn} onClick={load} disabled={loading}><RefreshCw size={13} /> Refresh</button>
                            <button style={{ ...btn, background: '#09090b', color: '#fff', border: 'none' }} onClick={openCreateModal}><Plus size={13} /> New cohort</button>
                        </div>
                    </header>

                    {error && (
                        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: '0.84rem', marginBottom: 14 }}>
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                        </div>
                    )}

                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>{['Cohort', 'Program', 'Dates', 'Status', 'Students', 'Staff', 'Schema version', 'Actions'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {rows.map((c) => {
                                    const st = STATUS_STYLE[c.status] || STATUS_STYLE.deleting;
                                    const working = busy === c.id;
                                    return (
                                        <tr key={c.id}>
                                            <td style={td}>
                                                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                                    {c.label} {c.is_default && <span title="Default cohort" style={{ marginLeft: 6, fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4, background: '#e0f2fe', color: '#075985' }}>DEFAULT</span>}
                                                    {c.is_legacy && <span style={{ marginLeft: 6, fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', color: '#64748b' }}>LEGACY</span>}
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>{c.schema}</div>
                                                {c.status === 'failed' && c.last_error && <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#b91c1c', maxWidth: 360 }}>{c.last_error}</div>}
                                            </td>
                                            <td style={td}>{c.program || '—'}</td>
                                            <td style={td}>{date(c.starts_on) || '—'} → {date(c.ends_on) || 'ongoing'}</td>
                                            <td style={td}><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, background: st.bg, color: st.fg }}>{st.label}</span></td>
                                            <td style={td}>{c.student_count}</td>
                                            <td style={td}>{c.staff_count}</td>
                                            <td style={{ ...td, fontFamily: 'monospace', color: '#64748b' }}>{c.schema_version || '—'}</td>
                                            <td style={td}>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    {(c.status === 'running' || c.status === 'archived') && (
                                                        <button style={btn} onClick={() => switchCohort(c.schema)}>Open</button>
                                                    )}
                                                    {c.status !== 'provisioning' && c.status !== 'deleting' && c.status !== 'failed' && (
                                                        <button style={btn} disabled={working} onClick={() => setEditing(c)}><Pencil size={12} /> Edit</button>
                                                    )}
                                                    {c.status === 'running' && !c.is_default && (
                                                        <button style={btn} disabled={working} onClick={() => confirm(`Make "${c.label}" the default cohort (new sign-ups and background jobs)?`) && patch(c, { is_default: true })}><Star size={12} /> Make default</button>
                                                    )}
                                                    {c.status === 'running' && !c.is_default && (
                                                        <button style={btn} disabled={working} onClick={() => confirm(`Archive "${c.label}"? It becomes read-only and active students are marked completed.`) && patch(c, { status: 'archived' })}><Archive size={12} /> Archive</button>
                                                    )}
                                                    {c.status === 'archived' && (
                                                        <button style={btn} disabled={working} onClick={() => confirm(`Un-archive "${c.label}"? Students' memberships stay as they are.`) && patch(c, { status: 'running' })}><ArchiveRestore size={12} /> Un-archive</button>
                                                    )}
                                                    {c.status === 'failed' && (
                                                        <button style={{ ...btn, color: '#991b1b' }} disabled={working} onClick={() => run(c.id, () => api.post(`/api/admin/cohorts/${c.id}/retry`, {}))}><RotateCcw size={12} /> {working ? 'Retrying…' : 'Retry'}</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!rows.length && !loading && <tr><td style={td} colSpan={8}>No cohorts.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <p style={{ marginTop: 14, fontSize: '0.74rem', color: '#94a3b8' }}>
                        Cohorts cannot be deleted from this page. Deleting is a deliberate command-line operation that takes a backup first (see docs/COHORTS.md).
                    </p>
                </div>
            </div>
            {editing && <EditModal cohort={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); await refreshCohorts(); }} />}
        </div>
    );
}
