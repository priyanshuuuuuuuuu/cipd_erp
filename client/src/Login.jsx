import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    console.log('Login attempt', { email, password });
    // TODO: Implement actual auth validation
    navigate('/dashboard');
  };

  return (
    <div className="login-container">
      <CardContainer>
        <div className="logo-section" style={{ marginBottom: '0' }}>
          {/* Logo Image directly used here as it's specific */}
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

            <Button label="Log in" type="submit" />

            <ForgotPasswordText />
          </form>
        </div>
      </CardContainer>
    </div>
  );
};

export default Login;
