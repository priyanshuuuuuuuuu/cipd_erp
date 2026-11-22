'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';

export default function AttendanceQrDisplay({ sessionId, onClose }) {
  const [data, setData] = useState(null);
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const next = await api.get(`/api/admin/attendance/qr?session_id=${encodeURIComponent(sessionId)}`);
        const url = await QRCode.toDataURL(JSON.stringify(next.token), { width: 360, margin: 2, errorCorrectionLevel: 'M' });
        if (live) { setData(next); setImage(url); setError(''); }
      } catch (e) { if (live) { setError(e.message); setData(null); setImage(''); } }
      finally { busy = false; }
    };
    refresh();
    const interval = setInterval(refresh, 1500);
    return () => { live = false; clearInterval(interval); };
  }, [sessionId]);
  return <div role="dialog" aria-modal="true" aria-label="Attendance QR code" style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,.7)', display:'grid', placeItems:'center', padding:20 }}>
    <div style={{ background:'#fff', borderRadius:16, padding:24, width:'min(100%, 450px)', textAlign:'center' }}>
      <h2>{data?.phase === 'start' ? 'Opening attendance' : data?.phase === 'end' ? 'Final attendance' : 'Attendance QR'}</h2>
      <p>Students: open your dashboard and scan this code. {data ? (data.rotationSeconds ? `The code changes every ${data.rotationSeconds} seconds.` : 'The code stays the same during this attendance window for local testing.') : ''}</p>
      {image && <img src={image} alt="Attendance QR code" style={{ width:'min(100%, 360px)' }} />}
      {error && <p role="alert" style={{ color:'#b91c1c' }}>{error}</p>}
      {!image && !error && <p>Loading QR code…</p>}
      <button type="button" onClick={onClose} style={{ padding:'10px 24px', cursor:'pointer' }}>Close</button>
    </div>
  </div>;
}
