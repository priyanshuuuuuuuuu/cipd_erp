'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, Wifi, Bell, User, Palette, Shield,
    CheckCircle, AlertCircle, Eye, EyeOff, Save, RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

const SETTING_SECTIONS = [
    { id: 'device', label: 'Device & Attendance', icon: Wifi },
    { id: 'account', label: 'Account', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
];
const SectionCard = ({ title, subtitle, children }) => (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111' }}>{title}</div>
            {subtitle && <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '2px' }}>{subtitle}</div>}
        </div>
        <div style={{ padding: '1.5rem' }}>{children}</div>
    </div>
);

const SettingRow = ({ label, description, children }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 0', borderBottom: '1px solid #fafafa' }}>
        <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#222' }}>{label}</div>
            {description && <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '2px' }}>{description}</div>}
        </div>
        <div style={{ flexShrink: 0, marginLeft: '1rem' }}>{children}</div>
    </div>
);

const Toggle = ({ checked, onChange }) => (
    <div onClick={() => onChange(!checked)} style={{
        width: '44px', height: '24px', borderRadius: '12px',
        background: checked ? '#111' : '#e0e0e0',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
        flexShrink: 0,
    }}>
        <div style={{
            position: 'absolute', top: '3px',
            left: checked ? '22px' : '3px',
            width: '18px', height: '18px', borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
    </div>
);

export default function SettingsPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('device');

    // Profile state
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusRefreshing, setStatusRefreshing] = useState(false);

    // MAC address state
    const [macInput, setMacInput] = useState('');
    const [macSaving, setMacSaving] = useState(false);
    const [macMsg, setMacMsg] = useState(null); // { type: 'success'|'error', text }
    const [showMac, setShowMac] = useState(false);

    // Ref to hold latest profile for use inside the polling interval
    const profileRef = useRef(profile);
    useEffect(() => { profileRef.current = profile; }, [profile]);

    // Notification settings
    const [notifSettings, setNotifSettings] = useState({
        scheduleReminders: true,
        attendanceAlerts: true,
        assignmentDeadlines: true,
        feedbackRequests: true,
        gradeUpdates: false,
        systemAnnouncements: true,
    });

    // Appearance
    const [theme, setTheme] = useState('light');
    const [fontSize, setFontSize] = useState('medium');

    // Preferences saving state
    const [prefSaving, setPrefSaving] = useState(false);
    const [prefMsg, setPrefMsg] = useState(null);

    // Password change state
    const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState(null); // { type: 'success'|'error', text }

    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const fetchProfile = useCallback(async () => {
        try {
            const ts = Date.now();
            const [profileRes, prefsRes] = await Promise.allSettled([
                api.get(`/api/students/profile?_t=${ts}`),
                api.get(`/api/students/settings?_t=${ts}`),
            ]);

            if (profileRes.status === 'fulfilled') {
                const p = profileRes.value.profile || profileRes.value;
                setProfile(p);
                setMacInput(p.mac_address || '');
            }

            if (prefsRes.status === 'fulfilled') {
                const prefs = prefsRes.value.preferences || {};
                if (prefs.notifications) setNotifSettings(prev => ({ ...prev, ...prefs.notifications }));
                if (prefs.appearance) {
                    if (prefs.appearance.theme) setTheme(prefs.appearance.theme);
                    if (prefs.appearance.fontSize) setFontSize(prefs.appearance.fontSize);
                }
            }
        } catch (e) {
            console.error('Settings fetch error', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (authReady) fetchProfile(); }, [fetchProfile, authReady]);

    // ── Lightweight status-only refresh (for polling / manual check) ────────
    // Only updates mac_address + mac_verified to avoid clobbering input fields.
    const refreshMacStatus = useCallback(async (opts = {}) => {
        if (opts.showSpinner) setStatusRefreshing(true);
        try {
            // Bypass all caches: unique timestamp + no-store pragma header
            const res = await api.get(`/api/students/profile?_t=${Date.now()}`);
            const p = res.profile || res;

            if (!p || (!p.mac_address && p.mac_address !== null && !p.mac_verified)) {
                // Unexpected shape — do nothing
                return;
            }

            const wasApproved = p.mac_address && p.mac_verified;

            setProfile(prev => ({
                ...prev,
                mac_address: p.mac_address,
                mac_verified: p.mac_verified,
            }));

            if (wasApproved) {
                // Sync the input field to the approved MAC
                setMacInput(p.mac_address);
                // Reveal it so the student can see the real value
                setShowMac(true);
                if (opts.showSpinner) {
                    setMacMsg({ type: 'success', text: `✓ Verified! Your MAC address is now active: ${p.mac_address}` });
                }
            } else if (opts.showSpinner) {
                setMacMsg({ type: 'error', text: 'Still pending — admin has not approved yet.' });
            }
        } catch (e) {
            console.error('Status refresh error', e);
            if (opts.showSpinner) {
                setMacMsg({ type: 'error', text: `Check failed: ${e.message || 'Network error'}` });
            }
        } finally {
            if (opts.showSpinner) setStatusRefreshing(false);
        }
    }, []);

    // ── Poll every 20s while a MAC is pending ─────────────────────────────
    useEffect(() => {
        if (!profile) return;
        // Only poll when the student has submitted a MAC that hasn't been verified yet
        const isPending = profile.mac_address && !profile.mac_verified;
        if (!isPending) return;

        const interval = setInterval(() => {
            // Re-check profile ref so we stop if it got approved between ticks
            const current = profileRef.current;
            if (current?.mac_address && !current?.mac_verified) {
                refreshMacStatus();
            }
        }, 20000); // every 20 seconds

        return () => clearInterval(interval);
    }, [profile?.mac_address, profile?.mac_verified, refreshMacStatus]);

    // ── Refresh on tab/window focus ───────────────────────────────────────
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                refreshMacStatus();
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [refreshMacStatus]);

    const macValid = (mac) => /^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/.test(mac);

    const handleMacSave = async () => {
        if (!macValid(macInput)) {
            setMacMsg({ type: 'error', text: 'Invalid format. Use XX:XX:XX:XX:XX:XX (e.g. A4:83:E7:2B:9F:01)' });
            return;
        }
        setMacSaving(true);
        setMacMsg(null);
        try {
            const res = await api.patch('/api/students/mac', { mac_address: macInput });
            setMacMsg({ type: 'success', text: 'MAC address updated. Pending verification by admin.' });
            setProfile(prev => ({ ...prev, mac_address: res.mac_address, mac_verified: false }));
        } catch (e) {
            setMacMsg({ type: 'error', text: e.message || 'Failed to update MAC address.' });
        } finally {
            setMacSaving(false);
        }
    };

    // Persist a preference change to the backend
    const savePreference = async (section, key, value) => {
        setPrefSaving(true);
        setPrefMsg(null);
        try {
            await api.patch('/api/students/settings', {
                [section]: { [key]: value },
            });
            setPrefMsg({ type: 'success', text: 'Saved.' });
            setTimeout(() => setPrefMsg(null), 2000);
        } catch (e) {
            setPrefMsg({ type: 'error', text: 'Could not save preference.' });
        } finally {
            setPrefSaving(false);
        }
    };

    const handleNotifToggle = (key, value) => {
        setNotifSettings(s => ({ ...s, [key]: value }));
        savePreference('notifications', key, value);
    };

    const handleThemeChange = (value) => {
        setTheme(value);
        savePreference('appearance', 'theme', value);
    };

    const handleFontSizeChange = (value) => {
        setFontSize(value);
        savePreference('appearance', 'fontSize', value);
    };

    // Password change handler
    const handlePasswordChange = async () => {
        setPwMsg(null);
        
        const currentTrimmed = pwForm.current.trim();
        const newPwTrimmed = pwForm.newPw.trim();
        const confirmTrimmed = pwForm.confirm.trim();

        if (!currentTrimmed || !newPwTrimmed || !confirmTrimmed) {
            setPwMsg({ type: 'error', text: 'All fields are required.' });
            return;
        }
        if (newPwTrimmed !== confirmTrimmed) {
            setPwMsg({ type: 'error', text: 'New passwords do not match.' });
            return;
        }
        if (newPwTrimmed.length < 8) {
            setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
            return;
        }
        setPwSaving(true);
        try {
            await api.post('/api/auth/update-password', {
                currentPassword: currentTrimmed,
                newPassword: newPwTrimmed,
            });
            setPwMsg({ type: 'success', text: 'Password updated successfully.' });
            setPwForm({ current: '', newPw: '', confirm: '' });
        } catch (e) {
            setPwMsg({ type: 'error', text: e.message || 'Failed to update password.' });
        } finally {
            setPwSaving(false);
        }
    };
    // Components were moved outside of SettingsPage to prevent re-mounting

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile">
                        <div className="user-avatar" style={{ background: '#0b6861', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => navTo('/profile')}>
                            {user?.firstName?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                    </div>
                    <nav className="nav-menu">
                        <div onClick={() => navTo('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Home</span></div>
                        <div onClick={() => navTo('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Attendance</span></div>
                        <div onClick={() => navTo('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div onClick={() => navTo('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div onClick={() => navTo('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div onClick={() => navTo('/courses')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Courses</span></div>
                        <div onClick={() => navTo('/calendar')} className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Calendar</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div className="nav-item active"><Settings size={18} /> <span>Settings</span></div>
                    <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content" style={{ flexDirection: 'column', overflowY: 'auto' }}>
                <header className="dashboard-header" style={{ padding: '1rem 2rem', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                        <h1>Settings</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search settings" className="search-input" /></div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }} />
                    </div>
                </header>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Settings sidebar */}
                    <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid #f0f0f0', padding: '1.5rem 1rem', background: '#fafafa' }}>
                        {SETTING_SECTIONS.map(sec => {
                            const Icon = sec.icon;
                            const isActive = activeSection === sec.id;
                            return (
                                <div key={sec.id} onClick={() => setActiveSection(sec.id)} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '0.7rem 0.8rem', borderRadius: '10px', cursor: 'pointer',
                                    background: isActive ? '#111' : 'transparent',
                                    color: isActive ? '#fff' : '#666',
                                    fontSize: '0.82rem', fontWeight: isActive ? 600 : 500,
                                    marginBottom: '4px', transition: 'all 0.15s',
                                }}>
                                    <Icon size={16} />
                                    {sec.label}
                                </div>
                            );
                        })}
                    </div>

                    {/* Settings content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>

                        {/* ── DEVICE & ATTENDANCE ── */}
                        {activeSection === 'device' && (
                            <div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', marginBottom: '4px' }}>Device & Attendance</div>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Manage your device registration used for Wi-Fi based attendance detection.</div>
                                </div>

                                <SectionCard title={`MAC Address Registration — ${profile?.first_name || user?.firstName || 'Student'}`} subtitle="Your device's MAC address is used by the attendance system to detect your presence in class.">
                                    {/* Current status */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: profile?.mac_verified ? '#f0fdf4' : '#fef9c3', borderRadius: '10px', marginBottom: '1.5rem' }}>
                                        {profile?.mac_verified
                                            ? <CheckCircle size={18} color="#16a34a" />
                                            : <AlertCircle size={18} color="#b45309" />}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: profile?.mac_verified ? '#16a34a' : '#b45309' }}>
                                                {profile?.mac_verified ? 'Verified & Active' : 'Pending Verification'}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '1px' }}>
                                                {profile?.mac_verified
                                                    ? 'Your device is registered and will be detected during attendance sessions.'
                                                    : 'Your MAC address has been submitted and is awaiting admin verification. Status updates automatically.'}
                                            </div>
                                        </div>
                                        {/* Manual refresh button — only shown when pending */}
                                        {!profile?.mac_verified && profile?.mac_address && (
                                            <button
                                                onClick={() => refreshMacStatus({ showSpinner: true })}
                                                disabled={statusRefreshing}
                                                title="Check approval status"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                    padding: '5px 12px', borderRadius: '8px',
                                                    border: '1px solid #fde047', background: '#fff',
                                                    cursor: statusRefreshing ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.72rem', fontWeight: 600, color: '#713f12',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <RefreshCw size={12} style={{ animation: statusRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                                                {statusRefreshing ? 'Checking...' : 'Check Status'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Current MAC display */}
                                    {profile?.mac_address && (
                                        <div style={{ marginBottom: '1.2rem' }}>
                                            <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Current MAC Address</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <code style={{ padding: '8px 16px', background: '#f5f5f5', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 600, letterSpacing: '1px', color: '#333' }}>
                                                    {showMac ? profile.mac_address : profile.mac_address.replace(/[A-Fa-f0-9]/g, '•')}
                                                </code>
                                                <button onClick={() => setShowMac(!showMac)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', display: 'flex' }}>
                                                    {showMac ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* MAC input */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                            {profile?.mac_address ? 'Update MAC Address' : 'Register MAC Address'}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input
                                                value={macInput}
                                                onChange={e => {
                                                    // Strip non-hex, uppercase it
                                                    let val = e.target.value.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
                                                    // Group by 2 and join with colon
                                                    if (val.length > 0) {
                                                        val = val.match(/.{1,2}/g).join(':');
                                                    }
                                                    setMacInput(val.slice(0, 17)); // Max 17 chars (XX:XX:XX:XX:XX:XX)
                                                    setMacMsg(null);
                                                }}
                                                placeholder="A4:83:E7:2B:9F:01"
                                                maxLength={17}
                                                style={{
                                                    flex: 1, padding: '10px 14px', borderRadius: '10px',
                                                    border: `1px solid ${macMsg?.type === 'error' ? '#fca5a5' : '#e0e0e0'}`,
                                                    fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: '1px',
                                                    outline: 'none', color: '#333',
                                                }}
                                            />
                                            <button
                                                onClick={handleMacSave}
                                                disabled={macSaving || !macInput}
                                                style={{
                                                    padding: '10px 20px', borderRadius: '10px',
                                                    background: macSaving ? '#ccc' : '#111', color: '#fff',
                                                    border: 'none', cursor: macSaving ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.82rem', fontWeight: 600,
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                }}
                                            >
                                                {macSaving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                                                {macSaving ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                        {macMsg && (
                                            <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 500,
                                                background: macMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                                                color: macMsg.type === 'success' ? '#16a34a' : '#dc2626',
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                            }}>
                                                {macMsg.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                                                {macMsg.text}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #e8e8e8', fontSize: '0.75rem' }}>
                                        {/* Warning banner */}
                                        <div style={{ padding: '10px 14px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                            <AlertCircle size={14} color="#c2410c" style={{ flexShrink: 0, marginTop: '1px' }} />
                                            <div style={{ color: '#7c2d12', lineHeight: 1.5 }}>
                                                <strong>Important:</strong> You must <strong>disable MAC randomisation</strong> before registering. The attendance system uses your fixed (factory) MAC address. A randomised MAC changes every time you connect and will not be recognised.
                                            </div>
                                        </div>

                                        {/* Android */}
                                        <div style={{ padding: '12px 14px', background: '#f8f8f8', borderBottom: '1px solid #eee' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#333' }}>Android</span>
                                            </div>
                                            <div style={{ color: '#666', lineHeight: 1.7 }}>
                                                <strong style={{ color: '#444' }}>Step 1 – Find your MAC address:</strong><br />
                                                Settings → About phone → Status → <strong>Phone Wi-Fi MAC address</strong><br /><br />
                                                <strong style={{ color: '#444' }}>Step 2 – Disable randomised MAC:</strong><br />
                                                Settings → Wi-Fi → long-press your network → <em>Modify network</em> → Advanced → <strong>MAC address type → Use device MAC</strong>
                                            </div>
                                        </div>

                                        {/* iOS */}
                                        <div style={{ padding: '12px 14px', background: '#f8f8f8' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#333' }}>iPhone / iPad (iOS)</span>
                                            </div>
                                            <div style={{ color: '#666', lineHeight: 1.7 }}>
                                                <strong style={{ color: '#444' }}>Step 1 – Find your MAC address:</strong><br />
                                                Settings → General → About → <strong>Wi-Fi Address</strong><br /><br />
                                                <strong style={{ color: '#444' }}>Step 2 – Disable Private Wi-Fi Address:</strong><br />
                                                Settings → Wi-Fi → tap the <strong>(i)</strong> next to your network → toggle <strong>Private Wi-Fi Address → Off</strong> → tap <em>Continue</em>
                                            </div>
                                        </div>
                                    </div>
                                </SectionCard>

                                <SectionCard title="Detection Rules" subtitle="How the attendance system determines your presence.">
                                    <SettingRow label="Detection Rule" description="Minimum Wi-Fi pings required to mark present">
                                        <span style={{ padding: '4px 12px', background: '#e0e7ff', color: '#3730a3', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>≥ 3 pings</span>
                                    </SettingRow>
                                    <SettingRow label="Ping Interval" description="How often the system checks for your device">
                                        <span style={{ padding: '4px 12px', background: '#f5f5f5', color: '#555', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>10 min</span>
                                    </SettingRow>
                                    <SettingRow label="Session Window" description="Duration of each attendance session">
                                        <span style={{ padding: '4px 12px', background: '#f5f5f5', color: '#555', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>60 min</span>
                                    </SettingRow>
                                    <SettingRow label="BSSID Verified" description="Venue Wi-Fi must match registered BSSID">
                                        <span style={{ padding: '4px 12px', background: '#dcfce7', color: '#16a34a', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>Yes</span>
                                    </SettingRow>
                                </SectionCard>
                            </div>
                        )}

                        {/* ── ACCOUNT ── */}
                        {activeSection === 'account' && (
                            <div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', marginBottom: '4px' }}>Account</div>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>View and manage your account information.</div>
                                </div>
                                <SectionCard title="Profile Information" subtitle="Your account details as registered with the institution.">
                                    {[
                                        { label: 'Full Name', value: displayName },
                                        { label: 'Email', value: user?.email },
                                        { label: 'Enrollment No.', value: profile?.enrollment_no },
                                        { label: 'Program', value: profile?.program_name },
                                        { label: 'Account Status', value: profile?.is_active !== false ? 'Active' : 'Inactive' },
                                    ].map((row, i) => (
                                        <SettingRow key={i} label={row.label}>
                                            <span style={{ fontSize: '0.82rem', color: '#444', fontWeight: 500 }}>{row.value || '—'}</span>
                                        </SettingRow>
                                    ))}
                                </SectionCard>
                                <SectionCard title="Password" subtitle="Change your account password.">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        {[
                                            { label: 'Current Password', key: 'current' },
                                            { label: 'New Password', key: 'newPw' },
                                            { label: 'Confirm New Password', key: 'confirm' },
                                        ].map(({ label, key }) => (
                                            <div key={key}>
                                                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '5px' }}>{label}</div>
                                                <input
                                                    type="password"
                                                    placeholder="••••••••"
                                                    value={pwForm[key]}
                                                    onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                                                    style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1px solid #e0e0e0', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                        ))}
                                        {pwMsg && (
                                            <div style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 500,
                                                background: pwMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                                                color: pwMsg.type === 'success' ? '#16a34a' : '#dc2626',
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                            }}>
                                                {pwMsg.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                                                {pwMsg.text}
                                            </div>
                                        )}
                                        <button
                                            onClick={handlePasswordChange}
                                            disabled={pwSaving}
                                            style={{ marginTop: '4px', padding: '9px 20px', background: pwSaving ? '#ccc' : '#111', color: '#fff', border: 'none', borderRadius: '9px', cursor: pwSaving ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 600, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            {pwSaving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                                            {pwSaving ? 'Updating...' : 'Update Password'}
                                        </button>
                                    </div>
                                </SectionCard>
                            </div>
                        )}

                        {/* ── NOTIFICATIONS ── */}
                        {activeSection === 'notifications' && (
                            <div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', marginBottom: '4px' }}>Notifications</div>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Choose which notifications you receive from the system.</div>
                                </div>
                                <SectionCard title="Academic Alerts">
                                    {prefMsg && (
                                        <div style={{ marginBottom: '0.75rem', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 500,
                                            background: prefMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                                            color: prefMsg.type === 'success' ? '#16a34a' : '#dc2626',
                                        }}>
                                            {prefMsg.text}
                                        </div>
                                    )}
                                    {[
                                        { key: 'scheduleReminders', label: 'Schedule Reminders', desc: 'Get reminded before class starts' },
                                        { key: 'attendanceAlerts', label: 'Attendance Alerts', desc: 'Alert when attendance drops below 75%' },
                                        { key: 'assignmentDeadlines', label: 'Assignment Deadlines', desc: 'Reminder 24h before an assignment is due' },
                                        { key: 'gradeUpdates', label: 'Grade Updates', desc: 'Notify when assignments are graded' },
                                    ].map(n => (
                                        <SettingRow key={n.key} label={n.label} description={n.desc}>
                                            <Toggle checked={notifSettings[n.key]} onChange={v => handleNotifToggle(n.key, v)} />
                                        </SettingRow>
                                    ))}
                                </SectionCard>
                                <SectionCard title="Other Notifications">
                                    {[
                                        { key: 'feedbackRequests', label: 'Feedback Requests', desc: 'When faculty requests session feedback' },
                                        { key: 'systemAnnouncements', label: 'System Announcements', desc: 'Important institutional announcements' },
                                    ].map(n => (
                                        <SettingRow key={n.key} label={n.label} description={n.desc}>
                                            <Toggle checked={notifSettings[n.key]} onChange={v => handleNotifToggle(n.key, v)} />
                                        </SettingRow>
                                    ))}
                                </SectionCard>
                            </div>
                        )}

                        {/* ── APPEARANCE ── */}
                        {activeSection === 'appearance' && (
                            <div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', marginBottom: '4px' }}>Appearance</div>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Customise how the dashboard looks and feels.</div>
                                </div>
                                <SectionCard title="Theme">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '4px' }}>
                                        {[
                                            { id: 'light', label: 'Light', bg: '#fff', border: '#e0e0e0' },
                                            { id: 'dark', label: 'Dark', bg: '#1a1a1a', border: '#333' },
                                            { id: 'system', label: 'System', bg: 'linear-gradient(135deg,#fff 50%,#1a1a1a 50%)', border: '#ccc' },
                                        ].map(t => (
                                            <div key={t.id} onClick={() => handleThemeChange(t.id)} style={{
                                                border: `2px solid ${theme === t.id ? '#111' : '#e8e8e8'}`,
                                                borderRadius: '12px', padding: '1rem', cursor: 'pointer',
                                                textAlign: 'center', transition: 'border-color 0.15s',
                                            }}>
                                                <div style={{ width: '100%', height: '60px', borderRadius: '8px', background: t.bg, marginBottom: '8px', border: `1px solid ${t.border}` }} />
                                                <div style={{ fontSize: '0.8rem', fontWeight: theme === t.id ? 700 : 500, color: theme === t.id ? '#111' : '#888' }}>{t.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                                <SectionCard title="Text Size">
                                    <SettingRow label="Font Size" description="Adjust the default text size across pages">
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {['small', 'medium', 'large'].map(s => (
                                                <button key={s} onClick={() => handleFontSizeChange(s)} style={{
                                                    padding: '5px 14px', borderRadius: '8px', border: `1px solid ${fontSize === s ? '#111' : '#e0e0e0'}`,
                                                    background: fontSize === s ? '#111' : '#fff', color: fontSize === s ? '#fff' : '#666',
                                                    cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize',
                                                }}>
                                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </SettingRow>
                                    {prefMsg && (
                                        <div style={{ marginTop: '0.5rem', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 500,
                                            background: prefMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                                            color: prefMsg.type === 'success' ? '#16a34a' : '#dc2626',
                                        }}>
                                            {prefMsg.text}
                                        </div>
                                    )}
                                </SectionCard>
                            </div>
                        )}

                        {/* ── PRIVACY & SECURITY ── */}
                        {activeSection === 'privacy' && (
                            <div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', marginBottom: '4px' }}>Privacy & Security</div>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Manage your data and security preferences.</div>
                                </div>
                                <SectionCard title="Data & Privacy">
                                    <SettingRow label="Active Sessions" description="You currently have 1 active session">
                                        <button style={{ padding: '5px 14px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                                            Sign out all
                                        </button>
                                    </SettingRow>
                                    <SettingRow label="MAC Address Visibility" description="Only your faculty and admin can see your MAC address">
                                        <span style={{ fontSize: '0.78rem', color: '#888', fontWeight: 500 }}>Faculty & Admin</span>
                                    </SettingRow>
                                    <SettingRow label="Attendance Data" description="Your attendance history is visible to faculty and admin">
                                        <span style={{ fontSize: '0.78rem', color: '#888', fontWeight: 500 }}>Faculty & Admin</span>
                                    </SettingRow>
                                </SectionCard>
                                <SectionCard title="Account Actions">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        <div style={{ padding: '14px', background: '#fef2f2', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>Sign Out</div>
                                                <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '2px' }}>Sign out of your account on this device</div>
                                            </div>
                                            <button onClick={async () => { await logout(); navTo('/'); }} style={{ padding: '7px 16px', borderRadius: '8px', background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                </SectionCard>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
