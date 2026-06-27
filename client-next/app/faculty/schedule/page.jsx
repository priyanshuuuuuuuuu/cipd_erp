'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, MapPin, Upload, X, Loader2, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

export default function FacultySchedulePage() {
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

  const statusBadge = (status) => {
    const map = {
      Confirmed: { bg: '#ecfdf5', color: '#166534' },
      Completed: { bg: '#eff6ff', color: '#1d4ed8' },
      Cancelled: { bg: '#fef2f2', color: '#991b1b' },
      Pending: { bg: '#fffbeb', color: '#92400e' },
    };
    const s = map[status] || map.Pending;
    return (
      <span style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: s.bg, color: s.color }}>
        {status}
      </span>
    );
  };

  const inp = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    color: '#333',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const formatDate = (d) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', color: '#111', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calendar size={22} /> My Schedule
      </h1>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8e8e8', borderTop: '3px solid #00A5A0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>No sessions assigned yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  {['Session', 'Course', 'Venue', 'Date', 'Time', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111' }}>{s.title}</td>
                    <td style={{ padding: '12px 16px', color: '#555' }}>{s.course}</td>
                    <td style={{ padding: '12px 16px', color: '#555' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <MapPin size={12} color="#aaa" />{s.venue}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#555' }}>{formatDate(s.date)}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#555' }}>{s.time} – {s.endTime}</td>
                    <td style={{ padding: '12px 16px' }}>{statusBadge(s.status)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => openUpload(s)}
                        className="change-status-btn"
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #2563eb', background: '#eff6ff', cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                        title="Upload session material"
                      >
                        <Upload size={13} /> Material
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {uploadSession && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={closeUpload}
        >
          <div
            style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>Upload Material</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111' }}>{uploadSession.title}</div>
              </div>
              <button onClick={closeUpload} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Title</label>
                <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} style={inp} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Notes (optional)</label>
                <textarea value={uploadContent} onChange={(e) => setUploadContent(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>File</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: '2px dashed #e0e0e0', borderRadius: '10px', padding: '1.2rem', textAlign: 'center', cursor: 'pointer', background: '#fafafa' }}
                >
                  <FileText size={22} color="#bbb" style={{ marginBottom: '6px' }} />
                  <div style={{ fontSize: '0.82rem', color: '#888' }}>
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

              {uploadError && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '10px' }}>{uploadError}</div>}
              {uploadSuccess && <div style={{ color: '#16a34a', fontSize: '0.82rem', marginBottom: '10px' }}>{uploadSuccess}</div>}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeUpload} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                <button
                  type="submit"
                  disabled={uploadLoading}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#111', color: '#fff', cursor: uploadLoading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {uploadLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading...</> : <><Upload size={14} /> Upload</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
