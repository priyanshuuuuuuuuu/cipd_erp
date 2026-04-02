'use client';
import React, { useState } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings as SettingsIcon, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Save,
    Plus, Trash2, Edit3, Shield, X, Eye, EyeOff, AlertCircle, ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminSettingsPage() {
    const router = useRouter();
    const [gcStatus, setGcStatus] = useState(null); // 'success', 'db_error', etc.
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showBssidModal, setShowBssidModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingBssid, setEditingBssid] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [saveStatus, setSaveStatus] = useState({});
    const [errorMsg, setErrorMsg] = useState('');

    const [detectionConfig, setDetectionConfig] = useState({
        pingInterval: 10,
        pingsPerSession: 6,
        presenceThreshold: 3,
        attendanceWindow: 60,
    });

    const [bssidList, setBssidList] = useState([]);
    const [newBssid, setNewBssid] = useState({ bssid: '', venue: '' });
    const [accountSettings, setAccountSettings] = useState({ email: 'admin@cipd.edu', currentPassword: '', newPassword: '' });

    const navTo = p => router.push(p);

    React.useEffect(() => {
        // Read GC connection status from URL, safely handling SSR
        if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(window.location.search);
            if (searchParams.get('gc_connected') === '1') {
                setGcStatus('success');
                // Clean up URL
                window.history.replaceState({}, '', '/admin/settings');
            } else if (searchParams.get('gc_error')) {
                setGcStatus(searchParams.get('gc_error'));
                window.history.replaceState({}, '', '/admin/settings');
            }
        }

        const loadData = async () => {
            try {
                const confRes = await fetch('/api/admin/settings/config');
                const conf = await confRes.json();
                if (conf && conf.ping_interval) {
                    setDetectionConfig({
                        pingInterval: conf.ping_interval,
                        pingsPerSession: conf.pings_per_session,
                        presenceThreshold: conf.presence_threshold,
                        attendanceWindow: conf.attendance_window,
                    });
                }
                const venRes = await fetch('/api/admin/settings/bssid');
                const venues = await venRes.json();
                setBssidList(Array.isArray(venues) ? venues : []);
            } catch (err) {
                console.error("Error loading settings:", err);
            }
        };
        loadData();
    }, []);

    const handleSave = async (section) => {
        setSaveStatus({ ...saveStatus, [section]: 'saving' });
        setErrorMsg('');
        try {
            if (section === 'detection') {
                const res = await fetch('/api/admin/settings/config', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(detectionConfig),
                });
                if (!res.ok) throw new Error("Failed to save config");
            } else if (section === 'account') {
                if (!accountSettings.currentPassword || !accountSettings.newPassword) {
                    throw new Error("Both current and new passwords are required");
                }
                const res = await fetch('/api/admin/settings/password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currentPassword: accountSettings.currentPassword,
                        newPassword: accountSettings.newPassword,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Password update failed");
                setAccountSettings({ ...accountSettings, currentPassword: '', newPassword: '' });
                alert("Password successfully updated!");
            }
            setSaveStatus({ ...saveStatus, [section]: 'saved' });
            setTimeout(() => setSaveStatus(prev => ({ ...prev, [section]: null })), 2000);
        } catch (err) {
            console.error("Save error:", err);
            setErrorMsg(err.message);
            setSaveStatus({ ...saveStatus, [section]: null });
            alert(err.message);
        }
    };

    const handleAddBssid = async () => {
        if (!newBssid.bssid || !newBssid.venue) return;
        try {
            const res = await fetch('/api/admin/settings/bssid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bssid: newBssid.bssid, venue: newBssid.venue }),
            });
            const { data } = await res.json();
            if (data) {
                setBssidList(prev => [...prev, data]);
                setNewBssid({ bssid: '', venue: '' });
                setShowBssidModal(false);
            }
        } catch (err) {
            console.error("Error adding BSSID:", err);
            alert("Failed to add BSSID");
        }
    };

    const toggleBssid = async (id) => {
        const item = bssidList.find(b => b.id === id);
        if(!item) return;
        try {
            const res = await fetch('/api/admin/settings/bssid', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !item.is_active }),
            });
            if (res.ok) {
                setBssidList(prev => prev.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b));
            }
        } catch (err) {
            console.error("Error toggling BSSID:", err);
        }
    };

    const handleEditBssid = async () => {
        if (!editingBssid || !editingBssid.router_bssid || !editingBssid.name) return;
        try {
            const res = await fetch('/api/admin/settings/bssid', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: editingBssid.id, 
                    router_bssid: editingBssid.router_bssid, 
                    name: editingBssid.name 
                }),
            });
            if (res.ok) {
                setBssidList(prev => prev.map(b => b.id === editingBssid.id ? editingBssid : b));
                setShowEditModal(false);
                setEditingBssid(null);
            }
        } catch (err) {
            console.error("Error editing BSSID:", err);
            alert("Failed to update BSSID");
        }
    };

    const removeBssid = async (id) => {
        if(!confirm("Are you sure you want to delete this venue?")) return;
        try {
            const res = await fetch(`/api/admin/settings/bssid?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setBssidList(prev => prev.filter(b => b.id !== id));
            }
        } catch (err) {
            console.error("Error removing BSSID:", err);
        }
    };

    const SaveButton = ({ section }) => (
        <button onClick={() => handleSave(section)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 16px', borderRadius: '8px', border: 'none', background: saveStatus[section] === 'saved' ? '#ecfdf5' : '#111', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: saveStatus[section] === 'saved' ? '#166534' : '#fff', transition: 'all 0.2s' }}>
            {saveStatus[section] === 'saving' ? 'Saving...' : saveStatus[section] === 'saved' ? <><CheckCircle size={13} /> Saved</> : <><Save size={13} /> Save Changes</>}
        </button>
    );

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
                    <div className="nav-item" onClick={() => navTo('/admin/attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours & Honorarium</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/reports')} style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/notifications')} style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                    <div className="nav-item active"><SettingsIcon size={18} /> <span>Settings</span></div>
                </nav>
            </div>
            <div className="sidebar-footer">
                <div className="nav-item" onClick={() => navTo('/')} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
            </div>
        </aside>
    );

    const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', color: '#333', outline: 'none', boxSizing: 'border-box', background: '#fafafa' };

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            {sidebarNav}
            <div className="main-content">
                <div className="content-center admin-full">
                    <header className="dashboard-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                            <h1>Settings</h1>
                        </div>
                        <div className="header-actions">
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Attendance Detection Config */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}><Shield size={16} /> Attendance Detection Configuration</div>
                            <SaveButton section="detection" />
                        </div>
                        <div style={{ padding: '1.2rem 1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                {[
                                    { label: 'Ping Interval (minutes)', key: 'pingInterval', min: 1, max: 30 },
                                    { label: 'Pings per Session', key: 'pingsPerSession', min: 1, max: 20 },
                                    { label: 'Presence Threshold (≥ pings)', key: 'presenceThreshold', min: 1, max: 10 },
                                    { label: 'Attendance Window (minutes)', key: 'attendanceWindow', min: 15, max: 180 },
                                ].map(field => (
                                    <div key={field.key}>
                                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '5px' }}>{field.label}</label>
                                        <input type="number" min={field.min} max={field.max} value={detectionConfig[field.key]}
                                            onChange={e => setDetectionConfig({ ...detectionConfig, [field.key]: parseInt(e.target.value) || 0 })}
                                            style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 600 }}
                                            onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #f0f0f0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <AlertCircle size={14} color="#888" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div style={{ fontSize: '0.72rem', color: '#888', lineHeight: 1.6 }}>
                                    Current rule: A student is marked <strong style={{ color: '#333' }}>Present</strong> if detected by ≥ <strong style={{ color: '#111' }}>{detectionConfig.presenceThreshold}</strong> pings out of <strong style={{ color: '#111' }}>{detectionConfig.pingsPerSession}</strong> total pings within <strong style={{ color: '#111' }}>{detectionConfig.attendanceWindow} min</strong> (every <strong style={{ color: '#111' }}>{detectionConfig.pingInterval} min</strong>).
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BSSID Whitelist */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}><Wifi size={16} /> BSSID Whitelist</div>
                            <button onClick={() => setShowBssidModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}><Plus size={13} /> Add BSSID</button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        {['BSSID', 'Venue', 'Status', ''].map(h => (
                                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#aaa', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {bssidList.map(b => (
                                        <tr key={b.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5', opacity: b.is_active !== false ? 1 : 0.5 }}>
                                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem', color: '#333' }}>{b.router_bssid || b.bssid}</td>
                                            <td style={{ padding: '10px 16px', color: '#555' }}>{b.name || b.venue}</td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <button onClick={() => toggleBssid(b.id)} className="change-status-btn" style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: b.is_active !== false ? '#ecfdf5' : '#fef2f2', color: b.is_active !== false ? '#166534' : '#991b1b' }}>
                                                    {b.is_active !== false ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button 
                                                        onClick={() => {
                                                            setEditingBssid({ ...b });
                                                            setShowEditModal(true);
                                                        }}
                                                        className="change-status-btn" 
                                                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#888' }}
                                                    >
                                                        <Edit3 size={13} />
                                                    </button>
                                                    <button onClick={() => removeBssid(b.id)} className="change-status-btn" style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#ccc' }}><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Account Settings */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #E91E87', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}><SettingsIcon size={16} /> Account Settings</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                {errorMsg && <div style={{ fontSize: '0.75rem', color: '#e11d48', fontWeight: 600 }}>{errorMsg}</div>}
                                <SaveButton section="account" />
                            </div>
                        </div>
                        <div style={{ padding: '1.2rem 1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '600px' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '5px' }}>Admin Email</label>
                                    <input type="email" value={accountSettings.email} onChange={e => setAccountSettings({ ...accountSettings, email: e.target.value })}
                                        style={inputStyle} onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '5px' }}>Current Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type={showPassword ? 'text' : 'password'} value={accountSettings.currentPassword} onChange={e => setAccountSettings({ ...accountSettings, currentPassword: e.target.value })} placeholder="••••••••"
                                            style={{ ...inputStyle, paddingRight: '36px' }} onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                        <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0 }}>
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888', display: 'block', marginBottom: '5px' }}>New Password</label>
                                    <input type="password" value={accountSettings.newPassword} onChange={e => setAccountSettings({ ...accountSettings, newPassword: e.target.value })} placeholder="••••••••"
                                        style={inputStyle} onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Google Classroom Integration */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #1a73e8', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                                <img src="https://ssl.gstatic.com/classroom/favicon.png" alt="GC" width={18} height={18} />
                                Google Classroom Integration
                            </div>
                        </div>
                        <div style={{ padding: '1.2rem 1.5rem' }}>
                            <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: '12px', lineHeight: 1.6 }}>
                                Connect your Google Classroom teacher account (<strong>priyanshupandeynov18@gmail.com</strong>).
                                Once connected, assignments you create in Google Classroom will automatically appear
                                in every student's dashboard under "Pending Assignments".
                            </div>
                            <div style={{ padding: '10px 14px', background: '#f0f7ff', borderRadius: '8px', border: '1px solid #c7d9f8', marginBottom: '14px', fontSize: '0.75rem', color: '#1a56db', lineHeight: 1.5 }}>
                                ℹ️ Students do <strong>not</strong> need to connect their own Google accounts.
                                Only the admin needs to connect once using the teacher account.
                            </div>

                            {gcStatus === 'success' && (
                                <div style={{ padding: '10px 14px', background: '#e6f4ea', borderRadius: '8px', border: '1px solid #ceead6', marginBottom: '14px', fontSize: '0.8rem', color: '#137333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle size={16} /> Successfully connected to Google Classroom!
                                </div>
                            )}
                            {gcStatus === 'db_error' && (
                                <div style={{ padding: '10px 14px', background: '#fce8e6', borderRadius: '8px', border: '1px solid #fad2cf', marginBottom: '14px', fontSize: '0.8rem', color: '#c5221f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertCircle size={16} /> Database Error: Supabase schema cache issue. Please run `NOTIFY pgrst, 'reload schema'` in your Supabase SQL editor.
                                </div>
                            )}
                            {gcStatus && gcStatus !== 'success' && gcStatus !== 'db_error' && (
                                <div style={{ padding: '10px 14px', background: '#fce8e6', borderRadius: '8px', border: '1px solid #fad2cf', marginBottom: '14px', fontSize: '0.8rem', color: '#c5221f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertCircle size={16} /> Failed to connect: {gcStatus}
                                </div>
                            )}

                            <button
                                onClick={async () => {
                                    try {
                                        const { url } = await api.get('/api/auth/google/connect');
                                        window.location.href = url;
                                    } catch (e) {
                                        alert('Failed to get Google auth URL: ' + e.message);
                                    }
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 18px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.80rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                                <ExternalLink size={14} />
                                Connect Google Classroom
                            </button>
                            <div style={{ marginTop: '8px', fontSize: '0.68rem', color: '#aaa' }}>
                                You will be redirected to Google to authorize access. Make sure to log in with your teacher Google account.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add BSSID Modal */}
            {showBssidModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowBssidModal(false)}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Add BSSID</h3>
                            <button onClick={() => setShowBssidModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>BSSID (MAC Address)</label>
                                <input type="text" placeholder="e.g. C4:E9:84:A2:3F:06" value={newBssid.bssid} onChange={e => setNewBssid({ ...newBssid, bssid: e.target.value })}
                                    style={{ ...inputStyle, fontFamily: 'monospace' }} onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Venue</label>
                                <input type="text" placeholder="e.g. Room 301, Block B" value={newBssid.venue} onChange={e => setNewBssid({ ...newBssid, venue: e.target.value })}
                                    style={inputStyle} onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                            <button onClick={() => setShowBssidModal(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>Cancel</button>
                            <button onClick={handleAddBssid} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Plus size={14} /> Add BSSID
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Edit BSSID Modal */}
            {showEditModal && editingBssid && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => { setShowEditModal(false); setEditingBssid(null); }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Edit BSSID</h3>
                            <button onClick={() => { setShowEditModal(false); setEditingBssid(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>BSSID (MAC Address)</label>
                                <input type="text" value={editingBssid.router_bssid || ''} onChange={e => setEditingBssid({ ...editingBssid, router_bssid: e.target.value })}
                                    style={{ ...inputStyle, fontFamily: 'monospace' }} onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Venue Name</label>
                                <input type="text" value={editingBssid.name || ''} onChange={e => setEditingBssid({ ...editingBssid, name: e.target.value })}
                                    style={inputStyle} onFocus={e => e.target.style.borderColor = '#111'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                            <button onClick={() => { setShowEditModal(false); setEditingBssid(null); }} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>Cancel</button>
                            <button onClick={handleEditBssid} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#111', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Save size={14} /> Update BSSID
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
