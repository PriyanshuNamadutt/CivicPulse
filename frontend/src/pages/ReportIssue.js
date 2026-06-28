import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {  MapPin, X, AlertTriangle, Loader, Camera, Video, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { issueAPI } from '../services/api';
import toast from 'react-hot-toast';

// Fix leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// const CATEGORY_MAP = {
//   road_damage: { label: 'Road Damage', icon: '🛣️' },
//   water_supply: { label: 'Water Supply', icon: '💧' },
//   electricity: { label: 'Electricity', icon: '⚡' },
//   sanitation: { label: 'Sanitation', icon: '🚽' },
//   garbage: { label: 'Garbage', icon: '🗑️' },
//   street_light: { label: 'Street Light', icon: '💡' },
//   drainage: { label: 'Drainage', icon: '🌊' },
//   parks_recreation: { label: 'Parks', icon: '🌳' },
//   public_property_damage: { label: 'Public Property', icon: '🏗️' },
//   noise_pollution: { label: 'Noise Pollution', icon: '🔊' },
//   encroachment: { label: 'Encroachment', icon: '⛔' },
//   traffic: { label: 'Traffic', icon: '🚦' },
//   other: { label: 'Other', icon: '📋' },
// };

export default function ReportIssue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Media
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  // Description & AI
  const [description, setDescription] = useState('');
  const [aiSuggested, setAiSuggested] = useState(false);

  // Location
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [duplicateAlert, setDuplicateAlert] = useState(null);

  // Guard: must be fully verified to report
  useEffect(() => {
    if (user && (!user.emailVerified || !user.aadhaarVerified)) {
      toast.error('Please complete email and Aadhaar verification before reporting issues.');
      navigate('/register');
    }
  }, [user, navigate]);

  // Media dropzone
  const onDrop = useCallback((accepted) => {
    const newFiles = [...files, ...accepted].slice(0, 3);
    setFiles(newFiles);
    const newPreviews = newFiles.map(f => ({
      url: URL.createObjectURL(f),
      type: f.type.startsWith('video/') ? 'video' : 'image',
      name: f.name,
      size: f.size
    }));
    setPreviews(newPreviews);
    setAiSuggested(false);
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'video/*': ['.mp4', '.mov', '.avi', '.webm'] },
    maxFiles: 3,
    maxSize: 50 * 1024 * 1024
  });

  const removeFile = (idx) => {
    const newFiles = files.filter((_, i) => i !== idx);
    const newPreviews = previews.filter((_, i) => i !== idx);
    setFiles(newFiles);
    setPreviews(newPreviews);
    setAiSuggested(false);
  };

  // AI description from media
  const generateAiDescription = async () => {
    if (!files.length) return toast.error('Upload at least one photo first');
    const imageFile = files.find(f => f.type.startsWith('image/'));
    if (!imageFile) return toast.error('Add at least one image for AI description');
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('media', imageFile);
      const res = await issueAPI.analyzeMedia(formData);
      const data = res.data;
      // Backend returns both 'description' and 'aiDescription' — use whichever is populated
      const suggested = data?.description || data?.aiDescription || '';
      if (suggested) {
        setDescription(suggested);
        setAiSuggested(true);
        const categoryLabel = data?.category ? ` (${data.category.replace(/_/g, ' ')})` : '';
        toast.success(`AI description generated${categoryLabel} ✨ Feel free to edit it.`);
      } else {
        toast.error('AI returned empty description — please write one manually.');
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'AI analysis unavailable. Please write a description manually.';
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  };

  // Geolocation
  const getLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported');
    setLocLoading(true);
    setDuplicateAlert(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ latitude, longitude });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          setAddress(data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        } catch {
          setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
        try {
          const dupRes = await issueAPI.checkDuplicate({ latitude, longitude });
          if (dupRes.data.isDuplicate) setDuplicateAlert(dupRes.data);
        } catch {}
        setLocLoading(false);
      },
      () => {
        setLocLoading(false);
        toast.error('Could not get location. Please enable location access.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Submit
  const handleSubmit = async () => {
    if (!files.length) return toast.error('Please upload at least one photo or video');
    if (!location) return toast.error('Location is required — click "Use My Location"');
    if (!description.trim() || description.trim().length < 10) return toast.error('Please add a description (min 10 characters)');

    setLoading(true);
    const toastId = toast.loading('Submitting issue report...');
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('media', f));
      formData.append('description', description);
      formData.append('latitude', location.latitude);
      formData.append('longitude', location.longitude);
      formData.append('address', address);

      const res = await issueAPI.report(formData);
      toast.dismiss(toastId);
      toast.success('Issue reported successfully! 🎉');
      navigate(`/track/${res.data.issue.issueId}`);
    } catch (err) {
      toast.dismiss(toastId);
      if (err.response?.data?.isDuplicate) {
        setDuplicateAlert(err.response.data);
        toast.error('Duplicate issue detected nearby!');
      } else {
        toast.error(err.response?.data?.message || 'Failed to report issue');
      }
    } finally { setLoading(false); }
  };

  const isReady = files.length > 0 && location && description.trim().length >= 10;

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container" style={{ maxWidth: 700 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>📸 Report a Civic Issue</h1>
          <p style={{ color: '#64748b' }}>Help improve your community by reporting problems</p>
          {user?.aadhaarVerified && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '4px 14px', fontSize: 13, color: '#166534', marginTop: 8 }}>
              ✅ Verified Citizen — you can report issues
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── SECTION 1: MEDIA UPLOAD ── */}
          <div className="card" style={{ padding: '28px 24px' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Camera size={20} /> Upload Evidence
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px' }}>
              Photos or videos help identify the issue. Upload up to 3 files.
            </p>

            <div {...getRootProps()} style={{
              border: `2.5px dashed ${isDragActive ? '#2e6da4' : '#cbd5e1'}`,
              borderRadius: 14, padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
              background: isDragActive ? '#e8f4fd' : '#f8fafc', transition: 'all 0.2s', marginBottom: 16
            }}>
              <input {...getInputProps()} />
              <div style={{ fontSize: 36, marginBottom: 10 }}>{isDragActive ? '📂' : '📁'}</div>
              <p style={{ fontWeight: 600, color: '#334155', margin: '0 0 4px' }}>
                {isDragActive ? 'Drop files here' : 'Drag & drop or click to select'}
              </p>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                JPG, PNG, WebP, MP4, MOV — max 50MB each, up to 3 files
              </p>
            </div>

            {/* Previews */}
            {previews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {previews.map((p, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1', background: '#f1f5f9' }}>
                    {p.type === 'image'
                      ? <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <video src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>
                      {p.type === 'video' ? <Video size={12} /> : <Camera size={12} />}
                    </div>
                    <button onClick={() => removeFile(i)} style={{
                      position: 'absolute', top: 4, right: 4, background: '#ef4444', color: 'white',
                      border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SECTION 2: DESCRIPTION + AI ── */}
          <div className="card" style={{ padding: '28px 24px' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} /> Describe the Issue
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px' }}>
              Write what's wrong, or let AI generate a description from your photos.
            </p>

            {/* AI button */}
            <button
              type="button"
              onClick={generateAiDescription}
              disabled={aiLoading || !files.some(f => f.type.startsWith('image/'))}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: aiLoading ? '#f1f5f9' : 'linear-gradient(135deg, #6366f1, #2e6da4)',
                color: aiLoading ? '#94a3b8' : 'white',
                border: 'none', borderRadius: 10, padding: '10px 18px', cursor: aiLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 14, marginBottom: 16, transition: 'all 0.2s'
              }}
            >
              {aiLoading
                ? <><Loader size={15} className="spin" /> Analyzing image...</>
                : <><Sparkles size={15} /> Generate AI Description</>}
            </button>

            {aiSuggested && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#1e40af' }}>
                ✨ AI-generated — review and edit as needed
              </div>
            )}

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Description *</label>
              <textarea className="form-input" rows={5}
                placeholder="Describe the issue in detail. What is wrong? How long has it been like this? Any safety concerns?"
                value={description} onChange={e => { setDescription(e.target.value); setAiSuggested(false); }}
                style={{ resize: 'vertical', minHeight: 110 }} />
              <div style={{ fontSize: 12, color: description.length < 10 ? '#ef4444' : '#94a3b8', marginTop: 4, textAlign: 'right' }}>
                {description.length} / 2000 {description.length < 10 && '(min 10 characters)'}
              </div>
            </div>
          </div>

          {/* ── SECTION 3: LOCATION ── */}
          <div className="card" style={{ padding: '28px 24px' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={20} /> Issue Location
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px' }}>
              GPS location helps route the issue to the right authority and detect duplicates.
            </p>

            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={getLocation} disabled={locLoading}>
              {locLoading
                ? <><Loader size={16} className="spin" /> Detecting location...</>
                : <><MapPin size={16} /> Use My Current Location</>}
            </button>

            {location && (
              <div>
                <div className="alert alert-success" style={{ marginBottom: 14 }}>
                  ✅ <div><strong>Location captured</strong><br /><span style={{ fontSize: 12 }}>{address}</span></div>
                </div>
                <div style={{ height: 240, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <MapContainer center={[location.latitude, location.longitude]} zoom={16} style={{ height: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[location.latitude, location.longitude]}>
                      <Popup>Issue Location</Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>
            )}

            {/* Duplicate warning */}
            {duplicateAlert && (
              <div className="alert alert-warning" style={{ marginTop: 14, flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <strong>Similar issue already reported nearby!</strong>
                    <p style={{ margin: '6px 0 0', fontSize: 13 }}>{duplicateAlert.message || 'An issue with the same department is already open near your location.'}</p>
                    {duplicateAlert.existingIssues?.map(issue => (
                      <div key={issue.issueId} style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 8, padding: '10px', marginTop: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{issue.title}</div>
                        <div style={{ fontSize: 12, color: '#64748b', margin: '2px 0' }}>ID: {issue.issueId} • Dept: {issue.department || issue.category} • Status: {issue.status}</div>
                        <button onClick={() => navigate(`/track/${issue.issueId}`)}
                          className="btn btn-sm btn-primary" style={{ marginTop: 6 }}>View Existing Issue</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── SUBMIT ── */}
          <div className="card" style={{ padding: '24px', background: isReady ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${isReady ? '#bbf7d0' : '#e2e8f0'}`, transition: 'all 0.3s' }}>
            {/* Checklist */}
            <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CheckItem done={files.length > 0} label={files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} uploaded` : 'Upload at least 1 photo/video'} />
              <CheckItem done={description.trim().length >= 10} label={description.trim().length >= 10 ? 'Description added' : 'Add a description (min 10 chars)'} />
              <CheckItem done={!!location} label={location ? 'Location captured' : 'Capture your location'} />
            </div>

            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 13 }}>
              🤖 <strong>AI Analysis:</strong> Our AI will automatically detect the category, severity, and route this to the correct authority.
            </div>

            <div className="alert alert-warning" style={{ marginBottom: 20, fontSize: 13 }}>
              ⚠️ Your name will be shared with the relevant authority. Your Aadhaar, email, and phone remain private.
            </div>

            <button
              className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
              style={{ width: '100%', background: isReady ? '#10b981' : undefined, transition: 'background 0.3s' }}
              onClick={handleSubmit}
              disabled={loading || !isReady}
            >
              {!loading && '🚀 Submit Issue Report'}
            </button>
          </div>

        </div>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CheckItem({ done, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: done ? '#10b981' : '#e2e8f0', color: done ? 'white' : '#94a3b8', fontSize: 12, flexShrink: 0, transition: 'all 0.3s'
      }}>
        {done ? '✓' : '○'}
      </div>
      <span style={{ color: done ? '#166534' : '#64748b', fontWeight: done ? 600 : 400 }}>{label}</span>
    </div>
  );
}