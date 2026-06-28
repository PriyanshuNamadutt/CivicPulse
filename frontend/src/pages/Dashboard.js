import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus } from 'lucide-react';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  reported: '#3b82f6', acknowledged: '#8b5cf6',
  in_progress: '#f59e0b', resolved: '#10b981',
  rejected: '#ef4444', duplicate: '#94a3b8'
};

export default function Dashboard() {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const issuesRes = await userAPI.getMyIssues({ page, limit: 8, ...(filter && { status: filter }) });
        setIssues(issuesRes.data.issues);
        setTotalPages(issuesRes.data.pages);
      } catch { toast.error('Failed to load dashboard'); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [page, filter]);

  const statusData = Object.entries(
    issues.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value, color: STATUS_COLORS[name] || '#94a3b8' }));

  const categoryData = Object.entries(
    issues.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).substring(0, 14), value })).slice(0, 6);

  const statBoxes = [
    { label: 'Total Reported', value: user?.issuesReported || 0, icon: '📋', color: '#2e6da4', bg: '#e8f4fd' },
    { label: 'Resolved', value: user?.issuesResolved || 0, icon: '✅', color: '#10b981', bg: '#f0fdf4' },
    { label: 'Points Earned', value: user?.points || 0, icon: '⭐', color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Badges', value: user?.badges?.length || 0, icon: '🏅', color: '#8b5cf6', bg: '#faf5ff' },
  ];

  return (
    <div style={{ padding: '32px 0 80px' }}>
      <div className="container" style={{ maxWidth: 1000 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, margin: '0 0 4px' }}>📊 My Dashboard</h1>
            <p style={{ color: '#64748b', margin: 0 }}>Welcome back, {user?.name?.split(' ')[0]}!</p>
          </div>
          <Link to="/report" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Report New Issue
          </Link>
        </div>

        {/* Stat boxes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          {statBoxes.map(s => (
            <div key={s.label} className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        {issues.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: 15, margin: '0 0 16px', color: '#1e3a5f' }}>Status Distribution</h3>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name) => [val, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No data yet</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {statusData.map(s => (
                  <span key={s.name} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    {s.name} ({s.value})
                  </span>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: 15, margin: '0 0 16px', color: '#1e3a5f' }}>Issues by Category</h3>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2e6da4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No data yet</div>}
            </div>
          </div>
        )}

        {/* Filter + issues list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 16, margin: 0, color: '#1e3a5f' }}>My Reported Issues</h3>
            <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
              style={{ padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'white', cursor: 'pointer', outline: 'none' }}>
              <option value="">All Status</option>
              <option value="reported">Reported</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : issues.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p>{filter ? `No ${filter.replace('_', ' ')} issues.` : "You haven't reported any issues yet."}</p>
              <Link to="/report" className="btn btn-primary" style={{ marginTop: 8 }}>Report Your First Issue</Link>
            </div>
          ) : (
            <>
              {issues.map(issue => (
                <Link key={issue._id} to={`/track/${issue.issueId}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', gap: 14, alignItems: 'center', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    {/* Status dot */}
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[issue.status] || '#94a3b8', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 3, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        {issue.issueId} · {issue.category?.replace(/_/g, ' ')} ·{' '}
                        {formatDistanceToNow(new Date(issue.reportedAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      <span className={`status-badge severity-${issue.severity}`} style={{ fontSize: 11 }}>{issue.severity}</span>
                      <span className={`status-badge status-${issue.status}`} style={{ fontSize: 11 }}>{issue.status?.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>👍 {issue.upvoteCount || 0}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 20px' }}>
                  <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="btn btn-ghost btn-sm">← Prev</button>
                  <span style={{ padding: '7px 14px', fontSize: 13, color: '#64748b' }}>Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="btn btn-ghost btn-sm">Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}