import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';

import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyAccount = lazy(() => import('./pages/VerifyAccount'));
const ReportIssue = lazy(() => import('./pages/ReportIssue'));
const IssueTracker = lazy(() => import('./pages/IssueTracker'));
const IssueDetail = lazy(() => import('./pages/IssueDetail'));
const Profile = lazy(() => import('./pages/Profile'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));

const LoadingScreen = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <div className="spinner" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// Only unauthenticated users — if logged in and fully verified, redirect home
// If logged in but NOT verified, let them through (they came from register)
const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && user.emailVerified && user.aadhaarVerified) return <Navigate to="/" replace />;
  return children;
};

function AppRoutes() {
  return (
    <BrowserRouter>
      <Navbar />
      <main style={{ minHeight: 'calc(100vh - 140px)' }}>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
            {/* Verification flow after register — accessible to logged-in unverified users */}
            <Route path="/verify" element={<ProtectedRoute><VerifyAccount /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute><ReportIssue /></ProtectedRoute>} />
            <Route path="/issues" element={<IssueTracker />} />
            <Route path="/track/:issueId" element={<IssueDetail />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '14px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
          }
        }}
      />
    </AuthProvider>
  );
}
