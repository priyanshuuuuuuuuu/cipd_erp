'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, BookOpen, Users, MessageSquare, Settings,
    LogOut, Search, Menu, ChevronLeft, ChevronRight, FileText, Link as LinkIcon,
    Download, Upload, Clock, CheckCircle, AlertCircle, XCircle, ArrowLeft,
    Paperclip, X, User, MapPin, Send
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

const TABS = ['Materials', 'Assignments'];

const MOCK_COURSE = { id: 'cs301', code: 'CS301', name: 'Data Structures & Algorithms', faculty_name: 'Prof. Anuj Grover', venue: 'LHC-101', schedule: 'Mon, Wed, Fri · 9:00 AM' };

const MOCK_MATERIALS = [
    { id: 'm1', title: 'Lecture 1 – Introduction to DSA', type: 'pdf', session_topic: 'Week 1', size: 2457600, uploaded_at: '2026-01-15T09:00:00Z', url: '#' },
    { id: 'm2', title: 'Sorting Algorithms – Slides', type: 'pdf', session_topic: 'Week 3', size: 1843200, uploaded_at: '2026-01-29T09:00:00Z', url: '#' },
    { id: 'm3', title: 'AVL Trees – Reference Notes', type: 'pdf', session_topic: 'Week 5', size: 921600, uploaded_at: '2026-02-12T09:00:00Z', url: '#' },
    { id: 'm4', title: 'Graph Traversals – Video Lecture', type: 'link', session_topic: 'Week 7', uploaded_at: '2026-02-26T09:00:00Z', url: '#' },
    { id: 'm5', title: 'Dynamic Programming Cheatsheet', type: 'pdf', session_topic: 'Week 9', size: 512000, uploaded_at: '2026-03-05T09:00:00Z', url: '#' },
];

const MOCK_ASSIGNMENTS = [
    { id: 'a1', title: 'Assignment 1 – Linked List Operations', description: 'Implement singly and doubly linked list with all CRUD operations', total_marks: 20, due_date: '2026-02-10T23:59:00Z', submission_status: 'graded', marks: 18, feedback: 'Excellent work!' },
    { id: 'a2', title: 'Assignment 2 – Sorting Comparison', description: 'Compare time complexity of Merge Sort, Quick Sort and Heap Sort with benchmarks', total_marks: 25, due_date: '2026-02-24T23:59:00Z', submission_status: 'submitted' },
    { id: 'a3', title: 'Assignment 3 – BST & AVL Trees', description: 'Implement self-balancing AVL tree with rotation operations', total_marks: 30, due_date: '2026-03-15T23:59:00Z', submission_status: 'pending' },
    { id: 'a4', title: 'Assignment 4 – Graph Algorithms', description: 'Implement BFS, DFS, and Dijkstra shortest path algorithm', total_marks: 30, due_date: '2026-03-28T23:59:00Z', submission_status: 'pending' },
];

const StatusBadge = ({ status }) => {
    const map = {
        submitted: { bg: '#dcfce7', color: '#16a34a', icon: <CheckCircle size={11} />, label: 'Submitted' },
        pending: { bg: '#fef9c3', color: '#b45309', icon: <Clock size={11} />, label: 'Pending' },
        graded: { bg: '#e0e7ff', color: '#3730a3', icon: <CheckCircle size={11} />, label: 'Graded' },
        late: { bg: '#fee2e2', color: '#dc2626', icon: <AlertCircle size={11} />, label: 'Late' },
    };
    const s = map[status] || map['pending'];
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, background: s.bg, color: s.color }}>
            {s.icon} {s.label}
        </span>
    );
};

