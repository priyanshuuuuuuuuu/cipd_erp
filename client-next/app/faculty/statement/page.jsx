'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

const monthOf = (d) => String(d || '').slice(0, 7);
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

export default function FacultyStatementPage() {
  const { authReady, user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!authReady) return;
    api.get('/api/faculty/hours').then(setData).catch((e) => setError(e.message || 'Failed to load'));
  }, [authReady]);

  const rows = useMemo(
    () => (data?.sessions || []).filter((s) => s.status === 'completed' && (!month || monthOf(s.date_raw) === month)).sort((a, b) => a.date_raw.localeCompare(b.date_raw)),
    [data, month]
  );
  const rate = data?.profile?.honorarium_rate_per_hour || 0;
  const totalHours = rows.reduce((n, r) => n + (r.hours || 0), 0);
  const amount = Math.round(totalHours * rate);
  const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

  const downloadCsv = () => {
    const lines = [['Date', 'Session', 'Course', 'Venue', 'Hours', 'Rate (INR/hr)', 'Amount (INR)'].map(csvCell).join(',')];
    rows.forEach((r) => lines.push([r.date_raw, r.title, r.course, r.venue, r.hours, rate, Math.round(r.hours * rate)].map(csvCell).join(',')));
    lines.push(['', '', '', 'Total', totalHours.toFixed(2), rate, amount].map(csvCell).join(','));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `honorarium-statement-${month || 'all'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (error) return <div style={{ color: '#dc2626' }}>{error}</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading...</div>;
  const btn = { display: 'inline-flex', gap: 6, alignItems: 'center', padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 };

  return (
    <>
      <style>{`@media print { .no-print, aside, header, .sidebar { display: none !important; } .main-content { margin: 0 !important; padding: 0 !important; } }`}</style>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: '1.2rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Honorarium Statement</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <button style={btn} onClick={downloadCsv}><Download size={14} /> CSV</button>
          <button style={btn} onClick={() => window.print()}><Printer size={14} /> Print / PDF</button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '1.4rem 1.6rem' }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>Honorarium statement — {month || 'All time'}</div>
        <div style={{ fontSize: '0.82rem', color: '#666', margin: '4px 0 14px' }}>{name} · {user?.email}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#888', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                {['Date', 'Session', 'Course', 'Hours', 'Amount (₹)'].map((h) => <th key={h} style={{ padding: '8px 10px' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.session_id} style={{ borderTop: '1px solid #f3f3f3' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.date_raw}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.title}</td>
                  <td style={{ padding: '8px 10px' }}>{r.course}</td>
                  <td style={{ padding: '8px 10px' }}>{r.hours.toFixed(2)}</td>
                  <td style={{ padding: '8px 10px' }}>{Math.round(r.hours * rate).toLocaleString()}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#aaa' }}>No completed classes in this period.</td></tr>}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #111', fontWeight: 700 }}>
                <td colSpan={3} style={{ padding: '10px' }}>Total @ ₹{rate.toLocaleString()}/hr</td>
                <td style={{ padding: '10px' }}>{totalHours.toFixed(2)}</td>
                <td style={{ padding: '10px' }}>{amount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 12 }}>Only classes marked completed are counted. This is an estimate; the final payout is confirmed by the administration.</div>
      </div>
    </>
  );
}
