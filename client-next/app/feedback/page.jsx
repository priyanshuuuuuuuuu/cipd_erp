'use client';

import React, { useState, useEffect } from 'react';
import '../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight, Star, Send, CheckCircle, ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { api } from '@/lib/api';

export default function FeedbackPage() {
    const router = useRouter();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [pending, setPending] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    useEffect(() => {
        if (!authReady) return;
        api.get('/api/feedback/pending')
            .then(d => {
                if (d.pending) {
                    setPending(d.pending);
                    setQuestions(d.questions || []);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [authReady]);

    const handleRating = (qId, val) => setAnswers(a => ({ ...a, [qId]: val }));

    const handleSubmit = async () => {
        if (!pending) return;
        setSubmitting(true);
        try {
            const responses = questions.map(q => ({ question_id: q.id, answer: answers[q.id] || '' }));
            await api.post('/api/feedback/submit', { session_id: pending.id, responses });
            setSubmitted(true);
            setPending(null);
        } catch (e) {
            alert('Failed to submit feedback: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="dashboard-container">
            <div className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                <div>
                    <div className="user-profile" style={{ position: 'relative' }}>
                        <div className="user-avatar" style={{ background: '#0b6861', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => navTo('/profile')}>
                            {user?.firstName?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div className="user-info"><h3>{displayName}</h3><p>{user?.email}</p></div>
                        <div onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: '#1a1a1a', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #333', color: '#888' }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                        </div>
                    </div>
                    <nav className="nav-menu">
                        <div onClick={() => navTo('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18}/> <span>Home</span></div>
                        <div onClick={() => navTo('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18}/> <span>Attendance</span></div>
                        <div onClick={() => navTo('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18}/> <span>Grades</span></div>
                        <div onClick={() => navTo('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18}/> <span>Teachers</span></div>
                        <div className="nav-item active"><MessageSquare size={18}/> <span>Feedback</span></div>
                        <div onClick={() => navTo('/courses')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18}/> <span>Courses</span></div>
                        <div onClick={() => navTo('/calendar')} className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18}/> <span>Calendar</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div onClick={() => navTo('/settings')} className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18}/> <span>Settings</span></div>
                    <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18}/> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content" style={{ flexDirection: 'column', overflowY: 'auto' }}>
                <header className="dashboard-header" style={{ padding: '1rem 2rem', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24}/></div>
                        <h1>Feedback</h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa"/><input type="text" placeholder="Search" className="search-input"/></div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }}/>
                    </div>
                </header>

                <div style={{ padding: '1.5rem 2rem', flex: 1, maxWidth: '700px' }}>
                    {loading ? (
                        <div style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Loading...</div>
                    ) : submitted ? (
                        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', padding: '3rem', textAlign: 'center' }}>
                            <CheckCircle size={48} color="#16a34a" style={{ marginBottom: '16px' }} />
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', marginBottom: '8px' }}>Feedback Submitted!</div>
                            <div style={{ fontSize: '0.85rem', color: '#888' }}>Thank you for your feedback. It helps us improve.</div>
                            <button onClick={() => router.push('/dashboard')} style={{ marginTop: '1.5rem', padding: '8px 24px', borderRadius: '8px', border: 'none', background: '#0b6861', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                Back to Dashboard <ArrowRight size={14}/>
                            </button>
                        </div>
                    ) : !pending ? (
                        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', padding: '3rem', textAlign: 'center' }}>
                            <MessageSquare size={40} color="#e8e8e8" style={{ marginBottom: '12px' }} />
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#555' }}>No pending feedback</div>
                            <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '6px' }}>You're all caught up! Submit feedback after attending sessions.</div>
                        </div>
                    ) : (
                        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Session Feedback Required</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111', marginTop: '4px' }}>
                                    {pending.courses?.name} — {pending.title}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '3px' }}>
                                    {new Date(pending.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    {pending.faculty?.users && ` • ${pending.faculty.users.first_name} ${pending.faculty.users.last_name}`}
                                </div>
                            </div>

                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {questions.length === 0 ? (
                                    <div style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>No questions configured for this feedback.</div>
                                ) : questions.map((q, i) => (
                                    <div key={q.id}>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111', marginBottom: '10px' }}>
                                            {i + 1}. {q.question}
                                        </div>
                                        {q.type === 'rating' && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {[1,2,3,4,5].map(n => (
                                                    <button key={n} onClick={() => handleRating(q.id, n)}
                                                        style={{ width: '42px', height: '42px', borderRadius: '8px', border: '1px solid ' + (answers[q.id] >= n ? '#f59e0b' : '#e8e8e8'), background: answers[q.id] >= n ? '#fef3c7' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Star size={18} fill={answers[q.id] >= n ? '#f59e0b' : 'none'} color={answers[q.id] >= n ? '#f59e0b' : '#ccc'} />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {q.type === 'yes_no' && (
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                {['Yes', 'No'].map(opt => (
                                                    <button key={opt} onClick={() => handleRating(q.id, opt)}
                                                        style={{ padding: '8px 24px', borderRadius: '8px', border: '1px solid ' + (answers[q.id] === opt ? '#0b6861' : '#e8e8e8'), background: answers[q.id] === opt ? '#ecfdf5' : '#fff', color: answers[q.id] === opt ? '#0b6861' : '#555', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {q.type === 'text' && (
                                            <textarea value={answers[q.id] || ''} onChange={e => handleRating(q.id, e.target.value)}
                                                placeholder="Share your thoughts..."
                                                rows={3}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e8e8e8', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#333' }} />
                                        )}
                                    </div>
                                ))}

                                <button onClick={handleSubmit} disabled={submitting}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 24px', borderRadius: '10px', border: 'none', background: submitting ? '#aaa' : '#0b6861', color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
                                    <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Feedback'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
