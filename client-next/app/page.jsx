'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import './Login.css';
import SubBrandText from './components/SubBrandText';
import WelcomeText from './components/WelcomeText';
import EmailLabelText from './components/EmailLabelText';
import PasswordLabelText from './components/PasswordLabelText';
import InputField from './components/InputField';
import Button from './components/Button';
import ForgotPasswordText from './components/ForgotPasswordText';
import CardContainer from './components/CardContainer';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const router = useRouter();

  // Demo credentials
  const demoCredentials = [
    { role: 'Student', email: 'student@cipd.edu', password: '123456', path: '/dashboard', color: '#16a34a', bg: '#ecfdf5' },
    { role: 'Admin', email: 'admin@cipd.edu', password: '123456', path: '/admin', color: '#2563eb', bg: '#eff6ff' },
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    const match = demoCredentials.find(
      (c) => c.email.toLowerCase() === email.toLowerCase() && c.password === password
    );

    if (match) {
      router.push(match.path);
    } else {
      setError('Invalid credentials. Use the demo accounts below.');
    }
  };

  const autoFill = (cred) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setError('');
  };

  return (
    <div className="login-container">
      <CardContainer>
        <div className="logo-section" style={{ marginBottom: '0' }}>
          <img
            src="/logo.png"
            alt="Centre for Intelligent Product Development"
            className="logo-image"
            style={{ maxWidth: '180px', marginBottom: '10px' }}
          />
          <SubBrandText />
        </div>

        <div style={{ width: '100%', textAlign: 'left', marginTop: '30px' }}>
          <WelcomeText />

          <form onSubmit={handleLogin} style={{ width: '100%' }}>
            <div className="form-group">
              <EmailLabelText />
              <InputField
                text="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
            </div>

            <div className="form-group">
              <PasswordLabelText />
              <InputField
                text="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
            </div>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
                padding: '8px 12px', fontSize: '0.78rem', color: '#dc2626', marginBottom: '12px',
                fontWeight: 500
              }}>
                {error}
              </div>
            )}

            <Button label="Log in" type="submit" />

            <ForgotPasswordText />
          </form>
        </div>
      </CardContainer>

      {/* Demo Credentials — floating top-right */}
      <div style={{
        position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
        padding: '14px 16px', borderRadius: '12px',
        background: 'rgba(255,255,255,0.95)', border: '1px solid #e8e8e8',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)',
        maxWidth: '260px'
      }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          Demo Credentials
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {demoCredentials.map((cred, i) => (
            <div
              key={i}
              onClick={() => autoFill(cred)}
              style={{
                padding: '10px 12px', borderRadius: '10px', border: `1px solid ${cred.bg}`,
                background: '#fff', cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = cred.bg; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', background: cred.bg, color: cred.color,
                fontSize: '0.7rem', fontWeight: 800, flexShrink: 0
              }}>
                {cred.role[0]}
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: cred.color }}>{cred.role}</div>
                <div style={{ fontSize: '0.62rem', color: '#888', fontFamily: "'Roboto Mono', monospace" }}>{cred.email}</div>
                <div style={{ fontSize: '0.58rem', color: '#bbb' }}>pw: {cred.password}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.55rem', color: '#ccc', textAlign: 'center', marginTop: '8px' }}>
          Click to auto-fill &amp; login
        </div>
      </div>
    </div>
  );
};

export default Login;
