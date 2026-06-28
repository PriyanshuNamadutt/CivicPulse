import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phoneNumber: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    if (!form.name.trim()) return 'Full name is required';
    if (!form.email.match(/^\S+@\S+\.\S+$/)) return 'Valid email required';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    if (!form.phoneNumber.match(/^[6-9]\d{9}$/)) return 'Valid 10-digit Indian mobile number required';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password, phoneNumber: form.phoneNumber });
      toast.success('Account created! Now verify your email and Aadhaar.');
      // Navigate to dedicated verification page — user is now logged in but unverified
      navigate('/verify');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, gap: 0 }}>
          {['Account', 'Verify Email', 'Verify Aadhaar', 'Done'].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i === 0 ? '#1e3a5f' : '#e2e8f0',
                  color: i === 0 ? 'white' : '#94a3b8', fontWeight: 700, fontSize: 12, flexShrink: 0
                }}>{i + 1}</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? '#1e3a5f' : '#94a3b8', whiteSpace: 'nowrap' }}>{s}</span>
              </div>
              {i < 3 && <div style={{ width: 20, height: 2, background: '#e2e8f0', margin: '0 4px', flexShrink: 0 }} />}
            </React.Fragment>
          ))}
        </div>

        <div className="card" style={{ padding: '36px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
            <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>Create Account</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Join CivicPulse — email & Aadhaar verification follows</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" type="text" placeholder="Rajesh Kumar" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input className="form-input" type="email" placeholder="rajesh@example.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="form-input" style={{ width: 52, flexShrink: 0, color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+91</div>
                <input className="form-input" type="tel" placeholder="9876543210" maxLength={10} value={form.phoneNumber}
                  onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value.replace(/\D/g, '') }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input className="form-input" type="password" placeholder="Repeat password" value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
            </div>

            <button type="submit" className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
              style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {!loading && <><UserPlus size={16} /> Create Account & Continue</>}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#64748b', marginTop: 20, fontSize: 14 }}>
            Already have an account? <Link to="/login" style={{ color: '#2e6da4', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
