const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const VALID_CATEGORIES = [
  'road_damage', 'water_supply', 'electricity', 'sanitation', 'garbage',
  'street_light', 'drainage', 'parks_recreation', 'public_property_damage',
  'noise_pollution', 'encroachment', 'traffic', 'other'
];

const CATEGORY_GUIDE = `
CATEGORY DEFINITIONS (pick the single best match):
- road_damage      → potholes, cracks, broken asphalt, damaged footpath/pavement, road cave-in
- water_supply     → burst pipe, no water, leaking tap/hydrant, contaminated water, overflow
- electricity      → broken/dangling wire, power outage, transformer fault, sparking
- sanitation       → open drain, sewage overflow, public toilet condition, blocked sewer
- garbage          → uncollected garbage, overflowing dustbin, dumping of waste/trash
- street_light     → broken street lamp, non-working pole light, dark road at night
- drainage         → waterlogging, blocked storm drain, flooding after rain, stagnant water
- parks_recreation → damaged park bench/equipment, dead trees, broken fencing in parks
- public_property_damage → broken government building, damaged bus stop, broken bridge railing
- noise_pollution  → loud machinery, loudspeaker, construction noise (time violation)
- encroachment     → illegal construction, hawker blocking road, unauthorized building
- traffic          → broken signal, missing road sign, illegal parking causing jam
- other            → anything that doesn't fit the above categories
`;

const SHARED_PROMPT = `You are an AI assistant for CivicPulse, a civic issue reporting platform in India.
Analyze the provided image of a community/civic problem carefully.

${CATEGORY_GUIDE}

Respond ONLY with a valid JSON object — no markdown fences, no explanation, no extra text:
{
  "category": "<one of the exact keys listed above>",
  "title": "<5-8 word title describing the specific problem seen>",
  "description": "<2-3 sentences describing exactly what you see in the image, the specific problem it causes, and its urgency>",
  "severity": "<low|medium|high|critical>",
  "confidence": <0.0-1.0>,
  "department": "<responsible government department>",
  "suggestedAction": "<specific action required in one sentence>"
}

Keep description under 200 characters. Severity guide: low=minor inconvenience, medium=affects daily life, high=safety risk, critical=immediate danger.`;

/**
 * Safely parse Gemini's response — handles truncated JSON and markdown fences.
 * If the JSON is cut off mid-stream, attempts to close it before parsing.
 */
const safeParseGeminiJSON = (raw) => {
  // Strip markdown code fences
  let text = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  // Try parsing as-is first
  try {
    return JSON.parse(text);
  } catch (_) {
    // Truncation recovery: count open braces vs close braces
    const openBraces = (text.match(/{/g) || []).length;
    const closeBraces = (text.match(/}/g) || []).length;
    const missing = openBraces - closeBraces;

    // Remove trailing comma or incomplete key-value if present
    text = text.replace(/,\s*$/, '');

    // Close any open string values that got cut off
    // (e.g. "description": "some text that got cut off without closing quote)
    const quoteCount = (text.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      text += '"'; // close the open string
    }

    // Add missing closing braces
    for (let i = 0; i < missing; i++) text += '}';

    return JSON.parse(text);
  }
};

/**
 * Analyze image buffer (used by POST /issues/analyze-media — pre-upload, no Cloudinary URL yet)
 */
