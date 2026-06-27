'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
  LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
  LogOut, Bell, Search, Menu, ChevronLeft, ChevronRight, Trophy,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';
import NotificationBell from '../components/NotificationBell';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, logout, authReady } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student'
    : 'Student';

  const navTo = (p) => router.push(p);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/student/notifications');
      setNotifications(data.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) fetchNotifications();
  }, [authReady, fetchNotifications]);

  const markRead = async (id) => {
    await api.patch('/api/student/notifications', { notification_ids: [id] });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    await api.patch('/api/student/notifications', { mark_all: true });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
            <div className="nav-item" onClick={() => navTo('/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
            <div className="nav-item" onClick={() => navTo('/leaderboard')} style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
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
        <div className="content-center full-width">
          <header className="dashboard-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
              <h1>Notifications</h1>
            </div>
            <div className="header-actions">
              <NotificationBell />
            </div>
          </header>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.82rem', color: '#888' }}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
                <Bell size={32} color="#ddd" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No notifications</div>
              </div>
            ) : (
              notifications.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => { if (!n.is_read) markRead(n.id); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 1.5rem',
                    border: 'none',
                    borderBottom: i < notifications.length - 1 ? '1px solid #f5f5f5' : 'none',
                    background: n.is_read ? '#fff' : '#f8fbff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111' }}>{n.title}</span>
                    <span style={{ fontSize: '0.72rem', color: '#aaa' }}>
                      {n.created_at ? new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: 0, lineHeight: 1.5 }}>{n.message}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
