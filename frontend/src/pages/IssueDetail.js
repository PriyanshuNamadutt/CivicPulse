import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Clock, ThumbsUp, User, CheckCircle, AlertTriangle, Share2, ArrowLeft, Bot, Shield } from 'lucide-react';
import { issueAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_STEPS = [
  { key: 'reported', label: 'Reported', icon: '📋', color: '#3b82f6' },
  { key: 'acknowledged', label: 'Acknowledged', icon: '👁️', color: '#8b5cf6' },
  { key: 'in_progress', label: 'In Progress', icon: '🔧', color: '#f59e0b' },
  { key: 'resolved', label: 'Resolved', icon: '✅', color: '#10b981' },
];

const STATUS_ORDER = { reported: 0, acknowledged: 1, in_progress: 2, resolved: 3, rejected: -1 };

function StatusTimeline({ status }) {
  const currentIdx = STATUS_ORDER[status] ?? 0;
  if (status === 'rejected') {
    return (
      <div className="alert alert-error" style={{ marginBottom: 24 }}>
        <AlertTriangle size={18} />
        <div><strong>Issue Rejected</strong><br /><span style={{ fontSize: 13 }}>This issue was rejected by the authority.</span></div>
      </div>
    );
  }
  return (
    <div style={{ padding: '20px 24px', background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 20px', color: '#1e3a5f' }}>📊 Issue Progress</h3>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {STATUS_STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 'none' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, transition: 'all 0.4s',
                background: i <= currentIdx ? s.color : '#f1f5f9',
                boxShadow: i === currentIdx ? `0 0 0 4px ${s.color}30` : 'none',
                border: `3px solid ${i <= currentIdx ? s.color : '#e2e8f0'}`
              }}>
                {i < currentIdx ? '✓' : s.icon}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: i <= currentIdx ? s.color : '#94a3b8', textAlign: 'center', maxWidth: 64 }}>{s.label}</span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div style={{ flex: 1, height: 3, margin: '0 6px', marginBottom: 20, background: i < currentIdx ? STATUS_STEPS[i + 1]?.color || '#e2e8f0' : '#e2e8f0', transition: 'background 0.4s', borderRadius: 2 }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function UpdateCard({ update }) {
  const authorTypeConfig = {
    authority: { color: '#1e3a5f', bg: '#e8f4fd', icon: <Shield size={14} />, label: 'Authority' },
    ai: { color: '#7c3aed', bg: '#f5f3ff', icon: <Bot size={14} />, label: 'AI System' },
    system: { color: '#059669', bg: '#f0fdf4', icon: <CheckCircle size={14} />, label: 'System' },
    citizen: { color: '#d97706', bg: '#fffbeb', icon: <User size={14} />, label: 'Citizen' },
  };
  const cfg = authorTypeConfig[update.authorType] || authorTypeConfig.citizen;

  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, border: `2px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color }}>
          {cfg.icon}
        </div>
        <div style={{ width: 2, flex: 1, background: '#e2e8f0', marginTop: 6 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: cfg.color }}>{update.author || cfg.label}</span>
          <span style={{ fontSize: 11, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{cfg.label}</span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>
            {formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}
          </span>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
          {update.message}
          {update.aiVerificationNote && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#f5f3ff', borderRadius: 8, fontSize: 13, color: '#7c3aed' }}>
              🤖 <strong>AI Verification:</strong> {update.aiVerificationNote}
            </div>
          )}
        </div>
        {update.media?.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {update.media.map((m, i) => (
              <a key={i} href={m.url} target="_blank" rel="noreferrer"
                style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', width: 100, height: 80 }}>
                {m.type === 'image'
                  ? <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </a>
            ))}
            {update.isResolutionProof && (
              <div className="alert alert-success" style={{ width: '100%', padding: '8px 12px', marginTop: 4 }}>
                <CheckCircle size={14} /> <span style={{ fontSize: 13 }}>Resolution proof provided by authority</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function IssueDetail() {
  const { issueId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upvoted, setUpvoted] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await issueAPI.getOne(issueId);
        setIssue(res.data.issue);
      } catch {
        toast.error('Issue not found');
        navigate('/issues');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [issueId, navigate]);

  const handleUpvote = async () => {
    if (!user) return toast.error('Please login to upvote');
    try {
      const res = await issueAPI.upvote(issueId);
      setUpvoted(res.data.upvoted);
      setIssue(prev => ({ ...prev, upvoteCount: res.data.upvoteCount }));
      toast.success(res.data.upvoted ? 'Upvoted!' : 'Upvote removed');
    } catch { toast.error('Failed to upvote'); }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: issue.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied!');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="spinner" />
    </div>
  );

  if (!issue) return null;

  const coords = issue.location?.coordinates;
  const mapPos = coords ? [coords[1], coords[0]] : null;

  return (
    <div style={{ padding: '32px 0 80px' }}>
      <div className="container" style={{ maxWidth: 860 }}>
        {/* Back */}
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>
          <ArrowLeft size={16} /> Back to Issues
        </button>

        {/* Header card */}
        <div className="card" style={{ padding: '24px 28px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <span className={`status-badge status-${issue.status}`}>{issue.status?.replace(/_/g, ' ')}</span>
            <span className={`status-badge severity-${issue.severity}`}>{issue.severity} severity</span>
            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto', fontFamily: 'monospace', fontWeight: 700, background: '#f1f5f9', padding: '4px 10px', borderRadius: 6 }}>{issue.issueId}</span>
          </div>
          <h1 style={{ fontSize: 24, margin: '0 0 10px', lineHeight: 1.3 }}>{issue.title}</h1>
          <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.7, margin: '0 0 16px' }}>{issue.description}</p>
          {issue.aiDescription && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>🤖 AI ANALYSIS</div>
              <div style={{ fontSize: 14, color: '#4c1d95', lineHeight: 1.6 }}>{issue.aiDescription}</div>
              {issue.aiConfidence && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4 }}>Confidence: {Math.round(issue.aiConfidence * 100)}%</div>}
            </div>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={14} /> Reported by <strong style={{ color: '#334155' }}>{issue.reporterName}</strong></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> {format(new Date(issue.reportedAt), 'dd MMM yyyy, hh:mm a')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> {issue.location?.address || 'Location recorded'}</span>
          </div>

          {/* Authority */}
          {issue.assignedAuthority && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#e8f4fd', borderRadius: 8, fontSize: 13 }}>
              <strong style={{ color: '#1e3a5f' }}>📧 Assigned to:</strong> {issue.assignedAuthority.name} ({issue.assignedAuthority.department})
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={handleUpvote}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${upvoted ? '#3b82f6' : '#e2e8f0'}`, background: upvoted ? '#dbeafe' : 'white', color: upvoted ? '#1d4ed8' : '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: 14, transition: 'all 0.2s' }}>
              <ThumbsUp size={15} fill={upvoted ? '#3b82f6' : 'none'} /> {issue.upvoteCount || 0} Upvotes
            </button>
            <button onClick={handleShare} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Share2 size={15} /> Share
            </button>
          </div>
        </div>

        {/* Status timeline */}
        <StatusTimeline status={issue.status} />

        {/* Resolved banner */}
        {issue.status === 'resolved' && (
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, color: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 40 }}>🎉</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Issue Resolved!</div>
              <div style={{ opacity: 0.9, fontSize: 14 }}>
                Resolved {formatDistanceToNow(new Date(issue.resolvedAt || issue.updatedAt), { addSuffix: true })}. AI verified the resolution.
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
          {/* Updates timeline */}
          <div>
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: 17, margin: '0 0 24px', color: '#1e3a5f' }}>📋 Issue Timeline</h3>
              {issue.updates?.length > 0 ? (
                issue.updates.map((u, i) => <UpdateCard key={i} update={u} />)
              ) : (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No updates yet. Waiting for authority response.</p>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Media */}
            {issue.media?.length > 0 && (
              <div className="card" style={{ padding: '16px' }}>
                <h4 style={{ fontSize: 14, margin: '0 0 12px', color: '#1e3a5f' }}>📸 Evidence</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {issue.media.map((m, i) => (
                    <a key={i} href={m.url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      {m.type === 'image'
                        ? <img src={m.url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                        : <video src={m.url} controls style={{ width: '100%', maxHeight: 140 }} />}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution proof */}
            {issue.resolutionProofUrl && (
              <div className="card" style={{ padding: '16px', border: '2px solid #bbf7d0' }}>
                <h4 style={{ fontSize: 14, margin: '0 0 12px', color: '#059669' }}>✅ Resolution Proof</h4>
                <a href={issue.resolutionProofUrl} target="_blank" rel="noreferrer"
                  style={{ display: 'block', borderRadius: 8, overflow: 'hidden' }}>
                  {issue.resolutionProofType === 'image'
                    ? <img src={issue.resolutionProofUrl} alt="Resolution proof" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                    : <video src={issue.resolutionProofUrl} controls style={{ width: '100%' }} />}
                </a>
                <div style={{ fontSize: 12, color: '#059669', marginTop: 8, fontWeight: 600 }}>🤖 AI Verified Resolution</div>
              </div>
            )}

            {/* Map */}
            {mapPos && (
              <div className="card" style={{ padding: '16px' }}>
                <h4 style={{ fontSize: 14, margin: '0 0 12px', color: '#1e3a5f' }}>📍 Location</h4>
                <div style={{ height: 180, borderRadius: 10, overflow: 'hidden' }}>
                  <MapContainer center={mapPos} zoom={16} style={{ height: '100%' }} zoomControl={false}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={mapPos}>
                      <Popup>{issue.title}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                  {issue.location?.address}
                </div>
              </div>
            )}

            {/* Issue details */}
            <div className="card" style={{ padding: '16px' }}>
              <h4 style={{ fontSize: 14, margin: '0 0 12px', color: '#1e3a5f' }}>📌 Details</h4>
              {[
                ['Category', issue.category?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())],
                ['Department', issue.assignedAuthority?.department],
                ['Severity', issue.severity?.toUpperCase()],
                ['Upvotes', issue.upvoteCount || 0],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}