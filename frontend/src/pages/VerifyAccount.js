import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const steps = ['Account', 'Verify Email', 'Verify Aadhaar', 'Done'];

export default function VerifyAccount() {
  const { user, updateUser, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Determine starting step from current user state
  const getInitialStep = () => {
    if (!user) return 1;
    if (!user.emailVerified) return 1;
    if (!user.aadhaarVerified) return 2;
    return 3;
  };

  const [step, setStep] = useState(getInitialStep);
  const [otp, setOtp] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // If user is already fully verified, redirect home
  useEffect(() => {
    if (user?.emailVerified && user?.aadhaarVerified) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Auto-send OTP when arriving at step 1 for the first time
  useEffect(() => {
    if (step === 1 && !otpSent && !user?.emailVerified) {
      sendOtp(false);
    }
  }, [step]); // eslint-disable-line

  const sendOtp = async (showToast = true) => {
    try {
      await authAPI.sendOTP('email_verification');
      setOtpSent(true);
      if (showToast) toast.success('OTP resent to your email!');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send OTP');
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error('Enter the 6-digit OTP');
    setLoading(true);
    try {
      await authAPI.verifyOTP(otp, 'email_verification');
      // Refresh user from server to get updated emailVerified flag
      await refreshUser();
      updateUser({ emailVerified: true });
      setOtp('');
      setStep(2);
      toast.success('Email verified! ✅ Now verify your Aadhaar.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAadhaar = async (e) => {
    e.preventDefault();
    if (!/^\d{12}$/.test(aadhaar)) return toast.error('Enter a valid 12-digit Aadhaar number');
    setLoading(true);
    try {
      await authAPI.verifyAadhaar(aadhaar);
      await refreshUser();
      updateUser({ aadhaarVerified: true });
      setStep(3);
      toast.success('Aadhaar verified! Welcome to CivicPulse 🎉');
      setTimeout(() => navigate('/'), 2500);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Aadhaar verification failed');
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, gap: 0 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i < step ? '#10b981' : i === step ? '#1e3a5f' : '#e2e8f0',
              color: i <= step ? 'white' : '#94a3b8',
              fontWeight: 700, fontSize: 12, flexShrink: 0, transition: 'all 0.3s'
            }}>
              {i < step ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: i <= step ? '#1e3a5f' : '#94a3b8', whiteSpace: 'nowrap' }}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 20, height: 2, background: i < step ? '#10b981' : '#e2e8f0', margin: '0 4px', flexShrink: 0, transition: 'all 0.3s' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <StepIndicator />

        <div className="card" style={{ padding: '36px 32px' }}>

          {/* ── STEP 1: Email OTP ── */}
          {step === 1 && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>📧</div>
                <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>Verify Your Email</h2>
                <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
                  A 6-digit OTP was sent to <strong>{user?.email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyEmail}>
                <div className="form-group">
                  <label className="form-label">Enter OTP</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="• • • • • •"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    style={{ fontSize: 26, fontWeight: 700, textAlign: 'center', letterSpacing: 10 }}
                    autoFocus
                  />
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>
                    {otp.length} / 6
                  </div>
                </div>

                <button
                  type="submit"
                  className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                  style={{ width: '100%', marginBottom: 12 }}
                  disabled={loading || otp.length < 6}
                >
                  {!loading && '✅ Verify Email'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => sendOtp(true)}
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: 14 }}
              >
                Resend OTP
              </button>

              <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
                Check your spam folder if you don't see the email.
              </p>
            </>
          )}

          {/* ── STEP 2: Aadhaar ── */}
          {step === 2 && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>🪪</div>
                <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>Verify Your Aadhaar</h2>
                <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
                  Required to report civic issues and ensure accountability
                </p>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#1e40af' }}>
                🔒 Your Aadhaar is encrypted and <strong>never</strong> shown publicly. Only last 4 digits appear on your profile.
              </div>

              <form onSubmit={handleVerifyAadhaar}>
                <div className="form-group">
                  <label className="form-label">Aadhaar Number *</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Enter 12-digit Aadhaar"
                    maxLength={12}
                    value={aadhaar}
                    onChange={e => setAadhaar(e.target.value.replace(/\D/g, ''))}
                    style={{ fontSize: 20, letterSpacing: 5, textAlign: 'center' }}
                    autoFocus
                  />
                  <div style={{ fontSize: 12, color: aadhaar.length === 12 ? '#10b981' : '#94a3b8', marginTop: 4, textAlign: 'right', fontWeight: aadhaar.length === 12 ? 700 : 400 }}>
                    {aadhaar.length} / 12 digits {aadhaar.length === 12 && '✓'}
                  </div>
                </div>

                <button
                  type="submit"
                  className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                  style={{ width: '100%' }}
                  disabled={loading || aadhaar.length < 12}
                >
                  {loading ? '' : '🪪 Verify Aadhaar'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 12, fontSize: 13, color: '#94a3b8' }}
              >
                Skip for now (you won't be able to report issues)
              </button>
            </>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
              <h2 style={{ color: '#10b981', marginBottom: 8 }}>You're All Set!</h2>
              <p style={{ color: '#64748b', marginBottom: 20 }}>Welcome to CivicPulse. Start making your community better!</p>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, textAlign: 'left', marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: '#166534', margin: '0 0 6px' }}>✅ <strong>Email verified</strong></p>
                <p style={{ fontSize: 13, color: '#166534', margin: 0 }}>✅ <strong>Aadhaar verified</strong> — you can now report civic issues</p>
              </div>

              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Redirecting to home...</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
