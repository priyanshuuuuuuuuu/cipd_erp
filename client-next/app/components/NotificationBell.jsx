'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const router = useRouter();
  const { authReady, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    try {
      const data = await api.get('/api/student/notifications?unread=true');
      setUnreadCount(data.unread_count || 0);
    } catch {
      /* ignore — bell stays decorative on error */
    }
  }, [user]);

  const fetchAll = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    setLoading(true);
    try {
      const data = await api.get('/api/student/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authReady && user?.role === 'student') {
      fetchUnreadCount();
    }
  }, [authReady, user, fetchUnreadCount]);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const markRead = async (id) => {
    try {
      await api.patch('/api/student/notifications', { notification_ids: [id] });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* silent */
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/api/student/notifications', { mark_all: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      /* silent */
    }
  };

  if (!user || user.role !== 'student') return null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Bell size={20} color="#555" />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              minWidth: '16px',
              height: '16px',
              borderRadius: '8px',
              background: '#dc2626',
              color: '#fff',
              fontSize: '0.6rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '320px',
            maxHeight: '400px',
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  color: '#2563eb',
                  fontWeight: 600,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: '0.82rem' }}>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: '0.82rem' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.is_read) markRead(n.id);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    border: 'none',
                    borderBottom: '1px solid #f8f8f8',
                    background: n.is_read ? '#fff' : '#f8fbff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111' }}>{n.title}</span>
                    <span style={{ fontSize: '0.65rem', color: '#aaa', whiteSpace: 'nowrap' }}>
                      {formatTime(n.created_at)}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '0.72rem',
                      color: '#666',
                      margin: 0,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {n.message}
                  </p>
                </button>
              ))
            )}
          </div>

          <div style={{ padding: '8px 14px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push('/notifications');
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.72rem',
                color: '#555',
                fontWeight: 600,
              }}
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
