const Issue = require('../models/Issue');
const { analyzeIssueMedia } = require('../services/aiService');
const { sendIssueToAuthority } = require('../services/emailService');
const { resolveAuthority } = require('../services/authorityService');
const { getStaticAuthority } = require('../config/authorities');
const { awardPoints } = require('../services/gamificationService');

const DUPLICATE_RADIUS = parseInt(process.env.DUPLICATE_RADIUS_METERS) || 50;

// Simple email format guard for the editable authority-email field.
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: runs duplicate check against a resolved authority.
// Used by both /analyze and the final create, so the safety check can never
// be skipped by calling create directly with stale/tampered analysis data.
// ─────────────────────────────────────────────────────────────────────────────
const findDuplicate = async (latitude, longitude, department) => {
  return Issue.findOne({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
        $maxDistance: DUPLICATE_RADIUS
      }
    },
    'assignedAuthority.department': department,
    status: { $nin: ['resolved', 'rejected'] }
  }).select('issueId title category status assignedAuthority upvoteCount reportedAt media');
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/issues/analyze
//
// STEP 1 of the new 2-step flow. Triggered by the "AI Analysis" button after
// media + GPS are already supplied. Performs:
//   - AI analysis of media → category, title, description, severity
//   - Authority resolution → name, dept, email, phone
//   - Duplicate check (50m radius + same authority.department)
//
// Does NOT write to the database. Returns everything the frontend needs to
// render the preview screen (AI description, category, severity, authority
// contact — including the only-editable field: authority email).
//
// If a duplicate is found, responds 409 with isDuplicate:true and the
// existing issue's summary, exactly as before — frontend should show
// "already reported" and block submission.
// ─────────────────────────────────────────────────────────────────────────────
const analyzeIssue = async (req, res) => {
  try {
    const { latitude, longitude, address, ward, city, state, pincode } = req.body;

    // ── Guards ────────────────────────────────────────────────────────────────
    if (!req.user.aadhaarVerified) {
      return res.status(403).json({
        success: false,
        message: 'Aadhaar verification is required to report issues.',
        code: 'AADHAAR_REQUIRED'
      });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one photo or video is required.' });
    }
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Location (GPS) is required.' });
    }

    // ── Step 1: Build media array from Cloudinary-uploaded files ─────────────
    const media = req.files.map(file => ({
      url: file.path,
      type: file.mimetype.startsWith('video/') ? 'video' : 'image',
      publicId: file.filename
    }));

    // ── Step 2: AI analyzes media + location context ──────────────────────────
    const locationContext = address || `${latitude}, ${longitude}`;
    const aiResult = await analyzeIssueMedia(media, locationContext);
    console.log(`[analyzeIssue] AI → category=${aiResult.category} severity=${aiResult.severity} confidence=${aiResult.confidence}`);

    // ── Step 3: AI resolves responsible authority from category + GPS ─────────
    const staticFallback = getStaticAuthority(aiResult.category);
    const authority = await resolveAuthority(
      aiResult.category,
      aiResult.aiDescription || locationContext,
      parseFloat(latitude),
      parseFloat(longitude),
      staticFallback
    );
    console.log(`[analyzeIssue] Authority (${authority.source}): ${authority.name} | ${authority.department} | email=${authority.email} | emailSource=${authority.emailSource}`);
    if (authority.groundingSources?.length) {
      console.log(`[analyzeIssue] Grounding sources: ${authority.groundingSources.slice(0, 2).join(', ')}`);
    }

    // ── Step 4: Duplicate check — 50m radius + same authority department ──────
    const duplicate = await findDuplicate(latitude, longitude, authority.department);

    if (duplicate) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: `This issue has already been filed within ${DUPLICATE_RADIUS}m and is assigned to ${authority.department}. You can upvote it to increase priority.`,
        existingIssue: {
          issueId:      duplicate.issueId,
          title:        duplicate.title,
          category:     duplicate.category,
          status:       duplicate.status,
          department:   duplicate.assignedAuthority?.department,
          authority:    duplicate.assignedAuthority?.name,
          upvoteCount:  duplicate.upvoteCount,
          reportedAt:   duplicate.reportedAt,
          thumbnail:    duplicate.media?.[0]?.url
        }
      });
    }

    // ── No duplicate — return full preview payload for frontend to render ─────
    // Frontend shows this, lets user optionally edit `authority.email`, then
    // POSTs this exact object back to POST /api/issues on final submit.
    return res.status(200).json({
      success: true,
      isDuplicate: false,
      message: 'Analysis complete. Review the details below before submitting.',
      analysis: {
        title:         aiResult.aiTitle || `${aiResult.category.replace(/_/g, ' ')} reported`,
        description:   aiResult.aiDescription || locationContext,
        category:      aiResult.category,
        aiCategory:    aiResult.category,
        aiDescription: aiResult.aiDescription,
        aiConfidence:  aiResult.confidence,
        severity:      aiResult.severity || 'medium',
        media,
        location: {
          latitude:  parseFloat(latitude),
          longitude: parseFloat(longitude),
          address:   address || `${latitude}, ${longitude}`,
          ward, city, state, pincode
        },
        assignedAuthority: {
          name:             authority.name,
          department:       authority.department,
          email:            authority.email,        // editable on frontend
          emailEditable:    true,
          phone:            authority.phone           || '',
          jurisdiction:     authority.jurisdiction    || '',
          website:          authority.website         || null,
          grievancePortal:  authority.grievancePortal || null,
          emailSource:      authority.emailSource     || 'none',
          source:           authority.source,
          groundingSources: authority.groundingSources || [],
          notes:            authority.notes           || ''
        }
      }
    });

  } catch (error) {
    console.error('[analyzeIssue] Error:', error);
    res.status(500).json({ success: false, message: 'AI analysis failed. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/issues
//
// STEP 2 of the new 2-step flow — final "Submit Issue" button.
// Expects the exact `analysis` object returned by /analyze in the request
// body (the frontend may have modified ONLY `assignedAuthority.email`).
//
// Re-validates everything server-side rather than trusting the client blob:
//   - Re-runs the duplicate check (protects against race conditions where
//     another user reported the same issue between analyze and submit)
//   - Validates the (possibly edited) authority email format
//   - Rejects if required analysis fields are missing/tampered
// ─────────────────────────────────────────────────────────────────────────────
const reportIssue = async (req, res) => {
  try {
    const { analysis } = req.body;

    if (!req.user.aadhaarVerified) {
      return res.status(403).json({
        success: false,
        message: 'Aadhaar verification is required to report issues.',
        code: 'AADHAAR_REQUIRED'
      });
    }

    if (!analysis || typeof analysis !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Missing analysis data. Please run AI Analysis before submitting.'
      });
    }

    const {
      title, description, category, aiCategory, aiDescription, aiConfidence,
      severity, media, location, assignedAuthority
    } = analysis;

    // ── Validate required fields survived the round trip ─────────────────────
    if (!category || !location?.latitude || !location?.longitude || !media?.length) {
      return res.status(400).json({
        success: false,
        message: 'Incomplete analysis data. Please re-run AI Analysis and try again.'
      });
    }
    if (!assignedAuthority?.department) {
      return res.status(400).json({
        success: false,
        message: 'Missing authority assignment. Please re-run AI Analysis and try again.'
      });
    }

    // ── Validate the (possibly user-edited) authority email ──────────────────
    const finalAuthorityEmail = (assignedAuthority.email || '').trim();
    if (!isValidEmail(finalAuthorityEmail)) {
      return res.status(400).json({
        success: false,
        message: 'The authority contact email is invalid. Please correct it before submitting.'
      });
    }

    // ── Re-check duplicate at submit time (race-condition safe) ──────────────
    const duplicate = await findDuplicate(location.latitude, location.longitude, assignedAuthority.department);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: `This issue was just filed by someone else within ${DUPLICATE_RADIUS}m, assigned to ${assignedAuthority.department}. You can upvote it instead.`,
        existingIssue: {
          issueId:     duplicate.issueId,
          title:       duplicate.title,
          category:    duplicate.category,
          status:      duplicate.status,
          department:  duplicate.assignedAuthority?.department,
          authority:   duplicate.assignedAuthority?.name,
          upvoteCount: duplicate.upvoteCount,
          reportedAt:  duplicate.reportedAt,
          thumbnail:   duplicate.media?.[0]?.url
        }
      });
    }

    // ── Create issue ───────────────────────────────────────────────────────
    const issue = await Issue.create({
      title:         title || `${category.replace(/_/g, ' ')} reported`,
      description:   description || location.address,
      category,
      aiCategory:    aiCategory || category,
      aiDescription,
      aiConfidence,
      severity:      severity || 'medium',
      reporterName:  req.user.name,
      reporterId:    req.user._id,
      location: {
        type: 'Point',
        coordinates: [parseFloat(location.longitude), parseFloat(location.latitude)],
        address: location.address,
        ward: location.ward, city: location.city, state: location.state, pincode: location.pincode
      },
      media,
      assignedAuthority: {
        name:             assignedAuthority.name,
        department:       assignedAuthority.department,
        email:            finalAuthorityEmail, // uses edited value if user changed it
        phone:            assignedAuthority.phone           || '',
        jurisdiction:     assignedAuthority.jurisdiction    || '',
        website:          assignedAuthority.website         || null,
        grievancePortal:  assignedAuthority.grievancePortal || null,
        emailSource:      finalAuthorityEmail !== assignedAuthority.email ? 'user_edited' : (assignedAuthority.emailSource || 'none'),
        source:           assignedAuthority.source,
        groundingSources: assignedAuthority.groundingSources || [],
        notes:            assignedAuthority.notes            || ''
      },
      updates: [{
        message: `Issue reported by ${req.user.name}. ` +
                 `AI detected: "${category}" (confidence ${Math.round((aiConfidence || 0) * 100)}%). ` +
                 `Assigned to ${assignedAuthority.name} via ${assignedAuthority.source} resolution.` +
                 (finalAuthorityEmail !== assignedAuthority.email ? ' Authority email was manually corrected by reporter.' : ''),
        author:     'CivicPulse AI',
        authorType: 'ai'
      }]
    });

    // ── Email the authority ───────────────────────────────────────────────
    try {
      await sendIssueToAuthority(issue, finalAuthorityEmail);
    } catch (emailErr) {
      console.error('[reportIssue] Email failed (non-fatal):', emailErr.message);
    }

    // ── Gamification points ───────────────────────────────────────────────
    await awardPoints(req.user._id, 'report_issue');

    return res.status(201).json({
      success: true,
      message: 'Issue reported successfully!',
      issue: {
        issueId:       issue.issueId,
        title:         issue.title,
        category:      issue.category,
        status:        issue.status,
        severity:      issue.severity,
        aiDescription: issue.aiDescription,
        location: {
          address:   issue.location.address,
          latitude:  issue.location.coordinates[1],
          longitude: issue.location.coordinates[0]
        },
        media: issue.media.map(m => ({ url: m.url, type: m.type })),
        reportedAt: issue.reportedAt,
        assignedAuthority: {
          name:            issue.assignedAuthority.name,
          department:      issue.assignedAuthority.department,
          phone:           issue.assignedAuthority.phone,
          jurisdiction:    issue.assignedAuthority.jurisdiction,
          website:         issue.assignedAuthority.website,
          grievancePortal: issue.assignedAuthority.grievancePortal,
          emailSource:     issue.assignedAuthority.emailSource,
          source:          issue.assignedAuthority.source,
          notes:           issue.assignedAuthority.notes
          // email intentionally omitted from response
        }
      }
    });

  } catch (error) {
    console.error('[reportIssue] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to report issue. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/issues/stats/summary
// ─────────────────────────────────────────────────────────────────────────────
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
      stats: {
        total, resolved, inProgress, reported,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0
      },
      categories
    });
  } catch (error) {
    console.error('[getStats] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/issues
// ─────────────────────────────────────────────────────────────────────────────
const getIssues = async (req, res) => {
  try {
    const {
      page = 1, limit = 12, status, category, severity,
      latitude, longitude, radius = 5000, sort = '-reportedAt', search
    } = req.query;

    const query = {};
    if (status)   query.status = status;
    if (category) query.category = category;
    if (severity) query.severity = severity;
    if (search) {
      query.$or = [
        { title:       { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { issueId:     { $regex: search, $options: 'i' } }
      ];
    }
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
        .sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      Issue.countDocuments(query)
    ]);

    res.json({
      success: true, issues,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('[getIssues] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch issues.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/issues/:issueId
// ─────────────────────────────────────────────────────────────────────────────
const getIssue = async (req, res) => {
  try {
    const issue = await Issue.findOne({ issueId: req.params.issueId })
      .select('-assignedAuthority.email -updates.emailMessageId').lean();
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });
    res.json({ success: true, issue });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch issue.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/issues/:issueId/upvote
// ─────────────────────────────────────────────────────────────────────────────
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
    res.status(500).json({ success: false, message: 'Failed to upvote.' });
  }
};

module.exports = { analyzeIssue, reportIssue, getIssues, getIssue, upvoteIssue, getStats };
