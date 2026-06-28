import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const STEPS = ['Account Details', 'Verify Email', 'Verify Aadhaar', 'Done'];
const RESEND_SECONDS = 300;

export default function Register() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phoneNumber: '' });
  const [otp, setOtp] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const { register, updateUser } = useAuth();
  const navigate = useNavigate();

  // Countdown timer
  React.useEffect(() => {
    if (otpTimer <= 0) return;
    const t = setInterval(() => setOtpTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [otpTimer]);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── STEP 0: Create account ────────────────────────────────────────────
  const validate = () => {
    if (!form.name.trim()) return 'Full name is required';
    if (!form.email.match(/^\S+@\S+\.\S+$/)) return 'Valid email is required';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    if (!form.phoneNumber.match(/^[6-9]\d{9}$/)) return 'Valid 10-digit mobile number required';
    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);
    setLoading(true);
    try {
      // Step 1: create account (no OTP sent here)
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phoneNumber: form.phoneNumber,
      });
      // Step 2: send OTP — one call, one OTP in DB
      await authAPI.sendOTP('email_verification');
      setOtpTimer(RESEND_SECONDS);
      toast.success('OTP sent to ' + form.email);
      setStep(1);
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 1: Resend OTP (only called from Resend button) ───────────────
  const handleSendOTP = async () => {
    setLoading(true);
    try {
      await authAPI.sendOTP('email_verification');
      setOtpTimer(RESEND_SECONDS);
      toast.success('OTP resent to ' + form.email);
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to send OTP';
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error('Enter the 6-digit OTP');
    setLoading(true);
    try {
      await authAPI.verifyOTP(otp, 'email_verification');
      updateUser({ emailVerified: true });
      toast.success('Email verified ✅');
      setStep(2);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid or expired OTP');
    } finally { setLoading(false); }
  };

  // ── STEP 2: Aadhaar ───────────────────────────────────────────────────
  const handleVerifyAadhaar = async (e) => {
    e.preventDefault();
    if (!/^\d{12}$/.test(aadhaar)) return toast.error('Enter valid 12-digit Aadhaar number');
    setLoading(true);
    try {
      await authAPI.verifyAadhaar(aadhaar);
      updateUser({ aadhaarVerified: true });
      toast.success('Aadhaar verified ✅');
      setStep(3);
      setTimeout(() => navigate('/'), 2500);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Aadhaar verification failed');
    } finally { setLoading(false); }
  };

  // ── Step bar ──────────────────────────────────────────────────────────
  const StepBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, gap: 0 }}>
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, flexShrink: 0, transition: 'all 0.3s',
              background: i < step ? '#10b981' : i === step ? '#1e3a5f' : '#e2e8f0',
              color: i <= step ? 'white' : '#94a3b8',
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: i === step ? '#1e3a5f' : i < step ? '#10b981' : '#94a3b8' }}
              className="hide-mobile">{s}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ width: 24, height: 2, margin: '0 6px', background: i < step ? '#10b981' : '#e2e8f0', transition: 'all 0.3s', flexShrink: 0 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 500 }}>
        <StepBar />

        <div className="card" style={{ padding: '36px 32px' }}>

          {/* ── STEP 0: Account Details ──────────────────────────────── */}
          {step === 0 && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🏛️</div>
                <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>Create Account</h1>
                <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Join CivicPulse — make your community better</p>
              </div>
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" type="text" placeholder="Rajesh Kumar" autoFocus
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input className="form-input" type="email" placeholder="rajesh@example.com"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className="form-input" style={{ width: 52, flexShrink: 0, color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+91</span>
                    <input className="form-input" type="tel" placeholder="9876543210" maxLength={10}
                      value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value.replace(/\D/g, '') }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
                      value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      style={{ paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password *</label>
                  <input className="form-input" type="password" placeholder="Repeat password"
                    value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                </div>
                <button type="submit" className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                  style={{ width: '100%' }} disabled={loading}>
                  {!loading && <><UserPlus size={16} /> Create Account & Send OTP</>}
                </button>
              </form>
              <p style={{ textAlign: 'center', color: '#64748b', marginTop: 20, fontSize: 14 }}>
                Already have an account? <Link to="/login" style={{ color: '#2e6da4', fontWeight: 600 }}>Sign in</Link>
              </p>
            </>
          )}

          {/* ── STEP 1: Verify Email OTP ─────────────────────────────── */}
          {step === 1 && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📧</div>
                <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>Verify Your Email</h2>
                <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
                  We sent a 6-digit OTP to <strong>{form.email}</strong>
                </p>
              </div>
              <form onSubmit={handleVerifyOTP}>
                <div className="form-group">
                  <label className="form-label">Enter OTP</label>
                  <input className="form-input" type="text" inputMode="numeric" placeholder="• • • • • •"
                    maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    style={{ fontSize: 30, fontWeight: 800, textAlign: 'center', letterSpacing: 14 }} autoFocus />
                </div>
                <button type="submit" className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                  style={{ width: '100%', marginBottom: 12 }} disabled={loading || otp.length < 6}>
                  {!loading && '✅ Verify Email'}
                </button>
                <button type="button" onClick={() => handleSendOTP()}
                  className="btn btn-ghost" style={{ width: '100%', fontSize: 14 }}
                  disabled={otpTimer > 0 || loading}>
                  {otpTimer > 0 ? `Resend in ${fmt(otpTimer)}` : '🔄 Resend OTP'}
                </button>
              </form>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 14 }}>
                Check your spam/junk folder if not received
              </p>
            </>
          )}

          {/* ── STEP 2: Aadhaar Verification ─────────────────────────── */}
          {step === 2 && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>🪪</div>
                <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>Verify Aadhaar</h2>
                <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
                  Required for identity verification. Never shown publicly.
                </p>
              </div>
              <form onSubmit={handleVerifyAadhaar}>
                <div className="form-group">
                  <label className="form-label">Aadhaar Number (12 digits) *</label>
                  <input className="form-input" type="text" inputMode="numeric"
                    placeholder="XXXX XXXX XXXX" maxLength={12}
                    value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/\D/g, ''))}
                    style={{ fontSize: 22, fontWeight: 700, letterSpacing: 6, textAlign: 'center' }} autoFocus />
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                    🔒 Encrypted and stored securely. Your Aadhaar number is never visible to other users or authorities.
                  </p>
                </div>
                <button type="submit" className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                  style={{ width: '100%' }} disabled={loading || aadhaar.length < 12}>
                  {!loading && '🪪 Verify Aadhaar'}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 3: Done ─────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 68, marginBottom: 12 }}>🎉</div>
              <h2 style={{ color: '#10b981', marginBottom: 8 }}>You're fully verified!</h2>
              <p style={{ color: '#64748b', marginBottom: 20 }}>
                Welcome to CivicPulse. You can now report civic issues in your community.
              </p>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
                {[
                  '✅ Email verified',
                  '✅ Aadhaar verified',
                  '🏅 Early Adopter badge earned (if applicable)',
                ].map(l => <p key={l} style={{ fontSize: 13, color: '#166534', margin: '4px 0' }}>{l}</p>)}
              </div>
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Redirecting to home…</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@media(max-width:480px){.hide-mobile{display:none!important}}`}</style>
    </div>
  );
}
