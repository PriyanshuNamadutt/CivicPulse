/**
 * authorities.js
 *
 * Static fallback authority map.
 * Used when:
 *   - Gemini AI cannot find a verified email (low confidence)
 *   - GEMINI_API_KEY is not set
 *   - AI call times out or fails
 *
 * Override any entry at runtime by setting environment variables:
 *   AUTH_ROAD_DAMAGE_EMAIL=pwd@yourmunicipality.gov.in
 *   AUTH_WATER_SUPPLY_EMAIL=water@yourmunicipality.gov.in
 *   ... etc.
 *
 * The primary authority resolution (AI-powered, location-aware) lives in:
 *   backend/services/authorityService.js → resolveAuthority()
 */

const STATIC_AUTHORITY_MAP = {
  road_damage: {
    name:       'Public Works Department',
    department: 'PWD',
    email:      process.env.AUTH_ROAD_DAMAGE_EMAIL    || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_ROAD_DAMAGE_PHONE    || null,
  },
  water_supply: {
    name:       'Water Supply & Sewerage Board',
    department: 'Jal Board',
    email:      process.env.AUTH_WATER_SUPPLY_EMAIL   || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_WATER_SUPPLY_PHONE   || null,
  },
  electricity: {
    name:       'Electricity Distribution Company',
    department: 'DISCOM',
    email:      process.env.AUTH_ELECTRICITY_EMAIL    || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_ELECTRICITY_PHONE    || null,
  },
  sanitation: {
    name:       'Municipal Sanitation Department',
    department: 'Sanitation',
    email:      process.env.AUTH_SANITATION_EMAIL     || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_SANITATION_PHONE     || null,
  },
  garbage: {
    name:       'Solid Waste Management Department',
    department: 'SWM',
    email:      process.env.AUTH_GARBAGE_EMAIL        || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_GARBAGE_PHONE        || null,
  },
  street_light: {
    name:       'Street Lighting Department',
    department: 'Street Lights',
    email:      process.env.AUTH_STREET_LIGHT_EMAIL   || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_STREET_LIGHT_PHONE   || null,
  },
  drainage: {
    name:       'Drainage & Sewerage Department',
    department: 'Drainage',
    email:      process.env.AUTH_DRAINAGE_EMAIL       || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_DRAINAGE_PHONE       || null,
  },
  parks_recreation: {
    name:       'Parks & Recreation Department',
    department: 'Parks',
    email:      process.env.AUTH_PARKS_EMAIL          || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_PARKS_PHONE          || null,
  },
  public_property_damage: {
    name:       'Municipal Property Department',
    department: 'Municipal Property',
    email:      process.env.AUTH_PROPERTY_EMAIL       || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_PROPERTY_PHONE       || null,
  },
  noise_pollution: {
    name:       'State Pollution Control Board',
    department: 'Environment',
    email:      process.env.AUTH_NOISE_EMAIL          || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_NOISE_PHONE          || null,
  },
  encroachment: {
    name:       'Town Planning & Anti-Encroachment Cell',
    department: 'Town Planning',
    email:      process.env.AUTH_ENCROACHMENT_EMAIL   || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_ENCROACHMENT_PHONE   || null,
  },
  traffic: {
    name:       'Traffic Police Department',
    department: 'Traffic Police',
    email:      process.env.AUTH_TRAFFIC_EMAIL        || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_TRAFFIC_PHONE        || null,
  },
  other: {
    name:       'Municipal Corporation — General Administration',
    department: 'General',
    email:      process.env.AUTH_GENERAL_EMAIL        || process.env.FALLBACK_AUTHORITY_EMAIL || 'civicpulse.authority@gmail.com',
    phone:      process.env.AUTH_GENERAL_PHONE        || null,
  },
};

/**
 * getStaticAuthority(category)
 * Returns the static fallback entry for a category.
 * Used by authorityService.js as the fallback when AI lookup fails.
 */
const getStaticAuthority = (category) =>
  STATIC_AUTHORITY_MAP[category] || STATIC_AUTHORITY_MAP.other;

module.exports = { STATIC_AUTHORITY_MAP, getStaticAuthority };