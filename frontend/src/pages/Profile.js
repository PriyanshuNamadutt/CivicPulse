import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI, authAPI } from '../services/api';
import toast from 'react-hot-toast';

const LEVEL_NAMES = [
  'Newcomer', 'Observer', 'Concerned Citizen', 'Active Resident',
  'Community Member', 'Civic Advocate', 'City Guardian', 'Urban Hero',
  'Community Champion', 'CivicPulse Legend'
];

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];

const ALL_BADGES = [
  { type: 'first_report', name: 'First Reporter', icon: '🌟', desc: 'Report your first civic issue' },
  { type: 'five_reports', name: 'Active Citizen', icon: '📋', desc: 'Report 5 civic issues' },
  { type: 'ten_reports', name: 'Community Guardian', icon: '🛡️', desc: 'Report 10 civic issues' },
  { type: 'twenty_five_reports', name: 'Civic Champion', icon: '🏆', desc: 'Report 25 civic issues' },
  { type: 'fifty_reports', name: 'City Hero', icon: '🦸', desc: 'Report 50 civic issues' },
  { type: 'issue_resolved', name: 'Problem Solver', icon: '✅', desc: 'Get your first issue resolved' },
  { type: 'five_resolved', name: 'Change Maker', icon: '💪', desc: 'Get 5 issues resolved' },
  { type: 'community_hero', name: 'Community Hero', icon: '🌍', desc: 'Get 10 issues resolved' },
  { type: 'early_adopter', name: 'Early Adopter', icon: '🚀', desc: 'One of the first 100 citizens' },
  { type: 'verified_citizen', name: 'Verified Citizen', icon: '✔️', desc: 'Complete identity verification' },
];

