import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: 80, marginBottom: 16 }}>🏛️</div>
        <h1 style={{ fontSize: 72, margin: '0 0 8px', color: '#e2e8f0', fontFamily: 'Space Grotesk', fontWeight: 900 }}>404</h1>
        <h2 style={{ fontSize: 24, margin: '0 0 12px', color: '#1e3a5f' }}>Page Not Found</h2>
        <p style={{ color: '#64748b', marginBottom: 32, lineHeight: 1.6 }}>
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">← Go Back</button>
          <Link to="/" className="btn btn-primary">🏠 Go Home</Link>
        </div>
      </div>
    </div>
  );
}
