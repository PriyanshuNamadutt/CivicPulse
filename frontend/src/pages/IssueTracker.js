import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Search, Filter, Map, List, MapPin, ThumbsUp, Clock } from 'lucide-react';
import { issueAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'road_damage', label: '🛣️ Road Damage' },
  { value: 'water_supply', label: '💧 Water Supply' },
  { value: 'electricity', label: '⚡ Electricity' },
  { value: 'sanitation', label: '🚽 Sanitation' },
  { value: 'garbage', label: '🗑️ Garbage' },
  { value: 'street_light', label: '💡 Street Light' },
  { value: 'drainage', label: '🌊 Drainage' },
  { value: 'parks_recreation', label: '🌳 Parks' },
  { value: 'public_property_damage', label: '🏗️ Public Property' },
  { value: 'noise_pollution', label: '🔊 Noise Pollution' },
  { value: 'encroachment', label: '⛔ Encroachment' },
  { value: 'traffic', label: '🚦 Traffic' },
  { value: 'other', label: '📋 Other' },
];

const STATUSES = [
  { value: '', label: 'All Status' },
  { value: 'reported', label: '🔵 Reported' },
  { value: 'acknowledged', label: '🟣 Acknowledged' },
  { value: 'in_progress', label: '🟡 In Progress' },
  { value: 'resolved', label: '🟢 Resolved' },
  { value: 'rejected', label: '🔴 Rejected' },
];

const SEVERITIES = [
  { value: '', label: 'All Severity' },
  { value: 'low', label: '🟢 Low' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'high', label: '🟠 High' },
  { value: 'critical', label: '🔴 Critical' },
];

const STATUS_COLORS = {
  reported: '#3b82f6', acknowledged: '#8b5cf6', in_progress: '#f59e0b',
  resolved: '#10b981', rejected: '#ef4444', duplicate: '#94a3b8',
};

