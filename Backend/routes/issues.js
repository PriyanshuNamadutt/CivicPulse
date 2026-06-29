const express = require('express');
const router = express.Router();
const { reportIssue, getIssues, getIssue, upvoteIssue, getStats } = require('../controllers/issueController');
const { protect, optionalAuth, requireEmailVerified, requireAadhaarVerified } = require('../middleware/auth');
const { issueUpload } = require('../middleware/upload');

// ── Specific named routes BEFORE /:issueId ────────────────────────────────────
router.get('/stats/summary', getStats);

// Report issue — one shot: media + location → AI does everything
router.post('/',
  protect,
  requireEmailVerified,
  requireAadhaarVerified,
  issueUpload.array('media', 3),
  reportIssue
);

// Public routes
router.get('/', optionalAuth, getIssues);
router.get('/:issueId', optionalAuth, getIssue);
router.post('/:issueId/upvote', protect, upvoteIssue);

module.exports = router;
