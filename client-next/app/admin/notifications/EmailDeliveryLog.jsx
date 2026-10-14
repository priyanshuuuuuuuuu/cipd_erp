'use client';
import React, { useMemo, useState } from 'react';
import { Mail, ChevronDown, ChevronUp, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

// Plain-language view of the email outbox for non-technical admins.
const STAGES = {
    delivered: { label: 'Delivered',       color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', bar: '#00A5A0' },
    sending:   { label: 'Sending',         color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', bar: '#93c5fd' },
    waiting:   { label: 'Queued',          color: '#555',    bg: '#f5f5f5', border: '#e8e8e8', bar: '#d4d4d8' },
    retrying:  { label: 'Retrying',        color: '#b45309', bg: '#fffbeb', border: '#fde68a', bar: '#fcd34d' },
    testmode:  { label: 'Not sent (test mode)', color: '#555', bg: '#f5f5f5', border: '#e8e8e8', bar: '#e5e7eb' },
    failed:    { label: 'Failed',          color: '#dc2626', bg: '#fef2f2', border: '#fecaca', bar: '#dc2626' },
};

const EVENT_NAMES = {
    general_notification: 'Announcement',
    class_reminder: 'Class reminder',
    weekly_schedule: 'Weekly schedule',
    feedback_available: 'Feedback form',
    attendance_summary: 'Attendance summary',
    password_reset: 'Password reset',
};

function stageOf(m) {
    const err = m.last_error || '';
    if (m.status === 'sent') return 'delivered';
    if (m.status === 'processing') return 'sending';
    if (m.status === 'queued') return 'waiting';
    if (/sandbox/i.test(err)) return 'testmode';
    if (m.status === 'retry') return 'retrying';
    return 'failed';
}

function friendlyReason(m, stage) {
    if (stage === 'testmode') return 'Test mode is on, so only approved test addresses get real emails.';
    if (stage === 'retrying') return 'The first attempt did not go through. We will try again automatically.';
    if (stage === 'failed') return m.last_error ? 'Could not be delivered. Details: ' + m.last_error : 'Could not be delivered.';
    return '';
}

function timeOf(v) {
    return new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// dedupe_key looks like "<event>:<batchId>:<studentId>"; rows sharing event+batch are one send.
function buildBatches(messages) {
    const map = new Map();
    for (const m of messages) {
        const parts = (m.dedupe_key || '').split(':');
        const key = parts.length >= 3 ? parts[0] + ':' + parts[1] : m.id;
        if (!map.has(key)) map.set(key, { key, type: m.event_type, createdAt: m.created_at, items: [] });
        map.get(key).items.push({ ...m, stage: stageOf(m) });
    }
    return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function BatchCard({ batch, defaultOpen }) {
    const [open, setOpen] = useState(defaultOpen);
    const total = batch.items.length;
    const counts = batch.items.reduce((c, m) => ({ ...c, [m.stage]: (c[m.stage] || 0) + 1 }), {});
    const delivered = counts.delivered || 0;
    const inFlight = (counts.sending || 0) + (counts.waiting || 0) + (counts.retrying || 0);
    const done = inFlight === 0;
    const allGood = done && delivered === total;
    const pct = Math.round((delivered / total) * 100);

    let headline;
    if (allGood) headline = total === 1 ? 'Email delivered' : `All ${total} emails delivered`;
    else if (!done) headline = `${delivered} of ${total} delivered so far`;
    else if (delivered === 0) headline = 'No emails were sent';
    else headline = `${delivered} of ${total} delivered`;

    return (
        <div style={{ border: '1px solid #ececec', borderRadius: 10, marginBottom: 10, overflow: 'hidden', background: '#fff' }}>
            <button onClick={() => setOpen(!open)} style={{ width: '100%', textAlign: 'left', border: 'none', background: '#fff', padding: '14px 18px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#111' }}>
                            {EVENT_NAMES[batch.type] || 'Email'} <span style={{ color: '#888', fontWeight: 500 }}>&middot; {headline}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#888' }}>Started at {timeOf(batch.createdAt)}</div>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#3B2D82' }}>{pct}%</span>
                    {open ? <ChevronUp size={16} color="#888" /> : <ChevronDown size={16} color="#888" />}
                </div>
                {/* progress bar: one coloured segment per stage */}
                <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', background: '#f0f0f0', marginTop: 12 }}>
                    {Object.keys(STAGES).map(s => counts[s] ? (
                        <div key={s} className={s === 'sending' ? 'edl-pulse' : ''} style={{ width: `${(counts[s] / total) * 100}%`, background: STAGES[s].bar, transition: 'width .6s ease' }} />
                    ) : null)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {Object.keys(STAGES).map(s => counts[s] ? (
                        <span key={s} style={{ background: STAGES[s].bg, color: STAGES[s].color, borderRadius: 99, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700 }}>
                            {counts[s]} {STAGES[s].label.toLowerCase()}
                        </span>
                    ) : null)}
                </div>
            </button>
            {open && (
                <div style={{ borderTop: '1px solid #f0f0f0', maxHeight: 260, overflowY: 'auto' }}>
                    {batch.items.map(m => {
                        const st = STAGES[m.stage];
                        const reason = friendlyReason(m, m.stage);
                        return (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 18px', borderBottom: '1px solid #f8f8f8', fontSize: '0.8rem' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600 }}>{m.recipient_name && m.recipient_name !== 'Student' ? m.recipient_name + ' · ' : ''}<span style={{ color: '#555', fontWeight: 500 }}>{m.recipient_email}</span></div>
                                    {reason && <div style={{ color: '#888', fontSize: '0.72rem', marginTop: 2 }}>{reason}</div>}
                                </div>
                                <span style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}`, borderRadius: 6, padding: '2px 8px', fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{st.label}</span>
                                <span style={{ color: '#888', fontSize: '0.72rem', width: 78, textAlign: 'right' }}>{timeOf(m.sent_at || m.updated_at || m.created_at)}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function EmailDeliveryLog({ messages, error }) {
    const batches = useMemo(() => buildBatches(messages), [messages]);
    const all = batches.flatMap(b => b.items);
    const delivered = all.filter(m => m.stage === 'delivered').length;
    const inFlight = all.filter(m => ['sending', 'waiting', 'retrying'].includes(m.stage)).length;
    const attention = all.filter(m => m.stage === 'failed').length;

    const tiles = [
        { icon: CheckCircle,   n: delivered, label: 'Delivered',      color: '#16a34a', bg: '#f0fdf4' },
        { icon: Clock,         n: inFlight,  label: 'In progress',    color: '#3B2D82', bg: '#f5f3ff' },
        { icon: AlertTriangle, n: attention, label: 'Need attention', color: '#dc2626', bg: '#fef2f2' },
    ];

    return (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', borderTop: '3px solid #3B2D82', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', marginBottom: '1.5rem' }}>
            <style>{`@keyframes edlPulse{0%,100%{opacity:1}50%{opacity:.45}} .edl-pulse{animation:edlPulse 1.2s ease-in-out infinite}`}</style>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={18} color="#3B2D82" /> Email Delivery
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 8px' }}>
                        <span className="edl-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} /> Live
                    </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#888' }}>Updates automatically</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '14px 1.5rem 4px' }}>
                {tiles.map(t => (
                    <div key={t.label} style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <t.icon size={18} color={t.color} />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111', lineHeight: 1.1 }}>{t.n}</div>
                            <div style={{ fontSize: '0.72rem', color: '#888' }}>{t.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {error && <div style={{ padding: '8px 1.5rem', color: '#dc2626', fontSize: '0.8rem' }}>{error}</div>}

            <div style={{ padding: '12px 1.5rem 8px', maxHeight: 460, overflowY: 'auto' }}>
                {batches.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>
                        No emails sent yet. Once you send a notification, delivery progress appears here.
                    </div>
                ) : batches.slice(0, 12).map((b, i) => <BatchCard key={b.key} batch={b} defaultOpen={i === 0} />)}
            </div>
        </div>
    );
}
