'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Users, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import { PageHeader, Loading, Empty } from '../components/ui';

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
      <PageHeader icon={BookOpen} title="My Modules" subtitle="Courses you teach. Open one to post, share materials and manage assignments." />
      {loading && <Loading />}
      {error && <div className="fp-msg fp-msg-error">{error}</div>}
      {!loading && !error && modules.length === 0 && (
        <div className="fp-card">
          <Empty icon={BookOpen} title="No modules assigned yet">
            Ask the admin to assign you to a module, or you will see it here once you have a scheduled class in it.
          </Empty>
        </div>
      )}
      <div className="fp-modules">
        {modules.map((m) => (
          <div key={m.id} className="fp-card fp-hover fp-module" style={{ marginBottom: 0 }} onClick={() => router.push(`/faculty/modules/${m.id}`)}>
            <div className="fp-module-top" />
            <div className="fp-module-body">
              <div className="fp-module-icon"><BookOpen size={20} /></div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{m.name}</div>
              {m.code && <div style={{ marginTop: 6 }}><span className="fp-tag" style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.72rem' }}>{m.code}</span></div>}
              {m.description && <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 10, lineHeight: 1.5 }}>{m.description}</div>}
              <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem', color: '#64748b', marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Users size={14} color="#3b82f6" />{m.student_count} students</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MessageSquare size={14} color="#555" />{m.post_count} posts</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
