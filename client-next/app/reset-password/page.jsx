'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import '../Login.css';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('No reset token found. Please ask your admin to resend the email.');
        }
    }, [token]);

    const strength = (() => {
        if (!newPassword) return 0;
        let s = 0;
        if (newPassword.length >= 8) s++;
        if (/[A-Z]/.test(newPassword)) s++;
        if (/[0-9]/.test(newPassword)) s++;
        if (/[^A-Za-z0-9]/.test(newPassword)) s++;
        return s;
    })();
    const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
    const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'][strength];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage('Passwords do not match.');
            setStatus('error');
            return;
        }
        if (newPassword.length < 8) {
            setMessage('Password must be at least 8 characters.');
            setStatus('error');
            return;
        }
        setStatus('loading');
        setMessage('');
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus('error');
                setMessage(data.error || 'Something went wrong.');
            } else {
                setStatus('success');
                setMessage(data.message || 'Password updated! Redirecting to login…');
                setTimeout(() => router.push('/'), 3000);
            }
        } catch {
            setStatus('error');
            setMessage('Network error. Please try again.');
        }
    };

    return (
        <div style={{
            minHeight: '100vh', background: 'linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #3B82F6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
            fontFamily: "'Inter', -apple-system, sans-serif",
        }}>
            {/* Decorative blobs */}
            <div style={{ position: 'fixed', top: '-120px', right: '-120px', width: 400, height: 400, background: 'rgba(255,255,255,0.06)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '-100px', left: '-100px', width: 320, height: 320, background: 'rgba(255,255,255,0.04)', borderRadius: '50%', pointerEvents: 'none' }} />

            <div style={{
                background: '#fff', borderRadius: '24px', boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
                width: 'min(440px, 100%)', overflow: 'hidden', position: 'relative', zIndex: 1,
            }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #0f4c75, #1b6ca8)', padding: '2rem 2rem 1.5rem', color: '#fff', textAlign: 'center' }}>
                    <div style={{
                        width: 60, height: 60, background: 'rgba(255,255,255,0.15)', borderRadius: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem', border: '1px solid rgba(255,255,255,0.2)',
                    }}>
                        {/* Lock icon */}
                        <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1 }}>Set New Password</div>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', marginTop: 8, lineHeight: 1.5 }}>
                        Choose a strong password for your CiPD 360 account.<br />This link expires in 15 minutes.
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '1.8rem 2rem 2rem' }}>
                    {status === 'success' ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                            <div style={{
                                width: 64, height: 64, background: '#ecfdf5', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1rem',
                            }}>
                                <svg width="30" height="30" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#065f46', marginBottom: 8 }}>Password Updated!</div>
                            <div style={{ fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.6 }}>{message}</div>
                            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#94a3b8', fontSize: '0.78rem' }}>
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                Redirecting to login in 3 seconds…
                            </div>
                        </div>
                    ) : status === 'error' && !token ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                            <div style={{
                                width: 64, height: 64, background: '#fef2f2', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1rem',
                            }}>
                                <svg width="28" height="28" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                            </div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>Invalid Link</div>
                            <div style={{ fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.6 }}>{message}</div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {/* New Password */}
                            <div style={{ marginBottom: '1.2rem' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                                    New Password
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="Min. 8 characters"
                                        required
                                        style={{
                                            width: '100%', padding: '10px 44px 10px 14px', borderRadius: '10px',
                                            border: '1.5px solid #e5e7eb', fontSize: '0.88rem',
                                            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                                            transition: 'border-color 0.15s',
                                        }}
                                        onFocus={e => e.target.style.borderColor = '#3B82F6'}
                                        onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                                    />
                                    <button type="button" onClick={() => setShowNew(v => !v)} style={{
                                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex',
                                    }}>
                                        {showNew
                                            ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                            : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        }
                                    </button>
                                </div>
                                {/* Strength bar */}
                                {newPassword && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} style={{
                                                    flex: 1, height: 4, borderRadius: 4,
                                                    background: i <= strength ? strengthColor : '#e5e7eb',
                                                    transition: 'background 0.2s',
                                                }} />
                                            ))}
                                        </div>
                                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: strengthColor }}>{strengthLabel}</span>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div style={{ marginBottom: '1.4rem' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                                    Confirm Password
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter your password"
                                        required
                                        style={{
                                            width: '100%', padding: '10px 44px 10px 14px', borderRadius: '10px',
                                            border: `1.5px solid ${confirmPassword && confirmPassword !== newPassword ? '#fca5a5' : '#e5e7eb'}`,
                                            fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                                            transition: 'border-color 0.15s',
                                        }}
                                        onFocus={e => e.target.style.borderColor = confirmPassword && confirmPassword !== newPassword ? '#ef4444' : '#3B82F6'}
                                        onBlur={e => e.target.style.borderColor = confirmPassword && confirmPassword !== newPassword ? '#fca5a5' : '#e5e7eb'}
                                    />
                                    <button type="button" onClick={() => setShowConfirm(v => !v)} style={{
                                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex',
                                    }}>
                                        {showConfirm
                                            ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                            : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        }
                                    </button>
                                </div>
                                {confirmPassword && confirmPassword !== newPassword && (
                                    <span style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: 4, display: 'block' }}>Passwords don't match</span>
                                )}
                            </div>

                            {/* Error message */}
                            {status === 'error' && message && (
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px',
                                    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
                                    marginBottom: '1.2rem', fontSize: '0.8rem', color: '#dc2626', lineHeight: 1.5,
                                }}>
                                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                    {message}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={status === 'loading' || !newPassword || !confirmPassword}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                                    background: status === 'loading' ? '#93c5fd' : ((!newPassword || !confirmPassword) ? '#e5e7eb' : 'linear-gradient(135deg, #0f4c75, #1b6ca8)'),
                                    color: (!newPassword || !confirmPassword) ? '#9ca3af' : '#fff',
                                    cursor: status === 'loading' || !newPassword || !confirmPassword ? 'not-allowed' : 'pointer',
                                    fontSize: '0.92rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    transition: 'all 0.15s',
                                }}
                            >
                                {status === 'loading' ? (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                        </svg>
                                        Updating Password…
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                        </svg>
                                        Set New Password
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Footer */}
                    <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.6 }}>
                        Having trouble? Contact your program coordinator.
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f4c75, #1b6ca8)' }}>
                <div style={{ color: '#fff', fontSize: '0.9rem' }}>Loading…</div>
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
