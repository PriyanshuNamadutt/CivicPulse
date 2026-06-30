import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cp_token');
      localStorage.removeItem('cp_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// AUTH
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  sendOTP: (purpose) => api.post('/auth/send-otp', { purpose }),
  verifyOTP: (otp, purpose) => api.post('/auth/verify-otp', { otp, purpose }),
  verifyAadhaar: (aadhaarNumber) => api.post('/auth/verify-aadhaar', { aadhaarNumber }),
};

// ISSUES
export const issueAPI = {
  getAll: (params) => api.get('/issues', { params }),
  getOne: (issueId) => api.get(`/issues/${issueId}`),

  // ── Step 1: AI Analysis — media + GPS in, preview out, no DB write ───────
  analyze: (formData) => api.post('/issues/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  // ── Step 2: Final submit — plain JSON { analysis: {...} } ────────────────
  // Renamed from the old single-shot `report` since the flow now requires
  // calling `analyze` first. `report` is kept as an alias below in case
  // anything else in the app still references it directly.
  report: (analysisPayload) => api.post('/issues', analysisPayload),

  upvote: (issueId) => api.post(`/issues/${issueId}/upvote`),
  getStats: () => api.get('/issues/stats/summary'),
};

// USERS
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  getMyIssues: (params) => api.get('/users/my-issues', { params }),
  getLeaderboard: () => api.get('/users/leaderboard'),
};

export default api;
