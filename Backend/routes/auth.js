const express = require('express');
const router = express.Router();
const { register, login, sendOTP, verifyOTP, verifyAadhaar, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', protect, sendOTP);
router.post('/verify-otp', protect, verifyOTP);
router.post('/verify-aadhaar', protect, verifyAadhaar);
router.get('/me', protect, getMe);

module.exports = router;
