'use client';
import React, { useState, useEffect } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, Download, RefreshCw, Activity,
    CheckCircle, AlertTriangle, Filter, Fingerprint, Shield, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminAttendancePage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [sessionFilter, setSessionFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('2026-02-14');
    const [sessionActive, setSessionActive] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authState, setAuthState] = useState('idle');
    const [macFilter, setMacFilter] = useState('all');
    const [timer, setTimer] = useState({ min: 7, sec: 24 });

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer(prev => {
                if (prev.sec === 0) return prev.min === 0 ? { min: 11, sec: 59 } : { min: prev.min - 1, sec: 59 };
                return { ...prev, sec: prev.sec - 1 };
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const pad = n => String(n).padStart(2, '0');
    const navTo = p => router.push(p);

    const students = [
        { name: 'Aarav Gupta', rollNo: 'CS21034', pings: 4, status: 'Present', mac: 'A4:83:E7:2B:9F:01', lastSeen: '09:36:15' },
        { name: 'Sneha Kumar', rollNo: 'CS21056', pings: 2, status: 'Absent', mac: 'B2:C1:D4:8E:3A:02', lastSeen: '09:36:09' },
        { name: 'Rohan Patel', rollNo: 'CS21023', pings: 5, status: 'Present', mac: 'C9:D4:A1:7B:E3:03', lastSeen: '09:48:19' },
        { name: 'Priya Malhotra', rollNo: 'CS21045', pings: 3, status: 'Present', mac: null, lastSeen: '09:24:05' },
        { name: 'Karan Singh', rollNo: 'CS21067', pings: 1, status: 'Absent', mac: 'E8:F2:B5:6D:1C:05', lastSeen: '09:48:03' },
        { name: 'Vivaan Singh', rollNo: 'CS21091', pings: 3, status: 'Present', mac: null, lastSeen: '09:36:02' },
        { name: 'Aditya Kumar', rollNo: 'CS21012', pings: 0, status: 'Absent', mac: null, lastSeen: '—' },
    ];

    const rawLogs = [
        { timestamp: '2026-02-14 09:00:12', hash: 'a7f3...e1d2', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:12:08', hash: 'b2c1...f4a8', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:12:14', hash: 'c9d4...b7e3', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:24:05', hash: 'd1e5...a3c7', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:36:02', hash: 'f3a7...c2e9', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:36:09', hash: 'b2c1...f4a8', bssid: 'C4:E9:84:A2:3F:02', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:36:15', hash: 'a7f3...e1d2', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:48:03', hash: 'e8f2...d6b1', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
        { timestamp: '2026-02-14 09:48:19', hash: 'c9d4...b7e3', bssid: 'C4:E9:84:A2:3F:01', session: 'CS301-A' },
    ];

    const filtered = students.filter(s => macFilter === 'registered' ? s.mac : macFilter === 'not-registered' ? !s.mac : true);
    const presentCount = students.filter(s => s.status === 'Present').length;
    const absentCount = students.length - presentCount;

    const handleFingerprint = () => {
        setAuthState('verifying');
        setTimeout(() => {
            if (Math.random() > 0.1) {
                setAuthState('success');
                setTimeout(() => { setShowAuthModal(false); setSessionActive(true); setAuthState('idle'); }, 1200);
            } else setAuthState('failed');
        }, 1800);
    };

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
                    <div className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                    <div className="nav-item active"><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                    <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                    <div className="nav-item" style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Hours &amp; Honorarium</span></div>
                    <div className="nav-item" style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                    <div className="nav-item" style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                    <div className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
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

                    {/* Session strip */}
                    <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', marginBottom: '1.2rem', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 1.2rem', fontSize: '0.78rem', borderBottom: '1px solid #f0f0f0', gap: '0', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                            {[['Session','CS301-A'],['Students',String(students.length)],['Detected',`${presentCount}/${students.length}`],['Ping','3/6'],['Window','09:00–10:00']].map(([label, val], i) => (
                                <React.Fragment key={label}>
                                    <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'0 14px', flexShrink:0 }}>
                                        <span style={{ color:'#999', fontWeight:500, fontSize:'0.7rem', textTransform:'uppercase' }}>{label}</span>
                                        <span style={{ fontWeight:700, color:'#111', fontFamily:'monospace' }}>{val}</span>
                                    </div>
                                    {i < 4 && <div style={{ width:'1px', height:'20px', background:'#e8e8e8', flexShrink:0 }} />}
                                </React.Fragment>
                            ))}
                            <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'0 14px', flexShrink:0, borderLeft:'1px solid #e8e8e8' }}>
                                <span style={{ width:'6px', height:'6px', borderRadius:'50%', background: sessionActive ? '#16a34a' : '#999', display:'inline-block' }} />
                                <span style={{ fontWeight:600, color: sessionActive ? '#111' : '#999', fontSize:'0.78rem' }}>{sessionActive ? 'Active' : 'Inactive'}</span>
                            </div>
                            <div style={{ marginLeft:'auto', padding:'0 14px', flexShrink:0 }}>
                                <span style={{ fontWeight:700, color:'#111', fontFamily:'monospace', fontSize:'0.82rem' }}>{pad(timer.min)}:{pad(timer.sec)}</span>
                                <span style={{ color:'#bbb', fontSize:'0.68rem', marginLeft:'4px' }}>next ping</span>
                            </div>
                            <div style={{ paddingRight:'14px', flexShrink:0 }}>
                                <button onClick={() => { if (!sessionActive) { setShowAuthModal(true); setAuthState('idle'); } }} disabled={sessionActive}
                                    style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 14px', borderRadius:'6px', border: `1px solid ${sessionActive ? '#e8e8e8' : '#111'}`, background: sessionActive ? '#fafafa' : '#111', color: sessionActive ? '#999' : '#fff', fontSize:'0.72rem', fontWeight:600, cursor: sessionActive ? 'not-allowed' : 'pointer' }}>
                                    {sessionActive ? <><CheckCircle size={11}/> Live Tracking Enabled</> : <><Shield size={11}/> Start Attendance</>}
                                </button>
                            </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', padding:'7px 1.5rem', gap:'16px', fontSize:'0.7rem', color:'#aaa', background:'#fafafa' }}>
                            <span>BSSID <span style={{ fontFamily:'monospace', color:'#888' }}>C4:E9:84:A2:3F:01</span></span>
                            <span style={{ color:'#ddd' }}>·</span>
                            <span>Venue <span style={{ color:'#888', fontWeight:500 }}>Room 204, Block A</span></span>
                            <span style={{ color:'#ddd' }}>·</span>
                            <span>Rule <span style={{ color:'#888', fontWeight:500 }}>≥ 3 pings = Present</span></span>
                            <span style={{ color:'#ddd' }}>·</span>
                            <span>Faculty <span style={{ color:'#888', fontWeight:500 }}>Prof. Anuj Grover</span></span>
                            <button style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'4px', padding:'3px 8px', borderRadius:'6px', border:'1px solid #e8e8e8', background:'#fff', cursor:'pointer', fontSize:'0.68rem', color:'#888' }}><RefreshCw size={10}/> Refresh</button>
                        </div>
                    </div>

                    {/* Attendance table + Summary */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:'1.2rem', marginBottom:'1.5rem' }}>
                        <div style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e8e8e8', overflow:'hidden' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 1.5rem', borderBottom:'1px solid #f0f0f0' }}>
                                <div style={{ fontSize:'0.9rem', fontWeight:700, display:'flex', alignItems:'center', gap:'8px' }}><Activity size={14}/> Attendance Snapshot</div>
                                <button style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'6px', border:'1px solid #e8e8e8', background:'#fff', cursor:'pointer', fontSize:'0.72rem', color:'#888' }}><Download size={11}/> Export</button>
                            </div>
                            <div style={{ display:'flex', gap:'8px', padding:'6px 1.5rem', borderBottom:'1px solid #f0f0f0', alignItems:'center' }}>
                                <span style={{ fontSize:'0.68rem', color:'#aaa' }}>Filter MAC:</span>
                                {['all','registered','not-registered'].map(f => (
                                    <button key={f} onClick={() => setMacFilter(f)} style={{ padding:'2px 8px', borderRadius:'4px', fontSize:'0.68rem', fontWeight:600, border:`1px solid ${macFilter===f?'#111':'#e8e8e8'}`, background:macFilter===f?'#111':'#fff', color:macFilter===f?'#fff':'#888', cursor:'pointer' }}>
                                        {f === 'not-registered' ? 'Not Registered' : f === 'all' ? 'All' : 'Registered'}
                                    </button>
                                ))}
                                <span style={{ fontSize:'0.68rem', color:'#bbb', marginLeft:'auto' }}>{filtered.length} students</span>
                            </div>
                            <div style={{ overflowX:'auto' }}>
                                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                                    <thead>
                                        <tr style={{ background:'#fafafa' }}>
                                            {['Student','Roll No','Pings','MAC Address','Last Seen','Status',''].map(h => (
                                                <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontSize:'0.68rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', color:'#aaa', borderBottom:'1px solid #f0f0f0' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((s,i) => (
                                            <tr key={i} className="attendance-row" style={{ borderBottom:'1px solid #f5f5f5' }}>
                                                <td style={{ padding:'9px 16px', fontWeight:600, color:'#111' }}>{s.name}</td>
                                                <td style={{ padding:'9px 16px', fontFamily:'monospace', fontSize:'0.78rem', color:'#555' }}>{s.rollNo}</td>
                                                <td style={{ padding:'9px 16px' }}>
                                                    <span style={{ fontWeight:600, fontFamily:'monospace', color: s.pings>=3?'#111':s.pings>=1?'#b45309':'#dc2626' }}>{s.pings}/5</span>
                                                </td>
                                                <td style={{ padding:'9px 16px' }}>
                                                    {s.mac ? <span style={{ fontFamily:'monospace', fontSize:'0.75rem', color:'#999' }}>{s.mac}</span> : <span style={{ fontSize:'0.75rem', color:'#ccc', fontStyle:'italic' }}>Not Registered</span>}
                                                </td>
                                                <td style={{ padding:'9px 16px', fontFamily:'monospace', fontSize:'0.78rem', color:'#888' }}>{s.lastSeen}</td>
                                                <td style={{ padding:'9px 16px' }}>
                                                    <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'2px 10px', borderRadius:'6px', fontSize:'0.75rem', fontWeight:500, background: s.status==='Present'?'#ecfdf5':'#fef2f2', color: s.status==='Present'?'#166534':'#991b1b' }}>
                                                        <span style={{ width:'5px', height:'5px', borderRadius:'50%', background: s.status==='Present'?'#16a34a':'#dc2626' }} />{s.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding:'9px 16px' }}>
                                                    <button className="change-status-btn" style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #e8e8e8', background:'#fff', cursor:'pointer', fontSize:'0.7rem', color:'#999' }}>Override</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                            <div style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e8e8e8', padding:'1.2rem' }}>
                                <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'12px' }}>Detection Summary</div>
                                {[['Present', presentCount, '#16a34a'],['Absent', absentCount, '#dc2626']].map(([label, count, color]) => (
                                    <div key={label} style={{ marginBottom:'10px' }}>
                                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px', fontSize:'0.8rem' }}>
                                            <span style={{ color:'#777' }}>{label}</span>
                                            <span style={{ fontWeight:700, fontFamily:'monospace', color:'#111' }}>{count} <span style={{ fontSize:'0.68rem', color:'#aaa' }}>({Math.round(count/students.length*100)}%)</span></span>
                                        </div>
                                        <div style={{ width:'100%', height:'4px', background:'#e5e7eb', borderRadius:'2px', overflow:'hidden' }}>
                                            <div style={{ width:`${count/students.length*100}%`, height:'100%', background:color, borderRadius:'2px' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e8e8e8', padding:'1.2rem', flex:1 }}>
                                <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'12px' }}>System Config</div>
                                {[['Detection Rule','≥ 3 pings'],['Ping Interval','10 min'],['Total Pings','6 per session'],['Window','60 min'],['BSSID Verified','Yes']].map(([label, val], i) => (
                                    <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom: i<4?'1px solid #f5f5f5':'none', fontSize:'0.78rem' }}>
                                        <span style={{ color:'#888' }}>{label}</span>
                                        <span style={{ fontWeight:600, color:'#333', fontFamily:'monospace', fontSize:'0.76rem' }}>{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Raw Logs */}
                    <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e8e8e8', borderTop:'3px solid #3B2D82', overflow:'hidden' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem 1.5rem', borderBottom:'1px solid #f0f0f0', flexWrap:'wrap', gap:'10px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'1rem', fontWeight:700 }}><Wifi size={16}/> Raw Wi-Fi Ping Logs</div>
                            <div style={{ display:'flex', gap:'8px' }}>
                                <select value={sessionFilter} onChange={e=>setSessionFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'8px', border:'1px solid #eee', fontSize:'0.8rem', color:'#555', background:'#fff', cursor:'pointer' }}>
                                    <option value="all">All Sessions</option>
                                    <option value="CS301-A">CS301-A</option>
                                </select>
                                <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={{ padding:'5px 10px', borderRadius:'8px', border:'1px solid #eee', fontSize:'0.8rem', color:'#555' }} />
                                <button style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 14px', borderRadius:'8px', border:'none', background:'#111', cursor:'pointer', fontSize:'0.8rem', fontWeight:600, color:'#fff' }}><Download size={12}/> Export CSV</button>
                            </div>
                        </div>
                        <div style={{ overflowX:'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                                <thead>
                                    <tr style={{ background:'#f9f9f9' }}>
                                        {['#','Timestamp','Device Hash','BSSID Detected','Session','Match'].map(h => (
                                            <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'0.7rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', color:'#888', borderBottom:'1px solid #eee' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rawLogs.map((log, i) => {
                                        const isMatch = log.bssid === 'C4:E9:84:A2:3F:01';
                                        return (
                                            <tr key={i} className="attendance-row" style={{ borderBottom:'1px solid #f5f5f5' }}>
                                                <td style={{ padding:'10px 16px', color:'#aaa' }}>{i+1}</td>
                                                <td style={{ padding:'10px 16px', fontFamily:'monospace', fontSize:'0.8rem', color:'#333' }}>{log.timestamp}</td>
                                                <td style={{ padding:'10px 16px', fontFamily:'monospace', fontSize:'0.8rem', color:'#777' }}>{log.hash}</td>
                                                <td style={{ padding:'10px 16px', fontFamily:'monospace', fontSize:'0.8rem', color: isMatch?'#333':'#dc2626' }}>{log.bssid}</td>
                                                <td style={{ padding:'10px 16px', fontWeight:500 }}>{log.session}</td>
                                                <td style={{ padding:'10px 16px' }}>
                                                    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'8px', fontSize:'0.75rem', fontWeight:500, background: isMatch?'#ecfdf5':'#fef2f2', color: isMatch?'#166534':'#991b1b' }}>
                                                        {isMatch ? <CheckCircle size={11}/> : <AlertTriangle size={11}/>}{isMatch ? 'Valid' : 'Mismatch'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Auth Modal */}
            {showAuthModal && (
                <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}
                    onClick={() => { if (authState !== 'verifying') { setShowAuthModal(false); setAuthState('idle'); } }}>
                    <div style={{ background:'#fff', borderRadius:'12px', width:'380px', maxWidth:'90vw', boxShadow:'0 8px 30px rgba(0,0,0,0.08)', overflow:'hidden' }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid #f0f0f0' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}><Shield size={14} color="#555"/><span style={{ fontSize:'0.88rem', fontWeight:700 }}>Admin Authentication Required</span></div>
                            <button onClick={() => { setShowAuthModal(false); setAuthState('idle'); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#999' }}><X size={16}/></button>
                        </div>
                        <div style={{ padding:'24px 20px', textAlign:'center' }}>
                            <div style={{ fontSize:'0.8rem', color:'#888', lineHeight:'1.6', marginBottom:'20px' }}>This action will initiate live attendance tracking for the current session.</div>
                            <div style={{ width:'80px', height:'80px', margin:'0 auto 16px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${authState==='success'?'#16a34a':authState==='failed'?'#dc2626':'#e8e8e8'}`, background: authState==='success'?'#f0fdf4':authState==='failed'?'#fef2f2':'#fafafa' }}>
                                {authState === 'success' ? <CheckCircle size={32} color="#16a34a"/> : <Fingerprint size={32} color={authState==='failed'?'#dc2626':authState==='verifying'?'#555':'#bbb'}/>}
                            </div>
                            <div style={{ fontSize:'0.82rem', fontWeight:600, marginBottom:'4px', color: authState==='success'?'#16a34a':authState==='failed'?'#dc2626':'#333' }}>
                                {authState==='idle'&&'Waiting for authentication'}{authState==='verifying'&&'Verifying...'}{authState==='success'&&'Authentication Successful ✓'}{authState==='failed'&&'Authentication Failed — Try Again'}
                            </div>
                            <div style={{ fontSize:'0.72rem', color:'#aaa', marginBottom:'20px' }}>
                                {authState==='idle'&&'Place your registered fingerprint to authenticate.'}{authState==='verifying'&&'Processing biometric data...'}{authState==='success'&&'Session will be activated shortly.'}{authState==='failed'&&'Fingerprint did not match. Please try again.'}
                            </div>
                            {(authState==='idle'||authState==='failed') && (
                                <button onClick={handleFingerprint} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 20px', borderRadius:'8px', border:'none', background:'#111', color:'#fff', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
                                    <Fingerprint size={14}/>{authState==='failed'?'Retry':'Authenticate'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
