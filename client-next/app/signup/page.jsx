'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../Login.css';
import CardContainer from '../components/CardContainer';

const PROGRAMS = [
  'B.Tech Computer Science',
  'B.Tech Electronics',
  'B.Tech Mechanical',
  'B.Tech Civil',
  'M.Tech Computer Science',
  'M.Tech Electronics',
  'MBA',
  'MCA',
  'BCA',
  'Other',
];

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successData, setSuccessData] = useState(null); // { enrollmentNo }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email || !form.password) {
      setError('All fields are required.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Signup failed. Please try again.');
        return;
      }

      // Store auth & show success with enrollment number
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccessData({ enrollmentNo: data.enrollmentNo });

      // Redirect after brief delay
      setTimeout(() => router.push('/dashboard'), 2200);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    height: '48px',
    padding: '0px 16px',
    border: '1.2px solid #00bfff',
    boxSizing: 'border-box',
    borderRadius: '14px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    color: '#000',
    fontSize: '14px',
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    marginBottom: '10px',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#000',
    marginBottom: '4px',
    textAlign: 'left',
  };

  return (
    <div className="login-container">
      <CardContainer>
        {/* Logo */}
        <div className="logo-section" style={{ marginBottom: '0' }}>
          <img
            src="/logo.png"
            alt="Centre for Intelligent Product Development"
            className="logo-image"
            style={{ maxWidth: '150px', marginBottom: '6px' }}
          />
          <div style={{ fontSize: '0.72rem', color: '#00AEAE', fontWeight: 500, letterSpacing: '0.5px' }}>
            CIPD 360 — Academic ERP
          </div>
        </div>

        <div style={{ width: '100%', textAlign: 'left', marginTop: '20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#000', marginBottom: '4px' }}>
            Create Account
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#777', marginBottom: '18px' }}>
            Register as a student — your enrollment ID will be generated automatically
          </p>

          {/* Success state */}
          {successData && (
            <div style={{
              background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '10px',
              padding: '12px 16px', fontSize: '0.82rem', color: '#065f46', marginBottom: '12px'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>✓ Account created successfully!</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#d1fae5', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: '#065f46' }}>Your Enrollment ID:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', letterSpacing: '1px', color: '#047857' }}>
                  {successData.enrollmentNo}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6ee7b7' }}>
                Redirecting to dashboard...
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
              padding: '8px 12px', fontSize: '0.78rem', color: '#dc2626', marginBottom: '12px', fontWeight: 500
            }}>
              {error}
            </div>
          )}

          {!successData && (
            <form onSubmit={handleSignup} style={{ width: '100%' }}>
              {/* Name row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={labelStyle}>First Name</label>
                  <input style={inputStyle} placeholder="First name" value={form.firstName} onChange={set('firstName')} />
                </div>
                <div className="form-group">
                  <label style={labelStyle}>Last Name</label>
                  <input style={inputStyle} placeholder="Last name" value={form.lastName} onChange={set('lastName')} />
                </div>
              </div>

              <div className="form-group">
                <label style={labelStyle}>Email Address</label>
                <input style={inputStyle} type="email" placeholder="Enter your college email" value={form.email} onChange={set('email')} />
              </div>

              <div className="form-group">
                <label style={labelStyle}>Password</label>
                <input style={inputStyle} type="password" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} />
              </div>

              <div className="form-group">
                <label style={labelStyle}>Confirm Password</label>
                <input style={inputStyle} type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={set('confirmPassword')} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#f0f9ff', borderRadius: '8px', marginBottom: '10px', fontSize: '0.72rem', color: '#0369a1' }}>
                <span>🎓</span>
                <span>Your enrollment number (e.g. <strong>CiPD_1</strong>) will be auto-generated on signup.</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%', padding: '0.85rem',
                  background: isLoading ? '#aaa' : 'var(--primary-cyan, #00bfff)',
                  color: '#000', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '6px',
                  opacity: isLoading ? 0.7 : 0.9, transition: 'all 0.2s'
                }}
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>

              <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.78rem', color: '#777' }}>
                Already have an account?{' '}
                <span
                  onClick={() => router.push('/')}
                  style={{ color: '#00AEAE', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Log in
                </span>
              </p>
            </form>
          )}
        </div>
      </CardContainer>
    </div>
  );
}
