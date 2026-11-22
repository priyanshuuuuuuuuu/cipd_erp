'use client';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function StudentInstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (standalone) return;
    if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    const onPrompt = (event) => { event.preventDefault(); setPrompt(event); };
    const onInstalled = () => { setPrompt(null); setHidden(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (hidden || (!prompt && !ios)) return null;
  return <div className="student-install-card">
    <div className="student-install-icon"><Download size={19} /></div>
    <div className="student-install-copy"><strong>CiPD 360 on your home screen</strong><span>{ios ? 'In Safari, tap Share, then Add to Home Screen.' : 'Open your dashboard like an app.'}</span></div>
    {prompt && <button type="button" onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>Install</button>}
    <button type="button" className="student-install-dismiss" aria-label="Dismiss install prompt" onClick={() => setHidden(true)}><X size={17} /></button>
  </div>;
}
