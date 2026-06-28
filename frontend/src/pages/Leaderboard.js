import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { userAPI } from '../services/api';
import toast from 'react-hot-toast';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

const LEVEL_NAMES = [
  'Newcomer', 'Observer', 'Concerned Citizen', 'Active Resident',
  'Community Member', 'Civic Advocate', 'City Guardian', 'Urban Hero',
  'Community Champion', 'CivicPulse Legend'
];

export default function Leaderboard() {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userAPI.getLeaderboard()
      .then(res => { setBoard(res.data.leaderboard); setLoading(false); })
      .catch(() => { toast.error('Failed to load leaderboard'); setLoading(false); });
  }, []);

  const top3 = board.slice(0, 3);

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🏆</div>
          <h1 style={{ fontSize: 32, margin: '0 0 8px' }}>Civic Champions</h1>
          <p style={{ color: '#64748b', fontSize: 16 }}>Citizens who are actively making their communities better</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <>
            {/* Top 3 podium */}
            {top3.length >= 3 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 36 }}>
                {/* 2nd place */}
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>🥈</div>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #c0c0c0, #a8a8a8)', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'white', boxShadow: '0 4px 12px rgba(192,192,192,0.5)' }}>
                    {top3[1]?.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', borderRadius: '12px 12px 0 0', padding: '16px 12px', height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#334155', marginBottom: 4 }}>{top3[1]?.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{top3[1]?.points} pts</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{LEVEL_NAMES[Math.min((top3[1]?.level || 1) - 1, 9)]}</div>
                  </div>
                </div>
                {/* 1st place */}
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 40, marginBottom: 6 }}>🥇</div>
                  <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: 'white', boxShadow: '0 6px 20px rgba(251,191,36,0.5)' }}>
                    {top3[0]?.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: '12px 12px 0 0', padding: '20px 12px', height: 130, display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '2px solid #fcd34d' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#92400e', marginBottom: 4 }}>{top3[0]?.name}</div>
                    <div style={{ fontSize: 13, color: '#d97706', fontWeight: 700 }}>{top3[0]?.points} pts</div>
                    <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>{LEVEL_NAMES[Math.min((top3[0]?.level || 1) - 1, 9)]}</div>
                    {top3[0]?.topBadge && <div style={{ fontSize: 16, marginTop: 4 }}>{top3[0].topBadge.icon}</div>}
                  </div>
                </div>
                {/* 3rd place */}
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>🥉</div>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #cd7f32, #b87333)', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'white', boxShadow: '0 4px 12px rgba(205,127,50,0.5)' }}>
                    {top3[2]?.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, #fed7aa, #fdba74)', borderRadius: '12px 12px 0 0', padding: '16px 12px', height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#9a3412', marginBottom: 4 }}>{top3[2]?.name}</div>
                    <div style={{ fontSize: 12, color: '#c2410c' }}>{top3[2]?.points} pts</div>
                  </div>
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '48px 1fr 80px 80px 60px', gap: 12, fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <div>Rank</div>
                <div>Citizen</div>
                <div style={{ textAlign: 'center' }}>Reports</div>
                <div style={{ textAlign: 'center' }}>Resolved</div>
                <div style={{ textAlign: 'right' }}>Points</div>
              </div>
              {board.map((entry, i) => (
                <div key={i} style={{
                  padding: '14px 20px', display: 'grid', gridTemplateColumns: '48px 1fr 80px 80px 60px', gap: 12, alignItems: 'center',
                  borderBottom: i < board.length - 1 ? '1px solid #f8fafc' : 'none',
                  background: i < 3 ? (i === 0 ? '#fffbeb' : i === 1 ? '#f8fafc' : '#fff8f4') : 'white',
                  transition: 'background 0.15s'
                }}>
                  <div style={{ fontWeight: 800, fontSize: 16, textAlign: 'center' }}>
                    {MEDAL[i + 1] || <span style={{ color: '#94a3b8', fontSize: 14 }}>#{i + 1}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: `hsl(${(i * 47) % 360}, 60%, 50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                      {entry.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{entry.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {LEVEL_NAMES[Math.min((entry.level || 1) - 1, 9)]} · Level {entry.level}
                        {entry.topBadge && <span style={{ marginLeft: 6 }}>{entry.topBadge.icon}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 600, color: '#2e6da4', fontSize: 14 }}>{entry.issuesReported}</div>
                  <div style={{ textAlign: 'center', fontWeight: 600, color: '#10b981', fontSize: 14 }}>{entry.issuesResolved}</div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: '#f59e0b', fontSize: 14 }}>⭐ {entry.points}</div>
                </div>
              ))}
              {board.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🏆</div>
                  <p>No citizens on the board yet. Be the first!</p>
                  <Link to="/register" className="btn btn-primary" style={{ marginTop: 8 }}>Join CivicPulse</Link>
                </div>
              )}
            </div>

            {/* CTA */}
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <p style={{ color: '#64748b', marginBottom: 16 }}>Want to see your name here? Start reporting issues!</p>
              <Link to="/report" className="btn btn-primary btn-lg">📸 Report an Issue</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}