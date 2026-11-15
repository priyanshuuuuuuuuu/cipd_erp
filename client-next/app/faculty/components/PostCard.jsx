'use client';

import React from 'react';
import { Megaphone, FileText, Link as LinkIcon, ClipboardList, Pin, ExternalLink } from 'lucide-react';

const META = {
  announcement: { icon: Megaphone, color: '#7c3aed', label: 'Announcement' },
  material: { icon: FileText, color: '#2563eb', label: 'Material' },
  link: { icon: LinkIcon, color: '#0891b2', label: 'Link' },
  assignment: { icon: ClipboardList, color: '#ea580c', label: 'Assignment' },
};

export const formatDateTime = (v) => {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** One item of a module stream. `actions` is an optional node rendered at the top-right (faculty controls). */
export default function PostCard({ post, actions, footer }) {
  const m = META[post.type] || META.announcement;
  const Icon = m.icon;
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderLeft: `4px solid ${m.color}`, borderRadius: 12, padding: '1rem 1.2rem', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <Icon size={18} color={m.color} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6, wordBreak: 'break-word' }}>
              {post.title}{post.pinned && <Pin size={13} color="#888" />}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 2 }}>
              {m.label}{post.author?.name ? ` · ${post.author.name}` : ''} · {formatDateTime(post.created_at)}
            </div>
          </div>
        </div>
        {actions}
      </div>

      {post.body && <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{post.body}</div>}

      {post.assignment && (
        <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#9a3412', background: '#fff7ed', borderRadius: 8, padding: '6px 10px', display: 'inline-block' }}>
          {post.assignment.due_date ? `Due ${formatDateTime(post.assignment.due_date)}` : 'No due date'} · {post.assignment.total_marks} marks
          {post.assignment.allow_late === false ? ' · no late submissions' : ''}
        </div>
      )}

      {(post.file_url || post.link_url) && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {post.file_url && (
            <a href={post.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 8, padding: '6px 10px', textDecoration: 'none' }}>
              <FileText size={14} /> Open file
            </a>
          )}
          {post.link_url && (
            <a href={post.link_url} target="_blank" rel="noopener noreferrer nofollow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: '#0e7490', border: '1px solid #cffafe', background: '#ecfeff', borderRadius: 8, padding: '6px 10px', textDecoration: 'none', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <ExternalLink size={14} /> {post.link_url}
            </a>
          )}
        </div>
      )}
      {footer}
    </div>
  );
}