function BadgeCard({ badge, earned, earnedBadge }) {
  return (
    <div style={{
      padding: '16px 12px', borderRadius: 12, textAlign: 'center',
      background: earned ? 'linear-gradient(135deg, #fffbeb, #fef3c7)' : '#f8fafc',
      border: `1.5px solid ${earned ? '#fcd34d' : '#e2e8f0'}`,
      opacity: earned ? 1 : 0.55, transition: 'all 0.2s',
      position: 'relative', overflow: 'hidden'
    }}>
      {earned && <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white' }}>✓</div>}
      <div style={{ fontSize: 32, marginBottom: 6 }}>{badge.icon}</div>
      <div style={{ fontWeight: 700, fontSize: 12, color: earned ? '#92400e' : '#64748b', marginBottom: 4 }}>{badge.name}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{badge.desc}</div>
      {earned && earnedBadge?.earnedAt && (
        <div style={{ fontSize: 10, color: '#d97706', marginTop: 6, fontWeight: 600 }}>
          {new Date(earnedBadge.earnedAt).toLocaleDateString('en-IN')}
        </div>
      )}
      {!earned && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>🔒 Not earned yet</div>}
    </div>
  );
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aadhaar, setAadhaar] = useState('');
  const [aadhaarLoading, setAadhaarLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('badges'); // badges | issues | account

  useEffect(() => {
    userAPI.getProfile().then(res => {
      setProfile(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const verifyAadhaar = async () => {
    if (!/^\d{12}$/.test(aadhaar)) return toast.error('Enter valid 12-digit Aadhaar');
    setAadhaarLoading(true);
    try {
      await authAPI.verifyAadhaar(aadhaar);
      updateUser({ aadhaarVerified: true });
      setProfile(p => ({ ...p, user: { ...p.user, aadhaarVerified: true } }));
      toast.success('Aadhaar verified! ✅');
      setAadhaar('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Verification failed');
    } finally { setAadhaarLoading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="spinner" />
    </div>
  );

  const u = profile?.user || user;
  const level = u?.level || 1;
  const points = u?.points || 0;
  const levelName = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || 10000;
  const progressPct = Math.min(100, ((points - currentThreshold) / (nextThreshold - currentThreshold)) * 100);

  const earnedBadgeTypes = new Set(u?.badges?.map(b => b.type));
  const earnedBadgeMap = {};
  u?.badges?.forEach(b => { earnedBadgeMap[b.type] = b; });

  const tabs = [
    { key: 'badges', label: '🏅 Badges' },
    { key: 'issues', label: '📋 My Issues' },
    { key: 'account', label: '⚙️ Account' },
  ];

  return (
    <div style={{ padding: '32px 0 80px' }}>
      <div className="container" style={{ maxWidth: 860 }}>

        {/* Profile header */}
        <div className="card" style={{ padding: '28px', marginBottom: 24, background: 'linear-gradient(135deg, #1e3a5f 0%, #2e6da4 100%)', color: 'white' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, flexShrink: 0 }}>
              {u?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: 'white', fontSize: 24, margin: '0 0 4px' }}>{u?.name}</h1>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginBottom: 12 }}>
                {levelName} · Level {level}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                <span>⭐ {points} points</span>
                <span>📋 {u?.issuesReported || 0} reported</span>
                <span>✅ {u?.issuesResolved || 0} resolved</span>
                <span>🏅 {u?.badges?.length || 0} badges</span>
              </div>
              {/* Level progress */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  <span>Level {level}: {levelName}</span>
                  <span>{points} / {nextThreshold} pts → Level {level + 1}</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', background: '#fbbf24', borderRadius: 4, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification status */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Email Verified', ok: u?.emailVerified, icon: '📧' },
            { label: 'Aadhaar Verified', ok: u?.aadhaarVerified, icon: '🪪' },
          ].map(v => (
            <div key={v.label} style={{
              flex: 1, minWidth: 180, padding: '12px 16px', borderRadius: 10,
              background: v.ok ? '#f0fdf4' : '#fff7ed', border: `1px solid ${v.ok ? '#bbf7d0' : '#fed7aa'}`,
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <span style={{ fontSize: 20 }}>{v.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: v.ok ? '#065f46' : '#9a3412' }}>{v.label}</div>
                <div style={{ fontSize: 12, color: v.ok ? '#059669' : '#ea580c' }}>{v.ok ? 'Verified ✓' : 'Not verified'}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.15s', background: activeTab === t.key ? 'white' : 'transparent', color: activeTab === t.key ? '#1e3a5f' : '#64748b', boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Badges tab */}
        {activeTab === 'badges' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {ALL_BADGES.map(badge => (
                <BadgeCard key={badge.type} badge={badge} earned={earnedBadgeTypes.has(badge.type)} earnedBadge={earnedBadgeMap[badge.type]} />
              ))}
            </div>
            {u?.badges?.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏅</div>
                <p>Start reporting issues to earn your first badge!</p>
                <Link to="/report" className="btn btn-primary" style={{ marginTop: 8 }}>Report an Issue</Link>
              </div>
            )}
          </div>
        )}

        {/* My Issues tab */}
        {activeTab === 'issues' && (
          <div>
            {profile?.recentIssues?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {profile.recentIssues.map(issue => (
                  <Link key={issue.issueId} to={`/track/${issue.issueId}`} style={{ textDecoration: 'none' }}>
                    <div className="card card-hover" style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{issue.title}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{issue.issueId} · {issue.category?.replace(/_/g, ' ')}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>👍 {issue.upvoteCount || 0}</span>
                        <span className={`status-badge status-${issue.status}`}>{issue.status?.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </Link>
                ))}
                <Link to="/dashboard" className="btn btn-secondary" style={{ alignSelf: 'flex-start', marginTop: 8 }}>View All My Issues →</Link>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <p>You haven't reported any issues yet.</p>
                <Link to="/report" className="btn btn-primary" style={{ marginTop: 8 }}>Report Your First Issue</Link>
              </div>
            )}
          </div>
        )}

        {/* Account tab */}
        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: 17, margin: '0 0 18px', color: '#1e3a5f' }}>Account Information</h3>
              {[
                { label: 'Full Name', value: u?.name },
                { label: 'Email', value: u?.email },
                { label: 'Role', value: u?.role?.charAt(0).toUpperCase() + u?.role?.slice(1) },
                { label: 'Member Since', value: u?.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>{row.label}</span>
                  <span style={{ color: '#334155' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Aadhaar verification if not done */}
            {!u?.aadhaarVerified && (
              <div className="card" style={{ padding: '24px', border: '1.5px solid #fed7aa' }}>
                <h3 style={{ fontSize: 16, margin: '0 0 8px', color: '#9a3412' }}>🪪 Verify Aadhaar</h3>
                <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 16px' }}>Aadhaar verification is required to report civic issues.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input className="form-input" type="text" placeholder="12-digit Aadhaar number" maxLength={12}
                    value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/\D/g, ''))} style={{ flex: 1 }} />
                  <button className="btn btn-primary" onClick={verifyAadhaar} disabled={aadhaarLoading || aadhaar.length < 12}>
                    {aadhaarLoading ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, margin: '8px 0 0' }}>Your Aadhaar number is encrypted and never shown publicly.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}