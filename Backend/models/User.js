const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const badgeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  icon: String,
  earnedAt: { type: Date, default: Date.now },
  type: {
    type: String,
    enum: ['first_report', 'five_reports', 'ten_reports', 'twenty_five_reports',
      'fifty_reports', 'hundred_reports', 'issue_resolved', 'five_resolved',
      'community_hero', 'early_adopter', 'verified_citizen'],
  }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian mobile number']
  },
  aadhaarNumber: {
    type: String,
    select: false,
    match: [/^\d{12}$/, 'Aadhaar must be 12 digits']
  },
  aadhaarVerified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  profilePhoto: String,
  role: {
    type: String,
    enum: ['citizen', 'admin', 'authority'],
    default: 'citizen'
  },
  authorityDepartment: String, // for authority role
  authorityEmail: String,
  // OTP fields
  emailOtp: { type: String, select: false },
  emailOtpExpiry: { type: Date, select: false },
  // Gamification
  points: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  badges: [badgeSchema],
  issuesReported: { type: Number, default: 0 },
  issuesResolved: { type: Number, default: 0 },
  // Reset password
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpiry: { type: Date, select: false },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Calculate level based on points
userSchema.methods.calculateLevel = function () {
  const thresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (this.points >= thresholds[i]) {
      this.level = i + 1;
      break;
    }
  }
};

module.exports = mongoose.model('User', userSchema);
