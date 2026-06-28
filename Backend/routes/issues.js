const express = require('express');
const router = express.Router();
const {
  reportIssue, getIssues, getIssue, upvoteIssue, getStats, checkDuplicate, analyzeMedia
} = require('../controllers/issueController');
const { protect, optionalAuth, requireEmailVerified, requireAadhaarVerified } = require('../middleware/auth');
const { issueUpload, memoryUpload } = require('../middleware/upload');

// ─── IMPORTANT: specific routes BEFORE param routes ───────────────────────────

// Stats — must be before /:issueId or Express treats "stats" as an issueId
router.get('/stats/summary', getStats);

// Check duplicate (auth needed to prevent spam)
router.post('/check-duplicate', protect, checkDuplicate);

// AI media analysis — uses memory storage (no Cloudinary upload)
router.post('/analyze-media', protect, memoryUpload.single('media'), analyzeMedia);

// Report issue — email + aadhaar verified citizens only
router.post('/',
  protect,
  requireEmailVerified,
  requireAadhaarVerified,
  issueUpload.array('media', 3),
  reportIssue
);

// Public list & single-issue routes
router.get('/', optionalAuth, getIssues);
router.get('/:issueId', optionalAuth, getIssue);
router.post('/:issueId/upvote', protect, upvoteIssue);

module.exports = router;