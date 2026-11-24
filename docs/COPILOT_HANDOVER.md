# JEEVIKA — GitHub Copilot Master Handover & Execution Specification

> **Mission Priority:** High-Investment Overhaul.  
> **Target System:** Full-Stack JEEVIKA Continuity-of-Care Operating System.  
> **Source of Truth:** [`docs/PRD.md`](file:///Users/apple/Desktop/JEEVIKA/docs/PRD.md) and [`AGENTS.md`](file:///Users/apple/Desktop/JEEVIKA/AGENTS.md).  
> **Copilot Objectives:** Comprehensive Backend Bug Audit & Security Hardening + Complete Frontend UI Redesign adhering strictly to the JEEVIKA design system.

---

## 1. Executive Summary & Context

JEEVIKA is an enterprise continuity-of-care operating system uniting walk-in patient intake kiosks, outpatient clinician cockpits, inpatient (IPD) bedside SOS cascades, casualty triage sentries, and integer-paise pharmacy point-of-sale (POS) systems across urban and rural Primary Health Centres (PHCs).

The system is built on **Cloudflare Native Serverless Architecture** (Workers, D1 SQL, Durable Objects, KV, R2) and a **React 18 + Vite** web ERP, accompanied by deterministic mathematical safety algorithms in `packages/engine`.

You (GitHub Copilot) are tasked with spending dedicated compute cycles to:
1. **Comprehensively audit the backend for bugs, race conditions, multi-tenant leaks, integer-math errors, and architectural debt.**
2. **Completely overhaul the frontend UI:** The current UI has grown cluttered, inconsistent, and fragmented across monolithic files. You must redesign it into a world-class, clean, serene, high-trust clinical operating system utilizing the project's chosen design system tokens.

---

## 2. Non-Negotiable Master Rules (Architectural Invariants)

All code written or refactored MUST comply with these rules from [`AGENTS.md`](file:///Users/apple/Desktop/JEEVIKA/AGENTS.md):

1. **Shared Backend (`/api/v1`):** All web portals (`frontend/website`) and mobile apps (`frontend/app`) connect to the unified Cloudflare Worker backend.
2. **TypeScript Strict Mode:** No `any`. Strict types and Zod schemas enforce boundaries (`packages/shared`).
3. **Algorithms Decide, AI Translates:** Rule engines (`packages/engine`) govern clinical triage, stock eligibility, and safety gates. LLMs/speech models only format and translate text under human clinician review.
4. **Zero PHI Leaks (DPDP Act Compliance):** The in-flight redaction gate (`backend/src/modules/prune/index.ts`) must scrub 12-digit Aadhaar and 10-digit mobile numbers prior to any external AI inference call.
5. **Money = Integer Paise:** Zero floating-point math for prices, billing, taxes, or ledger entries ($\Sigma \text{Debits} = \Sigma \text{Credits}$). All money is stored and computed in integer paise ($\text{Rupees} \times 100$).
6. **Multi-Tenancy (`org_id`):** Every database query on Cloudflare D1 must be tenant-scoped via `tenantDb(ctx)`. Never write raw unsanitized SQL without an `org_id` filter.
7. **Cloudflare Native Only:** Use Cloudflare Workers, Cloudflare Pages, D1 SQL, Durable Objects, KV, and R2. Supabase is completely eradicated.
8. **Zero Secrets in Code/Git:** Never commit or hardcode API keys, credentials, or secrets. Rely on environment bindings or git-ignored `.env` files.

---

## 3. Mission 1: Backend Bug Audit & Hardening

### 3.1 Known Issues & Audit Hotspots

| Component | File Path | What to Inspect & Fix |
|---|---|---|
| **Monolithic Router Bloat** | [`backend/src/index.ts`](file:///Users/apple/Desktop/JEEVIKA/backend/src/index.ts) | 1,960+ lines containing mixed inline routes, socket dispatchers, and IPD beds logic. Extract routes into modular controllers in `backend/src/modules/`. |
| **Durable Objects Concurrency** | [`backend/src/do/ClinicInventory.ts`](file:///Users/apple/Desktop/JEEVIKA/backend/src/do/ClinicInventory.ts), [`ClinicHub.ts`](file:///Users/apple/Desktop/JEEVIKA/backend/src/do/ClinicHub.ts) | Audit transactional storage locks during concurrent FEFO batch allocations to prevent negative stock dispensing. Check alarm handlers. |
| **Session Isolation & Expiry** | [`backend/src/patient-session.ts`](file:///Users/apple/Desktop/JEEVIKA/backend/src/patient-session.ts), [`backend/src/staff-session.ts`](file:///Users/apple/Desktop/JEEVIKA/backend/src/staff-session.ts) | Ensure memory sessions strictly fall back to D1 in production; check token format regex, hash equality timing attacks (`equalHash`), and session revocation. |
| **Integer Math & POS Ledger** | [`backend/src/modules/ops/routes.ts`](file:///Users/apple/Desktop/JEEVIKA/backend/src/modules/ops/routes.ts) | Audit loose-tablet rounding, GST calculation, and double-entry ledger balancing. Ensure zero division-by-zero or float conversions exist. |
| **WebSockets & Binary Frames** | [`backend/src/data-socket.ts`](file:///Users/apple/Desktop/JEEVIKA/backend/src/data-socket.ts) | Verify frame byte size bounds (`maxSocketFrameBytes`), protocol version negotiation, ping/pong keepalive timeouts, and client reconnect handling. |
| **Local SQLite vs Cloudflare D1** | [`backend/local/server.ts`](file:///Users/apple/Desktop/JEEVIKA/backend/local/server.ts), [`migrate.ts`](file:///Users/apple/Desktop/JEEVIKA/backend/local/migrate.ts) | Ensure SQL queries in migrations work identically across SQLite (`better-sqlite3`) and Cloudflare D1 without dialect friction. |
| **Input Validation** | All `routes.ts` | Verify that every `POST`, `PUT`, and `PATCH` endpoint parses request bodies using Zod schemas with descriptive error messages. |

### 3.2 Bug Hunting Checklist
- [ ] Run `npm test` (verify all 191 tests pass; expand suite to cover unexercised edge cases).
- [ ] Check every SQL query in `backend/src/db/tenant.ts` for missing `org_id` clauses.
- [ ] Inspect error handlers: Ensure all exceptions throw typed `HTTPException` with proper status codes (400, 401, 403, 404, 422, 500) rather than unhandled promise crashes.
- [ ] Check date parsing logic: Use strict ISO 8601 UTC strings (`new Date().toISOString()`), avoid local timezone drift.

---

## 4. Mission 2: Complete Frontend UI Overhaul & Redesign

### 4.1 The Problem
The current UI is functionally comprehensive but visually cluttered, inconsistent, and fragmented:
- Giant monolithic component files (e.g., `DoctorConsultation.tsx` is 194KB; `PatientKiosk.tsx` is 197KB; `IPDDashboard.tsx` is 143KB).
- Patchwork CSS overrides with conflicting legacy styles (`.bg-blue-600`, `.text-indigo-700`) clashing with the new theme tokens.
- Noisy badge clutter, cramped table padding, inconsistent button variants, overlapping modal layers, and haphazard scrollbars.

### 4.2 The Solution & Theme Specification
You MUST redesign the UI to look **clean, serene, modern, and trustworthy**—resembling high-tier clinical software (Linear meets Apple Health & modern EHR).

#### Non-Negotiable Design Tokens ([`packages/design/tokens.css`](file:///Users/apple/Desktop/JEEVIKA/packages/design/tokens.css)):
- **Background Palette:**
  - Page Background: `#f8faf8` (`--ayu-bg` — serene, subtle warm-mint tinted off-white)
  - Card/Container Surface: `#ffffff` (`--ayu-surface` — pure white with crisp soft borders)
  - Secondary/Ivory: `#fffcf5` (`--ayu-ivory` — warm clinical highlight)
  - Soft Sub-surface: `#f1f5f2` (`--ayu-soft`)
- **Primary Brand (Deep Clinical Teal):**
  - Main Brand: `#087f72` (`--ayu-brand` / HSL `173 88% 26%`)
  - Hover State: `#06695f` (`--ayu-hover`)
  - Subtle Mint Pill/Accent: `#e6f4ef` (`--ayu-mint`)
- **Typography & Ink:**
  - Font Family: `'Plus Jakarta Sans'`, `'Noto Sans Devanagari'`, `sans-serif`
  - High-Contrast Ink: `#182724` (`--ayu-ink` — deep charcoal/forest slate, never pure `#000000`)
  - Muted Text: `#61716b` (`--ayu-muted` — accessible slate green)
  - Numbers & Vitals: Enable tabular numerals (`font-feature-settings: "tnum" on`) for clinical telemetry and currency.
- **Borders, Radius & Shadows:**
  - Border: `1px solid #e3eae6` (`--ayu-border` — subtle, clean, non-aggressive)
  - Corner Radius: `14px` (`rounded-xl` / `rounded-2xl`, smooth organic pill shapes for badges and buttons)
  - Shadow: `0 8px 32px rgba(24, 77, 57, 0.06)` (`--ayu-shadow` — soft, natural depth; zero heavy black drop-shadows)
- **Status & Triage Semantics:**
  - **Emergency / STAT / Code Blue:** Crimson `#c8213b` with soft pink background `#fff0f1` and crisp border `#fecdd3`.
  - **Warning / Review Required:** Warm Amber `#d98558` with soft amber background `#fffbeb`.
  - **Routine / Safe / Consented:** Emerald Teal `#087f72` with soft mint `#e6f4ef`.

### 4.3 Key Components to Overhaul

1. **`DoctorConsultation.tsx` (Outpatient Cockpit):**
   - Decompose into clean modular components:
     - `QueueSidebar.tsx`: Clean patient cards, waiting time pills, clear triage priority tags.
     - `PatientBanner.tsx`: High-contrast patient vitals strip, ABHA ID pill, allergy badges.
     - `AmbientScribeCard.tsx`: Speech-to-SOAP recording widget with calm waveform, clean editable SOAP notes.
     - `PrescriptionBuilder.tsx`: Generic substitution savings meter (-88%), clear dosage schedule pills, contraindication alerts.
     - `CbcResearchModal.tsx`: Uncluttered laboratory report validation with unit bounds.

2. **`PatientKiosk.tsx` (Reception & Triage Sentry):**
   - High-accessibility touch interface:
     - Prominent language selection tiles with native Indic scripts (`हिन्दी`, `ਪੰਜਾਬੀ`, `தமிழ்`, `English`).
     - Large, comfortable touch targets (minimum 48px height).
     - Acidity vs. STEMI differential interceptor modal: high clarity, calm yet urgent confirmation buttons.
     - Digital token slip view with printable bilingual layout.

3. **`IPDDashboard.tsx` (Inpatient Wards & Bedside SOS):**
   - Visual ward and bed census grid (`Room 101-108`, `Beds 1-4`).
   - Bedside SOS Trigger card: prominent, unambiguous action button.
   - Nurse STAT Reporter drawer: clean collapsible slide-over with pre-populated patient telemetry.
   - Doctor En Route latency logger with live timer display.

4. **`EmergencyTriage.tsx` (Casualty & Trauma Station):**
   - Live Code Blue Cascade banner with smooth CSS glow (no flickering animations).
   - Resuscitation Bays 1-4 allocation tiles with attending nurse/physician assignments.
   - ESI Acuity Score selector (Level 1 Resuscitation to Level 5 Non-urgent).

5. **`HospitalDashboard.tsx` & `ClinicAdminDashboard.tsx` (HQ Command & Operations):**
   - Clean KPI metric cards with generous horizontal breadth.
   - High-density yet spacious tables with alternating row hovers (`hover:bg-[#fafcf6]`).
   - Rebalancing inventory modal with multi-clinic stock transfer sliders.

6. **`LoginPage.tsx` (Default Authentication Gateway):**
   - Dual-mode segmented control: **1-Click Role Access** and **Staff Credentials**.
   - 7 persona cards with crisp icons, clear role designations, and smooth hover borders.
   - Quick-fill credential pills (`Doctor`, `Nurse`, `HQ Admin`, `Super Admin`) with instant feedback.

---

## 5. Development & Verification Workflows

```bash
# 1. Install dependencies
npm install
npm install --prefix frontend/website

# 2. Run the test suite (all 191 tests must pass)
npm test

# 3. Check TypeScript types across backend and website
npx tsc --noEmit
cd frontend/website && npx tsc --noEmit

# 4. Run local development servers
npm run dev:api    # Port 8790
npm run dev:web    # Port 5174

# 5. Scan for secrets before every commit
python3 scripts/secret-scan.py
```

---

## 6. Definition of Done (DoD)

1. **Zero TypeScript Errors:** Both root and `frontend/website` typecheck cleanly (`tsc --noEmit`).
2. **100% Test Pass Rate:** Existing 191 tests pass, plus new tests added for audited endpoints.
3. **Zero Secrets in Git:** Passed `python3 scripts/secret-scan.py`.
4. **Theme Fidelity:** All screens adhere strictly to `--ayu-bg`, `--ayu-brand`, `--ayu-ink`, `--ayu-border`, and `Plus Jakarta Sans`. No discordant blue/indigo classes.
5. **Clean Modular Architecture:** Giant monolithic files are broken into maintainable subcomponents under 300 lines each.
6. **Responsive Layouts:** Mobile, tablet, and desktop viewports render with zero horizontal overflow and clean touch targets.
