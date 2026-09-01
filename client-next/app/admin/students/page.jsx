'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../../Dashboard.css';
import {
    LayoutGrid, Calendar, MessageSquare, Settings, LogOut, Bell, Search, Menu,
    ChevronLeft, ChevronRight, Wifi, Clock, FileBarChart, CheckCircle, Users,
    X, Loader2, Pencil, Trash2, Plus, UserPlus, BookOpen, Shield, ShieldCheck,
    ShieldOff, Activity, AlertTriangle, Trophy, GraduationCap, Mail, Hash, UserX,
    ChevronDown, ChevronUp, RefreshCw, BookmarkPlus, BookmarkMinus, BarChart2, Flame
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// ─── Input style helper ────────────────────────────────────────────────────
const inp = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1px solid #e5e7eb', fontSize: '0.82rem',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    background: '#fff', transition: 'border-color 0.15s',
};

// ─── Delete Confirmation Modal ─────────────────────────────────────────────
function DeleteConfirmModal({ student, onConfirm, onClose, deleting }) {
    useEffect(() => {
        const onKey = e => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1100, backdropFilter: 'blur(4px)' }} />
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                background: '#fff', borderRadius: '16px', padding: '2rem', width: 'min(440px, 90vw)',
                zIndex: 1101, boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '12px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertTriangle size={22} color="#dc2626" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#111' }}>Delete Student</div>
                        <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>This action cannot be undone</div>
                    </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#444', lineHeight: 1.6, marginBottom: '1rem' }}>
                    You are about to permanently delete <strong>{student.first_name} {student.last_name}</strong> ({student.email}).
                </p>

                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>⚠ Cascade Deletion Warning</div>
                    <div style={{ fontSize: '0.75rem', color: '#b91c1c', lineHeight: 1.5 }}>
                        All of this student's attendance records, feedback responses, leave requests, and assignment submissions will also be permanently deleted.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onClose} disabled={deleting} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={deleting} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: deleting ? '#f87171' : '#dc2626', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {deleting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...</> : <><Trash2 size={14} /> Delete Student</>}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Bulk Delete Confirmation Modal ─────────────────────────────────────────────
function BulkDeleteConfirmModal({ count, onConfirm, onClose, deleting }) {
    useEffect(() => {
        const onKey = e => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1100, backdropFilter: 'blur(4px)' }} />
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                background: '#fff', borderRadius: '16px', padding: '2rem', width: 'min(440px, 90vw)',
                zIndex: 1101, boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '12px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertTriangle size={22} color="#dc2626" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#111' }}>Delete Multiple Students</div>
                        <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>This action cannot be undone</div>
                    </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#444', lineHeight: 1.6, marginBottom: '1rem' }}>
                    You are about to permanently delete <strong>{count}</strong> selected student(s).
                </p>

                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>⚠ Cascade Deletion Warning</div>
                    <div style={{ fontSize: '0.75rem', color: '#b91c1c', lineHeight: 1.5 }}>
                        All related records for these students (attendance, feedback, submissions) will also be permanently deleted.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onClose} disabled={deleting} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={deleting} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: deleting ? '#f87171' : '#dc2626', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {deleting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...</> : <><Trash2 size={14} /> Delete {count}</>}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Student Edit / Detail Drawer ──────────────────────────────────────────
