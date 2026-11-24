import React from 'react';

export function PageHeader({ title, subtitle, eyebrow = 'Faculty portal', children }) {
  return (
    <div className="fp-page-head">
      <div>
        <div className="fp-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Loading({ text = 'Loading…' }) {
  return (
    <div className="fp-loading">
      <div className="fp-spinner" />
      {text}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="fp-empty">
      {Icon && <div className="fp-empty-icon"><Icon size={24} /></div>}
      {title && <b>{title}</b>}
      {children}
    </div>
  );
}

const PILL = {
  scheduled: 'green', completed: 'blue', cancelled: 'red', pending: 'amber',
  approved: 'green', rejected: 'red', present: 'green', partial: 'amber',
  leave: 'violet', absent: 'red', unverified: 'gray',
};
export function StatusPill({ status, label }) {
  const key = String(status || '').toLowerCase();
  return <span className={`fp-pill fp-dot fp-pill-${PILL[key] || 'gray'}`}>{label || status}</span>;
}

export function StatTile({ label, value, icon: Icon, tone = 'violet', note }) {
  return (
    <div className={`fp-stat fp-tile-${tone}`}>
      <div className="fp-stat-top">
        <div className="fp-stat-icon"><Icon size={19} /></div>
        <div className="fp-stat-label">{label}</div>
      </div>
      <div className="fp-stat-value">{value}</div>
      {note && <div className="fp-stat-note">{note}</div>}
    </div>
  );
}

export function Notice({ msg }) {
  if (!msg?.text) return null;
  return <div className={`fp-msg ${msg.type === 'ok' ? 'fp-msg-ok' : 'fp-msg-error'}`}>{msg.text}</div>;
}
