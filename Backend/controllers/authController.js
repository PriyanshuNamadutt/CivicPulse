const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { sendOTPEmail } = require('../services/emailService');
const { awardPoints } = require('../services/gamificationService');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
});

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    if (!name || !email || !password || !phoneNumber) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({ name, email: email.toLowerCase(), password, phoneNumber });

    // Award early adopter badge if user count < 100
    const userCount = await User.countDocuments();
    if (userCount <= 100) {
      const badge = { name: 'Early Adopter', description: 'One of the first citizens to join CivicPulse', icon: '🚀', type: 'early_adopter', earnedAt: new Date() };
      user.badges.push(badge);
      user.points += 150;
      await user.save();
    }

    // Send email verification OTP
    const otp = generateOTP();
    await OTP.create({ email: user.email, otp, purpose: 'email_verification' });
    await sendOTPEmail(user.email, otp, 'email_verification');

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please verify your email.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        points: user.points,
        level: user.level,
        badges: user.badges
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        aadhaarVerified: user.aadhaarVerified,
        points: user.points,
        level: user.level,
        badges: user.badges,
        issuesReported: user.issuesReported,
        issuesResolved: user.issuesResolved
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// POST /api/auth/send-otp
const sendOTP = async (req, res) => {
  try {
    const { purpose } = req.body;
    const email = req.user?.email || req.body.email;

    if (!email) return res.status(400).json({ success: false, message: 'Email required.' });

    // Rate limit: max 3 OTPs per 15 min
    const recentOtps = await OTP.countDocuments({
      email,
      purpose,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    });

    if (recentOtps >= 3) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Please wait 15 minutes.' });
    }

    const otp = generateOTP();
    await OTP.create({ email, otp, purpose });
    await sendOTPEmail(email, otp, purpose);

    res.json({ success: true, message: 'OTP sent to your email.' });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP.' });
  }
};

// POST /api/auth/verify-otp
const verifyOTP = async (req, res) => {
  try {
    const { otp, purpose } = req.body;
    const email = req.user?.email || req.body.email;

    if (!otp || !purpose) return res.status(400).json({ success: false, message: 'OTP and purpose required.' });

    const otpRecord = await OTP.findOne({
      email,
      otp,
      purpose,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Mark as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // If email verification, update user
    if (purpose === 'email_verification' && req.user) {
      await User.findByIdAndUpdate(req.user._id, { emailVerified: true });
      // Award verified citizen badge
      await awardPoints(req.user._id, 'profile_complete');
    }

    res.json({ success: true, message: 'OTP verified successfully.', verified: true });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP.' });
  }
};

// POST /api/auth/verify-aadhaar
const verifyAadhaar = async (req, res) => {
  try {
    const { aadhaarNumber } = req.body;

    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({ success: false, message: 'Valid 12-digit Aadhaar number required.' });
    }

    // NOTE: In production, integrate with UIDAI Aadhaar verification API
    // For demo: basic validation (Verhoeff algorithm check can be added)
    // Simulate verification delay
    await new Promise(r => setTimeout(r, 1000));

    // Mock: Aadhaar numbers starting with 0 or 1 are invalid
    if (aadhaarNumber.startsWith('0') || aadhaarNumber.startsWith('1')) {
      return res.status(400).json({ success: false, message: 'Invalid Aadhaar number.' });
    }

    // Store encrypted aadhaar (only last 4 digits visible)
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { aadhaarVerified: true, aadhaarNumber },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Aadhaar verified successfully.',
      aadhaarVerified: true,
      maskedAadhaar: `XXXX-XXXX-${aadhaarNumber.slice(-4)}`
    });
  } catch (error) {
    console.error('Aadhaar verify error:', error);
    res.status(500).json({ success: false, message: 'Aadhaar verification failed.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      emailVerified: req.user.emailVerified,
      aadhaarVerified: req.user.aadhaarVerified,
      points: req.user.points,
      level: req.user.level,
      badges: req.user.badges,
      issuesReported: req.user.issuesReported,
      issuesResolved: req.user.issuesResolved,
      createdAt: req.user.createdAt
    }
  });
};

module.exports = { register, login, sendOTP, verifyOTP, verifyAadhaar, getMe };
