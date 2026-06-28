# 🏛️ CivicPulse — Citizen Issue Reporting Platform

> **Empowering Citizens. Building Communities.**
> Report, track, and resolve civic issues through collaboration, data, and AI-powered automation.

---

## 🌟 What is CivicPulse?

CivicPulse is a full-stack civic engagement platform that enables Indian citizens to:
- **Report** community issues with photo/video evidence
- **Track** resolution progress in real time
- **Collaborate** with authorities via automated email threads
- **Earn rewards** for active civic participation

---

## 🚀 Core Features

### 📸 AI-Powered Issue Reporting
- Citizens upload photos and/or videos of civic problems (potholes, broken streetlights, garbage piles, etc.)
- **Google Gemini AI** automatically analyzes the media and:
  - Categorizes the issue (13 categories)
  - Writes a detailed AI description
  - Assesses severity (Low / Medium / High / Critical)
  - Identifies the responsible government department
- User's **GPS location** is captured automatically via the browser Geolocation API
- Location is reverse-geocoded to a human-readable address using OpenStreetMap Nominatim

### 🔍 Duplicate Issue Detection
- Before submitting, the system checks if any **open issue exists within 50 metres** of the user's location in the same category
- If a duplicate is found:
  - The user is **alerted** with details of the existing issue
  - They are **redirected to the existing issue's tracking page** instead of creating a new report
  - This prevents noise and consolidates community attention on the same problem

### 📧 Automated Authority Notification
- Once an issue is submitted, a **detailed HTML email** is sent to the relevant government authority with:
  - Issue ID, title, category, severity
  - Reporter's name and timestamp
  - GPS coordinates and human-readable address
  - Direct links to photo/video evidence
  - Clear instructions for the authority on how to reply to update status

### 📡 Real-Time Issue Tracking
- Every issue gets a **unique ID** (e.g., `CP-LK8AX-3F2B`)
- Authorities reply to the email thread with status keywords:
  - `[STATUS: ACKNOWLEDGED]` → updates status to Acknowledged
  - `[STATUS: IN_PROGRESS]` → updates status to In Progress
  - `[STATUS: RESOLVED]` + attached photo/video proof → triggers AI verification
  - `[STATUS: REJECTED]` → marks issue rejected with reason
- The system monitors the inbox via **IMAP** and processes replies automatically
- Reporter receives an **email notification** whenever the status changes

### 🤖 AI Resolution Verification
- When an authority marks an issue resolved and attaches proof media, **Gemini AI verifies**:
  - Whether the proof shows the issue has actually been fixed
  - Confidence score of the verification
  - If confidence > 70%, the issue is automatically marked **Resolved**
  - If not convincing, the issue remains open and a note is added

### 🔐 Identity Verification (Two-Layer)
Two verifications are required before reporting an issue:
1. **Email OTP** — A 6-digit OTP is sent to the citizen's email (valid 10 minutes)
2. **Aadhaar Number** — 12-digit Aadhaar is verified (integrates with UIDAI API in production)

**Privacy guarantees:**
- Aadhaar number, email, mobile number are **never displayed** on public tracking pages
- Only the reporter's **name** is shown publicly

### 🏅 Gamification & Badges
Citizens earn **points and badges** for civic participation:

| Badge | Trigger | Points |
|-------|---------|--------|
| 🌟 First Reporter | Report first issue | 50 |
| 📋 Active Citizen | Report 5 issues | 100 |
| 🛡️ Community Guardian | Report 10 issues | 200 |
| 🏆 Civic Champion | Report 25 issues | 500 |
| 🦸 City Hero | Report 50 issues | 1000 |
| ✅ Problem Solver | First issue resolved | 100 |
| 💪 Change Maker | 5 issues resolved | 300 |
| 🌍 Community Hero | 10 issues resolved | 750 |
| 🚀 Early Adopter | First 100 users | 150 |
| ✔️ Verified Citizen | Complete verification | 75 |

**Certificates** are automatically generated as PDF and emailed when a badge is earned.

**Level System** (10 levels, 0–10,000 points):
Newcomer → Observer → Concerned Citizen → Active Resident → Community Member → Civic Advocate → City Guardian → Urban Hero → Community Champion → CivicPulse Legend

### 👁️ Public Transparency
- All issues are publicly visible — no login required to view or track
- Anyone can upvote issues to signal importance
- Map view shows all reported issues in an area

---

## 🗂️ Issue Categories

| Category | Department |
|----------|-----------|
| 🛣️ Road Damage | Public Works Department |
| 💧 Water Supply | Jal Board |
| ⚡ Electricity | DISCOM |
| 🚽 Sanitation | Sanitation Dept |
| 🗑️ Garbage | Solid Waste Management |
| 💡 Street Light | Street Lighting Dept |
| 🌊 Drainage | Drainage Dept |
| 🌳 Parks & Recreation | Parks Dept |
| 🏗️ Public Property Damage | Municipal Property |
| 🔊 Noise Pollution | Environment Dept |
| ⛔ Encroachment | Town Planning |
| 🚦 Traffic | Traffic Police |
| 📋 Other | General Administration |

---

## 🏗️ Tech Stack

### Backend
- **Node.js + Express** — REST API
- **MongoDB + Mongoose** — Database with geospatial indexing (`2dsphere`)
- **Cloudinary** — Media storage (images & videos)
- **Nodemailer** — SMTP email sending (Gmail)
- **IMAP / mailparser** — Email reply monitoring
- **Google Gemini 1.5 Flash** — AI vision analysis
- **jsonwebtoken** — JWT authentication
- **bcryptjs** — Password hashing
- **geolib** — Geospatial calculations
- **PDFKit** — Certificate generation
- **node-cron** — Scheduled jobs

### Frontend
- **React 18** — UI framework
- **React Router v6** — Client-side routing
- **Leaflet + React-Leaflet** — Interactive maps (OpenStreetMap)
- **Recharts** — Data visualization
- **react-dropzone** — Drag-and-drop file uploads
- **framer-motion** — Animations
- **date-fns** — Date formatting
- **react-hot-toast** — Notifications
- **Axios** — HTTP client

### External APIs
- **Google Gemini 1.5 Flash** (AI analysis)
- **Cloudinary** (media CDN)
- **OpenStreetMap Nominatim** (reverse geocoding, free)
- **UIDAI Aadhaar API** (verification, production)
- **Gmail SMTP + IMAP** (email send + monitoring)

---

## 🔒 Security Features
- Rate limiting on all API endpoints
- Helmet.js security headers
- JWT authentication with expiry
- Password hashing with bcrypt (12 rounds)
- Aadhaar never shown publicly
- Email/phone excluded from tracking pages
- OTP expiry (10 minutes) and attempt limiting
- CORS restricted to frontend origin
