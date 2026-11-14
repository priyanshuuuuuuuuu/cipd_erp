'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

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
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{label}</label>
      <input
        type="password"
        value={form[key]}
        autoComplete={autoComplete}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.9rem' }}
      />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f7', padding: 16 }}>
      <form onSubmit={submit} style={{ background: '#fff', padding: 32, borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h2 style={{ margin: '0 0 6px' }}>Set a new password</h2>
        <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: '#666' }}>
          {user?.firstName ? `Hi ${user.firstName}, you` : 'You'} are using a default password. Choose your own to continue.
        </p>
        {field('current', 'Current (default) password', 'current-password')}
        {field('next', 'New password', 'new-password')}
        {field('confirm', 'Confirm new password', 'new-password')}
        {error && <div style={{ color: '#c0392b', fontSize: '0.85rem', marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={saving} style={{ width: '100%', padding: 12, background: '#1a1a1a', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Update password'}
        </button>
        <button type="button" onClick={async () => { await logout(); router.push('/'); }} style={{ width: '100%', marginTop: 10, background: 'none', border: 0, color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}>
          Log out
        </button>
      </form>
    </div>
  );
}
