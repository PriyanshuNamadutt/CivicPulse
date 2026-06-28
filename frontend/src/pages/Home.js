import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { issueAPI } from '../services/api';

const STAT_CARDS = [
  { label: 'Issues Reported', key: 'total', icon: '📋', color: '#2e6da4' },
  { label: 'Issues Resolved', key: 'resolved', icon: '✅', color: '#10b981' },
  { label: 'In Progress', key: 'inProgress', icon: '🔧', color: '#f59e0b' },
  { label: 'Resolution Rate', key: 'resolutionRate', icon: '📊', color: '#8b5cf6', suffix: '%' },
];

const FEATURES = [
  { icon: '📸', title: 'AI-Powered Reporting', desc: 'Upload photos or videos and our AI automatically categorizes your issue and routes it to the right authority.' },
  { icon: '📍', title: 'Smart Geo-Detection', desc: 'Your device location is used to identify nearby issues and prevent duplicate reports.' },
  { icon: '📧', title: 'Direct Authority Notification', desc: 'Issues are automatically emailed to the relevant government department with all proof and details.' },
  { icon: '🤖', title: 'AI Resolution Verification', desc: 'Authorities send proof of resolution. Our AI verifies it and automatically closes the issue.' },
  { icon: '🏆', title: 'Citizen Gamification', desc: 'Earn points, unlock badges, and receive certificates for your community service contributions.' },
  { icon: '🔍', title: 'Public Transparency', desc: 'All issues and their resolution status are publicly visible. No more accountability gaps.' },
];

const CATEGORY_EXAMPLES = [
  { icon: '🛣️', label: 'Road Damage' },
  { icon: '💧', label: 'Water Supply' },
  { icon: '⚡', label: 'Electricity' },
  { icon: '🗑️', label: 'Garbage' },
  { icon: '💡', label: 'Street Lights' },
  { icon: '🌊', label: 'Drainage' },
  { icon: '🌳', label: 'Parks' },
  { icon: '🚦', label: 'Traffic' },
];

export default function Home() {
  const [stats, setStats] = useState({ total: 0, resolved: 0, inProgress: 0, resolutionRate: 0 });

  useEffect(() => {
    issueAPI.getStats().then(res => {
      if (res.data.success) setStats(res.data.stats);
    }).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2e6da4 50%, #1e3a5f 100%)',
        padding: '80px 0 60px', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 40%)'
        }} />
        <div className="container" style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)',
            padding: '6px 16px', borderRadius: 20, marginBottom: 24, backdropFilter: 'blur(8px)'
          }}>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>🇮🇳 Built for Indian Citizens</span>
          </div>
          <h1 style={{ color: 'white', fontSize: 'clamp(32px, 5vw, 58px)', margin: '0 0 20px', lineHeight: 1.2, fontFamily: 'Space Grotesk' }}>
            Your Voice.<br />
            <span style={{ color: '#fbbf24' }}>Real Change.</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 18, maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
            Report civic issues in your community. AI analyzes, categorizes, and routes them to the right authority. Track resolution in real time.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/report" className="btn btn-lg" style={{ background: '#fbbf24', color: '#1e3a5f', fontWeight: 700 }}>
              📸 Report an Issue
            </Link>
            <Link to="/issues" className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '2px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)' }}>
              🗺️ View All Issues
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 0 }}>
            {STAT_CARDS.map((s, i) => (
              <div key={s.key} style={{
                padding: '28px 24px', textAlign: 'center',
                borderRight: i < STAT_CARDS.length - 1 ? '1px solid #f1f5f9' : 'none'
              }}>
                <div style={{ fontSize: 30, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: s.color, fontFamily: 'Space Grotesk', lineHeight: 1 }}>
                  {stats[s.key]?.toLocaleString()}{s.suffix || ''}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section style={{ padding: '56px 0', background: '#f8fafc' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: 8, fontSize: 28 }}>What Can You Report?</h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 36 }}>AI automatically identifies and categorizes your issue</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
            {CATEGORY_EXAMPLES.map(cat => (
              <Link key={cat.label} to={`/issues?category=${cat.label.toLowerCase().replace(' ', '_')}`}
                style={{ textDecoration: 'none' }}>
                <div className="card card-hover" style={{ padding: '20px 10px', textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{cat.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{cat.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '64px 0', background: 'white' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: 8, fontSize: 28 }}>How CivicPulse Works</h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 48, maxWidth: 520, margin: '0 auto 48px' }}>
            Powered by AI and backed by real civic infrastructure
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="card" style={{ padding: '28px 24px' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, marginBottom: 8, color: '#1e3a5f' }}>{f.title}</h3>
                <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works step-by-step */}
      <section style={{ padding: '64px 0', background: 'linear-gradient(135deg, #1e3a5f, #2e6da4)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', color: 'white', marginBottom: 48 }}>Your Issue → Resolution in 4 Steps</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            {[
              { step: '01', icon: '📸', title: 'Report', desc: 'Take photo/video, add description. Your GPS location is captured automatically.' },
              { step: '02', icon: '🤖', title: 'AI Analyzes', desc: 'Gemini AI categorizes the issue, assesses severity, and finds the right authority.' },
              { step: '03', icon: '📧', title: 'Authority Notified', desc: 'Email with all details sent to the concerned department. They reply with updates.' },
              { step: '04', icon: '✅', title: 'Verified & Closed', desc: 'Authority sends proof. AI verifies resolution. Issue automatically marked resolved.' },
            ].map(s => (
              <div key={s.step} style={{ textAlign: 'center', padding: '20px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 8 }}>{s.step}</div>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{s.icon}</div>
                <h3 style={{ color: 'white', fontSize: 18, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 0', background: 'white', textAlign: 'center' }}>
        <div className="container">
          <h2 style={{ fontSize: 32, marginBottom: 12 }}>Ready to Make a Difference?</h2>
          <p style={{ color: '#64748b', fontSize: 16, marginBottom: 32 }}>Join thousands of citizens actively improving their communities.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary btn-lg">Create Free Account</Link>
            <Link to="/issues" className="btn btn-secondary btn-lg">
              Browse Issues <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}