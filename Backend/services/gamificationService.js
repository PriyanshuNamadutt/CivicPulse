const User = require('../models/User');
const PDFDocument = require('pdfkit');
const { sendBadgeEmail } = require('./emailService');

const BADGE_DEFINITIONS = {
  first_report: {
    name: 'First Reporter',
    description: 'Reported your first civic issue',
    icon: '🌟',
    type: 'first_report',
    points: 50
  },
  five_reports: {
    name: 'Active Citizen',
    description: 'Reported 5 civic issues',
    icon: '📋',
    type: 'five_reports',
    points: 100
  },
  ten_reports: {
    name: 'Community Guardian',
    description: 'Reported 10 civic issues',
    icon: '🛡️',
    type: 'ten_reports',
    points: 200
  },
  twenty_five_reports: {
    name: 'Civic Champion',
    description: 'Reported 25 civic issues',
    icon: '🏆',
    type: 'twenty_five_reports',
    points: 500
  },
  fifty_reports: {
    name: 'City Hero',
    description: 'Reported 50 civic issues',
    icon: '🦸',
    type: 'fifty_reports',
    points: 1000
  },
  issue_resolved: {
    name: 'Problem Solver',
    description: 'Had your first issue resolved',
    icon: '✅',
    type: 'issue_resolved',
    points: 100
  },
  five_resolved: {
    name: 'Change Maker',
    description: 'Had 5 issues resolved',
    icon: '💪',
    type: 'five_resolved',
    points: 300
  },
  community_hero: {
    name: 'Community Hero',
    description: 'Had 10 issues resolved',
    icon: '🌍',
    type: 'community_hero',
    points: 750
  },
  early_adopter: {
    name: 'Early Adopter',
    description: 'One of the first 100 citizens to join CivicPulse',
    icon: '🚀',
    type: 'early_adopter',
    points: 150
  },
  verified_citizen: {
    name: 'Verified Citizen',
    description: 'Completed full identity verification',
    icon: '✔️',
    type: 'verified_citizen',
    points: 75
  }
};

const POINTS_MAP = {
  report_issue: 20,
  issue_acknowledged: 10,
  issue_resolved: 50,
  upvote_received: 2,
  profile_complete: 25
};

const LEVEL_NAMES = [
  'Newcomer', 'Observer', 'Concerned Citizen', 'Active Resident',
  'Community Member', 'Civic Advocate', 'City Guardian', 'Urban Hero',
  'Community Champion', 'CivicPulse Legend'
];

/**
 * Award points to user and check for new badges
 */
const awardPoints = async (userId, action, metadata = {}) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const points = POINTS_MAP[action] || 0;
  user.points += points;
  user.calculateLevel();

  const newBadges = [];

  // Check badge conditions
  if (action === 'report_issue') {
    user.issuesReported = (user.issuesReported || 0) + 1;

    if (user.issuesReported === 1 && !hasBadge(user, 'first_report')) {
      newBadges.push(addBadge(user, 'first_report'));
    }
    if (user.issuesReported === 5 && !hasBadge(user, 'five_reports')) {
      newBadges.push(addBadge(user, 'five_reports'));
    }
    if (user.issuesReported === 10 && !hasBadge(user, 'ten_reports')) {
      newBadges.push(addBadge(user, 'ten_reports'));
    }
    if (user.issuesReported === 25 && !hasBadge(user, 'twenty_five_reports')) {
      newBadges.push(addBadge(user, 'twenty_five_reports'));
    }
    if (user.issuesReported === 50 && !hasBadge(user, 'fifty_reports')) {
      newBadges.push(addBadge(user, 'fifty_reports'));
    }
  }

  if (action === 'issue_resolved') {
    user.issuesResolved = (user.issuesResolved || 0) + 1;

    if (user.issuesResolved === 1 && !hasBadge(user, 'issue_resolved')) {
      newBadges.push(addBadge(user, 'issue_resolved'));
    }
    if (user.issuesResolved === 5 && !hasBadge(user, 'five_resolved')) {
      newBadges.push(addBadge(user, 'five_resolved'));
    }
    if (user.issuesResolved === 10 && !hasBadge(user, 'community_hero')) {
      newBadges.push(addBadge(user, 'community_hero'));
    }
  }

  await user.save();

  // Send badge emails asynchronously
  for (const badge of newBadges) {
    try {
      const userWithEmail = await User.findById(userId).select('+email');
      const certBase64 = await generateCertificate(user.name, badge);
      await sendBadgeEmail(userWithEmail.email, user.name, badge, certBase64);
    } catch (err) {
      console.error('Badge email error:', err.message);
    }
  }

  return { points, newBadges, totalPoints: user.points, level: user.level };
};

const hasBadge = (user, type) => user.badges.some(b => b.type === type);

const addBadge = (user, type) => {
  const badgeDef = BADGE_DEFINITIONS[type];
  if (!badgeDef) return null;
  const badge = { ...badgeDef, earnedAt: new Date() };
  user.badges.push(badge);
  user.points += badgeDef.points || 0;
  return badge;
};

/**
 * Generate PDF certificate
 */
const generateCertificate = (userName, badge) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer.toString('base64'));
      });

      // Background
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8f9fa');
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#1e3a5f');
      doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).stroke('#2e6da4');

      // Header
      doc.fillColor('#1e3a5f')
        .fontSize(36)
        .font('Helvetica-Bold')
        .text('🏛️ CivicPulse', 0, 60, { align: 'center' });

      doc.fillColor('#2e6da4')
        .fontSize(20)
        .font('Helvetica')
        .text('Certificate of Community Service', 0, 105, { align: 'center' });

      // Divider
      doc.moveTo(100, 140).lineTo(doc.page.width - 100, 140).stroke('#2e6da4');

      // Main content
      doc.fillColor('#333')
        .fontSize(16)
        .text('This is to certify that', 0, 165, { align: 'center' });

      doc.fillColor('#1e3a5f')
        .fontSize(32)
        .font('Helvetica-Bold')
        .text(userName, 0, 195, { align: 'center' });

      doc.fillColor('#333')
        .fontSize(16)
        .font('Helvetica')
        .text('has earned the', 0, 245, { align: 'center' });

      doc.fillColor('#f39c12')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(`${badge.icon} ${badge.name}`, 0, 270, { align: 'center' });

      doc.fillColor('#555')
        .fontSize(14)
        .font('Helvetica')
        .text(badge.description, 0, 315, { align: 'center' });

      doc.fillColor('#555')
        .fontSize(12)
        .text('for active participation in community issue reporting and civic engagement', 0, 345, { align: 'center' });

      // Date
      doc.fillColor('#888')
        .fontSize(12)
        .text(`Awarded on: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 0, 390, { align: 'center' });

      // Footer
      doc.moveTo(100, 420).lineTo(doc.page.width - 100, 420).stroke('#2e6da4');
      doc.fillColor('#aaa')
        .fontSize(10)
        .text('CivicPulse — Empowering Citizens, Building Communities', 0, 432, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

const getLevelName = (level) => LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];

module.exports = {
  awardPoints,
  BADGE_DEFINITIONS,
  POINTS_MAP,
  getLevelName,
  generateCertificate
};
