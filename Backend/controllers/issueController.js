const Issue = require('../models/Issue');
const User = require('../models/User');
const { analyzeIssueMedia, analyzeMediaBuffer } = require('../services/aiService');
const { sendIssueToAuthority } = require('../services/emailService');
const { resolveAuthority } = require('../services/authorityService');
const { getStaticAuthority } = require('../config/authorities');
const { awardPoints } = require('../services/gamificationService');
const geolib = require('geolib');

const DUPLICATE_RADIUS = parseInt(process.env.DUPLICATE_RADIUS_METERS) || 50;

// ── POST /api/issues/check-duplicate ──────────────────────────────────────────
// Duplicate = same location radius AND same assigned department (not just category)
const checkDuplicate = async (req, res) => {
  try {
    const { latitude, longitude, department } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Location required.' });
    }
 
    const query = {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
          $maxDistance: DUPLICATE_RADIUS
        }
      },
      status: { $nin: ['resolved', 'rejected'] }
    };
 
    // Only filter by department when we actually know it (post-AI-analysis)
    if (department) {
      query['assignedAuthority.department'] = department;
    }
 
    const nearbyIssues = await Issue.find(query)
      .select('issueId title category status location reportedAt reporterName media upvoteCount assignedAuthority')
      .limit(5);
 
    if (nearbyIssues.length > 0) {
      return res.json({
        success: true,
        isDuplicate: true,
        message: `A similar issue already exists within ${DUPLICATE_RADIUS}m handled by the same department.`,
        existingIssues: nearbyIssues.map(i => ({
          issueId: i.issueId,
          title: i.title,
          category: i.category,
          status: i.status,
          department: i.assignedAuthority?.department,
          reportedAt: i.reportedAt,
          upvoteCount: i.upvoteCount,
          thumbnail: i.media?.[0]?.url
        }))
      });
    }
    res.json({ success: true, isDuplicate: false });
  } catch (error) {
    console.error('checkDuplicate error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
 
// ── POST /api/issues/analyze-media ───────────────────────────────────────────
// Returns AI description, category, severity from a raw buffer (no Cloudinary yet)
const analyzeMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }
 
    const result = await analyzeMediaBuffer(req.file.buffer, req.file.mimetype);
 
    if (!result.success) {
      return res.status(422).json({
        success: false,
        message: result.error || 'AI analysis failed. Please write a description manually.'
      });
    }
 
    res.json({
      success: true,
      // Return both keys so frontend is unambiguous
      description: result.aiDescription,
      aiDescription: result.aiDescription,
      category: result.category,
      title: result.aiTitle,
      severity: result.severity,
      confidence: result.confidence,
      department: result.department,
      suggestedAction: result.suggestedAction
    });
  } catch (error) {
    console.error('analyzeMedia error:', error);
    res.status(500).json({ success: false, message: 'AI analysis failed.' });
  }
};

// POST /api/issues - Report new issue
const reportIssue = async (req, res) => {
  try {
    const { description, latitude, longitude, address, ward, city, state, pincode } = req.body;

    // OTP verification is done once at registration — no per-report OTP needed.
    // Only Aadhaar must be verified (completed during registration).
    if (!req.user.aadhaarVerified) {
      return res.status(403).json({
        success: false,
        message: 'Aadhaar verification is required to report issues.',
        code: 'AADHAAR_REQUIRED'
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Location is required.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one photo or video is required.' });
    }

    // Build media array
    const media = req.files.map(file => ({
      url: file.path,
      type: file.mimetype.startsWith('video/') ? 'video' : 'image',
      publicId: file.filename
    }));

    // AI Analysis
    const aiResult = await analyzeIssueMedia(media, description);

    // Resolve authority — AI looks up real government contact by location,
    // falls back to static map if AI fails or returns low-confidence result.
    const authority = await resolveAuthority(
      aiResult.category,
      parseFloat(latitude),
      parseFloat(longitude),
      address,
      getStaticAuthority(aiResult.category)
    );

    console.log(`[Issue] Authority resolved via "${authority.source}": ${authority.name} <${authority.email}>`);

    // Final duplicate check
      const nearbyDuplicate = await Issue.findOne({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
          $maxDistance: DUPLICATE_RADIUS
        }
      },
      'assignedAuthority.department': authority.department,
      status: { $nin: ['resolved', 'rejected'] }
    });
 
    if (nearbyDuplicate) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: `A ${authority.department} issue already exists near your location. Consider upvoting it instead.`,
        existingIssue: {
          issueId: nearbyDuplicate.issueId,
          title: nearbyDuplicate.title,
          category: nearbyDuplicate.category,
          status: nearbyDuplicate.status,
          department: nearbyDuplicate.assignedAuthority?.department
        }
      });
    }

    // Create issue
    const issue = await Issue.create({
      title: aiResult.aiTitle || description.substring(0, 100),
      description,
      category: aiResult.category,
      aiCategory: aiResult.category,
      aiDescription: aiResult.aiDescription,
      aiConfidence: aiResult.confidence,
      severity: aiResult.severity || 'medium',
      reporterName: req.user.name,
      reporterId: req.user._id,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        address: address || 'Location provided',
        ward, city, state, pincode
      },
      media,
      assignedAuthority: authority,
      updates: [{
        message: `Issue reported by ${req.user.name}. AI Analysis: ${aiResult.aiDescription || 'Issue categorized as ' + aiResult.category}`,
        author: 'CivicPulse AI',
        authorType: 'ai'
      }]
    });

    // Send email to authority
    try {
      await sendIssueToAuthority(issue, authority.email);
    } catch (emailErr) {
      console.error('Failed to send email to authority:', emailErr.message);
    }

    // Award gamification points
    await awardPoints(req.user._id, 'report_issue');

    res.status(201).json({
      success: true,
      message: 'Issue reported successfully!',
      issue: {
        issueId: issue.issueId,
        title: issue.title,
        category: issue.category,
        status: issue.status,
        severity: issue.severity,
        aiDescription: issue.aiDescription,
        location: { address: issue.location.address },
        media: issue.media.map(m => ({ url: m.url, type: m.type })),
        reportedAt: issue.reportedAt,
        assignedAuthority: { name: issue.assignedAuthority.name, department: issue.assignedAuthority.department }
      }
    });
  } catch (error) {
    console.error('Report issue error:', error);
    res.status(500).json({ success: false, message: 'Failed to report issue.' });
  }
};