function IssueCard({ issue, onUpvote }) {
  return (
    <div className="card card-hover" style={{ overflow: 'hidden' }}>
      {/* Thumbnail */}
      <div style={{ height: 160, background: '#f1f5f9', position: 'relative', overflow: 'hidden' }}>
        {issue.media?.[0] ? (
          issue.media[0].type === 'image'
            ? <img src={issue.media[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <video src={issue.media[0].url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: '#cbd5e1' }}>📋</div>
        )}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
          <span className={`status-badge status-${issue.status}`}>{issue.status?.replace(/_/g, ' ')}</span>
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <span className={`status-badge severity-${issue.severity}`}>{issue.severity}</span>
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          {issue.category?.replace(/_/g, ' ').toUpperCase()} • {issue.issueId}
        </div>
        <h3 style={{ fontSize: 15, margin: '0 0 8px', lineHeight: 1.4, color: '#1e293b' }}>{issue.title}</h3>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {issue.description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12, color: '#94a3b8' }}>
          <MapPin size={12} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {issue.location?.address || 'Location recorded'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
            {formatDistanceToNow(new Date(issue.reportedAt), { addSuffix: true })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={(e) => { e.preventDefault(); onUpvote(issue.issueId); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              <ThumbsUp size={12} /> {issue.upvoteCount || 0}
            </button>
            <Link to={`/track/${issue.issueId}`} className="btn btn-primary btn-sm">View</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IssueTracker() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [viewMode, setViewMode] = useState('grid'); // grid | map
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    category: searchParams.get('category') || '',
    severity: searchParams.get('severity') || '',
    sort: '-reportedAt',
    page: 1,
  });

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.severity) params.severity = filters.severity;
      params.sort = filters.sort;
      params.page = filters.page;
      params.limit = 12;

      const res = await issueAPI.getAll(params);
      setIssues(res.data.issues);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  // Get user location for map center
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => setUserLocation([20.5937, 78.9629]) // India center fallback
    );
  }, []);

  const handleUpvote = async (issueId) => {
    if (!user) return toast.error('Please login to upvote');
    try {
      const res = await issueAPI.upvote(issueId);
      setIssues(prev => prev.map(i => i.issueId === issueId
        ? { ...i, upvoteCount: res.data.upvoteCount } : i));
    } catch { toast.error('Failed to upvote'); }
  };

  const updateFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value, page: 1 }));
  };

  const selectStyle = {
    padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, fontWeight: 600, background: 'white', cursor: 'pointer', outline: 'none', color: '#334155'
  };

  return (
    <div style={{ padding: '32px 0 80px' }}>
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, marginBottom: 6 }}>🗺️ Issue Tracker</h1>
          <p style={{ color: '#64748b' }}>Browse all reported civic issues in your community</p>
        </div>

        {/* Search + Controls */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input className="form-input" type="text" placeholder="Search by title, ID or description…"
              value={filters.search} onChange={e => updateFilter('search', e.target.value)}
              style={{ paddingLeft: 38 }} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary" style={{ gap: 6 }}>
            <Filter size={14} /> Filters {showFilters ? '▲' : '▼'}
          </button>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2 }}>
            {[['grid', <List size={16} />], ['map', <Map size={16} />]].map(([mode, icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{ padding: '7px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, transition: 'all 0.15s', background: viewMode === mode ? 'white' : 'transparent', color: viewMode === mode ? '#1e3a5f' : '#64748b', boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {icon} {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <select style={selectStyle} value={filters.status} onChange={e => updateFilter('status', e.target.value)}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select style={selectStyle} value={filters.category} onChange={e => updateFilter('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select style={selectStyle} value={filters.severity} onChange={e => updateFilter('severity', e.target.value)}>
              {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select style={selectStyle} value={filters.sort} onChange={e => updateFilter('sort', e.target.value)}>
              <option value="-reportedAt">Newest First</option>
              <option value="reportedAt">Oldest First</option>
              <option value="-upvoteCount">Most Upvoted</option>
              <option value="-severity">Highest Severity</option>
            </select>
            <button onClick={() => setFilters({ search: '', status: '', category: '', severity: '', sort: '-reportedAt', page: 1 })}
              className="btn btn-ghost btn-sm">Clear All</button>
          </div>
        )}

        {/* Total count */}
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, fontWeight: 600 }}>
          {loading ? 'Loading...' : `${pagination.total} issues found`}
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card" style={{ height: 340, background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                ))}
              </div>
            ) : issues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
                <h3 style={{ color: '#64748b', marginBottom: 8 }}>No issues found</h3>
                <p style={{ fontSize: 14 }}>Try adjusting your filters or <Link to="/report" style={{ color: '#2e6da4' }}>report an issue</Link></p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {issues.map(issue => (
                  <IssueCard key={issue._id} issue={issue} onUpvote={handleUpvote} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 36 }}>
                <button onClick={() => updateFilter('page', filters.page - 1)} disabled={filters.page <= 1}
                  className="btn btn-secondary btn-sm">← Prev</button>
                {[...Array(Math.min(pagination.pages, 7))].map((_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p} onClick={() => updateFilter('page', p)}
                      className={`btn btn-sm ${filters.page === p ? 'btn-primary' : 'btn-ghost'}`}>{p}</button>
                  );
                })}
                <button onClick={() => updateFilter('page', filters.page + 1)} disabled={filters.page >= pagination.pages}
                  className="btn btn-secondary btn-sm">Next →</button>
              </div>
            )}
          </>
        )}

        {/* Map View */}
        {viewMode === 'map' && (
          <div style={{ height: 600, borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            {userLocation ? (
              <MapContainer center={userLocation} zoom={13} style={{ height: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap contributors" />
                {issues.map(issue => {
                  if (!issue.location?.coordinates) return null;
                  const [lng, lat] = issue.location.coordinates;
                  const color = STATUS_COLORS[issue.status] || '#64748b';
                  const icon = L.divIcon({
                    className: '',
                    html: `<div style="width:32px;height:32px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                  });
                  return (
                    <Marker key={issue._id} position={[lat, lng]} icon={icon}>
                      <Popup>
                        <div style={{ minWidth: 200, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{issue.title}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{issue.issueId}</div>
                          <span className={`status-badge status-${issue.status}`}>{issue.status?.replace(/_/g, ' ')}</span>
                          <br /><br />
                          <Link to={`/track/${issue.issueId}`} style={{ color: '#2e6da4', fontWeight: 600, fontSize: 13 }}>View Details →</Link>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes shimmer { to { background-position: -200% 0; } }`}</style>
    </div>
  );
}