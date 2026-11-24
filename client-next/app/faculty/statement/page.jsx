'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Download, Printer, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import { PageHeader, Loading } from '../components/ui';

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

  if (error) return <div className="fp-msg fp-msg-error">{error}</div>;
  if (!data) return <Loading />;

  return (
    <>
      <style>{`@media print { .no-print, aside, header, .sidebar { display: none !important; } .main-content { margin: 0 !important; padding: 0 !important; background: #fff !important; } .fp-card { box-shadow: none !important; border: none !important; } }`}</style>
      <div className="no-print">
        <PageHeader icon={FileText} title="Honorarium Statement" subtitle="Download or print your monthly earnings.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="month" className="fp-input" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="fp-btn" onClick={downloadCsv}><Download size={14} /> CSV</button>
            <button className="fp-btn fp-btn-primary" onClick={() => window.print()}><Printer size={14} /> Print / PDF</button>
          </div>
        </PageHeader>
      </div>

      <div className="fp-card">
        <div style={{ background: '#111', color: '#fff', padding: '1.3rem 1.5rem', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Honorarium statement — {month || 'All time'}</div>
            <div style={{ fontSize: '0.84rem', opacity: 0.85, marginTop: 3 }}>{name} · {user?.email}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>Total payable</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800 }}>₹{amount.toLocaleString()}</div>
          </div>
        </div>
        <div className="fp-table-wrap">
          <table className="fp-table">
            <thead>
              <tr>{['Date', 'Session', 'Course', 'Hours', 'Amount (₹)'].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.session_id}>
                  <td className="fp-mono">{r.date_raw}</td>
                  <td className="fp-strong">{r.title}</td>
                  <td><span className="fp-tag">{r.course}</span></td>
                  <td className="fp-mono">{r.hours.toFixed(2)}</td>
                  <td className="fp-mono">{Math.round(r.hours * rate).toLocaleString()}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No completed classes in this period.</td></tr>}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 800, color: '#0f172a' }}>
                <td colSpan={3} style={{ padding: '14px 18px', borderTop: '2px solid #e2e8f0' }}>Total @ ₹{rate.toLocaleString()}/hr</td>
                <td className="fp-mono" style={{ padding: '14px 18px', borderTop: '2px solid #e2e8f0' }}>{totalHours.toFixed(2)}</td>
                <td className="fp-mono" style={{ padding: '14px 18px', borderTop: '2px solid #e2e8f0' }}>{amount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="fp-hint" style={{ padding: '0 1.5rem 1.2rem', marginTop: 12 }}>Only classes marked completed are counted. This is an estimate; the final payout is confirmed by the administration.</div>
      </div>
    </>
  );
}
