const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Issue = require('../models/Issue');
const { getLevelName } = require('../services/gamificationService');

// GET /api/users/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('name points level badges issuesReported issuesResolved createdAt')
      .sort('-points')
      .limit(20)
      .lean();

    res.json({
      success: true,
      leaderboard: users.map((u, index) => ({
        rank: index + 1,
        name: u.name,
        points: u.points,
        level: u.level,
        levelName: getLevelName(u.level),
        badgeCount: u.badges?.length || 0,
        issuesReported: u.issuesReported || 0,
        issuesResolved: u.issuesResolved || 0,
        topBadge: u.badges?.sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt))[0]
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard.' });
  }
});

// GET /api/users/profile - own profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = req.user;
    const myIssues = await Issue.find({ reporterId: user._id })
      .select('issueId title category status severity reportedAt upvoteCount')
      .sort('-reportedAt')
      .limit(10);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        aadhaarVerified: user.aadhaarVerified,
        points: user.points,
        level: user.level,
        levelName: getLevelName(user.level),
        badges: user.badges,
        issuesReported: user.issuesReported,
        issuesResolved: user.issuesResolved,
        createdAt: user.createdAt
      },
      recentIssues: myIssues
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
});

// GET /api/users/my-issues
router.get('/my-issues', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { reporterId: req.user._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [issues, total] = await Promise.all([
      Issue.find(query).sort('-reportedAt').skip(skip).limit(parseInt(limit)).lean(),
      Issue.countDocuments(query)
    ]);

    res.json({ success: true, issues, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch issues.' });
  }
});

module.exports = router;
