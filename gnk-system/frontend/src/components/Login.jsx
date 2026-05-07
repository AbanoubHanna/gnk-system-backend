import { useState } from 'react';
import api from '../api';

export default function Login({ onLoginSuccess }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async () => {
    setError('');
    if (!email.includes('@')) {
      setError('⚠️ Please enter a valid company email');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { email });
      if (res.data.success) {
        setStep(2);
      } else {
        setError(res.data.error || 'Failed to send code');
      }
    } catch (err) {
      setError('❌ Connection error. Is the backend running?');
    }
    setLoading(false);
  };

  const verifyCode = async () => {
    setError('');
    if (otp.length !== 6) {
      setError('⚠️ Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, code: otp });
      if (res.data.success) {
        onLoginSuccess(res.data.user);
      } else {
        setError(res.data.error || 'Invalid code');
      }
    } catch (err) {
      setError('❌ Connection error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: '20px', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' }}>
      <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '420px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '4px', color: '#0f172a', marginBottom: '30px' }}>
          GNK <span style={{ fontSize: '12px', color: '#64748b', letterSpacing: '2px', fontWeight: '600' }}>OPERATIONS</span>
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', marginBottom: '20px' }}>{error}</div>}

        {step === 1 ? (
          <div>
            <h2 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '8px' }}>👋 Welcome Back</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Enter your company email to receive an access code.</p>
            
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Email Address</label>
              <input 
                type="email" 
                placeholder="your.name@gnk.group" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
              />
            </div>
            
            <button 
              onClick={sendCode} 
              disabled={loading}
              style={{ width: '100%', padding: '14px', background: loading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '8px' }}>🔐 Enter Code</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
              We sent a 6-digit code to <strong>{email}</strong><br/>
              <span style={{ fontSize: '11px', color: '#2563eb' }}>(Check your backend terminal for the code)</span>
            </p>
            
            <input 
              type="text" 
              placeholder="000000" 
              maxLength="6"
              value={otp} 
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
              style={{ width: '100%', padding: '16px', border: '2px solid #2563eb', borderRadius: '8px', fontSize: '24px', fontWeight: '700', letterSpacing: '10px', textAlign: 'center', outline: 'none', marginBottom: '20px', fontFamily: 'monospace' }}
            />
            
            <button 
              onClick={verifyCode} 
              disabled={loading}
              style={{ width: '100%', padding: '14px', background: loading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>

            <button 
              onClick={() => { setStep(1); setOtp(''); setError(''); }} 
              style={{ marginTop: '20px', background: 'none', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
            >
              ← Change Email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}