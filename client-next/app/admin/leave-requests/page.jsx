'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../../Dashboard.css';
import {
  LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
  ChevronLeft, ChevronRight, Users, CheckCircle, XCircle, Clock, Trophy, GraduationCap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminLeaveRequestsPage() {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [reviewNotes, setReviewNotes] = useState({});
  const [busyId, setBusyId] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`;
      const res = await api.get(`/api/admin/leave-requests${q}`);
      setRequests(res.requests || []);
      setStats(res.stats || { pending: 0, approved: 0, total: 0 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const review = async (id, status) => {
    setBusyId(id);
    try {
      await api.patch(`/api/admin/leave-requests/${id}`, {
        status,
        admin_notes: reviewNotes[id] || '',
      });
      await fetchRequests();
    } catch (e) {
      alert(e.message || 'Failed to update leave request');
    } finally {
      setBusyId(null);
    }
  };

  const navTo = (p) => router.push(p);

  return (
    <div className="dashboard-container">
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
        <div>
          <div className="user-profile" style={{ position: 'relative' }}>
            <div className="user-avatar"><img src="/adminPic.png" alt="Admin" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /></div>
            <div className="user-info"><h3>Admin</h3><p>Leave Management</p></div>
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
                        <div className="nav-item active"><Clock size={18} /> <span>Leave Requests</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
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
              <h1>Leave Requests</h1>
            </div>
            <div className="header-actions"><Search size={18} color="#888" /></div>
          </header>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {['pending', 'approved', 'rejected', 'all'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 14px', borderRadius: '10px', border: filter === f ? 'none' : '1px solid #e2e8f0', background: filter === f ? '#111' : '#fff', color: filter === f ? '#fff' : '#64748b', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                {f} {f === 'pending' && stats.pending > 0 ? `(${stats.pending})` : ''}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
          ) : requests.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>No leave requests found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {requests.map((lr) => {
                const student = lr.students;
                const user = student?.users;
                const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Student';
                return (
                  <div key={lr.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{student?.enrollment_no || '—'} · {user?.email || ''}</div>
                        <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '10px' }}>
                          <strong>{lr.leave_date}</strong>
                          {lr.sessions?.title ? ` · ${lr.sessions.title}` : ' · Full day'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>{lr.reason}</div>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: lr.status === 'approved' ? '#ecfdf5' : lr.status === 'rejected' ? '#fef2f2' : '#fffbeb', color: lr.status === 'approved' ? '#166534' : lr.status === 'rejected' ? '#991b1b' : '#b45309' }}>
                        {lr.status}
                      </span>
                    </div>

                    {lr.status === 'pending' && (
                      <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Admin note (optional)"
                          value={reviewNotes[lr.id] || ''}
                          onChange={(e) => setReviewNotes((prev) => ({ ...prev, [lr.id]: e.target.value }))}
                          style={{ flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}
                        />
                        <button disabled={busyId === lr.id} onClick={() => review(lr.id, 'approved')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none', background: '#166534', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button disabled={busyId === lr.id} onClick={() => review(lr.id, 'rejected')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none', background: '#991b1b', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    )}

                    {lr.admin_notes && lr.status !== 'pending' && (
                      <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#64748b' }}>Note: {lr.admin_notes}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
