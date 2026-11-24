'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, MapPin, Upload, X, Loader2, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { PageHeader, Loading, Empty, StatusPill } from '../components/ui';

export default function FacultySchedulePage() {
  const router = useRouter();
  const { authReady } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadSession, setUploadSession] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/faculty/schedule');
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) fetchSessions();
  }, [authReady, fetchSessions]);

  const openUpload = (session) => {
    setUploadSession(session);
    setUploadTitle(session.title || '');
    setUploadContent('');
    setUploadFile(null);
    setUploadError('');
    setUploadSuccess('');
  };

  const closeUpload = () => {
    setUploadSession(null);
    setUploadError('');
    setUploadSuccess('');
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadSession || !uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Title is required.');
      return;
    }

    setUploadLoading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle.trim());
      formData.append('session_id', uploadSession.id);
      if (uploadContent.trim()) formData.append('content', uploadContent.trim());

      await api.upload('/api/faculty/materials', formData);
      setUploadSuccess('Material uploaded successfully.');
      setTimeout(closeUpload, 1200);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploadLoading(false);
    }
  };

  const formatDate = (d) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <>
      <PageHeader icon={Calendar} title="My Schedule" subtitle={loading ? '' : `${sessions.length} session${sessions.length === 1 ? '' : 's'} assigned to you`} />

      <div className="fp-card">
        {loading ? (
          <Loading text="Loading sessions…" />
        ) : sessions.length === 0 ? (
          <Empty icon={Calendar} title="No sessions yet">Sessions assigned to you will show up here.</Empty>
        ) : (
          <div className="fp-table-wrap">
            <table className="fp-table">
              <thead>
                <tr>
                  {['Session', 'Course', 'Venue', 'Date', 'Time', 'Status', 'Actions'].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="fp-strong">{s.title}</td>
                    <td><span className="fp-tag">{s.course}</span></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={13} color="#94a3b8" />{s.venue}
                      </span>
                    </td>
                    <td className="fp-mono">{formatDate(s.date)}</td>
                    <td className="fp-mono">{s.time} – {s.endTime}</td>
                    <td><StatusPill status={s.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="fp-btn fp-btn-sm" onClick={() => router.push(`/faculty/schedule/${s.id}`)}>Details</button>
                        <button className="fp-btn fp-btn-sm fp-btn-soft" onClick={() => openUpload(s)} title="Upload session material">
                          <Upload size={13} /> Material
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {uploadSession && (
        <div className="fp-overlay" onClick={closeUpload}>
          <div className="fp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fp-modal-head">
              <div>
                <small>Upload Material</small>
                <h3>{uploadSession.title}</h3>
              </div>
              <button className="fp-modal-close" onClick={closeUpload} aria-label="Close"><X size={16} /></button>
            </div>

            <form className="fp-modal-body" onSubmit={handleUploadSubmit}>
              <div className="fp-field">
                <label className="fp-label">Title</label>
                <input type="text" className="fp-input" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} required />
              </div>
              <div className="fp-field">
                <label className="fp-label">Notes (optional)</label>
                <textarea className="fp-input" value={uploadContent} onChange={(e) => setUploadContent(e.target.value)} rows={3} />
              </div>
              <div className="fp-field">
                <label className="fp-label">File</label>
                <div className="fp-drop" onClick={() => fileInputRef.current?.click()}>
                  <FileText size={24} color="#a78bfa" style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
                    {uploadFile ? uploadFile.name : 'Click to select file (PDF, DOC, PPT — max 10MB)'}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                    style={{ display: 'none' }}
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              {uploadError && <div className="fp-msg fp-msg-error" style={{ marginTop: 0, marginBottom: 12 }}>{uploadError}</div>}
              {uploadSuccess && <div className="fp-msg fp-msg-ok" style={{ marginTop: 0, marginBottom: 12 }}>{uploadSuccess}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="fp-btn" onClick={closeUpload}>Cancel</button>
                <button type="submit" className="fp-btn fp-btn-primary" disabled={uploadLoading}>
                  {uploadLoading ? <><Loader2 size={14} style={{ animation: 'fp-spin 1s linear infinite' }} /> Uploading…</> : <><Upload size={14} /> Upload</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
