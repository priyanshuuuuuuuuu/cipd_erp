'use client';

import React, { useState } from 'react';
import '../Dashboard.css';
import {
  LayoutGrid, Calendar, Clock, LogOut, Menu, ChevronLeft, ChevronRight, Search,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { path: '/faculty/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { path: '/faculty/schedule', label: 'My Schedule', icon: Calendar },
  { path: '/faculty/profile', label: 'Hours & Profile', icon: Clock },
];

export default function FacultyLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Faculty'
    : 'Faculty';

  const navTo = (path) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="dashboard-container">
      <div
        className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
        <div>
          <div className="user-profile" style={{ position: 'relative' }}>
            <div
              className="user-avatar"
              style={{
                background: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 700,
              }}
            >
              {user?.firstName?.[0]?.toUpperCase() || 'F'}
            </div>
            <div className="user-info">
              <h3>{displayName}</h3>
              <p>{user?.email}</p>
            </div>
            <div
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{
                position: 'absolute',
                right: '-12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#1a1a1a',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: '1px solid #333',
                color: '#888',
              }}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </div>
          </div>

          <nav className="nav-menu">
            <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '8px 1rem 4px' }}>
              <span>Faculty</span>
            </div>
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
              <div
                key={path}
                onClick={() => navTo(path)}
                className={`nav-item ${pathname === path ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <Icon size={18} /> <span>{label}</span>
              </div>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div
            className="nav-item"
            onClick={async () => {
              await logout();
              navTo('/');
            }}
            style={{ cursor: 'pointer' }}
          >
            <LogOut size={18} /> <span>Log out</span>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <div className="content-center admin-full">
          <header className="dashboard-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                className="mobile-menu-btn"
                onClick={() => setIsMobileMenuOpen(true)}
                style={{ cursor: 'pointer' }}
              >
                <Menu size={24} />
              </div>
            </div>
            <div className="header-actions">
              <div className="search-bar">
                <Search size={16} color="#aaa" />
                <input type="text" placeholder="Search..." className="search-input" />
              </div>
              <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
            </div>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
