import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, X, Camera, Video, Loader, Upload, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { issueAPI } from '../services/api';
import toast from 'react-hot-toast';

// Fix leaflet default marker
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function ReportIssue() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [files,    setFiles]    = useState([]);
  const [previews, setPreviews] = useState([]);
  const [location, setLocation] = useState(null);   // { latitude, longitude }
  const [address,  setAddress]  = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicate,  setDuplicate]  = useState(null); // set when 409 returned

  // Guard: must be verified
  useEffect(() => {
    if (user && (!user.emailVerified || !user.aadhaarVerified)) {
      toast.error('Complete email and Aadhaar verification before reporting.');
      navigate('/verify');
    }
  }, [user, navigate]);

  // ── Media dropzone ──────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted) => {
    const merged = [...files, ...accepted].slice(0, 3);
    setFiles(merged);
    setPreviews(merged.map(f => ({
      url:  URL.createObjectURL(f),
      type: f.type.startsWith('video/') ? 'video' : 'image',
      name: f.name
    })));
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'video/*': ['.mp4', '.mov', '.avi', '.webm'] },
    maxFiles: 3,
    maxSize: 50 * 1024 * 1024
  });

  const removeFile = (i) => {
    const f = files.filter((_, idx) => idx !== i);
    const p = previews.filter((_, idx) => idx !== i);
    setFiles(f);
    setPreviews(p);
  };

  // ── GPS location ────────────────────────────────────────────────────────────
  const getLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported by your browser.');
    setLocLoading(true);
    setDuplicate(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        setLocation({ latitude, longitude });
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const d = await r.json();
          setAddress(d.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        } catch {
          setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
        setLocLoading(false);
      },
      () => { setLocLoading(false); toast.error('Could not get location — please enable location access.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!files.length)  return toast.error('Upload at least one photo or video.');
    if (!location)      return toast.error('Capture your location first.');

    setSubmitting(true);
    setDuplicate(null);
    const tid = toast.loading('Uploading media and analysing with AI…');

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('media', f));
      formData.append('latitude',  location.latitude);
      formData.append('longitude', location.longitude);
      formData.append('address',   address);

      const res = await issueAPI.report(formData);
      toast.dismiss(tid);
      toast.success('Issue reported! 🎉');
      navigate(`/track/${res.data.issue.issueId}`);

    } catch (err) {
      toast.dismiss(tid);
      if (err.response?.status === 409 && err.response.data?.isDuplicate) {
        // Same location + same authority → show the existing issue inline
        setDuplicate(err.response.data);
        toast.error('This issue has already been filed nearby.');
      } else {
        toast.error(err.response?.data?.message || 'Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = files.length > 0 && !!location && !submitting;

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container" style={{ maxWidth: 680 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, marginBottom: 6 }}>📸 Report a Civic Issue</h1>
          <p style={{ color: '#64748b', margin: 0 }}>
            Upload evidence and share your location — AI handles the rest.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── STEP 1: Media ── */}
          <div className="card" style={{ padding: '28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>1</div>
              <h2 style={{ fontSize: 17, margin: 0 }}>Upload Evidence</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 18px 38px' }}>
              Photos or videos of the issue — up to 3 files, 50 MB each.
            </p>

            <div {...getRootProps()} style={{
              border: `2.5px dashed ${isDragActive ? '#2e6da4' : '#cbd5e1'}`,
              borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
              background: isDragActive ? '#e8f4fd' : '#f8fafc', transition: 'all 0.2s'
            }}>
              <input {...getInputProps()} />
              <Upload size={28} color={isDragActive ? '#2e6da4' : '#94a3b8'} style={{ marginBottom: 10 }} />
              <p style={{ fontWeight: 600, color: '#334155', margin: '0 0 4px', fontSize: 14 }}>
                {isDragActive ? 'Drop files here' : 'Drag & drop or click to select'}
              </p>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                JPG · PNG · WebP · MP4 · MOV
              </p>
            </div>

            {previews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
                {previews.map((p, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1', background: '#f1f5f9' }}>
                    {p.type === 'image'
                      ? <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <video src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <div style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '2px 6px' }}>
                      {p.type === 'video' ? <Video size={11} color="white" /> : <Camera size={11} color="white" />}
                    </div>
                    <button onClick={() => removeFile(i)} style={{
                      position: 'absolute', top: 5, right: 5, width: 22, height: 22,
                      background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── STEP 2: Location ── */}
          <div className="card" style={{ padding: '28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>2</div>
              <h2 style={{ fontSize: 17, margin: 0 }}>Share Location</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 18px 38px' }}>
              GPS location routes your issue to the right authority and detects duplicates.
            </p>

            <button
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={getLocation}
              disabled={locLoading}
            >
              {locLoading
                ? <><Loader size={16} className="spin" /> Detecting…</>
                : <><MapPin size={16} /> Use My Current Location</>}
            </button>

            {location && (
              <div style={{ marginTop: 14 }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', marginBottom: 12, fontSize: 13, color: '#166534' }}>
                  ✅ <strong>Location captured</strong><br />
                  <span style={{ color: '#047857', fontSize: 12 }}>{address}</span>
                </div>
                <div style={{ height: 220, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <MapContainer center={[location.latitude, location.longitude]} zoom={16} style={{ height: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[location.latitude, location.longitude]}>
                      <Popup>Issue location</Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>
            )}
          </div>

          {/* ── AI info banner ── */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px', fontSize: 13, color: '#1e40af' }}>
            🤖 <strong>What happens on submit:</strong> AI analyses your photos to detect the issue category, writes a description, identifies the responsible government authority for your location, and emails them directly.
          </div>

          {/* ── Duplicate warning (409 response) ── */}
          {duplicate && (
            <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <AlertTriangle size={20} color="#ea580c" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong style={{ color: '#9a3412', fontSize: 15 }}>This issue is already filed!</strong>
                  <p style={{ color: '#c2410c', fontSize: 13, margin: '4px 0 0' }}>{duplicate.message}</p>
                </div>
              </div>
              {duplicate.existingIssue && (
                <div style={{ background: 'white', border: '1px solid #fed7aa', borderRadius: 10, padding: '14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {duplicate.existingIssue.thumbnail && (
                    <img src={duplicate.existingIssue.thumbnail} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>{duplicate.existingIssue.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                      🏛️ {duplicate.existingIssue.authority || duplicate.existingIssue.department} &nbsp;·&nbsp;
                      👍 {duplicate.existingIssue.upvoteCount} upvotes &nbsp;·&nbsp;
                      Status: <strong>{duplicate.existingIssue.status?.replace(/_/g, ' ')}</strong>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 13, padding: '7px 16px' }}
                      onClick={() => navigate(`/track/${duplicate.existingIssue.issueId}`)}
                    >
                      View & Upvote This Issue →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Submit ── */}
          <div className="card" style={{ padding: '20px 24px', background: canSubmit ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${canSubmit ? '#bbf7d0' : '#e2e8f0'}`, transition: 'all 0.3s' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              <CheckItem done={files.length > 0} label={files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} ready` : 'Upload at least 1 photo or video'} />
              <CheckItem done={!!location}        label={location ? 'Location captured' : 'Capture your GPS location'} />
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
              ⚠️ Your name is shared with the authority. Email, phone, and Aadhaar remain private.
            </div>

            <button
              className={`btn btn-primary btn-lg ${submitting ? 'btn-loading' : ''}`}
              style={{ width: '100%', background: canSubmit ? '#10b981' : undefined, transition: 'background 0.3s' }}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {!submitting && '🚀 Submit Issue Report'}
            </button>
          </div>

        </div>
      </div>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function CheckItem({ done, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        background: done ? '#10b981' : '#e2e8f0', color: done ? 'white' : '#94a3b8',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, transition: 'all 0.3s'
      }}>{done ? '✓' : '○'}</div>
      <span style={{ color: done ? '#166534' : '#64748b', fontWeight: done ? 600 : 400 }}>{label}</span>
    </div>
  );
}
