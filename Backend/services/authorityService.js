const axios = require('axios');

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
/**
 * Department labels per category — used inside the AI prompt so Gemini
 * knows exactly which government body to look up.
 */
const DEPARTMENT_HINTS = {
  road_damage:            'Public Works Department (PWD) or Roads & Highways Department',
  water_supply:           'Water Supply Department or Jal Board or Municipal Water Authority',
  electricity:            'Electricity Distribution Company (DISCOM) or State Electricity Board',
  sanitation:             'Sanitation Department or Municipal Health Department',
  garbage:                'Solid Waste Management Department or Municipal Cleanliness Department',
  street_light:           'Street Lighting Department or Municipal Electrical Department',
  drainage:               'Drainage or Sewerage Department or Municipal Engineering Department',
  parks_recreation:       'Parks and Gardens Department or Horticulture Department',
  public_property_damage: 'Municipal Corporation Property Department',
  noise_pollution:        'Environment Department or Pollution Control Board',
  encroachment:           'Town Planning Department or Anti-Encroachment Cell',
  traffic:                'Traffic Police Department or Transport Department',
  other:                  'Municipal Corporation General Administration or District Collector Office',
};

/**
 * Reverse-geocode coordinates to a human-readable location string
 * using OpenStreetMap Nominatim (free, no key needed).
 */
const reverseGeocode = async (latitude, longitude) => {
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat: latitude, lon: longitude, format: 'json' },
      headers: { 'User-Agent': 'CivicPulse/1.0' },
      timeout: 6000,
    });
    const a = res.data.address || {};
    const parts = [
      a.suburb || a.neighbourhood || a.quarter,
      a.city || a.town || a.village || a.county,
      a.state_district || a.district,
      a.state,
      a.country,
    ].filter(Boolean);
    return parts.join(', ');
  } catch {
    return null;
  }
};

/**
 * Ask Gemini to find the real government authority for a given
 * category + location. Returns { name, department, email, phone, source }.
 *
 * Gemini is instructed to use its knowledge of Indian government portals,
 * state websites, and official directories to return the most accurate
 * contact. If it cannot find a verified email it returns null for email
 * so the caller can fall back to the static map.
 */
const fetchAuthorityByAI = async (category, latitude, longitude, address) => {
  const hint = DEPARTMENT_HINTS[category] || DEPARTMENT_HINTS.other;

  // Try to get a richer location string if caller didn't pass one
  const location = address || (await reverseGeocode(latitude, longitude)) || `${latitude}, ${longitude}`;

  const prompt = `You are a government directory assistant for India.

A civic issue of type "${category.replace(/_/g, ' ')}" has been reported at this location:
"${location}" (coordinates: ${latitude}, ${longitude})

The responsible department is typically: ${hint}

Your task:
1. Identify the exact city/district/municipality from the location.
2. Find the official government authority responsible for "${category.replace(/_/g, ' ')}" issues in that jurisdiction.
3. Return their official contact details.

Rules:
- Use your knowledge of Indian government websites (state portals, municipal corporation sites, district NIC sites).
- Prefer official .gov.in or .nic.in email addresses.
- If the exact city email is unknown, use the district-level or state-level authority email.
- If you genuinely cannot find a real verified email, set "email" to null — do NOT invent fake emails.
- Always return valid JSON only, no markdown, no explanation.

Respond ONLY with this JSON structure:
{
  "name": "Full official name of the authority",
  "department": "Department short name",
  "email": "official@gov.in or null if unknown",
  "phone": "official phone number or null",
  "jurisdiction": "City/District/State this authority covers",
  "website": "official website URL or null",
  "confidence": 0.0 to 1.0
}`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
  };

  const response = await axios.post(GEMINI_API_URL, requestBody, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
  });

  const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(clean);

  return {
    name:         parsed.name         || null,
    department:   parsed.department   || null,
    email:        parsed.email        || null,
    phone:        parsed.phone        || null,
    jurisdiction: parsed.jurisdiction || null,
    website:      parsed.website      || null,
    confidence:   parsed.confidence   || 0,
    source:       'ai',
  };
};

/**
 * Main export — resolves the best authority for a given issue.
 *
 * Strategy (in priority order):
 *  1. .env override for that category  →  fastest, admin-controlled
 *  2. Gemini AI lookup by location     →  accurate, location-specific
 *  3. Static fallback map              →  always works, generic
 *
 * Returns { name, department, email, phone, source }
 */
const resolveAuthority = async (category, latitude, longitude, address, staticFallback) => {
  // ── 1. Hard .env override ──────────────────────────────────────────────
  const envKey = `AUTH_${category.toUpperCase()}_EMAIL`;
  if (process.env[envKey]) {
    console.log(`[Authority] Using .env override for ${category}: ${process.env[envKey]}`);
    return {
      ...staticFallback,
      email:  process.env[envKey],
      source: 'env',
    };
  }

  // ── 2. AI lookup ───────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY && latitude && longitude) {
    try {
      const aiAuthority = await fetchAuthorityByAI(category, latitude, longitude, address);

      if (aiAuthority.email && aiAuthority.confidence >= 0.5) {
        console.log(`[Authority] AI resolved for ${category} at (${latitude},${longitude}): ${aiAuthority.email} (confidence: ${aiAuthority.confidence})`);
        return {
          name:       aiAuthority.name       || staticFallback.name,
          department: aiAuthority.department || staticFallback.department,
          email:      aiAuthority.email,
          phone:      aiAuthority.phone      || staticFallback.phone,
          website:    aiAuthority.website    || null,
          source:     'ai',
        };
      }

      // AI responded but no confident email — use AI name/dept + static email as best effort
      if (aiAuthority.name && aiAuthority.confidence >= 0.3) {
        console.log(`[Authority] AI found name but no verified email for ${category}. Falling back to static email.`);
        return {
          name:       aiAuthority.name,
          department: aiAuthority.department || staticFallback.department,
          email:      staticFallback.email,          // static email as fallback
          phone:      aiAuthority.phone || staticFallback.phone,
          source:     'ai_partial',
        };
      }
    } catch (err) {
      console.error(`[Authority] AI lookup failed for ${category}:`, err.message);
    }
  }

  // ── 3. Static fallback ─────────────────────────────────────────────────
  console.log(`[Authority] Using static fallback for ${category}: ${staticFallback.email}`);
  return { ...staticFallback, source: 'static' };
};

module.exports = { resolveAuthority, reverseGeocode, fetchAuthorityByAI };