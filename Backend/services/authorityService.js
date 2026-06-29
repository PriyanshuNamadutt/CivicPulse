/**
 * authorityService.js
 *
 * ARCHITECTURE: AI + Live Web Search → Real Authority Contact
 * ──────────────────────────────────────────────────────────
 *
 * Step 1 — Nominatim reverse-geocodes GPS → city, district, state, pincode
 *
 * Step 2 — Gemini (with google_search grounding enabled) searches the web
 *           for the responsible government body and its contact details.
 *           Because grounding is on, Gemini reads actual government websites,
 *           official portals, and contact pages — not hallucinated data.
 *           Returns: name, department, email, phone, website, jurisdiction
 *
 * Step 3 — Email validation: if Gemini found an email, use it.
 *           If not (no public email exists), fall back to AUTHORITY_EMAIL_FALLBACK
 *           from .env (your admin inbox). Issue is always created regardless.
 *
 * This works for ANY location in India — village panchayat, district HQ,
 * metro city — because the search is live, not a hardcoded table.
 *
 * ENV VARS NEEDED:
 *   GEMINI_API_KEY             — Google AI Studio key (enables web search grounding)
 *   AUTHORITY_EMAIL_FALLBACK   — your inbox; catches issues with no public authority email
 */

const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Gemini 2.5 Flash with grounding support
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Reverse geocode GPS → structured address
// ─────────────────────────────────────────────────────────────────────────────
const reverseGeocode = async (latitude, longitude) => {
  try {
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
      { timeout: 8000, headers: { 'User-Agent': 'CivicPulse/1.0 (civic-issue-reporting)' } }
    );
    const addr = res.data?.address || {};
    return {
      display:  res.data?.display_name || '',
      city:     addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || '',
      district: addr.county || addr.state_district || '',
      state:    addr.state || '',
      pincode:  addr.postcode || '',
      country:  addr.country || 'India'
    };
  } catch (err) {
    console.warn('[authorityService] Nominatim failed:', err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Category → what kind of government body to search for
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_SEARCH_CONTEXT = {
  road_damage:            'road repair pothole civic complaint municipal corporation PWD public works',
  water_supply:           'water supply board jal board complaint contact',
  electricity:            'electricity board DISCOM power distribution company complaint',
  sanitation:             'sanitation department solid waste municipal corporation complaint',
  garbage:                'garbage collection solid waste management municipal complaint',
  street_light:           'street light complaint municipal corporation electrical department',
  drainage:               'drainage stormwater flooding municipal corporation complaint',
  parks_recreation:       'parks gardens department municipal corporation complaint',
  public_property_damage: 'municipal corporation property damage complaint engineering department',
  noise_pollution:        'pollution control board noise complaint environment department',
  encroachment:           'anti encroachment town planning municipal enforcement complaint',
  traffic:                'traffic police complaint contact',
  other:                  'municipal corporation general complaint helpdesk'
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Gemini with web search grounding finds the real authority + contact
// ─────────────────────────────────────────────────────────────────────────────
const findAuthorityWithWebSearch = async (category, aiDescription, geocode) => {
  try {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

    const searchContext = CATEGORY_SEARCH_CONTEXT[category] || 'municipal corporation complaint';

    // Build the most specific location string possible
    const locationParts = [];
    if (geocode?.city)     locationParts.push(geocode.city);
    if (geocode?.district && geocode.district !== geocode.city) locationParts.push(geocode.district);
    if (geocode?.state)    locationParts.push(geocode.state);
    locationParts.push('India');
    const locationText = locationParts.join(', ');

    const prompt = `You are helping route a civic complaint to the correct Indian government authority.

LOCATION: ${locationText}
Full address: ${geocode?.display || locationText}
Pincode: ${geocode?.pincode || 'unknown'}

ISSUE:
Category: ${category.replace(/_/g, ' ')}
Description: ${aiDescription}
Search context: ${searchContext}

YOUR TASK:
1. Search the web to find the EXACT government body responsible for "${category.replace(/_/g, ' ')}" issues at this specific location.
2. Find their official contact details — especially email addresses — from their official website, government portals (pgportal.gov.in, cpgrams, state grievance portals), or official directories.
3. For local issues (road, garbage, drainage, lights, parks): look for the municipal corporation / nagar palika / gram panchayat for that area.
4. For electricity: find the actual DISCOM serving that pincode/district.
5. For traffic: find the specific police commissionerate or SP office.
6. For pollution: find the regional office of the state PCB.
7. Search for terms like: "[city/district] [department] email complaint contact official"
8. Check official .gov.in or .nic.in websites, state government portals, and the body's own website.

IMPORTANT RULES:
- Only return email addresses you actually found on official sources — do NOT guess or construct email addresses
- If you cannot find a verified email, set email to null
- Phone: return the official helpline number if found, else "1916"
- website: return the official website URL if found
- grievancePortal: if the body has an online grievance portal URL, return it

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "name": "<full official name of the responsible body>",
  "department": "<short routing label e.g. BBMP-Roads, BESCOM, Traffic Police, Gram Panchayat>",
  "email": "<verified official email or null>",
  "phone": "<official helpline number>",
  "website": "<official website URL or null>",
  "grievancePortal": "<online complaint portal URL or null>",
  "jurisdiction": "<city, district, or area this body covers>",
  "emailSource": "<where you found the email: official website / government portal / directory / null>",
  "confidence": <0.0-1.0>,
  "notes": "<any useful notes about this authority or how to contact them>"
}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      // Enable Google Search grounding — Gemini will actually search the web
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024
      }
    };

    const response = await axios.post(GEMINI_API_URL, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 45000 // web search takes longer than pure generation
    });

    const raw = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Empty response from Gemini');

    // Extract JSON from response (grounded responses sometimes include extra text)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Gemini response');

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.name || !parsed.department) throw new Error('Incomplete authority data from AI');

    // Log what grounding sources were used
    const groundingMeta = response.data.candidates?.[0]?.groundingMetadata;
    const sources = groundingMeta?.groundingChunks?.map(c => c.web?.uri).filter(Boolean) || [];
    if (sources.length) {
      console.log(`[authorityService] Web sources used: ${sources.slice(0, 3).join(', ')}`);
    }

    console.log(`[authorityService] Found: "${parsed.name}" | email=${parsed.email || 'none'} | confidence=${parsed.confidence}`);
    return { ...parsed, groundingSources: sources };

  } catch (err) {
    console.warn('[authorityService] Web search authority lookup failed:', err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Determine final email to use
// ─────────────────────────────────────────────────────────────────────────────
const resolveEmail = (aiResult) => {
  // AI found a real email from web search
  if (aiResult?.email && aiResult.email !== 'null') {
    console.log(`[authorityService] Using AI-found email: ${aiResult.email} (source: ${aiResult.emailSource})`);
    return { email: aiResult.email, emailSource: aiResult.emailSource || 'ai-web-search' };
  }

  // No public email found — use admin fallback from .env
  const fallback = process.env.AUTHORITY_EMAIL_FALLBACK;
  if (fallback) {
    console.log(`[authorityService] No public email found for "${aiResult?.department}" — routing to AUTHORITY_EMAIL_FALLBACK`);
    return { email: fallback, emailSource: 'admin-fallback' };
  }

  console.warn(`[authorityService] No email and no AUTHORITY_EMAIL_FALLBACK set — email will be skipped`);
  return { email: null, emailSource: 'none' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
const resolveAuthority = async (category, aiDescription, latitude, longitude, staticFallback) => {

  // Step 1: Get precise location from GPS
  const geocode = await reverseGeocode(latitude, longitude);
  if (geocode?.city) {
    console.log(`[authorityService] Location resolved: ${geocode.city}, ${geocode.district}, ${geocode.state}`);
  }

  // Step 2: Gemini searches the web to find real authority + contact
  const aiResult = await findAuthorityWithWebSearch(category, aiDescription, geocode);

  // Step 3: Determine email
  const base = aiResult || staticFallback;
  const { email, emailSource } = resolveEmail(aiResult);

  return {
    name:            base.name         || staticFallback.name,
    department:      base.department   || staticFallback.department,
    phone:           base.phone        || staticFallback.phone || '1916',
    jurisdiction:    base.jurisdiction || geocode?.city || '',
    website:         aiResult?.website         || null,
    grievancePortal: aiResult?.grievancePortal || null,
    email:           email             || staticFallback.email,
    emailSource,
    source:          aiResult ? 'ai-web-search' : 'static',
    groundingSources: aiResult?.groundingSources || [],
    notes:           aiResult?.notes   || ''
  };
};

module.exports = { resolveAuthority, reverseGeocode };