const analyzeMediaBuffer = async (buffer, mimeType = 'image/jpeg') => {
  try {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

    const base64 = buffer.toString('base64');
    const parts = [
      { text: SHARED_PROMPT },
      { inlineData: { mimeType, data: base64 } }
    ];

    const response = await axios.post(GEMINI_API_URL, {
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024, topP: 0.8 }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    const raw = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Empty response from Gemini');

    const parsed = safeParseGeminiJSON(raw);

    if (!VALID_CATEGORIES.includes(parsed.category)) parsed.category = 'other';

    return {
      success: true,
      category: parsed.category,
      aiTitle: parsed.title || 'Civic Issue',
      aiDescription: parsed.description || '',
      severity: ['low', 'medium', 'high', 'critical'].includes(parsed.severity) ? parsed.severity : 'medium',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      department: parsed.department || '',
      suggestedAction: parsed.suggestedAction || ''
    };
  } catch (error) {
    console.error('analyzeMediaBuffer error:', error.response?.data || error.message);
    return {
      success: false,
      category: 'other',
      aiTitle: 'Civic Issue',
      aiDescription: '',
      severity: 'medium',
      confidence: 0,
      error: error.message
    };
  }
};

/**
 * Analyze issue media by Cloudinary URL (used after upload during reportIssue)
 */
const analyzeIssueMedia = async (mediaItems, userDescription = '') => {
  try {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

    const parts = [];
    const prompt = userDescription
      ? `${SHARED_PROMPT}\n\nCitizen's description (use as additional context): "${userDescription}"`
      : SHARED_PROMPT;
    parts.push({ text: prompt });

    const images = mediaItems.filter(m => m.type === 'image').slice(0, 3);
    for (const media of images) {
      try {
        const res = await axios.get(media.url, { responseType: 'arraybuffer', timeout: 15000 });
        const base64 = Buffer.from(res.data).toString('base64');
        const contentType = res.headers['content-type']?.split(';')[0] || 'image/jpeg';
        parts.push({ inlineData: { mimeType: contentType, data: base64 } });
      } catch (fetchErr) {
        console.error('Failed to fetch image for AI:', fetchErr.message);
      }
    }

    if (parts.length === 1) {
      parts.push({ text: `Classify based on description: "${userDescription}"` });
    }

    const response = await axios.post(GEMINI_API_URL, {
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024, topP: 0.8 }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    const raw = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Empty response from Gemini');

    const parsed = safeParseGeminiJSON(raw);

    if (!VALID_CATEGORIES.includes(parsed.category)) parsed.category = 'other';

    return {
      success: true,
      category: parsed.category,
      aiTitle: parsed.title || 'Civic Issue',
      aiDescription: parsed.description || userDescription,
      severity: parsed.severity || 'medium',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      department: parsed.department || '',
      suggestedAction: parsed.suggestedAction || ''
    };
  } catch (error) {
    console.error('analyzeIssueMedia error:', error.response?.data || error.message);
    return {
      success: false,
      category: 'other',
      aiTitle: userDescription?.substring(0, 60) || 'Community Issue',
      aiDescription: userDescription || 'Issue reported by citizen',
      severity: 'medium',
      confidence: 0,
      error: error.message
    };
  }
};

/**
 * Verify resolution proof — checks if proof image shows issue is fixed
 */
const verifyResolutionProof = async (proofMediaUrls, originalIssue) => {
  try {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

    const parts = [{
      text: `You are an AI verifying if a civic issue has been resolved.

Original Issue:
- Category: ${originalIssue.category}
- Description: ${originalIssue.description}
- AI Analysis: ${originalIssue.aiDescription || ''}

Analyze the proof image(s) and determine if this issue appears resolved.

Respond ONLY with valid JSON (no markdown):
{
  "isResolved": true or false,
  "confidence": 0.95,
  "verificationNote": "Brief explanation of what you see and why resolved or not",
  "partiallyResolved": true or false
}`
    }];

    for (const media of proofMediaUrls.slice(0, 2)) {
      try {
        const res = await axios.get(media.url, { responseType: 'arraybuffer', timeout: 15000 });
        const base64 = Buffer.from(res.data).toString('base64');
        const mimeType = res.headers['content-type']?.split(';')[0] || 'image/jpeg';
        parts.push({ inlineData: { mimeType, data: base64 } });
      } catch (err) {
        console.error('Failed to fetch proof image:', err.message);
      }
    }

    const response = await axios.post(GEMINI_API_URL, {
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    const raw = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('No response from Gemini');

    const parsed = safeParseGeminiJSON(raw);

    return {
      success: true,
      isResolved: parsed.isResolved,
      confidence: parsed.confidence || 0.8,
      verificationNote: parsed.verificationNote,
      partiallyResolved: parsed.partiallyResolved || false
    };
  } catch (error) {
    console.error('verifyResolutionProof error:', error.message);
    return {
      success: false,
      isResolved: false,
      confidence: 0,
      verificationNote: 'AI verification failed - manual review required',
      error: error.message
    };
  }
};

module.exports = { analyzeIssueMedia, verifyResolutionProof, analyzeMediaBuffer };