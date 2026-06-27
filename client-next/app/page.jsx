'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import './Login.css';
import SubBrandText from './components/SubBrandText';
import WelcomeText from './components/WelcomeText';
import PasswordLabelText from './components/PasswordLabelText';
import CardContainer from './components/CardContainer';
import ForgotPasswordText from './components/ForgotPasswordText';
import Button from './components/Button';
import { useAuth } from './contexts/AuthContext';

const inputStyle = {
  width: '100%',
  height: '53px',
  padding: '0px 16px',
  border: '1.2px solid #00bfff',
  boxSizing: 'border-box',
  borderRadius: '14px',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  color: '#000000',
  fontSize: '14px',
  fontFamily: 'DM Sans, sans-serif',
  lineHeight: '18px',
  outline: 'none',
  marginBottom: '10px',
};

const EyeIcon = ({ open }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block' }}
  >
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(identifier.trim(), password);
      if (user.role === 'admin') {
        router.push('/admin');
      } else if (user.role === 'faculty') {
        router.push('/faculty/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

          <form onSubmit={handleLogin} style={{ width: '100%' }} noValidate>
            {/* Identifier field — accepts email OR enrollment number */}
            <div className="form-group">
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#333', display: 'block', marginBottom: '6px', fontFamily: 'DM Sans, sans-serif' }}>
                Email or Enrollment Number
              </label>
              <input
                style={inputStyle}
                type="text"
                placeholder="Enter your email or enrollment no."
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>

            {/* Password field with show/hide toggle */}
            <div className="form-group">
              <PasswordLabelText />
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  style={{ ...inputStyle, paddingRight: '44px', marginBottom: 0 }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-55%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#888',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {/* Keep bottom margin consistent with old InputField */}
              <div style={{ marginBottom: '10px' }} />
            </div>

            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.78rem',
                  color: '#dc2626',
                  marginBottom: '12px',
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            <Button
              label={isLoading ? 'Logging in...' : 'Log in'}
              type="submit"
            />


            <ForgotPasswordText />
          </form>
        </div>
      </CardContainer>
    </div>
  );
};

export default Login;
