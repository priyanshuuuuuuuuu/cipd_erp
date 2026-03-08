'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Bell, Search, Menu, ChevronLeft, ChevronRight,
    CheckCircle, Clock, FileText, Send, Lock, Trophy, Award
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

export default function FeedbackPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [activeTab, setActiveTab] = useState('feedback');
    const [ratings, setRatings] = useState({ q1: 0, q2: 0, q3: 0, q4: 0 });
    const [meetsExpectations, setMeetsExpectations] = useState(null);
    const [descriptive, setDescriptive] = useState('');
    const [creditTimer, setCreditTimer] = useState({ min: 18, sec: 34 });
    const [submitting, setSubmitting] = useState(false);

    // Live data
    const [pendingSession, setPendingSession] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const formOpen = Boolean(pendingSession);

    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const fetchData = useCallback(async () => {
        const [fbRes, lbRes] = await Promise.allSettled([
            api.get('/api/feedback/pending'),
            api.get('/api/feedback/leaderboard').catch(() => ({ leaderboard: [] })),
        ]);
        if (fbRes.status === 'fulfilled' && fbRes.value.pending) {
            setPendingSession(fbRes.value.pending);
        }
        if (lbRes.status === 'fulfilled') {
            setLeaderboard(lbRes.value.leaderboard || []);
        }
    }, []);

    useEffect(() => { if (authReady) fetchData(); }, [fetchData, authReady]);

    useEffect(() => {
        if (!formOpen) return;
        const interval = setInterval(() => {
            setCreditTimer(prev => {
                if (prev.min === 0 && prev.sec === 0) return prev;
                if (prev.sec === 0) return { min: prev.min - 1, sec: 59 };
                return { ...prev, sec: prev.sec - 1 };
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [formOpen]);

    const pad = (n) => String(n).padStart(2, '0');
    const ratingQuestions = [
        { key: 'q1', text: 'Rate the overall quality of this lecture' },
        { key: 'q2', text: 'How clear was the explanation of concepts?' },
        { key: 'q3', text: 'Was the lecture well-structured and organized?' },
        { key: 'q4', text: 'How engaging was the session?' },
    ];
    const canSubmit = Object.values(ratings).every(v => v > 0) && meetsExpectations !== null;

    const handleSubmit = async () => {
        if (!canSubmit || submitting) return;
        setSubmitting(true);
        try {
            await api.post('/api/feedback/submit', {
                session_id: pendingSession?.session_id,
                ratings,
                meets_expectations: meetsExpectations === 'Yes',
                comments: descriptive,
            });
            setSubmitted(true);
        } catch (e) {
            alert('Failed to submit feedback: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const labelStyle = { color: '#999', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.4px' };
    const valueStyle = { fontWeight: 700, color: '#111', fontFamily: 'monospace', fontSize: '0.78rem' };
    const dividerStyle = { width: '1px', height: '20px', background: '#e8e8e8', flexShrink: 0 };
    const tabStyle = (active) => ({
        padding: '6px 16px', borderRadius: '6px', border: '1px solid ' + (active ? '#111' : '#e8e8e8'),
        background: active ? '#111' : '#fff', color: active ? '#fff' : '#888',
        fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
    });

    const navTo = (p) => router.push(p);

    // Fallback leaderboard if API returns nothing
    const displayLeaderboard = leaderboard.length > 0 ? leaderboard : [
        { rank: 1, name: 'Aarav Gupta', id: 'STU2021034', credits: 280, streak: 14, submissions: '14/14', percentile: 'Top 2%' },
        { rank: 2, name: 'Sneha Kumar', id: 'STU2021056', credits: 260, streak: 13, submissions: '13/14', percentile: 'Top 5%' },
        { rank: 3, name: 'Rohan Patel', id: 'STU2021023', credits: 240, streak: 12, submissions: '13/14', percentile: 'Top 8%' },
        { rank: 4, name: 'Priya Malhotra', id: 'STU2021045', credits: 220, streak: 11, submissions: '12/14', percentile: 'Top 12%' },
        { rank: 5, name: 'Karan Singh', id: 'STU2021067', credits: 200, streak: 10, submissions: '12/14', percentile: 'Top 15%' },
        { rank: 6, name: `You (${displayName})`, id: user?.enrollment_no || 'STU0000001', credits: 140, streak: 7, submissions: '12/14', percentile: 'Top 18%' },
        { rank: 7, name: 'Vivaan Singh', id: 'STU2021091', credits: 120, streak: 6, submissions: '10/14', percentile: 'Top 25%' },
        { rank: 8, name: 'Aditya Kumar', id: 'STU2021012', credits: 100, streak: 5, submissions: '9/14', percentile: 'Top 32%' },
        { rank: 9, name: 'Arjun Reddy', id: 'STU2021089', credits: 80, streak: 4, submissions: '8/14', percentile: 'Top 40%' },
        { rank: 10, name: 'Diya Sharma', id: 'STU2021044', credits: 60, streak: 3, submissions: '7/14', percentile: 'Top 50%' },
    ];

    return (
        <div className="dashboard-container">
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar"><img src="/studentPic.png" alt="Student" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /></div>
                        <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div className="nav-item" onClick={() => navTo('/dashboard')} style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Home</span></div>
                        <div className="nav-item" onClick={() => navTo('/attendance')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Attendance</span></div>
                        <div className="nav-item" onClick={() => navTo('/grades')} style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div className="nav-item" onClick={() => navTo('/teachers')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div className="nav-item active"><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div className="nav-item" onClick={() => navTo('/courses')} style={{ cursor: 'pointer' }}><FileText size={18} /> <span>Courses</span></div>
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
                            <h1>Lecture Feedback</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                            <Bell size={20} color="#555" /><MessageSquare size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem' }}>
                        <button style={tabStyle(activeTab === 'feedback')} onClick={() => setActiveTab('feedback')}>Lecture Feedback</button>
                        <button style={tabStyle(activeTab === 'leaderboard')} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
                    </div>

                    {activeTab === 'feedback' && (
                        <>
                            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '0', marginBottom: '1.2rem', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 1.2rem', fontSize: '0.78rem', borderBottom: '1px solid #f0f0f0', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                                    {[['Course', pendingSession?.courses?.name || 'N/A'], ['Lecture Date', pendingSession ? new Date(pendingSession.session_date || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A']].map(([l, v]) => (
                                        <React.Fragment key={l}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '14px', flexShrink: 0 }}><span style={labelStyle}>{l}</span><span style={valueStyle}>{v}</span></div>
                                            <div style={dividerStyle} />
                                        </React.Fragment>
                                    ))}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 14px', flexShrink: 0 }}><span style={labelStyle}>Form Status</span><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: formOpen ? '#16a34a' : '#dc2626', display: 'inline-block' }} /><span style={{ fontWeight: 600, color: formOpen ? '#16a34a' : '#dc2626', fontSize: '0.78rem' }}>{formOpen ? 'Open' : 'No Pending'}</span></div>
                                    <div style={dividerStyle} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 14px', flexShrink: 0 }}><span style={labelStyle}>Feedback</span><span style={{ fontWeight: 600, color: submitted ? '#16a34a' : '#b45309', fontSize: '0.78rem' }}>{submitted ? 'Submitted' : 'Pending'}</span></div>
                                    <div style={dividerStyle} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 14px', flexShrink: 0 }}><span style={labelStyle}>Credit Window</span><span style={{ fontWeight: 700, color: '#111', fontFamily: 'monospace', fontSize: '0.82rem' }}>{formOpen ? `${pad(creditTimer.min)}:${pad(creditTimer.sec)}` : '--:--'}</span><span style={{ color: '#bbb', fontSize: '0.68rem' }}>remaining</span></div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '6px 1.2rem', gap: '16px', fontSize: '0.68rem', color: '#aaa', background: '#fafafa' }}>
                                    <span>Faculty <span style={{ color: '#888', fontWeight: 500 }}>{pendingSession?.faculty?.users ? `${pendingSession.faculty.users.first_name} ${pendingSession.faculty.users.last_name}` : 'Faculty'}</span></span>
                                    <span style={{ color: '#ddd' }}>·</span>
                                    <span>Topic <span style={{ color: '#888', fontWeight: 500 }}>{pendingSession?.topic || pendingSession?.courses?.name || 'Session'}</span></span>
                                    <span style={{ color: '#ddd' }}>·</span>
                                    <span>Venue <span style={{ color: '#888', fontWeight: 500 }}>{pendingSession?.venues?.name || 'TBA'}</span></span>
                                </div>
                            </div>

                            {formOpen && !submitted && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.2rem' }}>
                                    <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                        <div style={{ padding: '12px 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FileText size={14} color="#888" /><span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>Lecture Evaluation</span>
                                            <span style={{ fontSize: '0.7rem', color: '#bbb', marginLeft: 'auto' }}>All fields marked with scale are mandatory</span>
                                        </div>
                                        <div style={{ padding: '1.2rem 1.5rem' }}>
                                            {ratingQuestions.map((q, idx) => (
                                                <div key={q.key} style={{ marginBottom: idx < ratingQuestions.length - 1 ? '1.4rem' : '1.2rem', paddingBottom: idx < ratingQuestions.length - 1 ? '1.4rem' : '0', borderBottom: idx < ratingQuestions.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#aaa', fontFamily: 'monospace', minWidth: '18px' }}>{idx + 1}.</span>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#333' }}>{q.text}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0', marginLeft: '26px' }}>
                                                        {[1,2,3,4,5].map(n => (
                                                            <label key={n} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',padding:'8px 16px',cursor:'pointer',border:'1px solid #e8e8e8',borderLeft:n===1?'1px solid #e8e8e8':'none',borderRadius:n===1?'6px 0 0 6px':n===5?'0 6px 6px 0':'0',background:ratings[q.key]===n?'#111':'#fff',transition:'background 0.15s' }}>
                                                                <input type="radio" name={q.key} value={n} checked={ratings[q.key]===n} onChange={()=>setRatings(prev=>({...prev,[q.key]:n}))} style={{ display:'none' }} />
                                                                <span style={{ fontSize:'0.82rem',fontWeight:600,fontFamily:'monospace',color:ratings[q.key]===n?'#fff':'#555' }}>{n}</span>
                                                            </label>
                                                        ))}
                                                        <div style={{ marginLeft:'12px',display:'flex',alignItems:'center',gap:'16px',fontSize:'0.68rem',color:'#bbb' }}><span>1 = Poor</span><span>5 = Excellent</span></div>
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ marginBottom: '1.4rem', paddingBottom: '1.4rem', borderBottom: '1px solid #f5f5f5' }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                                                    <span style={{ fontSize:'0.72rem',fontWeight:600,color:'#aaa',fontFamily:'monospace',minWidth:'18px' }}>5.</span>
                                                    <span style={{ fontSize:'0.85rem',fontWeight:500,color:'#333' }}>Did the lecture meet your learning expectations?</span>
                                                </div>
                                                <div style={{ display:'flex',gap:'0',marginLeft:'26px' }}>
                                                    {['Yes','No'].map(opt=>(
                                                        <button key={opt} onClick={()=>setMeetsExpectations(opt)} style={{ padding:'8px 24px',cursor:'pointer',fontSize:'0.82rem',fontWeight:600,border:'1px solid #e8e8e8',borderLeft:opt==='No'?'none':'1px solid #e8e8e8',borderRadius:opt==='Yes'?'6px 0 0 6px':'0 6px 6px 0',background:meetsExpectations===opt?'#111':'#fff',color:meetsExpectations===opt?'#fff':'#555',transition:'background 0.15s' }}>{opt}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ marginBottom: '1.2rem' }}>
                                                <div style={{ display:'flex',alignItems:'baseline',gap:'8px',marginBottom:'10px' }}>
                                                    <span style={{ fontSize:'0.72rem',fontWeight:600,color:'#aaa',fontFamily:'monospace',minWidth:'18px' }}>6.</span>
                                                    <span style={{ fontSize:'0.85rem',fontWeight:500,color:'#333' }}>What specific improvement would you suggest?</span>
                                                    <span style={{ fontSize:'0.68rem',color:'#bbb' }}>(Optional)</span>
                                                </div>
                                                <textarea value={descriptive} onChange={e=>setDescriptive(e.target.value)} placeholder="Write your suggestion here..." rows={4} style={{ width:'100%',marginLeft:'26px',maxWidth:'calc(100% - 26px)',padding:'10px 14px',borderRadius:'8px',border:'1px solid #e8e8e8',fontSize:'0.85rem',fontFamily:'inherit',color:'#333',resize:'vertical',outline:'none',background:'#fafafa',lineHeight:'1.5',boxSizing:'border-box' }} />
                                            </div>
                                            <div style={{ display:'flex',justifyContent:'flex-end',paddingTop:'8px',borderTop:'1px solid #f0f0f0' }}>
                                                <button onClick={handleSubmit} disabled={!canSubmit || submitting} style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 20px',borderRadius:'8px',border:'none',background:canSubmit?'#111':'#e5e7eb',color:canSubmit?'#fff':'#aaa',fontSize:'0.82rem',fontWeight:600,cursor:canSubmit?'pointer':'not-allowed' }}>
                                                    <Send size={13} /> {submitting ? 'Submitting...' : 'Submit Feedback'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display:'flex',flexDirection:'column',gap:'1rem' }}>
                                        {[['Submission Info',[['Status','Pending'],['Full Credit','+20 pts'],['Late Penalty','−5 pts/hr'],['Deadline','23:59 today'],['Mandatory','5 of 6']]],['Your Progress',[['Streak','—'],['Total Credits','—'],['Submissions','—'],['Avg Rating Given','—'],['Rank','—']]]].map(([title,rows])=>(
                                            <div key={title} style={{ background:'#fff',borderRadius:'10px',border:'1px solid #e8e8e8',padding:'1.2rem',boxShadow:'0 1px 4px rgba(0,0,0,0.02)' }}>
                                                <div style={{ fontSize:'0.72rem',fontWeight:600,color:'#aaa',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'12px' }}>{title}</div>
                                                <div style={{ display:'flex',flexDirection:'column',gap:'8px',fontSize:'0.78rem' }}>
                                                    {rows.map(([label,val],i)=>(
                                                        <div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'3px 0',borderBottom:i<4?'1px solid #f5f5f5':'none' }}>
                                                            <span style={{ color:'#888' }}>{label}</span>
                                                            <span style={{ fontWeight:600,color:'#333',fontFamily:'monospace',fontSize:'0.76rem' }}>{val}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!formOpen && (
                                <div style={{ background:'#fff',borderRadius:'10px',border:'1px solid #e8e8e8',padding:'2rem',textAlign:'center',color:'#888' }}>
                                    <CheckCircle size={40} color="#16a34a" style={{ marginBottom: '1rem' }} />
                                    <h3 style={{ color:'#333',margin:'0 0 0.5rem' }}>No Pending Feedback</h3>
                                    <p style={{ fontSize:'0.85rem' }}>All caught up! Check back after your next lecture.</p>
                                </div>
                            )}

                            {submitted && (
                                <div style={{ background:'#fff',borderRadius:'10px',border:'1px solid #e8e8e8',boxShadow:'0 1px 4px rgba(0,0,0,0.02)',overflow:'hidden',maxWidth:'640px' }}>
                                    <div style={{ padding:'12px 1.5rem',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',gap:'8px' }}>
                                        <CheckCircle size={14} color="#16a34a" /><span style={{ fontSize:'0.88rem',fontWeight:700,color:'#111' }}>Feedback Submitted</span>
                                    </div>
                                    <div style={{ padding:'1.2rem 1.5rem' }}>
                                        <div style={{ display:'flex',flexDirection:'column',gap:'10px',fontSize:'0.85rem' }}>
                                            {[['Status','Submitted ✓'],['Credits Earned','+20'],['Submitted At',new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})]].map(([label,val],i)=>(
                                                <div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<2?'1px solid #f5f5f5':'none' }}>
                                                    <span style={{ color:'#777' }}>{label}</span><span style={{ fontWeight:600,color:'#111',fontFamily:'monospace' }}>{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'leaderboard' && (
                        <>
                            <div style={{ background:'#fff',borderRadius:'10px',border:'1px solid #e8e8e8',padding:'0',marginBottom:'1.2rem',overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display:'flex',alignItems:'center',padding:'10px 1.2rem',fontSize:'0.78rem',overflowX:'auto',whiteSpace:'nowrap' }}>
                                    {[['Course','—'],['Your Rank','—'],['Your Credits','—'],['Percentile','—'],['Streak','—']].map(([l,v],i)=>(
                                        <React.Fragment key={i}><div style={{ display:'flex',alignItems:'center',gap:'6px',padding:'0 14px',flexShrink:0,paddingLeft:i===0?0:undefined }}><span style={labelStyle}>{l}</span><span style={valueStyle}>{v}</span></div>{i<4&&<div style={dividerStyle}/>}</React.Fragment>
                                    ))}
                                </div>
                            </div>
                            <div style={{ background:'#fff',borderRadius:'10px',border:'1px solid #e8e8e8',boxShadow:'0 1px 4px rgba(0,0,0,0.02)',overflow:'hidden' }}>
                                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 1.2rem',borderBottom:'1px solid #f0f0f0' }}>
                                    <div style={{ display:'flex',alignItems:'center',gap:'8px' }}><Trophy size={14} color="#888" /><span style={{ fontSize:'0.88rem',fontWeight:700,color:'#111' }}>Engagement Leaderboard</span></div>
                                    <span style={{ fontSize:'0.7rem',color:'#bbb' }}>Based on feedback credits & consistency</span>
                                </div>
                                <div style={{ overflowX:'auto' }}>
                                    <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'0.82rem' }}>
                                        <thead><tr style={{ background:'#fafafa' }}>{['Rank','Student','ID','Credits','Streak','Submissions','Percentile'].map(h=><th key={h} style={{ padding:'8px 16px',textAlign:'left',fontSize:'0.68rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',color:'#aaa',borderBottom:'1px solid #f0f0f0' }}>{h}</th>)}</tr></thead>
                                        <tbody>
                                            {displayLeaderboard.map(entry=>{
                                                const isYou = entry.name?.includes('You') || entry.is_current_user;
                                                const rankBg = entry.rank===1?'#fef3c7':entry.rank===2?'#e5e7eb':entry.rank===3?'#fed7aa':'#f9fafb';
                                                const rankColor = entry.rank===1?'#92400e':entry.rank===2?'#374151':entry.rank===3?'#9a3412':'#888';
                                                return(
                                                    <tr key={entry.rank} style={{ borderBottom:'1px solid #f5f5f5',background:isYou?'#f0f9ff':'transparent' }} className="attendance-row">
                                                        <td style={{ padding:'10px 16px' }}><span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',width:'24px',height:'24px',borderRadius:'6px',fontWeight:700,fontFamily:'monospace',fontSize:'0.78rem',background:rankBg,color:rankColor }}>{entry.rank}</span></td>
                                                        <td style={{ padding:'10px 16px',fontWeight:isYou?700:500,color:isYou?'#0369a1':'#333' }}>{entry.name}</td>
                                                        <td style={{ padding:'10px 16px',fontFamily:'monospace',fontSize:'0.78rem',color:'#999' }}>{entry.id || entry.enrollment_no || '—'}</td>
                                                        <td style={{ padding:'10px 16px',fontWeight:700,fontFamily:'monospace',color:'#111' }}>{entry.credits}</td>
                                                        <td style={{ padding:'10px 16px',fontFamily:'monospace',color:'#555' }}>{entry.streak}</td>
                                                        <td style={{ padding:'10px 16px',fontFamily:'monospace',fontSize:'0.78rem',color:'#555' }}>{entry.submissions}</td>
                                                        <td style={{ padding:'10px 16px' }}><span style={{ padding:'2px 8px',borderRadius:'4px',fontSize:'0.72rem',fontWeight:500,background:'#f5f5f5',color:'#555',border:'1px solid #e8e8e8' }}>{entry.percentile}</span></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ padding:'8px 1.2rem',background:'#fafafa',fontSize:'0.68rem',color:'#aaa',borderTop:'1px solid #f0f0f0' }}>Rankings update after each lecture feedback submission</div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
