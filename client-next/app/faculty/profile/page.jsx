'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, User, CalendarCheck, CheckCircle2, Timer, Landmark, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { PageHeader, Loading, Empty, StatTile, StatusPill, Notice } from '../components/ui';

export default function FacultyProfilePage() {
  const router = useRouter();
  const { user, authReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [hours, setHours] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [meRes, hoursRes] = await Promise.allSettled([
        api.get('/api/auth/me'),
        api.get('/api/faculty/hours'),
      ]);

      if (meRes.status === 'fulfilled') {
        setProfile(meRes.value.user || meRes.value);
      }
      if (hoursRes.status === 'fulfilled') {
        setHours(hoursRes.value);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) fetchData();
  }, [authReady, fetchData]);

  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : '';

  const initials = ((user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')).toUpperCase() || 'F';
  const rate = hours?.profile?.honorarium_rate_per_hour || profile?.honorarium_rate_per_hour || 0;
  const designation = profile?.designation || hours?.profile?.designation || 'Faculty';

  return (
    <>
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="fp-hero">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div className="fp-hero-avatar">{initials}</div>
              <div>
                <h2>{displayName || 'Faculty'}</h2>
                <p>{designation} · ₹{rate.toLocaleString()}/hr</p>
              </div>
            </div>
            <div className="fp-hero-chip">
              <span>Est. honorarium</span>
              <b>₹{(hours?.estimatedHonorarium || 0).toLocaleString()}</b>
            </div>
          </div>

          <div className="fp-stats">
            <StatTile label="All Sessions" value={hours?.totalSessionCount ?? 0} icon={CalendarCheck} tone="blue" />
            <StatTile label="Completed" value={hours?.completedSessions ?? 0} icon={CheckCircle2} tone="green" />
            <StatTile label="Teaching Hrs" value={`${hours?.totalHours ?? 0}h`} icon={Timer} tone="amber" />
          </div>

          <div className="fp-card">
            <div className="fp-card-head"><User size={17} /> Profile</div>
            <dl className="fp-kv fp-card-body" style={{ margin: 0 }}>
              <div><dt>Name</dt><dd>{displayName || '—'}</dd></div>
              <div><dt>Email</dt><dd>{user?.email}</dd></div>
              <div><dt>Designation</dt><dd>{profile?.designation || hours?.profile?.designation || '—'}</dd></div>
              <div><dt>Department</dt><dd>{profile?.department || hours?.profile?.department || '—'}</dd></div>
              <div><dt>Experience</dt><dd>{profile?.years_experience ?? hours?.profile?.years_experience ?? '—'} years</dd></div>
              <div><dt>Honorarium Rate</dt><dd>₹{rate.toLocaleString()} / hr</dd></div>
            </dl>
          </div>

          <BankDetailsCard />

          <div className="fp-card">
            <div className="fp-card-head">
              <Clock size={17} /> Session History
              <span className="fp-count">{(hours?.sessions || []).length} total</span>
              <span className="fp-spacer" />
              <button className="fp-btn fp-btn-sm" onClick={() => router.push('/faculty/statement')}><FileText size={13} /> Monthly statement</button>
            </div>
            {(hours?.sessions || []).length === 0 ? (
              <Empty icon={Clock} title="No sessions recorded" />
            ) : (
              <div className="fp-table-wrap">
                <table className="fp-table">
                  <thead>
                    <tr>{['Date', 'Session', 'Course', 'Venue', 'Duration', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {(hours?.sessions || []).map((s) => (
                      <tr key={s.session_id}>
                        <td className="fp-mono">{s.date}</td>
                        <td className="fp-strong">{s.title}</td>
                        <td><span className="fp-tag">{s.course}</span></td>
                        <td>{s.venue}</td>
                        <td className="fp-mono">{s.duration}</td>
                        <td><StatusPill status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function BankDetailsCard() {
  const [bank, setBank] = useState({ bank_account_number: '', bank_account_holder: '', bank_ifsc_code: '', bank_branch: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/faculty/profile').then((d) => setBank((b) => ({ ...b, ...Object.fromEntries(Object.entries(d.bank || {}).map(([k, v]) => [k, v || ''])) }))).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg({ type: '', text: '' });
    try { await api.patch('/api/faculty/profile', bank); setMsg({ type: 'ok', text: 'Bank details saved.' }); }
    catch (err) { setMsg({ type: 'error', text: err.message || 'Failed to save' }); } finally { setSaving(false); }
  };
  const field = (k, label) => (
    <div><label className="fp-label">{label}</label><input className="fp-input" value={bank[k]} onChange={(e) => setBank({ ...bank, [k]: e.target.value })} /></div>
  );
  return (
    <form onSubmit={save} className="fp-card">
      <div className="fp-card-head"><Landmark size={17} /> Bank details <span className="fp-count">for honorarium</span></div>
      <div className="fp-card-body">
        <div className="fp-grid-2">
          {field('bank_account_holder', 'Account holder')}
          {field('bank_account_number', 'Account number')}
          {field('bank_ifsc_code', 'IFSC code')}
          {field('bank_branch', 'Branch')}
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="fp-btn fp-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button>
        </div>
        <Notice msg={msg} />
      </div>
    </form>
  );
}
