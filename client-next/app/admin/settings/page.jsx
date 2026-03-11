'use client';
import React, { useState } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings as SettingsIcon, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Save,
    Plus, Trash2, Edit3, Shield, X, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminSettingsPage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showBssidModal, setShowBssidModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [saveStatus, setSaveStatus] = useState({});

    const [detectionConfig, setDetectionConfig] = useState({
        pingInterval: 10,
        pingsPerSession: 6,
        presenceThreshold: 3,
        attendanceWindow: 60,
    });

    const [bssidList, setBssidList] = useState([
        { id: 1, bssid: 'C4:E9:84:A2:3F:01', venue: 'Room 204, Block A', active: true },
        { id: 2, bssid: 'C4:E9:84:A2:3F:02', venue: 'Room 305, Block C', active: true },
        { id: 3, bssid: 'C4:E9:84:A2:3F:03', venue: 'LHC 3, Block B', active: true },
        { id: 4, bssid: 'C4:E9:84:A2:3F:04', venue: 'Lab 2, Block D', active: false },
        { id: 5, bssid: 'C4:E9:84:A2:3F:05', venue: 'Room 102, Block A', active: true },
    ]);

    const [newBssid, setNewBssid] = useState({ bssid: '', venue: '' });
    const [accountSettings, setAccountSettings] = useState({ email: 'admin@cipd.edu', currentPassword: '', newPassword: '', confirmPassword: '' });

    const navTo = p => router.push(p);

    const handleSave = (section) => {
        setSaveStatus({ ...saveStatus, [section]: 'saving' });
        setTimeout(() => {
            setSaveStatus({ ...saveStatus, [section]: 'saved' });
            setTimeout(() => setSaveStatus(prev => ({ ...prev, [section]: null })), 2000);
        }, 800);
    };

    const handleAddBssid = () => {
        if (!newBssid.bssid || !newBssid.venue) return;
        setBssidList(prev => [...prev, { id: Date.now(), bssid: newBssid.bssid, venue: newBssid.venue, active: true }]);
        setNewBssid({ bssid: '', venue: '' });
        setShowBssidModal(false);
    };

    const toggleBssid = (id) => {
        setBssidList(prev => prev.map(b => b.id === id ? { ...b, active: !b.active } : b));
    };

    const removeBssid = (id) => {
        setBssidList(prev => prev.filter(b => b.id !== id));
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
                                        <tr key={b.id} className="attendance-row" style={{ borderBottom: '1px solid #f5f5f5', opacity: b.active ? 1 : 0.5 }}>
                                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem', color: '#333' }}>{b.bssid}</td>
                                            <td style={{ padding: '10px 16px', color: '#555' }}>{b.venue}</td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <button onClick={() => toggleBssid(b.id)} className="change-status-btn" style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: b.active ? '#ecfdf5' : '#fef2f2', color: b.active ? '#166534' : '#991b1b' }}>
                                                    {b.active ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="change-status-btn" style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', color: '#888' }}><Edit3 size={13} /></button>
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
                            <SaveButton section="account" />
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
        </div>
    );
}