export default function CourseDetailPage() {
    const router = useRouter();
    const { courseId } = useParams();
    const { user, logout, authReady } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Materials');
    const [course, setCourse] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [uploadFiles, setUploadFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const fileInputRef = useRef(null);

    const navTo = (p) => router.push(p);
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student' : 'Student';

    const fetchData = useCallback(async () => {
        try {
            const [courseRes, matRes, asnRes] = await Promise.allSettled([
                api.get(`/api/courses/${courseId}`),
                api.get(`/api/courses/${courseId}/materials`),
                api.get(`/api/students/assignments?course_id=${courseId}`),
            ]);
            const c = courseRes.status === 'fulfilled' ? (courseRes.value.course || courseRes.value) : null;
            const m = matRes.status === 'fulfilled' ? (matRes.value.materials || []) : [];
            const a = asnRes.status === 'fulfilled' ? (asnRes.value.assignments || []) : [];
            setCourse(c || MOCK_COURSE);
            setMaterials(m.length > 0 ? m : MOCK_MATERIALS);
            setAssignments(a.length > 0 ? a : MOCK_ASSIGNMENTS);
        } catch {
            setCourse(MOCK_COURSE);
            setMaterials(MOCK_MATERIALS);
            setAssignments(MOCK_ASSIGNMENTS);
        } finally {
            setLoading(false);
        }
    }, [courseId]);

    useEffect(() => { if (authReady && courseId) fetchData(); }, [fetchData, authReady, courseId]);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        setUploadFiles(prev => [...prev, ...files]);
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        setUploadFiles(prev => [...prev, ...files]);
    };

    const removeFile = (idx) => setUploadFiles(prev => prev.filter((_, i) => i !== idx));

    const handleSubmit = async () => {
        if (!selectedAssignment || uploadFiles.length === 0) return;
        setSubmitting(true);
        try {
            const formData = new FormData();
            uploadFiles.forEach(f => formData.append('files', f));
            await api.post(`/api/assignments/${selectedAssignment.id}/submit`, formData);
            setSubmitSuccess(true);
            setUploadFiles([]);
            setTimeout(() => setSubmitSuccess(false), 3000);
            fetchData();
        } catch {
            // Handle error gracefully
        } finally {
            setSubmitting(false);
        }
    };

    const getFileIcon = (type) => {
        if (!type) return <FileText size={16} color="#6b7280" />;
        if (type.includes('pdf')) return <FileText size={16} color="#dc2626" />;
        if (type.includes('link') || type.includes('url')) return <LinkIcon size={16} color="#2563eb" />;
        return <Paperclip size={16} color="#6b7280" />;
    };

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
                        <div onClick={() => navTo('/dashboard')} className="nav-item" style={{ cursor: 'pointer' }}><LayoutGrid size={18} /> <span>Home</span></div>
                        <div onClick={() => navTo('/attendance')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Attendance</span></div>
                        <div onClick={() => navTo('/grades')} className="nav-item" style={{ cursor: 'pointer' }}><BookOpen size={18} /> <span>Grades</span></div>
                        <div onClick={() => navTo('/teachers')} className="nav-item" style={{ cursor: 'pointer' }}><Users size={18} /> <span>Teachers</span></div>
                        <div onClick={() => navTo('/feedback')} className="nav-item" style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback</span></div>
                        <div className="nav-item active"><BookOpen size={18} /> <span>Courses</span></div>
                        <div onClick={() => navTo('/calendar')} className="nav-item" style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Calendar</span></div>
                    </nav>
                </div>
                <div className="sidebar-footer">
                    <div onClick={() => navTo('/settings')} className="nav-item" style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
                    <div className="nav-item" onClick={async () => { await logout(); navTo('/'); }} style={{ cursor: 'pointer' }}><LogOut size={18} /> <span>Log out</span></div>
                </div>
            </aside>

            <div className="main-content" style={{ flexDirection: 'column', overflowY: 'auto' }}>
                {/* Header */}
                <header className="dashboard-header" style={{ padding: '1rem 2rem', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} style={{ cursor: 'pointer' }}><Menu size={24} /></div>
                        <button onClick={() => navTo('/courses')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.85rem', padding: 0, marginRight: '4px' }}>
                            <ArrowLeft size={16} /> Courses
                        </button>
                        <span style={{ color: '#ddd' }}>/</span>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#000', margin: 0 }}>
                            {loading ? '...' : (course?.name || 'Course')}
                        </h1>
                    </div>
                    <div className="header-actions">
                        <div className="search-bar"><Search size={16} color="#aaa" /><input type="text" placeholder="Search" className="search-input" /></div>
                        <img src="/logo.png" alt="Logo" style={{ height: '35px' }} />
                    </div>
                </header>

                {loading ? (
                    <div style={{ color: '#aaa', textAlign: 'center', padding: '4rem' }}>Loading course...</div>
                ) : (
                    <div style={{ padding: '1.5rem 2rem', flex: 1 }}>
                        {/* Course meta */}
                        {course && (
                            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '1.2rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                {course.faculty_name && <div style={{ fontSize: '0.8rem', color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><User size={13} color="#aaa" /> {course.faculty_name}</div>}
                                {course.venue && <div style={{ fontSize: '0.8rem', color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={13} color="#aaa" /> {course.venue}</div>}
                                {course.schedule && <div style={{ fontSize: '0.8rem', color: '#777', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={13} color="#aaa" /> {course.schedule}</div>}
                            </div>
                        )}

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: '4px', background: '#f5f5f5', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem', width: 'fit-content' }}>
                            {TABS.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    style={{
                                        padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                        background: activeTab === tab ? '#fff' : 'transparent',
                                        color: activeTab === tab ? '#111' : '#888',
                                        fontWeight: activeTab === tab ? 600 : 500,
                                        fontSize: '0.88rem',
                                        boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {tab}
                                    {tab === 'Assignments' && assignments.some(a => !a.submission_status || a.submission_status === 'pending') && (
                                        <span style={{ marginLeft: '6px', background: '#fbbf24', color: '#000', borderRadius: '20px', fontSize: '0.65rem', padding: '1px 6px', fontWeight: 700 }}>
                                            {assignments.filter(a => !a.submission_status || a.submission_status === 'pending').length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* ── MATERIALS TAB ── */}
                        {activeTab === 'Materials' && (
                            <div>
                                {materials.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8' }}>
                                        <FileText size={40} color="#e8e8e8" style={{ marginBottom: '12px' }} />
                                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#555' }}>No materials uploaded yet</div>
                                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '6px' }}>Your faculty will upload lecture materials here.</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {materials.map((mat, i) => (
                                            <div
                                                key={mat.id || i}
                                                style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'box-shadow 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'}
                                                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                                            >
                                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {getFileIcon(mat.type)}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {mat.title || mat.file_name || 'Untitled'}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: '#aaa', display: 'flex', gap: '12px' }}>
                                                        {mat.session_topic && <span>{mat.session_topic}</span>}
                                                        {mat.size && <span>{formatSize(mat.size)}</span>}
                                                        {mat.uploaded_at && <span>{new Date(mat.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                                                    </div>
                                                </div>
                                                {mat.url && (
                                                    <a href={mat.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', background: '#f5f5f5', borderRadius: '8px', color: '#555', fontSize: '0.8rem', fontWeight: 500, textDecoration: 'none', transition: 'background 0.15s', flexShrink: 0 }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#e8e8e8'}
                                                        onMouseLeave={e => e.currentTarget.style.background = '#f5f5f5'}
                                                    >
                                                        {mat.type === 'link' ? <LinkIcon size={14} /> : <Download size={14} />}
                                                        {mat.type === 'link' ? 'Open' : 'Download'}
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── ASSIGNMENTS TAB ── */}
                        {activeTab === 'Assignments' && (
                            <div style={{ display: 'grid', gridTemplateColumns: selectedAssignment ? '1fr 420px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
                                {/* Assignment list */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {assignments.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8e8e8' }}>
                                            <CheckCircle size={40} color="#e8e8e8" style={{ marginBottom: '12px' }} />
                                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#555' }}>No assignments yet</div>
                                            <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '6px' }}>Assignments for this course will appear here.</div>
                                        </div>
                                    ) : assignments.map((asn, i) => {
                                        const isSelected = selectedAssignment?.id === asn.id;
                                        const dueDate = asn.due_date ? new Date(asn.due_date) : null;
                                        const isOverdue = dueDate && dueDate < new Date() && asn.submission_status !== 'submitted' && asn.submission_status !== 'graded';
                                        return (
                                            <div
                                                key={asn.id || i}
                                                onClick={() => setSelectedAssignment(isSelected ? null : asn)}
                                                style={{
                                                    background: '#fff',
                                                    border: `1px solid ${isSelected ? '#111' : '#e8e8e8'}`,
                                                    borderRadius: '12px',
                                                    padding: '1rem 1.5rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                    boxShadow: isSelected ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
                                                }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.boxShadow = 'none'; }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                <FileText size={14} color="#16a34a" />
                                                            </div>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111' }}>{asn.title}</span>
                                                        </div>
                                                        {asn.description && (
                                                            <div style={{ fontSize: '0.78rem', color: '#888', marginLeft: '36px', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                                                                {asn.description}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', gap: '12px', marginLeft: '36px', fontSize: '0.72rem', color: '#aaa', flexWrap: 'wrap' }}>
                                                            {dueDate && (
                                                                <span style={{ color: isOverdue ? '#dc2626' : '#aaa', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                    <Clock size={11} /> Due {dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </span>
                                                            )}
                                                            {asn.total_marks && <span>{asn.total_marks} marks</span>}
                                                        </div>
                                                    </div>
                                                    <StatusBadge status={asn.submission_status || 'pending'} />
                                                </div>
                                                {asn.submission_status === 'graded' && asn.marks != null && (
                                                    <div style={{ marginTop: '10px', marginLeft: '36px', fontSize: '0.78rem', color: '#888', borderTop: '1px solid #f5f5f5', paddingTop: '8px' }}>
                                                        Score: <strong style={{ color: '#111' }}>{asn.marks}/{asn.total_marks}</strong>
                                                        {asn.feedback && <span style={{ marginLeft: '12px', fontStyle: 'italic' }}>"{asn.feedback}"</span>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Submission panel */}
                                {selectedAssignment && (
                                    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '1.5rem', position: 'sticky', top: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Submit Assignment</div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111' }}>{selectedAssignment.title}</div>
                                            </div>
                                            <button onClick={() => setSelectedAssignment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: '2px' }}>
                                                <X size={18} />
                                            </button>
                                        </div>

                                        {/* Submission info */}
                                        <div style={{ background: '#fafafa', borderRadius: '10px', padding: '12px 14px', marginBottom: '1.2rem', fontSize: '0.78rem', color: '#555' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid #f0f0f0', marginBottom: '6px' }}>
                                                <span>Full Credit</span><strong style={{ color: '#111' }}>+{selectedAssignment.total_marks || 10} pts</strong>
                                            </div>
                                            {selectedAssignment.due_date && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid #f0f0f0', marginBottom: '6px' }}>
                                                    <span>Deadline</span>
                                                    <strong style={{ color: '#111' }}>
                                                        {new Date(selectedAssignment.due_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </strong>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Status</span><StatusBadge status={selectedAssignment.submission_status || 'pending'} />
                                            </div>
                                        </div>

                                        {/* Drop zone */}
                                        {selectedAssignment.submission_status !== 'graded' && (
                                            <>
                                                <div
                                                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                                    onDragLeave={() => setIsDragging(false)}
                                                    onDrop={handleDrop}
                                                    onClick={() => fileInputRef.current?.click()}
                                                    style={{
                                                        border: `2px dashed ${isDragging ? '#0b6861' : '#e0e0e0'}`,
                                                        borderRadius: '12px',
                                                        padding: '1.5rem',
                                                        textAlign: 'center',
                                                        cursor: 'pointer',
                                                        background: isDragging ? '#f0fdf4' : '#fafafa',
                                                        transition: 'all 0.2s',
                                                        marginBottom: '1rem',
                                                    }}
                                                >
                                                    <Upload size={24} color={isDragging ? '#0b6861' : '#bbb'} style={{ marginBottom: '8px' }} />
                                                    <div style={{ fontSize: '0.82rem', color: '#888', fontWeight: 500 }}>
                                                        Drag & drop files here, or <span style={{ color: '#0b6861', textDecoration: 'underline' }}>browse</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#bbb', marginTop: '4px' }}>PDF, DOCX, ZIP up to 20MB</div>
                                                    <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
                                                </div>

                                                {uploadFiles.length > 0 && (
                                                    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {uploadFiles.map((f, i) => (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f5f5f5', borderRadius: '8px', fontSize: '0.78rem' }}>
                                                                <Paperclip size={13} color="#888" />
                                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#333' }}>{f.name}</span>
                                                                <span style={{ color: '#aaa', flexShrink: 0 }}>{formatSize(f.size)}</span>
                                                                <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0 }}><X size={13} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {submitSuccess && (
                                                    <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', fontWeight: 500, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <CheckCircle size={14} /> Submitted successfully!
                                                    </div>
                                                )}

                                                <button
                                                    onClick={handleSubmit}
                                                    disabled={uploadFiles.length === 0 || submitting}
                                                    style={{
                                                        width: '100%', padding: '10px', borderRadius: '10px', border: 'none', cursor: uploadFiles.length > 0 ? 'pointer' : 'not-allowed',
                                                        background: uploadFiles.length > 0 ? '#111' : '#e0e0e0',
                                                        color: uploadFiles.length > 0 ? '#fff' : '#aaa',
                                                        fontWeight: 600, fontSize: '0.88rem',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                        transition: 'background 0.15s',
                                                    }}
                                                >
                                                    <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Assignment'}
                                                </button>
                                            </>
                                        )}
                                        {selectedAssignment.submission_status === 'graded' && (
                                            <div style={{ textAlign: 'center', padding: '1rem', color: '#888', fontSize: '0.82rem' }}>
                                                This assignment has been graded. Resubmission is not available.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
