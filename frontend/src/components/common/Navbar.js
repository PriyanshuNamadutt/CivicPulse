import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, ChevronDown, LogOut, User, BarChart2, Home, AlertTriangle, Map, Trophy } from 'lucide-react';

const CATEGORY_ICONS = {
  road_damage: '🛣️', water_supply: '💧', electricity: '⚡', sanitation: '🚽',
  garbage: '🗑️', street_light: '💡', drainage: '🌊', parks_recreation: '🌳',
  public_property_damage: '🏗️', noise_pollution: '🔊', encroachment: '⛔',
  traffic: '🚦', other: '📋'
};

export const getCategoryIcon = (cat) => CATEGORY_ICONS[cat] || '📋';
export const getCategoryLabel = (cat) => cat?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Other';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setOpen(false); setProfileOpen(false); }, [location]);

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { to: '/', label: 'Home', icon: <Home size={16} /> },
    { to: '/issues', label: 'Track Issues', icon: <Map size={16} /> },
    { to: '/leaderboard', label: 'Leaderboard', icon: <Trophy size={16} /> },
    ...(user ? [{ to: '/report', label: 'Report Issue', icon: <AlertTriangle size={16} />, highlight: true }] : []),
  ];

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 1000,
      background: scrolled ? 'rgba(255,255,255,0.97)' : 'white',
      borderBottom: '1px solid #e2e8f0',
      backdropFilter: 'blur(8px)',
      transition: 'all 0.2s',
      boxShadow: scrolled ? '0 2px 12px rgba(0,0,0,0.08)' : 'none'
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', height: 64, justifyContent: 'space-between' }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36, background: 'linear-gradient(135deg, #1e3a5f, #2e6da4)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>🏛️</div>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 20, color: '#1e3a5f' }}>
            Civic<span style={{ color: '#2e6da4' }}>Pulse</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="desktop-nav">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none',
              background: link.highlight ? '#1e3a5f' : isActive(link.to) ? '#e8f4fd' : 'transparent',
              color: link.highlight ? 'white' : isActive(link.to) ? '#1e3a5f' : '#475569',
              transition: 'all 0.15s'
            }}>
              {link.icon} {link.label}
            </Link>
          ))}
        </nav>

        {/* Auth area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user ? (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setProfileOpen(!profileOpen)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8,
                cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#1e3a5f'
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1e3a5f, #2e6da4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, fontWeight: 700
                }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <span className="hide-mobile">{user.name?.split(' ')[0]}</span>
                <span className="hide-mobile" style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                  ⭐ {user.points || 0}
                </span>
                <ChevronDown size={14} color="#64748b" />
              </button>
              {profileOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.12)', minWidth: 180, overflow: 'hidden', zIndex: 999
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f' }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Level {user.level || 1} • {user.points || 0} pts</div>
                  </div>
                  {[
                    { to: '/profile', label: 'Profile & Badges', icon: <User size={14} /> },
                    { to: '/dashboard', label: 'My Issues', icon: <BarChart2 size={14} /> },
                  ].map(item => (
                    <Link key={item.to} to={item.to} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                      fontSize: 14, color: '#334155', textDecoration: 'none', fontWeight: 500
                    }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {item.icon} {item.label}
                    </Link>
                  ))}
                  <button onClick={logout} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', fontSize: 14, color: '#ef4444', background: 'none',
                    border: 'none', cursor: 'pointer', fontWeight: 500, borderTop: '1px solid #f1f5f9'
                  }}>
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm hide-mobile">Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button onClick={() => setOpen(!open)} className="mobile-menu-btn"
            style={{ background: 'none', border: 'none', padding: 6, color: '#1e3a5f', display: 'none' }}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div style={{
          position: 'fixed', top: 64, left: 0, right: 0, bottom: 0,
          background: 'white', zIndex: 999, padding: 20,
          borderTop: '1px solid #e2e8f0', overflowY: 'auto'
        }}>
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              fontSize: 16, fontWeight: 600, color: '#1e3a5f', borderRadius: 10,
              background: isActive(link.to) ? '#e8f4fd' : 'transparent',
              marginBottom: 4, textDecoration: 'none'
            }}>
              {link.icon} {link.label}
            </Link>
          ))}
          {!user && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/login" className="btn btn-secondary">Sign In</Link>
              <Link to="/register" className="btn btn-primary">Create Account</Link>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </header>
  );
}