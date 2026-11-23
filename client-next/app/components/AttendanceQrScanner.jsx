'use client';
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { api } from '@/lib/api';

export default function AttendanceQrScanner({ onClose }) {
  const video = useRef(null);
  const [message, setMessage] = useState('Point your camera at the attendance QR code.');
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true, stream, timer, sending = false;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS (or localhost) and a supported browser.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        video.current.srcObject = stream;
        await video.current.play();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        timer = setInterval(async () => {
          if (sending || !video.current?.videoWidth) return;
          canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
          ctx.drawImage(video.current, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, canvas.width, canvas.height);
          if (!code) return;
          let token;
          try { token = JSON.parse(code.data); } catch { return; }
          if (!token.sessionId || !token.signature) return;
          sending = true;
          try {
            const result = await api.post('/api/students/attendance/qr', { token });
            if (alive) { setMessage(result.message); setDone(true); }
            clearInterval(timer); stream.getTracks().forEach(t => t.stop());
          } catch (e) {
            if (alive) setMessage(e.message || 'Scan failed. Try the current QR again.');
            setTimeout(() => { sending = false; }, 1500);
          }
        }, 400);
      } catch (e) {
        stream?.getTracks().forEach(t => t.stop());
        if (alive) setMessage(e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings and try again.' : (e.message || 'Unable to access the camera.'));
      }
    }
    start();
    return () => { alive = false; clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  return <div role="dialog" aria-modal="true" aria-label="Scan attendance" style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,.7)', display:'grid', placeItems:'center', padding:16, overflowY:'auto' }}>
    <div style={{ background:'#fff', borderRadius:20, padding:20, width:'min(100%, 460px)', maxHeight:'90dvh', overflowY:'auto', textAlign:'center', boxSizing:'border-box' }}>
      <h2>Scan attendance</h2><p role="status">{message}</p>
      {!done && <video ref={video} playsInline muted style={{ width:'100%', maxHeight:'55dvh', objectFit:'cover', borderRadius:12, background:'#111' }} />}
      <button type="button" onClick={onClose} style={{ minHeight:44, padding:'10px 24px', marginTop:14, border:'1px solid #dce2ee', borderRadius:10, background:'#fff', cursor:'pointer' }}>Close scanner</button>
    </div>
  </div>;
}