function StudentDrawer({ student, courses, onClose, onSaved, schema = 'july' }) {
    const [tab, setTab] = useState('details'); // 'details' | 'enrollments'
    const [form, setForm] = useState({
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        enrollment_no: student.enrollment_no,
        program_name: student.program_name,
        mac_address: student.mac_address || '',
        mac_verified: student.mac_verified,
        is_active: student.is_active,
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');

    // Password reset email
    const [resetSending, setResetSending] = useState(false);
    const [resetStatus, setResetStatus] = useState(''); // '' | 'success' | 'error'
    const [resetMessage, setResetMessage] = useState('');

    // Enrollment management
    const [studentCourses, setStudentCourses] = useState(student.courses || []);
    const [enrolling, setEnrolling] = useState(null); // course_id being added
    const [unenrolling, setUnenrolling] = useState(null); // course_id being removed
    const [enrollError, setEnrollError] = useState('');

    useEffect(() => {
        const onKey = e => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const initials = `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() || 'ST';

    const handleSave = async (e) => {
        e.preventDefault();
        setSaveError(''); setSaveSuccess(''); setSaving(true);
        // Client-side MAC validation (same regex as student portal)
        if (form.mac_address && !/^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/i.test(form.mac_address)) {
            setSaveError('Invalid MAC address format. Use XX:XX:XX:XX:XX:XX');
            setSaving(false);
            return;
        }
        try {
            await api.patch('/api/admin/students', { student_id: student.id, ...form, schema });
            setSaveSuccess('Student details updated successfully!');
            onSaved();
            setTimeout(() => setSaveSuccess(''), 2500);
        } catch (err) {
            setSaveError(err.message || 'Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = async () => {
        setResetSending(true); setResetStatus(''); setResetMessage('');
        try {
            const res = await api.post('/api/admin/students/reset-password', { student_id: student.id, schema });
            setResetStatus('success');
            setResetMessage(res.message || `Reset email sent to ${student.email}`);
        } catch (err) {
            setResetStatus('error');
            setResetMessage(err.message || 'Failed to send reset email.');
        } finally {
            setResetSending(false);
        }
    };

    const handleEnroll = async (course) => {
        setEnrollError(''); setEnrolling(course.id);
        try {
            await api.post('/api/admin/enrollments', { student_id: student.id, course_id: course.id, schema });
            setStudentCourses(prev => [...prev, { course_id: course.id, course_name: course.name, course_code: course.code, enrolled_at: new Date().toISOString() }]);
            onSaved();
        } catch (err) {
            setEnrollError(err.message || 'Failed to enroll in course.');
        } finally {
            setEnrolling(null);
        }
    };

    const handleUnenroll = async (courseId) => {
        setEnrollError(''); setUnenrolling(courseId);
        try {
            await api.delete('/api/admin/enrollments', { student_id: student.id, course_id: courseId, schema });
            setStudentCourses(prev => prev.filter(c => c.course_id !== courseId));
            onSaved();
        } catch (err) {
            setEnrollError(err.message || 'Failed to remove from course.');
        } finally {
            setUnenrolling(null);
        }
    };

    const enrolledIds = new Set(studentCourses.map(c => c.course_id));
    const availableCourses = courses.filter(c => !enrolledIds.has(c.id));

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 1000, backdropFilter: 'blur(6px)' }} />
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0,
                width: 'min(680px, 100vw)', background: '#f8fafc', zIndex: 1001,
                display: 'flex', flexDirection: 'column',
                boxShadow: '-12px 0 60px rgba(0,0,0,0.2)',
                animation: 'slideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
            }}>
                {/* Gradient Header */}
                <div style={{ background: 'linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #3B82F6 100%)', padding: '2rem 2rem 1.5rem', color: '#fff', position: 'relative', flexShrink: 0 }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', color: '#fff', padding: 8, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
                        <X size={17} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                        <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#fff', color: '#1b6ca8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 900, boxShadow: '0 6px 20px rgba(0,0,0,0.2)', border: '3px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
                            {initials}
                        </div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.1 }}>{student.first_name} {student.last_name}</div>
                            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{student.email}</span>
                                {student.enrollment_no && <><span style={{ opacity: 0.5 }}>·</span><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Hash size={12} />{student.enrollment_no}</span></>}
                            </div>
                            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, background: student.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: student.is_active ? '#10b981' : '#ef4444', border: `1px solid ${student.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                                    {student.is_active ? '● Active' : '● Inactive'}
                                </span>
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, background: student.mac_verified ? 'rgba(59,130,246,0.2)' : 'rgba(156,163,175,0.2)', color: student.mac_verified ? '#3B82F6' : '#9ca3af', border: `1px solid ${student.mac_verified ? 'rgba(59,130,246,0.3)' : 'rgba(156,163,175,0.3)'}` }}>
                                    {student.mac_verified ? '✓ MAC Verified' : '✗ MAC Unverified'}
                                </span>
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                                    {studentCourses.length} course{studentCourses.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 0, marginTop: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                        {[{ key: 'details', label: 'Edit Details' }, { key: 'enrollments', label: `Course Enrollments (${studentCourses.length})` }].map(t => (
                            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 18px', border: 'none', background: 'transparent', cursor: 'pointer', color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: tab === t.key ? 700 : 500, fontSize: '0.82rem', borderBottom: tab === t.key ? '2px solid #fff' : '2px solid transparent', transition: 'all 0.15s', marginBottom: '-1px' }}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
                    {tab === 'details' && (
                        <form onSubmit={handleSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>First Name *</label>
                                    <input style={inp} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required
                                        onFocus={e => e.target.style.borderColor = '#3B82F6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Last Name *</label>
                                    <input style={inp} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required
                                        onFocus={e => e.target.style.borderColor = '#3B82F6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Email *</label>
                                <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
                                    onFocus={e => e.target.style.borderColor = '#3B82F6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Enrollment No.</label>
                                    <input style={inp} value={form.enrollment_no} onChange={e => setForm(f => ({ ...f, enrollment_no: e.target.value }))} placeholder="e.g. CIPD/2024/001"
                                        onFocus={e => e.target.style.borderColor = '#3B82F6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Program Name</label>
                                    <input style={inp} value={form.program_name} onChange={e => setForm(f => ({ ...f, program_name: e.target.value }))} placeholder="e.g. MBA, BBA"
                                        onFocus={e => e.target.style.borderColor = '#3B82F6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Account Status</label>
                                    <select style={{ ...inp }} value={form.is_active ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}>
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>MAC Verified</label>
                                    <select style={{ ...inp }} value={form.mac_verified ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, mac_verified: e.target.value === 'true' }))}>
                                        <option value="true">Verified</option>
                                        <option value="false">Not Verified</option>
                                    </select>
                                </div>
                            </div>
                            {/* MAC Address field */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>MAC Address</label>
                                <input
                                    style={{ ...inp, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase' }}
                                    value={form.mac_address}
                                    onChange={e => setForm(f => ({ ...f, mac_address: e.target.value.trim() }))}
                                    placeholder="XX:XX:XX:XX:XX:XX"
                                    maxLength={17}
                                    onFocus={e => e.target.style.borderColor = '#3B82F6'}
                                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                                    {form.mac_address && !/^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/i.test(form.mac_address) ? (
                                        <span style={{ fontSize: '0.68rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <AlertTriangle size={11} /> Invalid format — use XX:XX:XX:XX:XX:XX
                                        </span>
                                    ) : form.mac_address ? (
                                        <span style={{ fontSize: '0.68rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <CheckCircle size={11} /> Valid · will be stored as {form.mac_address.toUpperCase()} · mac_verified will reset to false
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Leave blank to clear MAC address</span>
                                    )}
                                </div>
                            </div>

                            {saveError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#dc2626' }}>
                                    <AlertTriangle size={14} /> {saveError}
                                </div>
                            )}
                            {saveSuccess && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#065f46' }}>
                                    <CheckCircle size={14} /> {saveSuccess}
                                </div>
                            )}

                            <button type="submit" disabled={saving} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: saving ? '#93c5fd' : 'linear-gradient(135deg, #0f4c75, #1b6ca8)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><CheckCircle size={15} /> Save Changes</>}
                            </button>

                            {/* ── Password Reset Section ── */}
                            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem' }}>Password Reset</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6, marginBottom: '0.9rem' }}>
                                    Send a password reset link to <strong>{student.email}</strong>. The link expires in 15 minutes.
                                </div>

                                {resetStatus === 'success' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#065f46' }}>
                                        <CheckCircle size={14} /> {resetMessage}
                                    </div>
                                )}
                                {resetStatus === 'error' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#dc2626' }}>
                                        <AlertTriangle size={14} /> {resetMessage}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleResetPassword}
                                    disabled={resetSending || resetStatus === 'success'}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: '10px',
                                        border: '1.5px solid',
                                        borderColor: resetStatus === 'success' ? '#a7f3d0' : '#bfdbfe',
                                        background: resetStatus === 'success' ? '#ecfdf5' : '#eff6ff',
                                        color: resetStatus === 'success' ? '#065f46' : '#1d4ed8',
                                        cursor: (resetSending || resetStatus === 'success') ? 'not-allowed' : 'pointer',
                                        fontSize: '0.88rem', fontWeight: 700,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        transition: 'all 0.15s',
                                        opacity: resetStatus === 'success' ? 0.75 : 1,
                                    }}
                                    onMouseOver={e => { if (!resetSending && resetStatus !== 'success') e.currentTarget.style.background = '#dbeafe'; }}
                                    onMouseOut={e => { if (!resetSending && resetStatus !== 'success') e.currentTarget.style.background = '#eff6ff'; }}
                                >
                                    {resetSending
                                        ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Sending Email…</>
                                        : resetStatus === 'success'
                                            ? <><CheckCircle size={15} /> Email Sent!</>
                                            : <><Mail size={15} /> Send Password Reset Email</>
                                    }
                                </button>
                            </div>
                        </form>
                    )}

                    {tab === 'enrollments' && (
                        <div>
                            {enrollError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#dc2626' }}>
                                    <AlertTriangle size={14} /> {enrollError}
                                </div>
                            )}

                            {/* Current enrollments */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                                    Currently Enrolled ({studentCourses.length})
                                </div>
                                {studentCourses.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#94a3b8', fontSize: '0.82rem' }}>
                                        Not enrolled in any courses yet.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {studentCourses.map(c => (
                                            <div key={c.course_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <BookOpen size={14} color="#3B82F6" />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{c.course_name}</div>
                                                        {c.course_code && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 1 }}>{c.course_code}</div>}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleUnenroll(c.course_id)} disabled={unenrolling === c.course_id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: '7px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: unenrolling === c.course_id ? 'not-allowed' : 'pointer', fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.15s' }}
                                                    onMouseOver={e => { e.currentTarget.style.background = '#fecaca'; }}
                                                    onMouseOut={e => { e.currentTarget.style.background = '#fef2f2'; }}>
                                                    {unenrolling === c.course_id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <BookmarkMinus size={12} />}
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Available courses */}
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                                    Add to Course ({availableCourses.length} available)
                                </div>
                                {availableCourses.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#94a3b8', fontSize: '0.82rem' }}>
                                        Student is enrolled in all available courses.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {availableCourses.map(c => (
                                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <BookOpen size={14} color="#94a3b8" />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{c.name}</div>
                                                        {c.code && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 1 }}>{c.code}</div>}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleEnroll(c)} disabled={enrolling === c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: '7px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: enrolling === c.id ? 'not-allowed' : 'pointer', fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.15s' }}
                                                    onMouseOver={e => { e.currentTarget.style.background = '#bfdbfe'; }}
                                                    onMouseOut={e => { e.currentTarget.style.background = '#eff6ff'; }}>
                                                    {enrolling === c.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <BookmarkPlus size={12} />}
                                                    Enroll
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ─── Add Student Modal ─────────────────────────────────────────────────────
function AddStudentModal({ onClose, onAdded, schema = 'july' }) {
    const [form, setForm] = useState({ first_name: '', last_name: '', email: '', enrollment_no: '', program_name: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const onKey = e => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await api.post('/api/admin/students', { ...form, schema });
            onAdded();
        } catch (err) {
            setError(err.message || 'Failed to create student.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1100, backdropFilter: 'blur(4px)' }} />
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                background: '#fff', borderRadius: '20px', width: 'min(520px, 92vw)',
                zIndex: 1101, boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
            }}>
                {/* Modal Header */}
                <div style={{ background: 'linear-gradient(135deg, #0f4c75, #1b6ca8)', padding: '1.5rem 1.8rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserPlus size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '1rem', fontWeight: 800 }}>Add New Student</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Default password: 12345678</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', color: '#fff', padding: 7, borderRadius: '8px', display: 'flex' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSubmit} style={{ padding: '1.5rem 1.8rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>First Name *</label>
                            <input style={inp} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name" required
                                onFocus={e => e.target.style.borderColor = '#3B82F6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Last Name *</label>
                            <input style={inp} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last name" required
                                onFocus={e => e.target.style.borderColor = '#3B82F6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Email *</label>
                        <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="student@cipd.edu" required
                            onFocus={e => e.target.style.borderColor = '#3B82F6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Enrollment No.</label>
                            <input style={inp} value={form.enrollment_no} onChange={e => setForm(f => ({ ...f, enrollment_no: e.target.value }))} placeholder="CIPD/2024/001"
                                onFocus={e => e.target.style.borderColor = '#3B82F6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Program Name</label>
                            <input style={inp} value={form.program_name} onChange={e => setForm(f => ({ ...f, program_name: e.target.value }))} placeholder="e.g. MBA, BBA"
                                onFocus={e => e.target.style.borderColor = '#3B82F6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                        </div>
                    </div>

                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#dc2626' }}>
                            <AlertTriangle size={14} /> {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} style={{ flex: 1.5, padding: '10px', borderRadius: '9px', border: 'none', background: loading ? '#93c5fd' : 'linear-gradient(135deg, #0f4c75, #1b6ca8)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creating...</> : <><UserPlus size={14} /> Create Student</>}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}


// ─── Attendance Summary Panel ──────────────────────────────────────────────
function AttendanceSummaryPanel({ student, schema }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true); setError('');
        api.get(`/api/admin/students/attendance-summary?student_id=${student.id}&schema=${schema}`)
            .then(d => setData(d))
            .catch(err => setError(err.message || 'Failed to load attendance data'))
            .finally(() => setLoading(false));
    }, [student.id, schema]);

    const pctColor = (p) => p >= 85 ? '#10b981' : p >= 75 ? '#f59e0b' : '#ef4444';
    const pctBg   = (p) => p >= 85 ? '#ecfdf5' : p >= 75 ? '#fffbeb' : '#fef2f2';
    const pctLabel = (p) => p >= 85 ? 'On Track' : p >= 75 ? 'Needs Attention' : 'At Risk';
    const statusColor = { present: '#10b981', partial: '#f59e0b', absent: '#ef4444', leave: '#3B82F6' };
    const statusBg    = { present: '#ecfdf5', partial: '#fffbeb', absent: '#fef2f2', leave: '#eff6ff' };
    const statusLabel = { present: 'Present', partial: 'Partial', absent: 'Absent', leave: 'Leave' };

    return (
        <tr>
            <td colSpan={8} style={{ padding: 0, borderBottom: '2px solid #e2e8f0' }}>
                <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderLeft: '3px solid #1b6ca8', padding: '1.2rem 1.4rem', animation: 'expandIn 0.2s ease' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: '0.82rem', padding: '0.5rem 0' }}>
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            Loading attendance data for {student.first_name}…
                        </div>
                    ) : error ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontSize: '0.8rem' }}>
                            <AlertTriangle size={13} /> {error}
                        </div>
                    ) : data ? (
                        <div>
                            {/* Header row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                                <BarChart2 size={14} color="#1b6ca8" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1b6ca8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attendance Summary</span>
                                <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: 4 }}>· {data.overall.total} sessions tracked</span>
                            </div>

                            {/* Overall stats bar */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, auto) 1fr', alignItems: 'center', gap: '1rem', background: '#fff', borderRadius: '10px', padding: '0.9rem 1.2rem', border: '1px solid #e2e8f0', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                                {/* Big % */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingRight: '1rem', borderRight: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: pctColor(data.overall.pct), lineHeight: 1 }}>{data.overall.pct}%</div>
                                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: pctColor(data.overall.pct), background: pctBg(data.overall.pct), padding: '2px 7px', borderRadius: 5 }}>{pctLabel(data.overall.pct)}</div>
                                </div>
                                {/* Stat chips */}
                                {[
                                    { label: 'Present', value: data.overall.attended, color: '#10b981', bg: '#ecfdf5' },
                                    { label: 'Absent', value: data.overall.absent, color: '#ef4444', bg: '#fef2f2' },
                                    { label: 'Leave', value: data.overall.leave, color: '#3B82F6', bg: '#eff6ff' },
                                    { label: 'Total', value: data.overall.total, color: '#64748b', bg: '#f8fafc' },
                                ].map(chip => (
                                    <div key={chip.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: chip.color }}>{chip.value}</div>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: chip.color, background: chip.bg, padding: '2px 7px', borderRadius: 5 }}>{chip.label}</div>
                                    </div>
                                ))}
                                {/* Streak */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                                    <Flame size={13} color={data.streak > 0 ? '#f59e0b' : '#cbd5e1'} />
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: data.streak > 0 ? '#f59e0b' : '#94a3b8' }}>{data.streak} day streak</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: data.courses.length > 0 ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                                {/* Course breakdown */}
                                {data.courses.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem' }}>By Course</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {data.courses.map(c => (
                                                <div key={c.course_name} style={{ background: '#fff', borderRadius: '8px', padding: '8px 12px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: 5 }}>{c.course_code}</span>
                                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>{c.course_name}</span>
                                                        </div>
                                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: pctColor(c.pct) }}>{c.pct}%</span>
                                                    </div>
                                                    {/* Progress bar */}
                                                    <div style={{ height: 5, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${c.pct}%`, background: `linear-gradient(90deg, ${pctColor(c.pct)}, ${pctColor(c.pct)}aa)`, borderRadius: 99, transition: 'width 0.5s ease' }} />
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: '0.62rem', color: '#94a3b8' }}>
                                                        <span style={{ color: '#10b981' }}>✓ {c.attended}</span>
                                                        <span style={{ color: '#ef4444' }}>✗ {c.absent}</span>
                                                        {c.leave > 0 && <span style={{ color: '#3B82F6' }}>L {c.leave}</span>}
                                                        <span>/ {c.total}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Recent sessions */}
                                <div>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem' }}>Recent Sessions</div>
                                    {data.recentSessions.length === 0 ? (
                                        <div style={{ background: '#fff', borderRadius: '8px', padding: '1rem', border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                                            No sessions recorded yet
                                        </div>
                                    ) : (
                                        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                            {data.recentSessions.slice(0, 8).map((sess, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: idx < Math.min(7, data.recentSessions.length - 1) ? '1px solid #f1f5f9' : 'none', gap: 10 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 42 }}>
                                                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>{sess.date}</div>
                                                            <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>{sess.day}</div>
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{sess.title}</div>
                                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{sess.course_code} · {sess.start_time}</div>
                                                        </div>
                                                    </div>
                                                    <span style={{ flexShrink: 0, fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: statusBg[sess.status] || '#f8fafc', color: statusColor[sess.status] || '#94a3b8' }}>
                                                        {statusLabel[sess.status] || sess.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </td>
        </tr>
    );
}

// ─── Main Page Component ───────────────────────────────────────────────────
export default function AdminStudentsPage() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Cohort/schema selector
    const [schema, setSchema] = useState('july');
    const [cohorts, setCohorts] = useState([{ value: 'july', label: 'July 2026' }]);
    const [cohortsLoading, setCohortsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterProgram, setFilterProgram] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    const [editingStudent, setEditingStudent] = useState(null);
    const [deletingStudent, setDeletingStudent] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [expandedStudentId, setExpandedStudentId] = useState(null);

    const [selectedStudents, setSelectedStudents] = useState([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

    const toggleExpand = (id) => setExpandedStudentId(prev => prev === id ? null : id);

    const navTo = p => router.push(p);

    // Load available cohorts from API on mount
    useEffect(() => {
        api.get('/api/admin/cohorts')
            .then(cfg => {
                const list = (cfg.schemas || []).map(s => ({ value: s, label: cfg.labels?.[s] || s }));
                if (list.length > 0) { setCohorts(list); setSchema(list[0].value); }
            })
            .catch(() => {})
            .finally(() => setCohortsLoading(false));
    }, []);

    const fetchStudents = useCallback(async () => {
        setLoading(true); setError('');
        setExpandedStudentId(null); // collapse any open panel when cohort changes
        setSelectedStudents([]); // reset selection
        try {
            const [stuRes, courseRes] = await Promise.allSettled([
                api.get(`/api/admin/students?schema=${schema}`),
                api.get('/api/admin/lookup'),
            ]);
            if (stuRes.status === 'fulfilled') setStudents(stuRes.value.students || []);
            else setError('Failed to load students.');
            if (courseRes.status === 'fulfilled') setCourses(courseRes.value.courses || []);
        } finally {
            setLoading(false);
        }
    }, [schema]);

    useEffect(() => { fetchStudents(); }, [fetchStudents]);

    // Stats
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.is_active).length;
    const verifiedMAC = students.filter(s => s.mac_verified).length;
    const totalEnrollments = students.reduce((a, s) => a + s.courses.length, 0);

    // Unique programs for filter
    const programs = useMemo(() => {
        const set = new Set(students.map(s => s.program_name).filter(Boolean));
        return [...set].sort();
    }, [students]);

    // Filtered list
    const filtered = useMemo(() => {
        return students.filter(s => {
            const term = searchTerm.toLowerCase();
            const matchSearch = !term || [s.first_name, s.last_name, s.email, s.enrollment_no, s.program_name].some(v => v?.toLowerCase().includes(term));
            const matchProgram = !filterProgram || s.program_name === filterProgram;
            const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? s.is_active : !s.is_active);
            return matchSearch && matchProgram && matchStatus;
        });
    }, [students, searchTerm, filterProgram, filterStatus]);

    const handleDelete = async () => {
        if (!deletingStudent) return;
        setDeleteLoading(true);
        try {
            await api.delete('/api/admin/students', { student_id: deletingStudent.id, schema });
            setDeletingStudent(null);
            fetchStudents();
        } catch (err) {
            alert('Failed to delete student: ' + (err.message || 'Unknown error'));
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedStudents.length === 0) return;
        setDeleteLoading(true);
        try {
            await api.delete('/api/admin/students', { student_ids: selectedStudents, schema });
            setShowBulkDeleteModal(false);
            setSelectedStudents([]);
            fetchStudents();
        } catch (err) {
            alert('Failed to delete students: ' + (err.message || 'Unknown error'));
        } finally {
            setDeleteLoading(false);
        }
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
                        <div className="nav-item" onClick={() => navTo('/admin/schedule')} style={{ cursor: 'pointer' }}><Calendar size={18} /> <span>Schedule Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/attendance')} style={{ cursor: 'pointer' }}><CheckCircle size={18} /> <span>Attendance Monitoring</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/live-students')} style={{ cursor: 'pointer' }}><Users size={18} /> <span>Live Students</span></div>
                        <div className="nav-item active"><GraduationCap size={18} /> <span>Student Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/leave-requests')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Leave Requests</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/wifi-logs')} style={{ cursor: 'pointer' }}><Wifi size={18} /> <span>Wi-Fi Logs</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>Analytics</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/feedback')} style={{ cursor: 'pointer' }}><MessageSquare size={18} /> <span>Feedback Analytics</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/leaderboard')} style={{ cursor: 'pointer' }}><Trophy size={18} /> <span>Leaderboard</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/faculty-hours')} style={{ cursor: 'pointer' }}><Clock size={18} /> <span>Faculty Management</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/reports')} style={{ cursor: 'pointer' }}><FileBarChart size={18} /> <span>Reports</span></div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#555', padding: '10px 1rem 4px' }}><span>System</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/notifications')} style={{ cursor: 'pointer' }}><Bell size={18} /> <span>Notifications</span></div>
                        <div className="nav-item" onClick={() => navTo('/admin/settings')} style={{ cursor: 'pointer' }}><Settings size={18} /> <span>Settings</span></div>
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
                            <h1>Student Management</h1>
                        </div>
                        <div className="header-actions">
                            <div className="search-bar">
                                <Search size={16} color="#aaa" />
                                <input type="text" placeholder="Search students..." className="search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <Bell size={20} color="#555" />
                            <img src="/logo.png" alt="Logo" style={{ height: '30px' }} />
                        </div>
                    </header>

                    {/* Cohort Selector Banner */}
                    {!cohortsLoading && cohorts.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', padding: '10px 14px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <BookOpen size={13} color="#64748b" /> Cohort
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {cohorts.map(c => (
                                    <button key={c.value} onClick={() => { setSchema(c.value); setExpandedStudentId(null); }}
                                        style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, transition: 'all 0.15s',
                                            background: schema === c.value ? 'linear-gradient(135deg, #0f4c75, #1b6ca8)' : '#f1f5f9',
                                            color: schema === c.value ? '#fff' : '#64748b',
                                            boxShadow: schema === c.value ? '0 2px 8px rgba(27,108,168,0.3)' : 'none' }}>
                                        {c.label}
                                        {c.value !== 'july' && <span style={{ fontSize: '0.58rem', marginLeft: 5, opacity: 0.75 }}>● Archive</span>}
                                    </button>
                                ))}
                            </div>
                            {schema !== (cohorts[0]?.value) && (
                                <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                                    ⚠ Viewing archived cohort — edits apply to this schema
                                </span>
                            )}
                        </div>
                    )}

                    {/* Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Students', value: totalStudents, icon: GraduationCap, color: '#3B82F6', bg: '#eff6ff', border: '#bfdbfe' },
                            { label: 'Active Accounts', value: activeStudents, icon: Activity, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
                            { label: 'MAC Verified', value: verifiedMAC, icon: ShieldCheck, color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
                        ].map(stat => {
                            const Icon = stat.icon;
                            return (
                                <div key={stat.label} style={{ background: '#fff', borderRadius: '12px', border: `1px solid ${stat.border}`, padding: '1.1rem 1.3rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 10, transition: 'transform 0.15s' }}
                                    onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                                        <div style={{ background: stat.bg, color: stat.color, padding: 7, borderRadius: '8px', display: 'flex' }}><Icon size={16} strokeWidth={2.5} /></div>
                                    </div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{loading ? '—' : stat.value}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Table Card */}
                    <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e8e8e8', borderTop: '3px solid #1b6ca8', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                        {/* Toolbar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.4rem', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem', fontWeight: 700, flex: 1 }}>
                                <GraduationCap size={16} color="#1b6ca8" />
                                All Students
                                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 500 }}>({filtered.length} of {totalStudents})</span>
                                {cohorts.length > 1 && <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: '#eff6ff', color: '#1d4ed8', marginLeft: 4 }}>{cohorts.find(c => c.value === schema)?.label}</span>}
                            </div>

                            {/* Filters */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', cursor: 'pointer', background: '#fff', color: '#444' }}>
                                    <option value="all">All Status</option>
                                    <option value="active">Active Only</option>
                                    <option value="inactive">Inactive Only</option>
                                </select>

                                {programs.length > 0 && (
                                    <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', fontFamily: 'inherit', cursor: 'pointer', background: '#fff', color: '#444' }}>
                                        <option value="">All Programs</option>
                                        {programs.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                )}

                                {selectedStudents.length > 0 && (
                                    <button onClick={() => setShowBulkDeleteModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: '9px', border: 'none', background: '#dc2626', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                                        <Trash2 size={14} /> Delete Selected ({selectedStudents.length})
                                    </button>
                                )}

                                <button onClick={fetchStudents} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>
                                    <RefreshCw size={13} /> Refresh
                                </button>

                                <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg, #0f4c75, #1b6ca8)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                                    <UserPlus size={14} /> Add Student
                                </button>
                            </div>
                        </div>

                        {/* Error banner */}
                        {error && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: '0.82rem', color: '#dc2626' }}>
                                <AlertTriangle size={14} /> {error}
                            </div>
                        )}

                        {/* Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '11px 16px', width: '40px', borderBottom: '1px solid #e2e8f0' }}>
                                            <input type="checkbox"
                                                checked={filtered.length > 0 && selectedStudents.length === filtered.length}
                                                onChange={e => setSelectedStudents(e.target.checked ? filtered.map(s => s.id) : [])}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </th>
                                        {['Student', 'Enrollment No.', 'Program', 'Courses', 'Status', 'MAC', 'Actions'].map(h => (
                                            <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        [...Array(5)].map((_, i) => (
                                            <tr key={i}>
                                                {[...Array(8)].map((_, j) => (
                                                    <td key={j} style={{ padding: '13px 16px' }}>
                                                        <div style={{ height: 12, borderRadius: 4, background: '#f1f5f9', width: `${50 + (i + j) * 7}%`, animation: 'shimmer 1.5s infinite' }} />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                <GraduationCap size={42} color="#cbd5e1" strokeWidth={1.5} style={{ marginBottom: 10 }} />
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>No students found</div>
                                                <div style={{ fontSize: '0.78rem' }}>Try adjusting your search or filters</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((s, i) => {
                                            const initials = `${s.first_name?.[0] || ''}${s.last_name?.[0] || ''}`.toUpperCase();
                                            const hues = [215, 142, 267, 23, 345, 187, 48, 160];
                                            const hue = hues[i % hues.length];
                                            const isExpanded = expandedStudentId === s.id;
                                            return (
                                                <React.Fragment key={s.id}>
                                                <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9', transition: 'background 0.12s', background: isExpanded ? '#f0f7ff' : '' }}
                                                    onMouseOver={e => { if (!isExpanded) e.currentTarget.style.background = '#f8fafc'; }}
                                                    onMouseOut={e => { if (!isExpanded) e.currentTarget.style.background = ''; }}>
                                                    {/* Checkbox */}
                                                    <td style={{ padding: '12px 16px', width: '40px' }}>
                                                        <input type="checkbox"
                                                            checked={selectedStudents.includes(s.id)}
                                                            onChange={e => setSelectedStudents(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    </td>
                                                    {/* Student name + email — clickable to expand */}
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => toggleExpand(s.id)} title="Click to view attendance">
                                                            <div style={{ width: 36, height: 36, borderRadius: '10px', background: `hsl(${hue},70%,92%)`, color: `hsl(${hue},55%,35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>{initials}</div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                                    <span style={{ fontWeight: 700, color: isExpanded ? '#1b6ca8' : '#0f172a' }}>{s.first_name} {s.last_name}</span>
                                                                    {isExpanded ? <ChevronUp size={13} color="#1b6ca8" /> : <ChevronDown size={13} color="#94a3b8" />}
                                                                </div>
                                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 1 }}>{s.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {/* Enrollment No */}
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: s.enrollment_no ? '#334155' : '#cbd5e1', fontWeight: s.enrollment_no ? 600 : 400 }}>
                                                            {s.enrollment_no || '—'}
                                                        </span>
                                                    </td>
                                                    {/* Program */}
                                                    <td style={{ padding: '12px 16px' }}>
                                                        {s.program_name ? (
                                                            <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: '#f1f5f9', color: '#334155' }}>{s.program_name}</span>
                                                        ) : <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>—</span>}
                                                    </td>
                                                    {/* Courses */}
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: s.courses.length > 0 ? '#eff6ff' : '#f8fafc', color: s.courses.length > 0 ? '#1d4ed8' : '#94a3b8' }}>
                                                                {s.courses.length} course{s.courses.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    {/* Status */}
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: s.is_active ? '#ecfdf5' : '#fef2f2', color: s.is_active ? '#10b981' : '#ef4444' }}>
                                                            {s.is_active ? '● Active' : '● Inactive'}
                                                        </span>
                                                    </td>
                                                    {/* MAC */}
                                                    <td style={{ padding: '12px 16px' }}>
                                                        {s.mac_verified ? (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed' }}><ShieldCheck size={13} /> Verified</span>
                                                        ) : (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 500, color: '#94a3b8' }}><ShieldOff size={13} /> Pending</span>
                                                        )}
                                                    </td>
                                                    {/* Actions */}
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <button onClick={() => setEditingStudent(s)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, color: '#1b6ca8', transition: 'all 0.15s' }}
                                                                onMouseOver={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                                                                onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                                                                <Pencil size={11} /> Edit
                                                            </button>
                                                            <button onClick={() => setDeletingStudent(s)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: '7px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', transition: 'all 0.15s' }}
                                                                onMouseOver={e => { e.currentTarget.style.background = '#fecaca'; }}
                                                                onMouseOut={e => { e.currentTarget.style.background = '#fef2f2'; }}>
                                                                <Trash2 size={11} /> Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && <AttendanceSummaryPanel student={s} schema={schema} />}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
            </table>
                        </div>

                        {/* Footer */}
                        {!loading && filtered.length > 0 && (
                            <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Showing {filtered.length} of {totalStudents} students</span>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{activeStudents} active · {totalStudents - activeStudents} inactive</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showAddModal && (
                <AddStudentModal onClose={() => setShowAddModal(false)} onAdded={() => { setShowAddModal(false); fetchStudents(); }} schema={schema} />
            )}
            {editingStudent && (
                <StudentDrawer student={editingStudent} courses={courses} onClose={() => setEditingStudent(null)} onSaved={fetchStudents} schema={schema} />
            )}
            {deletingStudent && (
                <DeleteConfirmModal student={deletingStudent} onClose={() => setDeletingStudent(null)} onConfirm={handleDelete} deleting={deleteLoading} />
            )}
            {showBulkDeleteModal && (
                <BulkDeleteConfirmModal count={selectedStudents.length} onClose={() => setShowBulkDeleteModal(false)} onConfirm={handleBulkDelete} deleting={deleteLoading} />
            )}

            <style>{`
                @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
                @keyframes shimmer { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes expandIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
