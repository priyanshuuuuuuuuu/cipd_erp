'use client';

import React, { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json().catch(() => ({}));
      setDone(data.message || 'If this email belongs to a faculty account, a password reset link has been sent.');
    } catch {
      setDone('Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f7', padding: 16 }}>
      <form onSubmit={submit} style={{ background: '#fff', padding: 32, borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h2 style={{ margin: '0 0 6px' }}>Reset your password</h2>
        <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: '#666' }}>Faculty: enter your email and we will send you a link that is valid for 15 minutes.</p>
        {done ? (
          <div style={{ fontSize: '0.9rem', color: '#166534' }}>{done}</div>
        ) : (
          <>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.9rem', marginBottom: 14, boxSizing: 'border-box' }} />
            <button type="submit" disabled={busy} style={{ width: '100%', padding: 12, background: '#1a1a1a', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )}
        <a href="/" style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: '0.8rem', color: '#888' }}>Back to login</a>
      </form>
    </div>
  );
}
