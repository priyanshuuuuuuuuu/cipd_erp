'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import { KeyRound } from 'lucide-react';

export default function FacultyChangePasswordPage() {
  const router = useRouter();
  const { user, logout, markPasswordChanged } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const current = form.current.trim();
    const next = form.next.trim();
    if (!current || !next || !form.confirm.trim()) return setError('All fields are required.');
    if (next !== form.confirm.trim()) return setError('New passwords do not match.');
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    setSaving(true);
    try {
      await api.post('/api/auth/update-password', { currentPassword: current, newPassword: next });
      markPasswordChanged();
      router.replace('/faculty/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, autoComplete) => (
    <div className="fp-field">
      <label className="fp-label">{label}</label>
      <input
        type="password"
        className="fp-input"
        value={form[key]}
        autoComplete={autoComplete}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="fp-shell" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f7', padding: 16 }}>
      <form onSubmit={submit} className="fp-modal" style={{ maxWidth: 420 }}>
        <div className="fp-modal-head" style={{ padding: '1.6rem 1.6rem 1.4rem', alignItems: 'center', gap: 14, justifyContent: 'flex-start' }}>
          <div className="fp-hero-avatar" style={{ width: 52, height: 52 }}><KeyRound size={22} /></div>
          <div>
            <h3 style={{ fontSize: '1.2rem' }}>Set a new password</h3>
            <small style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.8rem', fontWeight: 500 }}>
              {user?.firstName ? `Hi ${user.firstName}, you` : 'You'} are using a default password.
            </small>
          </div>
        </div>
        <div className="fp-modal-body">
          {field('current', 'Current (default) password', 'current-password')}
          {field('next', 'New password', 'new-password')}
          {field('confirm', 'Confirm new password', 'new-password')}
          {error && <div className="fp-msg fp-msg-error" style={{ marginTop: 0, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={saving} className="fp-btn fp-btn-primary" style={{ width: '100%', padding: 12 }}>
            {saving ? 'Saving…' : 'Update password'}
          </button>
          <button type="button" className="fp-link" style={{ width: '100%', marginTop: 12, justifyContent: 'center', color: '#94a3b8' }} onClick={async () => { await logout(); router.push('/'); }}>
            Log out
          </button>
        </div>
      </form>
    </div>
  );
}
