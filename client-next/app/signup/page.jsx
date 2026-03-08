'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../Login.css';
import CardContainer from '../components/CardContainer';
import { useAuth } from '../contexts/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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

      // Auto-login: store token and redirect
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccess(true);

      // Brief success flash, then redirect
      setTimeout(() => router.push('/dashboard'), 1000);
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
            Register as a student to get started
          </p>

          {success && (
            <div style={{
              background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px',
              padding: '8px 12px', fontSize: '0.78rem', color: '#065f46', marginBottom: '12px', fontWeight: 500
            }}>
              ✓ Account created! Redirecting to dashboard...
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

            <button
              type="submit"
              disabled={isLoading || success}
              style={{
                width: '100%', padding: '0.85rem', background: isLoading || success ? '#aaa' : 'var(--primary-cyan, #00bfff)',
                color: '#000', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600,
                cursor: isLoading || success ? 'not-allowed' : 'pointer', marginTop: '6px',
                opacity: isLoading || success ? 0.7 : 0.9, transition: 'all 0.2s'
              }}
            >
              {isLoading ? 'Creating account...' : success ? 'Done ✓' : 'Create Account'}
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
        </div>
      </CardContainer>
    </div>
  );
}
