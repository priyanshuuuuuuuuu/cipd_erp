'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Users, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

export default function FacultyModulesPage() {
  const router = useRouter();
  const { authReady } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authReady) return;
    api.get('/api/faculty/modules')
      .then((d) => setModules(d.modules || []))
      .catch((e) => setError(e.message || 'Failed to load modules'))
      .finally(() => setLoading(false));
  }, [authReady]);

  return (
    <>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111', marginBottom: '1.2rem' }}>My Modules</h1>
      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading...</div>}
      {error && <div style={{ color: '#dc2626' }}>{error}</div>}
      {!loading && !error && modules.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '2.5rem', textAlign: 'center', color: '#888' }}>
          No modules assigned yet. Ask the admin to assign you to a module, or you will see it here once you have a scheduled class in it.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {modules.map((m) => (
          <div
            key={m.id}
            onClick={() => router.push(`/faculty/modules/${m.id}`)}
            style={{ background: '#fff', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', borderRadius: 12, padding: '1.1rem 1.2rem', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <BookOpen size={16} color="#00A5A0" />
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{m.name}</div>
            </div>
            {m.code && <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#777', marginBottom: 6 }}>{m.code}</div>}
            {m.description && <div style={{ fontSize: '0.78rem', color: '#666', marginBottom: 10, lineHeight: 1.4 }}>{m.description}</div>}
            <div style={{ display: 'flex', gap: 14, fontSize: '0.76rem', color: '#555' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} />{m.student_count} students</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MessageSquare size={13} />{m.post_count} posts</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
