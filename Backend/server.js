require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');

// Routes
const authRoutes   = require('./routes/auth');
const issueRoutes  = require('./routes/issues');
const userRoutes   = require('./routes/users');

const app = express();

app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

const isDev = process.env.NODE_ENV === 'development';

// ─────────────────────────────────────────────────────────────────
// Rate Limiters
// ─────────────────────────────────────────────────────────────────
// General limiter — skips /auth/* so authLimiter handles those
// exclusively (prevents double-counting & false 429s on OTP sends).
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? Infinity : 100,
  skip: (req) => req.path.startsWith('/auth/'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Auth-specific limiter — tight in prod to block OTP/login brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? Infinity : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth requests. Please wait 15 minutes.' }
});
app.use('/api/auth/', authLimiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
if (isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined')); // more useful logs in production
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CivicPulse API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ─────────────────────────────────────────────────────────────────
// SMTP health check — hit this on Render to confirm email works.
// Remove or guard behind admin auth before going to full production.
// ─────────────────────────────────────────────────────────────────
app.get('/api/health/smtp', async (req, res) => {
  try {
    const { Resend } = require('resend');
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ success: false, error: 'RESEND_API_KEY not set' });
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'CivicPulse <onboarding@resend.dev>',
      to: process.env.RESEND_TEST_RECIPIENT || process.env.EMAIL_USER,
      subject: 'CivicPulse Resend health check',
      html: '<p>✅ Resend is connected and working.</p>'
    });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Resend connected', id: data.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Routes
app.use('/api/auth',   authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/users',  userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large. Max 50MB.' });
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.'
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 CivicPulse Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Rate limiting: ${isDev ? 'DISABLED (dev)' : 'ENABLED (prod)'}`);
  console.log(`🔀 Trust proxy: enabled (Render reverse proxy)`);
});

// Start email monitoring (IMAP) after server starts
setTimeout(() => {
  try {
    const { startEmailMonitoring } = require('./services/imapService');
    startEmailMonitoring();
  } catch (err) {
    console.error('Email monitoring startup error:', err.message);
  }
}, 3000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

module.exports = app;
