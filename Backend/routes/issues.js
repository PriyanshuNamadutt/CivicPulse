const express = require('express');
const router = express.Router();
const { analyzeIssue, reportIssue, getIssues, getIssue, upvoteIssue, getStats } = require('../controllers/issueController');
const { protect, optionalAuth, requireEmailVerified, requireAadhaarVerified } = require('../middleware/auth');
const { issueUpload } = require('../middleware/upload');

// ── Specific named routes BEFORE /:issueId ────────────────────────────────────
router.get('/stats/summary', getStats);

// Step 1 — "AI Analysis" button: media + location → AI analysis + authority
// resolution + duplicate check. Returns a preview, does NOT create the issue.
router.post('/analyze',
  protect,
  requireEmailVerified,
  requireAadhaarVerified,
  issueUpload.array('media', 3),
  analyzeIssue
);

// Step 2 — "Submit Issue" button: takes the (optionally edited) analysis
// object from step 1 and creates the issue. No file upload here — media is
// already on Cloudinary from the /analyze call.
router.post('/',
  protect,
  requireEmailVerified,
  requireAadhaarVerified,
  reportIssue
);

// Public routes
router.get('/', optionalAuth, getIssues);
router.get('/:issueId', optionalAuth, getIssue);
router.post('/:issueId/upvote', protect, upvoteIssue);

module.exports = router;