// GET /api/issues - List all issues
const getIssues = async (req, res) => {
  try {
    const {
      page = 1, limit = 12, status, category, severity,
      latitude, longitude, radius = 5000, sort = '-reportedAt', search
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (severity) query.severity = severity;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { issueId: { $regex: search, $options: 'i' } }
      ];
    }

    // Geo filter
    if (latitude && longitude) {
      query.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
          $maxDistance: parseInt(radius)
        }
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [issues, total] = await Promise.all([
      Issue.find(query)
        .select('-reporterId -assignedAuthority.email -updates.emailMessageId')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Issue.countDocuments(query)
    ]);

    res.json({
      success: true,
      issues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch issues.' });
  }
};

// GET /api/issues/:issueId - Get single issue
const getIssue = async (req, res) => {
  try {
    const issue = await Issue.findOne({ issueId: req.params.issueId })
      .select('-assignedAuthority.email -updates.emailMessageId')
      .lean();

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found.' });
    }

    res.json({ success: true, issue });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch issue.' });
  }
};

// POST /api/issues/:issueId/upvote
const upvoteIssue = async (req, res) => {
  try {
    const issue = await Issue.findOne({ issueId: req.params.issueId });
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

    const userId = req.user._id;
    const hasUpvoted = issue.upvotes.includes(userId);

    if (hasUpvoted) {
      issue.upvotes.pull(userId);
      issue.upvoteCount = Math.max(0, issue.upvoteCount - 1);
    } else {
      issue.upvotes.push(userId);
      issue.upvoteCount += 1;
    }

    await issue.save();

    res.json({ success: true, upvoted: !hasUpvoted, upvoteCount: issue.upvoteCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to toggle upvote.' });
  }
};

// POST /api/issues/analyze-preview — quick AI analysis of base64 image (no upload needed)
// const analyzePreview = async (req, res) => {
//   try {
//     const { imageBase64, mimeType } = req.body;
//     if (!imageBase64) return res.status(400).json({ success: false, message: 'Image data required.' });

//     const axios = require('axios');
//     const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

//     const requestBody = {
//       contents: [{
//         parts: [
//           {
//             text: `You are an AI assistant for a civic issue reporting platform in India.
// Analyze this image of a community/civic problem.

// Respond ONLY with valid JSON (no markdown, no explanation):
// {
//   "category": "one of: road_damage, water_supply, electricity, sanitation, garbage, street_light, drainage, parks_recreation, public_property_damage, noise_pollution, encroachment, traffic, other",
//   "title": "brief title (max 10 words)",
//   "aiDescription": "2-3 sentence description of what you see and what action is needed",
//   "severity": "one of: low, medium, high, critical",
//   "confidence": 0.95
// }`
//           },
//           { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
//         ]
//       }],
//       generationConfig: { temperature: 0.1, maxOutputTokens: 400 }
//     };

//     const response = await axios.post(GEMINI_API_URL, requestBody, {
//       headers: { 'Content-Type': 'application/json' },
//       timeout: 20000
//     });

//     const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
//     const clean = text.replace(/```json\n?|\n?```/g, '').trim();
//     const parsed = JSON.parse(clean);

//     const valid = ['road_damage','water_supply','electricity','sanitation','garbage','street_light',
//       'drainage','parks_recreation','public_property_damage','noise_pollution','encroachment','traffic','other'];
//     if (!valid.includes(parsed.category)) parsed.category = 'other';

//     return res.json({ success: true, ...parsed });
//   } catch (err) {
//     console.error('Analyze preview error:', err.message);
//     return res.status(500).json({ success: false, message: 'AI analysis failed.' });
//   }
// };
const getStats = async (req, res) => {
  try {
    const [total, resolved, inProgress, reported, categories] = await Promise.all([
      Issue.countDocuments(),
      Issue.countDocuments({ status: 'resolved' }),
      Issue.countDocuments({ status: 'in_progress' }),
      Issue.countDocuments({ status: 'reported' }),
      Issue.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ])
    ]);

    res.json({
      success: true,
      stats: { total, resolved, inProgress, reported, resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0 },
      categories
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
};

module.exports = { reportIssue, getIssues, getIssue, upvoteIssue, getStats, checkDuplicate, analyzeMedia };