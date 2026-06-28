const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Issue = require('../models/Issue');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const { verifyResolutionProof } = require('./aiService');
const { sendStatusUpdateToReporter } = require('./emailService');
const { awardPoints } = require('./gamificationService');

const STATUS_KEYWORDS = {
  'STATUS: ACKNOWLEDGED': 'acknowledged',
  'STATUS: IN_PROGRESS': 'in_progress',
  'STATUS: RESOLVED': 'resolved',
  'STATUS: REJECTED': 'rejected'
};

/**
 * Parse status from email body text
 */
const parseStatusFromEmail = (text) => {
  for (const [keyword, status] of Object.entries(STATUS_KEYWORDS)) {
    if (text.toUpperCase().includes(keyword)) {
      return status;
    }
  }
  return null;
};

/**
 * Extract issue ID from email subject
 */
const extractIssueId = (subject) => {
  const match = subject.match(/\[CivicPulse\]\s*\[(CP-[A-Z0-9-]+)\]/);
  return match ? match[1] : null;
};

/**
 * Process authority email reply
 */
const processAuthorityReply = async (parsed) => {
  try {
    const subject = parsed.subject || '';
    const issueId = extractIssueId(subject);

    if (!issueId) {
      console.log('No issue ID found in email subject:', subject);
      return;
    }

    const issue = await Issue.findOne({ issueId });
    if (!issue) {
      console.log('Issue not found:', issueId);
      return;
    }

    const emailText = parsed.text || parsed.html || '';
    const newStatus = parseStatusFromEmail(emailText);

    const updateData = {
      message: emailText.substring(0, 1000).replace(/<[^>]*>/g, '').trim(),
      author: parsed.from?.text || issue.assignedAuthority.name,
      authorType: 'authority',
      emailMessageId: parsed.messageId,
      media: [],
      isResolutionProof: newStatus === 'resolved',
    };

    // Handle attachments (resolution proof)
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const attachment of parsed.attachments) {
        if (attachment.contentType.startsWith('image/') || attachment.contentType.startsWith('video/')) {
          try {
            // Upload to cloudinary
            const result = await new Promise((resolve, reject) => {
              cloudinary.uploader.upload_stream(
                { folder: 'civicpulse/resolution-proofs', resource_type: 'auto' },
                (error, result) => error ? reject(error) : resolve(result)
              ).end(attachment.content);
            });

            updateData.media.push({
              url: result.secure_url,
              type: attachment.contentType.startsWith('image/') ? 'image' : 'video',
              publicId: result.public_id
            });
          } catch (uploadErr) {
            console.error('Failed to upload attachment:', uploadErr.message);
          }
        }
      }
    }

    // AI verification for resolution proof
    if (newStatus === 'resolved' && updateData.media.length > 0) {
      const verification = await verifyResolutionProof(updateData.media, issue);
      updateData.aiVerified = verification.isResolved;
      updateData.aiVerificationNote = verification.verificationNote;

      if (verification.isResolved && verification.confidence > 0.7) {
        issue.status = 'resolved';
        issue.resolvedAt = new Date();
        issue.resolutionProofUrl = updateData.media[0]?.url;
        issue.resolutionProofType = updateData.media[0]?.type;

        // Award points to reporter
        await awardPoints(issue.reporterId, 'issue_resolved');
      } else {
        updateData.message = `Authority claimed resolution, but AI verification ${verification.partiallyResolved ? 'suggests partial resolution' : 'could not confirm'}. ${verification.verificationNote}. Manual review may be needed.`;
        if (newStatus === 'resolved') issue.status = 'in_progress'; // keep open
      }
    } else if (newStatus) {
      issue.status = newStatus;
      if (newStatus === 'acknowledged') issue.acknowledgedAt = new Date();
    }

    issue.updates.push(updateData);
    await issue.save();

    // Notify reporter
    try {
      const reporter = await User.findById(issue.reporterId).select('+email');
      if (reporter) {
        await sendStatusUpdateToReporter(reporter.email, issue, updateData);
      }
    } catch (emailErr) {
      console.error('Failed to notify reporter:', emailErr.message);
    }

    console.log(`✅ Processed email reply for issue ${issueId}, new status: ${newStatus || 'no status change'}`);
  } catch (err) {
    console.error('Error processing authority reply:', err.message);
  }
};

/**
 * Start IMAP email monitoring
 */
const startEmailMonitoring = () => {
  if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASS) {
    console.log('⚠️  IMAP credentials not configured - email monitoring disabled');
    return;
  }

  const connectImap = () => {
    const imap = new Imap({
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASS,
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.IMAP_PORT) || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    imap.once('ready', () => {
      console.log('📧 IMAP connected - monitoring for authority replies');
      imap.openBox('INBOX', false, (err) => {
        if (err) console.error('IMAP openBox error:', err);

        // Listen for new emails
        imap.on('mail', () => {
          const fetch = imap.seq.fetch('*', { bodies: '', struct: true });
          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) return console.error('Parse error:', err);
                // Only process replies (Re: in subject)
                if (parsed.subject && parsed.subject.toLowerCase().startsWith('re:')) {
                  await processAuthorityReply(parsed);
                }
              });
            });
          });
        });
      });
    });

    imap.once('error', (err) => {
      console.error('IMAP error:', err.message);
      setTimeout(connectImap, 30000); // Reconnect after 30s
    });

    imap.once('end', () => {
      console.log('IMAP connection ended, reconnecting...');
      setTimeout(connectImap, 10000);
    });

    imap.connect();
  };

  connectImap();
};

module.exports = { startEmailMonitoring, processAuthorityReply };
