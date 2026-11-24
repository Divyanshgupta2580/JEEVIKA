# JEEVIKA (जीविका) — Complete System & Feature Specification for UI Design

> **Purpose:** This document is the comprehensive, feature-complete functional specification of the entire JEEVIKA platform. It catalogs all capabilities, user personas, data fields, user actions, business rules, edge cases, and inter-module workflows across the entire system.  
> **Target Audience:** UI/UX Design Agents and Frontend Architects.  
> **Scope:** Web ERP, Patient Touchscreen Kiosks, Clinician Cockpits, Emergency Consoles, Pharmacy POS, Inpatient Ward Sentinels, and Patient Mobile Companion Applications.  
> **Instructional Note:** This document specifies **what** features exist, **what data** must be captured and displayed, and **what interactions** must occur. It intentionally contains **zero visual styling or layout directives** (no prescribed colors, fonts, CSS classes, or component geometry), leaving all design, aesthetic, and structural decisions entirely to the designer.

---

## 1. System Architecture & User Personas

### 1.1 Organizational Hierarchy
The platform operates as a multi-tenant, hub-and-spoke healthcare network:
- **Headquarters (HQ) / Hospital Network:** High-level administrative and financial umbrella overseeing multiple health facilities.
- **Satellite Clinics / Primary Health Centres (PHCs):** Individual healthcare delivery sites equipped with outpatient clinics, emergency triage bays, pharmacies, and inpatient beds.
- **Clinical Departments:** OPD (Outpatient Department), Casualty / Emergency Resuscitation, IPD (Inpatient Wards), Pharmacy & Dispensary, AYUSH Integrative Medicine, and Accounts / Administration.

### 1.2 User Personas & Permissions

| Persona ID | System Role | Primary Responsibilities & Access Scope |
|---|---|---|
| `SUPER_ADMIN` | Platform Registrar & Group CA | Multi-tenant governance, system-wide financial audit locks, chartered accountant suites, platform configuration, regulatory logs. |
| `HOSPITAL_ADMIN` | Chief Medical Officer & Superintendent | Hospital command center, fleet-wide bed census, inter-clinic inventory rebalancing, network-wide staff management, operational analytics. |
| `CLINIC_ADMIN` | Clinic Operations Manager | Single-clinic operations hub, local shift management, cash registers, clinic-level procurement, local doctor rosters. |
| `DOCTOR` | Senior Consultant Physician (MD) | Outpatient clinical cockpit, patient queue management, patient vitals review, ambient consultation transcription, SOAP documentation, diagnosis coding (ICD-11 & NAMASTE), e-prescriptions, generic substitution, research CBC analysis. |
| `NURSE` | Ward Inpatient Lead Nurse (RN) | Inpatient bed census, bedside SOS response, nurse STAT emergency reporting, routine medication administration, clinical rounds notes. |
| `STAT_NURSE` | Casualty Resuscitation Lead Nurse | Emergency triage station, ESI trauma acuity scoring, resuscitation bay allocation, Code Blue alarm management, STAT emergency token processing. |
| `CASHIER` | Pharmacist & POS Cashier | Prescription fulfillment, FEFO batch allocation, loose-tablet dispensing, split-payment processing, GST invoice issuance, CDSCO drug register logs. |
| `PATIENT` | Walk-in Patient & Home User | Multilingual self-service kiosk check-in, ABHA verification, digital symptom reporting, emergency tokens, mobile home monitoring, prescription locker, daily health check-ins. |

---

## 2. Authentication & Access Control

### 2.1 Staff & Clinician Authentication
- **1-Click Direct Role Access Gateway:**
  - One-click entry presets for demonstration and rapid operational evaluation across 7 clinical personas (`HQ Executive`, `Doctor OPD`, `Ward Inpatient Nurse`, `Emergency Triage Nurse`, `Clinic Operations Hub`, `Patient Self-Service Kiosk`, `CA Financial & Audit Suite`).
  - Session initialization binding user profile, active tenant identifier (`org_id`), assigned facility identifier (`clinic_id`), and role-based access control (RBAC) claims.
- **Staff Credential Sign-In:**
  - Standard enterprise sign-in requiring verified staff email address and password.
  - Role pill quick-fill presets (`Doctor`, `Nurse`, `HQ Admin`, `Super Admin`).
  - Validation against cryptographic password hashes with constant-time verification.
  - Multi-tenant facility selection: Allows authorized staff to switch between assigned clinics within their hospital network.
  - Session Token Handling: Issues role-scoped tokens; handles token expiration, silent token refreshes, and explicit session revocations.
- **Password Recovery & Account Registration:**
  - Password reset request workflow via registered staff email.
  - Facility staff onboarding and account registration workflows.

### 2.2 Patient Authentication & Identity Verification
- **14-Digit ABHA (Ayushman Bharat Health Account) Verification:**
  - Manual 14-digit numeric ABHA entry with checksum format validation.
  - Simulated OTP verification sent to the patient's linked mobile phone.
- **1-Click ABHA QR Code Scanner:**
  - Optical scanning and decoding of ABDM-standard ABHA QR codes.
  - Automated extraction of demographic fields: Full Name, Gender, Date of Birth / Calculated Age, Residential Address, and ABHA Address (`@abdm`).
- **Mobile Number Authentication:**
  - 10-digit Indian mobile number capture with simulated OTP verification.
- **Temporary / Anonymous Walk-In Token:**
  - Quick-token generation for emergency, illiterate, or unconsented walk-in patients without an ABHA identifier.
- **PM-JAY Scheme Verification Indicator:**
  - Real-time pre-check status indicator verifying eligibility for PM-JAY ₹5 Lakh cashless coverage.

---

## 3. Patient Self-Service Kiosk (Reception & Triage Sentry)

### 3.1 Language Selection & Voice Guidance
- **Multilingual Support Across 9 Indic Languages:**
  - Hindi (`हिन्दी`), English, Punjabi (`ਪੰਜਾਬੀ`), Tamil (`தமிழ்`), Bengali (`বাংলা`), Telugu (`తెలుగు`), Marathi (`मराठी`), Gujarati (`ગુજરાતી`), and Kannada (`ಕನ್ನಡ`).
  - Native-script visual selectors with localized audio greetings.
- **Speech-to-Text (STT) & Audio Playback:**
  - Hands-free, voice-first interaction for low-literacy users.
  - Live audio listening status (Idle, Listening, Processing, Audio Response Active).
  - Code-mixed voice handling (e.g., Hinglish).
  - High-accessibility captions synchronized with all spoken prompts.

### 3.2 DPDP Act 2023 Digital Consent Management
- **Granular Consent Selection:**
  - Clear, accessible notice presented in the patient's chosen language.
  - Four granular, independent consent checkboxes:
    1. Direct Medical Care & Examination.
    2. Pharmacy Inventory Sharing & Fulfillment.
    3. Remote Post-Discharge Follow-Up & Home Monitoring.
    4. Anonymized Epidemiological Research.
- **Consent Receipt Generation:**
  - Unique cryptographic Consent Receipt ID and QR code.
  - Audit logging of consent timestamp, IP/Kiosk ID, and versioned notice text.
  - Consent revocation handling (tombstoning patient data across all non-emergency views).
  - Guardian consent authorization flag for pediatric patients under 18 years of age.

### 3.3 Adaptive Clinical Triage (Sentinel Engine)
- **Chief Complaint Intake:**
  - Category selection: Fever / Chills, Stomach Pain & Acidity, Chest Pain & Breathlessness, Cough & Respiratory, Headache & Neurological, Trauma & Injury, General Malaise.
  - Freeform spoken or typed chief complaint description.
- **Information-Gain Adaptive Questioning:**
  - Dynamic question engine following the clinical SOCRATES pain and symptom assessment framework.
  - Evaluates symptom vectors and dynamically serves the next most informative question to narrow differential diagnoses.
  - Input options for each question: Yes, No, Unsure (accessible by voice or button tap).
  - Stopping criterion: Resolves triage acuity in a median of 8 questions or fewer.
- **Prescription & Paper Document OCR:**
  - Integrated camera capture or upload of previous paper prescriptions and lab slips.
  - Optical character recognition extracting previous medications, dosages, and documented allergies.
  - Visual review interface displaying extracted fields with per-field confidence ratings for patient verification.

### 3.4 Acidity vs. STEMI Differential Interceptor Modal
- **Clinical Problem Solved:** Intercepts atypical acute myocardial infarction (STEMI) presentations masked as benign indigestion or acidity.
- **Automatic Interception Trigger:** Fires instantly whenever a patient selects or speaks complaints relating to stomach pain, burning sensation, or acidity.
- **Mandatory Differential Questions:**
  - "Does the pain radiate to your left arm, jaw, back, or neck?"
  - "Are you experiencing unusual sweating, cold clamminess, or breathlessness?"
  - "Is there a sensation of heavy pressure, squeezing, or crushing on your chest?"
- **Outcomes:**
  - If any symptom is confirmed: Immediate sub-15ms priority elevation to **STAT Emergency**; triggers audible kiosk alert; directs patient to immediate resuscitation bay; dispatches notification to floor staff.
  - If all symptoms are denied: Kiosk gracefully resumes routine outpatient triage.

### 3.5 Token Slip Issuance & Handoff
- **Triage Acuity Classification:**
  - Priority 1: STAT Emergency (Red Flag).
  - Priority 2: Priority Clinical Review (Yellow Flag).
  - Priority 3: Routine Outpatient Consultation (Green Flag).
- **Digital Token Slip Display & Print:**
  - Displays Assigned Token Number (e.g., `#EMERG-001`, `#OPD-104`).
  - Shows Patient Name, Age, Gender, Chief Complaint Summary, Triage Tier, Assigned Consultation Room, and Estimated Wait Time.
  - One-click print / download action for bilingual physical slip.
  - Automated transmission of patient record to Doctor OPD Cockpit queue.

---

## 4. Outpatient Clinical Cockpit (Doctor OPD Console)

### 4.1 Queue & Patient Intake Management
- **Prioritized Patient Waiting List:**
  - Sorted by triage urgency tier, followed by arrival timestamp (FIFO within tier).
  - Live visual badges indicating priority tier, elapsed wait time, and language preference.
  - Visual indicator for patients who bypassed routine intake via emergency interceptors.
- **Patient Calling & Session Management:**
  - One-click "Call In" action locking the consultation session to the active physician.
  - Ability to mark patients as "In Consultation", "Sent to Diagnostics", "No Show", or "Completed".

### 4.2 Comprehensive Patient Banner & Telemetry
- **Demographics & Medical Record Identifiers:**
  - Full Name, Age, Gender, ABHA ID, Encounter ID, Visit Type (New vs. Follow-up).
- **Vitals Telemetry Strip:**
  - Systolic and Diastolic Blood Pressure (mmHg).
  - Pulse / Heart Rate (bpm).
  - Oxygen Saturation ($SpO_2$ in %).
  - Body Temperature ($^\circ\text{F}$ or $^\circ\text{C}$).
  - Respiratory Rate (breaths/min).
  - Random Blood Sugar / Fasting Blood Glucose (mg/dL).
  - Visual indicators for abnormal or critical vital thresholds.
- **Safety Flags & Clinical Profile:**
  - Documented Drug Allergies (prominently flagged).
  - Chronic Co-morbidities (e.g., Type 2 Diabetes, Hypertension, CKD, Asthma).
  - Active Medications and previous consultation history.

### 4.3 Ambient Clinical Scribe (Speech-to-SOAP)
- **Ambient Voice Recording:**
  - Start, pause, resume, and stop controls for natural doctor-patient dialogue recording.
  - Real-time speech-to-text transcription feed.
- **Source-Linked SOAP Note Generation:**
  - **Subjective (S):** Chief complaints, history of present illness, review of systems, patient-reported symptoms.
  - **Objective (O):** Physical examination findings, measured vital signs, observed clinical signs.
  - **Assessment (A):** Differential diagnoses ranked with confidence levels, rule-out considerations, and clinical disclaimers.
  - **Plan (P):** Prescribed medications, diagnostic investigations ordered, dietary/lifestyle advice, follow-up timeline.
- **Evidence Provenance & Citation Verification:**
  - Every generated line in the SOAP note includes clickable citation chips linking directly to the source utterance timestamp, OCR bounding box, or intake question response.
  - Full inline text editor allowing the doctor to modify, add, or delete any section.
  - Mandatory clinician sign-off action before the note becomes a permanent medical record.

### 4.4 Diagnostic Coding & Terminology
- **ICD-11 Diagnostic Search:**
  - Searchable disease and disorder nomenclature with auto-complete.
  - Direct binding of official ICD-11 codes and descriptions to the clinical encounter.
- **AYUSH NAMASTE / TM-2 Harmonization:**
  - Standardized terminology search for traditional medicine conditions and formulations.

### 4.5 E-Prescription & Rx-to-Shelf Optimization
- **Medication Formulation Builder:**
  - Search by Brand Name, Generic Molecule / Salt, or Category.
  - Form selector: Tablet, Capsule, Syrup, Suspension, Injection, Ointment, Inhaler, Drops.
  - Dosage parameters: Strength (e.g., 500 mg), Frequency (e.g., Once Daily, Twice Daily, Thrice Daily, SOS), Timing relative to meals (Before Food, After Food, With Food), Course Duration (number of days), Total Units to Dispense.
  - Special Instructions (e.g., "Take with warm water", "Do not crush").
- **Live Inventory-Aware Stock Verification:**
  - Displays real-time stock availability in the local clinic dispensary.
  - Alerts doctor if a medication is out of stock, indicating availability at neighboring clinics within the network.
- **PMBJP Jan Aushadhi Generic Substitution (Savings Meter):**
  - Evaluates prescribed branded medications against bioequivalent Jan Aushadhi generic salts.
  - Displays side-by-side pricing: Branded Price vs. PMBJP Generic Price.
  - Calculates and displays exact patient rupee savings and percentage savings (up to 88% discount).
  - Clinician approval control: One-click toggle allowing the physician to accept the generic substitution or enforce "Dispense Brand as Prescribed".
- **Drug Safety & Interaction Checks:**
  - Automatic collision checks against patient's documented drug allergies.
  - Detection of severe drug-drug interactions and duplicate therapeutic classes.

### 4.6 Research CBC Analysis Explorer (Partitioned Research Tool)
- **Clinical Role:** Diagnostic research explorer strictly separated from legal medical records.
- **Document Ingestion & Verification:**
  - Upload PDF or image of a Complete Blood Count (CBC) report, or select synthetic presets.
  - Client-side OCR extracting five mandatory hematological parameters:
    1. White Blood Cell Count (WBC in $10^9/\text{L}$).
    2. Red Blood Cell Count (RBC in $10^{12}/\text{L}$).
    3. Neutrophil Percentage (%).
    4. Lymphocyte Percentage (%).
    5. Monocyte Percentage (%).
  - Manual verification inputs allowing the doctor to review, correct, and confirm all five parameters.
- **Inference Execution & Research Score Output:**
  - Runs frozen logistic model on confirmed parameters.
  - Displays calculated research score ($P \in [0, 1]$) against frozen decision cutoff (`0.6268`).
  - Prominent non-diagnostic disclaimer: States that scores are experimental research outputs and cannot replace histological/clinical judgment.

### 4.7 Consultation Disposition & Discharge Actions
- **Disposition Choices:**
  - "Send to Pharmacy POS" (electronically transmits approved prescription to dispensary).
  - "Admit to Inpatient Ward (IPD)" (opens immediate ward/bed assignment workflow).
  - "Refer to Emergency / Casualty" (triggers high-acuity transfer).
  - "Complete Consultation & Discharge Home".
- **Documentation Outputs:**
  - Generate and view printable bilingual prescription slip.
  - Generate and download ABDM-compliant FHIR R4 Encounter Bundle.

---

## 5. Inpatient Ward Management (IPD) & Bedside SOS Sentry

### 5.1 Ward & Bed Census Grid
- **Ward Hierarchy:**
  - Categorized by care level: General Ward (Male/Female), Semi-Private, Private Rooms, Intensive Care Unit (ICU), Post-Operative Ward.
- **Bed Status Indicators:**
  - Available / Vacant.
  - Occupied.
  - Maintenance / Disinfection in progress.
  - Reserved for incoming transfer.
- **Bedside Occupancy Data Card:**
  - Bed Number & Room Identifier (e.g., Room 105, Bed 1).
  - Patient Full Name, Age, Gender, Admission Date & Elapsed Stay Days.
  - Admitting Diagnosis and Attending Physician Name.
  - Current Acuity Status (Stable, Under Observation, STAT Alert).

### 5.2 Patient Bedside Distress SOS Sentry (Phase 2)
- **Clinical Problem Solved:** Eliminates nurse notification lag and ungrounded distress alerts for hospitalized patients.
- **Physical / Digital Distress Trigger:**
  - High-visibility emergency distress trigger accessible from the bed view.
  - Cryptographically bound to Room, Bed Number, Patient Identity, and Assigned Attending Doctor.
- **Two-Tier Hospital Alert Cascade:**
  1. **Tier 1 (Floor Nursing Console - Sub-5-Second SLA):**
     - High-priority visual alert across all nursing station monitors.
     - Pulsing Code Blue emergency banner displaying exact Room and Bed coordinates.
     - Automated dispatch indicator for floor crash cart arrival.
  2. **Tier 2 (Attending Physician Screen Override):**
     - High-priority interrupt banner broadcast directly across the attending doctor's screen regardless of their active workspace.
     - Displays: Room Number, Bed Number, Patient Name, Assigned Diagnosis, and Trigger Time.
- **Doctor "En Route" Telemetry & SLA Tracking:**
  - Action button: "Acknowledge & En Route".
  - Live stopwatch tracking the exact elapsed latency between patient trigger and doctor acknowledgment.
  - Permanent audit logging of attending physician arrival latency.

### 5.3 Nurse STAT Bed Distress Reporter
- **Purpose:** Bedside nursing drawer for reporting rapid clinical deterioration in incapacitated patients.
- **Reporting Inputs:**
  - Room & Bed selector (pre-filled if accessed from bed view).
  - Acuity Category: Code Blue (Cardiac/Respiratory Arrest), Rapid Response (Acute Deterioration), High Fall Incident, Acute Pain / Severe Reaction.
  - Quick Vital Entry: Current Blood Pressure, Heart Rate, $SpO_2$, Glasgow Coma Scale (GCS) score.
  - Clinical Narrative / Observation text field.
- **Execution Actions:**
  - "Dispatch Crash Cart & Alert Floor Team".
  - "Notify Attending Consultant Immediately".

### 5.4 Inpatient Admission, Transfer & Discharge Workflows
- **Admission Workflow:**
  - Select patient from outpatient queue, casualty triage, or direct entry.
  - Assign destination ward, room, and bed.
  - Set daily room tariff in integer paise.
- **Bed Transfer Workflow:**
  - Move patient between rooms or wards (e.g., General Ward to ICU) with timestamped audit logging.
- **Discharge & Billing Reconciliation:**
  - Calculation of total inpatient stay duration.
  - Auto-summation of daily bed charges, nursing fees, and inpatient medication ledger entries.
  - Clinical discharge summary builder (Discharge condition, home medication regimen, follow-up instructions).
  - Bed status transition to "Cleaning / Sanitization Required".

---

## 6. Casualty & Emergency Trauma Triage

### 6.1 Emergency Severity Index (ESI) Triage Station
- **Rapid Patient Ingestion:**
  - Immediate walk-in, ambulance, or internal transfer intake bypassing administrative queues.
  - Primary vital signs entry: Heart Rate, Blood Pressure, $SpO_2$, Respiratory Rate, GCS, Temperature.
- **Acuity Level Assignment (ESI 1 through 5):**
  - **Level 1 (Resuscitation):** Immediate life-saving intervention required (cardiac arrest, severe respiratory failure, massive trauma).
  - **Level 2 (Emergent):** High risk, altered mental status, severe pain, time-critical condition.
  - **Level 3 (Urgent):** Stable vitals, multiple diagnostic resources anticipated.
  - **Level 4 (Less Urgent):** Single diagnostic or therapeutic resource required.
  - **Level 5 (Non-urgent):** Simple examination or medication prescription only.

### 6.2 Resuscitation Bay Management
- **Bay Allocation Grid:**
  - Real-time status for Casualty Resuscitation Bays (Bay 1 through Bay 4).
  - Status states: Occupied, Preparing / Sanitizing, Available.
  - Assigned trauma nurse lead, emergency medical officer (EMO), and life-support equipment bindings (Defibrillator, Ventilator, Crash Cart).
- **STAT Resuscitation Token (#EMERG):**
  - Generates instant emergency token routed directly to Resuscitation Bay 1.
  - Real-time broadcasting across the casualty station console.

### 6.3 Hospital-Wide Emergency Broadcast Banner
- **Persistent Header Alert:**
  - Active hospital emergency banner visible across all authorized clinical views during an active Code Blue event.
  - Shows active emergency location, patient name, elapsed time since trigger, and responding team status.

---

## 7. Pharmacy Point-of-Sale (POS) & Dispensary

### 7.1 Prescription Ingestion & Batch Resolution
- **Prescription Inflow:**
  - Direct retrieval of electronic prescriptions from Doctor OPD Cockpit.
  - Manual paper prescription search or barcode/QR token scanning.
- **Rx-to-Shelf FEFO Batch Allocation:**
  - Automatic First-Expiry-First-Out (FEFO) batch matching.
  - **Course-Validity Constraint:** Algorithmic verification that the allocated batch expiry date outlives the patient's full treatment duration by at least 14 buffer days.
  - Automatic warning if a batch is valid today but would expire mid-course.
- **Alternative Formulation & Cross-Clinic Sourcing:**
  - Displays in-stock alternatives if prescribed brand is unavailable.
  - Sourcing suggestions from neighboring clinics within the network with transfer time estimates.

### 7.2 Cart & Loose-Unit Dispensing Operations
- **Dispensing Unit Flexibility:**
  - Dispense by Full Box, Strip, Blister Pack, Bottle, or Individual Loose Tablets.
  - Automatic unit-price computation in integer paise preventing rounding errors.
- **Line-Item Fields in Billing Cart:**
  - Medication Name, Generic Salt, Manufacturer.
  - Batch Number, Expiry Date.
  - Quantity Dispensed (Pack count and/or Loose units).
  - Unit Price (in integer paise), Gross Total.
  - Discount (percentage discount or flat paise deduction).
  - GST Breakdown (CGST % and SGST % for intra-state; IGST % for inter-state).
  - Net Payable Amount per item.

### 7.3 Payment & Checkout
- **Split-Payment Options:**
  - Cash payment input with exact change calculator.
  - UPI payment QR code generator with simulated instant confirmation.
  - Debit / Credit Card reference transaction entry.
  - Credit Account ledger (for corporate, institutional, or PM-JAY patients).
- **Regulatory Receipts & Invoicing:**
  - CDSCO Form 20 / Form 21 retail drug sale invoice compliance.
  - Mandatory capture of Prescribing Doctor Name, Registration Number, and Patient Details.
  - Instant generation of printable bilingual GST invoice.
  - Automated WhatsApp delivery trigger sending invoice PDF link to the patient's phone.

---

## 8. Inventory Management & Expiry Radar

### 8.1 Master Stock Registry & Multi-Clinic Visibility
- **Item Master Catalog:**
  - Product Name, Generic Molecule, Strength, Form, Category, Schedule (Schedule H, H1, X, OTC).
  - Reorder Threshold Level, Minimum Stock Level, Maximum Stock Level.
- **Multi-Clinic Inventory Grid:**
  - Consolidated table displaying stock quantities across all clinics in the network.
  - Filterable by individual clinic, therapeutic category, or stock status.

### 8.2 Batch Expiry Radar & Value-at-Risk
- **Batch Details:**
  - Batch Number, Manufacturing Date, Expiration Date, Stock on Hand, Purchase Price (in paise), Selling MRP (in paise).
- **Shelf-Life Status Categories:**
  - Expired (quarantined from dispensing).
  - Critical ($\leq 30$ days to expiry).
  - Warning ($31–60$ days to expiry).
  - Monitor ($61–90$ days to expiry).
  - Healthy ($> 90$ days to expiry).
- **Value-at-Risk Financial Analytics:**
  - Total monetary value (in rupees) of inventory at risk of expiring within 30, 60, and 90 days.
  - Recommended actions: Inter-clinic transfer to high-volume clinics or return to supplier.

### 8.3 Inter-Clinic Inventory Rebalancing
- **Stock Transfer Workflow:**
  - Initiation: Requesting Clinic, Supplying Clinic, Product, Batch Number, Quantity Requested.
  - Approval: Administrative review by Clinic Operations Manager or Hospital Superintendent.
  - Dispatch: Marked as "In-Transit" with courier/transit details.
  - Inward Receipt: Destination clinic verifies physical count and accepts batch into local stock.
  - Automated ledger entry adjusting inter-clinic asset balances.

### 8.4 Bulk Inventory Migration & CSV Import
- **Data Ingestion:**
  - Upload CSV file containing external medicine and inventory catalogs.
  - Interactive column mapping interface (matching CSV columns to JEEVIKA database fields).
- **Pre-Commit Validation:**
  - Row-by-row validation checking for date formats, negative quantities, missing salts, and duplicate batch numbers.
  - Error summary report allowing corrections before committing to the database.

---

## 9. Procurement & Vendor Management (PO to GRN)

### 9.1 Supplier Directory
- **Vendor Profiles:**
  - Supplier Legal Name, Trade Name, GSTIN, Drug License Number.
  - Contact Person, Phone, Email, Physical Address.
  - Payment Terms (e.g., Net 30, Advance, Cash on Delivery).
  - Banking Details for direct settlement.

### 9.2 Purchase Order (PO) Lifecycle
- **PO Generation:**
  - Select Supplier, Target Delivery Clinic, Expected Delivery Date.
  - Add Items: Product, Target Quantity, Negotiated Unit Rate (in paise), Applicable Tax Rate.
- **PO Status Lifecycle:**
  - `Draft` $\rightarrow$ `Pending Approval` $\rightarrow$ `Issued to Vendor` $\rightarrow$ `Partially Received` $\rightarrow$ `Fulfilled` $\rightarrow$ `Cancelled`.
- **Printable Purchase Order:**
  - Vector PDF generation with official hospital header and authorized signature block.

### 9.3 Goods Received Note (GRN) & Auto-Stocking
- **Inward Stock Inspection:**
  - Matching received physical shipment against active Purchase Order lines.
  - Entry of Supplier Invoice Number, Invoice Date, Challan Number.
  - Physical inspection recording: Received Quantity, Damaged / Rejected Quantity, Accepted Quantity.
  - Entry of newly delivered Batch Numbers and Expiration Dates.
- **Automated Stock Sync & Accounting Integration:**
  - Acceptance of GRN immediately adds inventory to active dispensary stock.
  - Automatically posts balanced double-entry accounting journals: Debits Inventory Asset Account and Credits Accounts Payable (Vendor Account).

---

## 10. Chartered Accountant (CA) Financial Suite & Audit Vault

### 10.1 Integer-Paise Double-Entry Accounting Engine
- **Architectural Invariant:** Zero floating-point math across all financial calculations ($\Sigma \text{Debits} = \Sigma \text{Credits}$).
- **Automated Trigger Postings:**
  - Pharmacy POS sales post Revenue and decrement Inventory Asset at COGS.
  - GRN receipts post Accounts Payable and increment Inventory Asset.
  - Clinic expense vouchers post Expense Accounts and decrement Cash/Bank Accounts.

### 10.2 Financial Statements & Ledgers
- **General Ledger View:**
  - Filterable by Account Head (Cash in Hand, HDFC Bank, Inventory Asset, Pharmacy Revenue, OPD Consultation Revenue, Accounts Payable).
  - Columns: Date, Voucher Number, Narrative / Description, Debit (paise), Credit (paise), Running Balance.
- **Profit & Loss (P&L) Statement:**
  - Operating Revenue (Pharmacy Sales, Doctor Consultation Fees, Lab Diagnostic Fees, Room Bed Charges).
  - Cost of Goods Sold (COGS).
  - Gross Profit.
  - Operating Expenses (Salaries, Utilities, Rent, Medical Supplies, Equipment Maintenance).
  - Net Profit / Net Surplus over custom date ranges.
- **Balance Sheet:**
  - Assets: Current Assets (Cash, Bank, Inventory Stock), Fixed Assets (Medical Equipment).
  - Liabilities: Current Liabilities (Vendor Payables, Accrued Expenses).
  - Equity & Reserves: Retained Earnings, Capital Fund.
  - Real-time validation assertion: $\text{Assets} = \text{Liabilities} + \text{Equity}$.
- **Bank Reconciliation Statement (BRS):**
  - Tool to match internal ledger transactions against bank statement feeds.

### 10.3 Cryptographic Tamper-Evident Audit Vault
- **SHA-256 Hash Chaining:**
  - Every financial transaction and critical clinical event appends a cryptographic hash:  
    $$\text{Hash}_n = \text{SHA256}(\text{Hash}_{n-1} + \text{Transaction Payload}_n)$$
- **Live Chain Verification Action:**
  - Interactive "Verify Ledger Integrity" action checking the entire cryptographic chain from genesis block to the latest entry.
  - Displays verification status (100% Intact vs. Tampering Detected).
- **Audit Period Lock:**
  - Financial period closing control allowing the CA to lock historical quarters or financial years, preventing retroactive edits or back-dated entries.

---

## 11. Hospital Command Center & Operations Management

### 11.1 Fleet-Wide Executive Dashboard
- **Consolidated Key Metrics:**
  - Total Active Facilities, Total Network Footfall, Active Inpatient Census (Occupied Beds / Total Beds), Today's Revenue (in rupees), Total Group Inventory Valuation.
- **Network Health Facility Map:**
  - Overview of all clinics in the network, operational status (Normal, Near Capacity, Emergency Overload), and contact details.

### 11.2 Operational Schedulers & Resource Registries
- **Staff Roster & Shift Scheduling:**
  - Weekly and monthly shift scheduler for Doctors, Nurses, Pharmacists, and Administrative Staff.
  - Shift tiers: Morning Shift, Evening Shift, Night Emergency Shift.
  - Staff attendance logs and department coverage alerts.
- **Medical Equipment & Asset Registry:**
  - Equipment Name, Department / Location, Serial Number, Purchase Date, Warranty Expiration Date.
  - Maintenance Schedule, Calibration Due Dates, Operational Status (Operational, In Maintenance, Out of Order).
- **Expense Voucher Management:**
  - Petty cash and clinic expense voucher recording with receipt attachment and approval workflows.

---

## 12. Maritime Autonomous Agent Swarm Mesh

### 12.1 Background Multi-Agent Swarm
- **System Role:** Continuous, non-blocking cloud background auditing across three specialized agents:
  1. **`agent-sentinel-01` (Clinical Safety & Pharmacovigilance Sentry):** Continuously scans all active outpatient and inpatient prescriptions to detect dangerous drug-drug collisions, allopathic-AYUSH herbal interactions, and dosage anomalies.
  2. **`agent-vernacular-02` (Indic Dialect & Scribing Sentry):** Continuously audits ambient consultation audio transcripts and patient intake voice notes to harmonize regional colloquialisms into standardized clinical FHIR concepts.
  3. **`agent-supply-03` (Supply Chain & Inventory Sentry):** Analyzes consumption velocity at each clinic, monitors lead times, and automatically suggests inter-clinic stock balancing transfers before stock-outs happen.

### 12.2 Swarm Management & Telemetry Console
- **Agent Status Monitor:**
  - Real-time status cards for each agent (Active, Monitoring, Processing Batch, Idle).
  - Processed event counters and active threat/anomaly counters.
- **Live Activity Feed:**
  - Chronological stream of agent operations: Timestamp, Agent Identifier, Action Taken, Execution Latency, Findings / Output Summary.
- **Manual Trigger Controls:**
  - Ability for system administrators to trigger full-database retrospective safety audits or demand forecasting sweeps on demand.

---

## 13. Prune AI Gateway & Security Firewall

### 13.1 Clinical Semantic Caching Engine
- **Operational Objective:** Drastically reduces upstream LLM API latency and operating expenses.
- **Vector Semantic Cache:**
  - Caches frequent medical explanations, symptom translation vectors, and clinical queries.
  - Sub-20ms cache response time.
- **Performance Telemetry:**
  - Real-time Cache Hit Rate percentage display (targeting ~76% hit rate).
  - Rupee Savings Counter: Calculates cumulative monthly cost savings in rupees based on bypassed token consumption.

### 13.2 Prompt Injection Web Application Firewall (WAF)
- **Security Objective:** Shields clinical AI interfaces from prompt injection, system jailbreaks, and adversarial queries (e.g. attempting to override narcotic prescribing safeguards).
- **Inspection Metrics:**
  - Sub-9ms interception latency.
  - Threat detection classification: Prompt Injection Attempt, System Prompt Extraction, Unauthorized Clinical Override, Policy Violation.
- **WAF Event Log:**
  - Displays timestamp, threat category, blocked prompt snippet, and safe fallback response.

### 13.3 DPDP Act Zero-Knowledge PII Redaction Gate
- **Regulatory Objective:** Ensures zero Protected Health Information (PHI) or Personally Identifiable Information (PII) leaks to external AI providers.
- **Automated In-Flight Redaction:**
  - In-flight detection and masking of 12-digit Aadhaar numbers, 10-digit mobile numbers, patient names, and addresses.
- **Interactive Redaction Diff View:**
  - Side-by-side inspection view displaying the original raw patient transcript on the left and the sanitized, redacted payload transmitted to the upstream model on the right.

---

## 14. AYUSH Integrative Clinical Portal

### 14.1 Dashavidha Pariksha (Ten-Fold Ayurvedic Examination)
- **Clinical Assessment Parameters:**
  1. *Prakriti* (Basic Constitutional Assessment: Vata, Pitta, Kapha balance).
  2. *Vikriti* (Current Pathological Imbalance).
  3. *Sara* (Quality and Purity of Tissues).
  4. *Samhanana* (Body Compactness and Build).
  5. *Pramana* (Body Anthropometric Measurements).
  6. *Satmya* (Nutritional and Environmental Adaptability).
  7. *Satva* (Mental Strength and Emotional Constitution).
  8. *Aharashakti* (Individual Digestive & Metabolic Power).
  9. *Vyayamashakti* (Physical Endurance and Exercise Capacity).
  10. *Vaya* (Age Category and Chronological Stage).

### 14.2 Prakriti & Agni Assessment Tool
- **Diagnostic Questionnaire:**
  - Structured questionnaire evaluating physiological traits to determine baseline Dosha proportions (Vata, Pitta, Kapha).
  - Assessment of *Agni* (Digestive Fire): *Samagni* (Balanced), *Vishamagni* (Irregular), *Tikshnagni* (Hyperactive), *Mandagni* (Sluggish).
- **Ayurvedic Profile Output:**
  - Visual breakdown of Dosha dominance and recommended dietary / lifestyle modifications.

### 14.3 AYUSH-Allopathic Interaction Guard
- **Cross-System Safety Radar:**
  - Evaluates prescribed classical and proprietary Ayurvedic formulations against concurrent allopathic medications.
  - Flags documented herb-drug interactions, heavy-metal absorption cautions, or therapeutic antagonisms.

---

## 15. Remote Patient Monitoring & Home Companion (Mobile & Web)

### 15.1 Longitudinal Patient Health Thread
- **Consolidated Patient Journey Timeline:**
  - Unified, immutable timeline displaying all patient events in chronological order: Kiosk Check-In, Clinical Consultations, Laboratory Reports, Dispensed Prescriptions, Bedside Distress Alerts, Daily Home Check-Ins, and Nurse Calls.
  - Provenance badges indicating the origin of every recorded observation.

### 15.2 Daily Remote Health Check-In (Multimodal)
- **Daily Dialogue Flow:**
  - Short, 2-to-3 question conversational check-in evaluating symptom recovery, medication adherence, and current distress.
- **Multimodal Inputs:**
  - Spoken Voice Note (analyzed with speech recognition).
  - Numeric keypad input for simple biometric numbers.
  - Smartphone Camera Capture: Photograph of physical medical device screens (Blood Pressure monitor, Glucometer, Pulse Oximeter).
- **On-Device Vision OCR:**
  - Extracts systolic, diastolic, pulse, or glucose numbers directly from the device screen photograph.
  - Interactive patient confirmation interface allowing manual adjustment if digits were misread.

### 15.3 Drift Radar (Personalized Baseline Change Detection)
- **Clinical Problem Solved:** Eliminates false alarms caused by population-wide rigid thresholds (e.g., treating a chronic hypertensive patient with baseline BP 145/90 the same as a young adult).
- **Algorithmic Baseline Learning:**
  - Analyzes the patient's first 7 observed readings to establish a personalized statistical baseline ($m = \text{median}$, $s = \text{MAD}$).
- **Streaming Change-Point Detection (CUSUM):**
  - Evaluates daily readings against the patient's individual baseline.
  - Flags true physiological deterioration (e.g., gradual upward drift over consecutive days).
- **Absolute Red-Flag Failsafe:**
  - Retains hard absolute safety thresholds (e.g., Systolic $BP \geq 180\text{ mmHg}$ or $SpO_2 \leq 90\%$) that trigger instant emergency escalations regardless of baseline learning.

### 15.4 Nurse Call Queue & Outbound Care Management
- **Prioritized Outbound Call List:**
  - Ranks post-discharge patients by risk score and baseline drift urgency so nurses contact deteriorating patients first.
  - **Silence-as-Signal Detection:** Automatically escalates patients who fail to submit daily check-ins for two consecutive days.
- **Nurse Call-Minute Budget Slider:**
  - Interactive slider allowing the care coordinator to set daily available call minutes (e.g., 60 minutes).
  - Dynamically highlights which high-risk patients can be reached within that operational time constraint.
- **Outreach Outcome Feedback:**
  - One-tap logging of call outcomes: "Patient Reassured / Stable", "Medication Dosage Adjusted", "Ordered Clinic Outpatient Review", "Initiated Emergency Hospital Transfer".

### 15.5 ThreadPulse (Adherence & Refill Demand Sensing)
- **Probabilistic Adherence Modeling:**
  - Models daily medication depletion as a Beta-Binomial distribution rather than a naive linear calendar.
  - Predicts the exact window when a chronic patient will exhaust their medication supply.
- **Proactive Refill Reminders:**
  - Dispatches automated refill reminders to the patient 3 days prior to anticipated stock depletion.
  - One-tap patient reservation action holding required medication at their preferred clinic.
- **Procurement Demand Feeder:**
  - Aggregates upcoming refill windows across all registered chronic patients to feed predictive restocking orders to the clinic procurement manager.

### 15.6 HER Women's Health & Maternal Wellness (Mobile App Feature)
- **Menstrual & Symptom Tracking:**
  - Daily symptom and cycle logging (flow intensity, pain scores, mood, physical symptoms).
  - Cycle phase calculation (Menstrual, Follicular, Ovulatory, Luteal).
- **Deterministic Clinical Rules (A0 through A4):**
  - **Rule A0 (Cycle Irregularity):** Flags cycles shorter than 21 days, longer than 35 days, or with inter-cycle variation exceeding 7 days.
  - **Rule A1 (PCOS Screening):** Identifies persistent cycle irregularity coupled with acne or hirsutism to suggest endocrine/ultrasound evaluation.
  - **Rule A2 (Iron-Deficiency Risk):** Detects menstrual flow lasting $\geq 7$ days or heavy bleeding accompanied by chronic fatigue, recommending ferritin screening.
  - **Rule A3 (Pregnancy Trimester Safety Gates):** Enforces hard clinical contraindications barring NSAIDs, ACE inhibitors, and Category-X drugs during pregnancy.
  - **Rule A4 (Postpartum Warning Sentry):** Immediate red-flag escalation for postpartum fever $> 100.4^\circ\text{F}$, severe unilateral leg swelling, or abnormal hemorrhage.

### 15.7 Vitalis Healthspan & Lifestyle Optimization (Mobile App Feature)
- **Evidence-Based Healthspan Metrics (V0 through V14):**
  - Tracks modifiable lifestyle and clinical behaviors rather than speculative biological age estimates.
  - Cardiovascular telemetry tracking (mean arterial pressure, resting pulse trends).
  - Sleep regularity scoring based on rolling 7-day wake and sleep time consistency.
  - Daily readiness calculation evaluating recovery vitals against daily activity levels.
  - Non-exercise $VO_2\text{max}$ estimation based on functional capacity metrics.
  - Preventive health milestones tracking (immunizations, diabetes screenings, annual checkups).

### 15.8 Personalized Gentle Yoga & Physical Rehabilitation (Mobile App Feature)
- **Therapeutic Posture Recommendations:**
  - Gentle yoga posture routines tailored to patient condition, recovery stage, and mobility level.
- **Medical Contraindication Filtering:**
  - Automatically filters out inversion poses for patients with documented hypertension, cardiovascular disease, or glaucoma.
  - Excludes deep forward folds or spinal twists for patients with acute lumbar disc herniation.
  - Step-by-step posture instructions with precautions and breathing guidance.

---

## 16. Cross-Module Data Handoffs & Workflow Choreography

```
[Patient Kiosk]
       │
       ├─► (Chief Complaint + Sentinel Triage + Acuity Tier)
       │         │
       │         ├─► [Emergency Triage] (If STAT Red-Flag / STEMI Intercept)
       │         │         │
       │         │         └─► [Casualty Bay 1-4] ──► [IPD Ward Bed / ICU]
       │         │
       │         └─► [Doctor OPD Cockpit] (If Priority / Routine Queue)
       │                   │
       │                   ├─► (Ambient Scribe SOAP + ICD-11 Coding)
       │                   ├─► (Research CBC Explorer Analysis)
       │                   │
       │                   ├─► [IPD Admission] ──► [Ward Bed Matrix] ──► [Bedside SOS Sentry]
       │                   │                                                     │
       │                   │                                                     └─► [Code Blue Cascade]
       │                   │
       │                   └─► (E-Prescription with Generic Substitution)
       │                             │
       │                             ▼
       │                     [Pharmacy POS]
       │                             │
       │                             ├─► (FEFO Batch Deduction) ──► [Inventory Radar]
       │                             ├─► (Integer-Paise Ledger) ──► [CA Financial Suite]
       │                             └─► (WhatsApp Invoice / Digital Rx Locker)
       │                                       │
       │                                       ▼
       └─────────────────────────────► [JEEVIKA Home Companion]
                                               │
                                               ├─► (Daily Check-in + Device Photo OCR)
                                               ├─► (Drift Radar Baseline Change Detection)
                                               │         │
                                               │         └─► [Nurse Outbound Call Queue]
                                               │
                                               ├─► (ThreadPulse Refill Demand Sensing)
                                               │         │
                                               │         └─► [Procurement PO Generator]
                                               │
                                               └─► (HER Women's Health + Vitalis Healthspan)
```

---

## 17. Complete System Screen & View Inventory

For complete UI coverage, the user interface must accommodate each of the following distinct operational views and dialogs:

1. **Authentication Gateway:**
   - 1-Click Persona Selection Portal (7 hospital roles).
   - Staff Credentials Sign-In & Multi-Clinic Switcher.
   - Account Registration & Password Reset Screens.
2. **Patient Intake Touchscreen Kiosk:**
   - 9-Language Selection Grid with Audio Welcome.
   - DPDP Act Consent Notice & Digital Receipt Issuance.
   - ABHA 14-Digit Entry & Optical ABHA QR Scanner.
   - Chief Complaint Selector & Adaptive Sentinel Voice Stage.
   - Acidity vs. STEMI Differential Safety Modal.
   - Previous Prescription / Lab Document Camera OCR View.
   - Triage Queue Slip & Bilingual Print Preview.
3. **Doctor OPD Clinical Cockpit:**
   - Waiting Queue Sidebar with Triage Urgency Badges.
   - Comprehensive Patient Demographics & Vitals Banner.
   - Ambient Clinical Scribe (Audio Recorder, Transcript Stream, Source-Linked SOAP Note Editor).
   - ICD-11 & NAMASTE Diagnostic Coding Selector.
   - E-Prescription Form with Real-Time Stock Status & Generic Savings Meter.
   - Research CBC Explorer (Lab Report OCR, 5-Field Verification, Logistic Inference Score Display).
   - Clinical Disposition Actions (Admit, Transfer to Emergency, Complete).
4. **Inpatient (IPD) Ward Console:**
   - Multi-Ward & Multi-Bed Census Matrix (Status, Patient Cards, Acuity Badges).
   - Patient Bedside Distress SOS Call Trigger.
   - Doctor "En Route" Alert Modal & Latency Stopwatch Logger.
   - Nurse STAT Bed Distress Reporter Slide-Over Drawer.
   - Inpatient Admission, Bed Transfer, and Discharge Reconciliation Modals.
5. **Emergency & Casualty Station:**
   - Live Hospital-Wide Code Blue Cascade Header Banner.
   - ESI-1 through ESI-5 Acuity Scoring Station.
   - Resuscitation Bays 1–4 Real-Time Allocation Grid.
   - Rapid Trauma Encounter Registration & Bay Routing.
6. **Pharmacy POS & Dispensary:**
   - Active Prescription Inflow & Barcode/QR Lookup.
   - Rx-to-Shelf FEFO Batch Allocation & Expiry Validator.
   - Billing Cart (Pack & Loose Tablets, Integer-Paise Math, GST Split).
   - Multi-Mode Payment Checkout (Cash, UPI QR, Card, Credit).
   - CDSCO Form 20/21 Receipt & Tax Invoice Print Preview.
7. **Inventory Management & Expiry Radar:**
   - Master Drug & Supply Catalog Table with Multi-Clinic Quantities.
   - Shelf-Life Expiry Radar (Expired, $\leq 30$d, $\leq 60$d, $\leq 90$d, Healthy).
   - Value-at-Risk Financial Analytics Cards.
   - Inter-Clinic Stock Transfer Request & Dispatch Workflow.
   - Bulk Inventory CSV Upload, Column Mapper & Validation Table.
8. **Procurement & Vendor Management (PO to GRN):**
   - Supplier Directory with GSTIN, Drug License, and Banking Details.
   - Purchase Order Builder & Lifecycle Tracker.
   - Goods Received Note (GRN) Inspector (Matching physical delivery to PO, batch capture, discrepancy logging).
9. **Chartered Accountant (CA) Financial Suite & Audit Vault:**
   - General Ledger Transaction Table (Paise-level Debits, Credits, Running Balances).
   - Live Profit & Loss (P&L) Statement Generator.
   - Balance Sheet ($\text{Assets} = \text{Liabilities} + \text{Equity}$).
   - Bank Reconciliation Statement (BRS) Matcher.
   - Cryptographic Tamper-Evident Hash Chain Verifier & Audit Period Lock.
10. **Hospital Command Center (HQ Executive):**
    - Multi-Clinic KPI Metric Cards (Footfall, Occupancy, Revenue, Inventory Value).
    - Network Facility Directory & Live Status Map.
    - Fleet-Wide Bed Occupancy Census.
    - Cross-Clinic Rebalancing Transfer Optimizer.
    - Expense Voucher Recording & Medical Equipment Asset Registry.
    - Staff Roster & Shift Scheduling Grid.
11. **Maritime Autonomous Agent Swarm Mesh:**
    - Tri-Agent Status Cards (`agent-sentinel-01`, `agent-vernacular-02`, `agent-supply-03`).
    - Live Background Telemetry Event Stream.
    - Manual Audit Trigger Controls.
12. **Prune AI Gateway & Security Firewall:**
    - Semantic Vector Cache Hit Rate & Monthly Rupee Savings Telemetry.
    - Prompt Injection WAF Interception Log & Threat Classifier.
    - DPDP Act Zero-Knowledge PII Redaction Side-by-Side Diff Viewer.
13. **AYUSH Integrative Medicine Portal:**
    - Dashavidha Pariksha 10-Fold Assessment Questionnaire.
    - Prakriti & Agni Constitutional Assessment Radar.
    - Herb-Drug Interaction Safety Radar.
14. **Remote Patient Monitoring & Home Companion (Mobile):**
    - Longitudinal Patient Health Thread Timeline.
    - Multimodal Daily Health Check-In (Voice, Numeric, Camera OCR).
    - Drift Radar Personal Baseline Trend Visualizer.
    - Nurse Prioritized Outbound Call Queue & Call-Minute Budget Slider.
    - ThreadPulse Medication Adherence & Refill Reminder Alert.
    - HER Women's Health & Maternal Cycle Tracker (A0–A4 rules).
    - Vitalis Healthspan Tracker (V0–V14 clinical telemetry & functional scores).
    - Therapeutic Gentle Yoga Rehabilitation Guide with Contraindication Filters.
15. **Public Overview & Platform Showroom:**
    - System Architectural Overview, Continuity Loop Diagram, Problem Statement, and Mechanism Benchmarks.

---

## 18. Final UI Implementation Locks

> **Purpose:** This section resolves implementation-facing ambiguities introduced after the
> original 17-area screen inventory. It does not add product features. Public routes and
> authenticated RBAC are defined separately. Unresolved permissions must default to
> `None`; unresolved policy belongs in the Open Questions table.

### 18.1 Authenticated RBAC Table

Authenticated route permissions use only `Full`, `Read-only`, or `None`.

| Route | SUPER_ADMIN | HOSPITAL_ADMIN | CLINIC_ADMIN | DOCTOR | NURSE | STAT_NURSE | CASHIER | PATIENT |
|---|---|---|---|---|---|---|---|---|
| `/app/command` | Full | Full | Full | None | None | None | None | None |
| `/app/command/network` | Full | Full | None | None | None | None | None | None |
| `/app/command/census` | Full | Full | Read-only | None | None | None | None | None |
| `/app/command/optimizer` | Full | Full | None | None | None | None | None | None |
| `/app/command/expenses` | None | Full | None | None | None | None | None | None |
| `/app/command/equipment` | None | Full | None | None | None | None | None | None |
| `/app/command/roster` | None | Full | Full | None | None | None | None | None |
| `/app/doctor` | None | None | None | Full | None | None | None | None |
| `/app/doctor/soap` | None | None | None | Full | None | None | None | None |
| `/app/doctor/coding` | None | None | None | Full | None | None | None | None |
| `/app/doctor/rx` | None | None | None | Full | None | None | None | None |
| `/app/doctor/cbc` | None | None | None | Full | None | None | None | None |
| `/app/doctor/disposition` | None | None | None | Full | None | None | None | None |
| `/app/ipd` | None | Read-only | Read-only | Full | Full | None | None | None |
| `/app/casualty` | None | None | None | Read-only | Full | Full | None | None |
| `/app/casualty/triage` | None | None | None | Read-only | Full | Full | None | None |
| `/app/casualty/bays` | None | None | None | Read-only | Full | Full | None | None |
| `/app/casualty/register` | None | None | None | None | None | Full | None | None |
| `/app/nurse-calls` | None | None | None | None | Full | None | None | None |
| `/app/pos` | None | None | Full | None | None | None | Full | None |
| `/app/inventory` | None | Full | Full | None | None | None | Read-only | None |
| `/app/inventory/expiry` | None | Full | Full | None | None | None | Read-only | None |
| `/app/inventory/transfers` | None | Full | Full | None | None | None | Read-only | None |
| `/app/inventory/import` | None | Full | Full | None | None | None | None | None |
| `/app/procurement` | Read-only | Full | Full | None | None | None | None | None |
| `/app/procurement/suppliers` | Read-only | Full | Full | None | None | None | None | None |
| `/app/procurement/orders` | Read-only | Full | Full | None | None | None | None | None |
| `/app/procurement/grn` | Read-only | Full | Full | None | None | None | Full | None |
| `/app/ca` | Full | Read-only | None | None | None | None | None | None |
| `/app/ca/ledger` | Full | Read-only | None | None | None | None | None | None |
| `/app/ca/pnl` | Full | Read-only | None | None | None | None | None | None |
| `/app/ca/balance-sheet` | Full | Read-only | None | None | None | None | None | None |
| `/app/ca/brs` | Full | Read-only | None | None | None | None | None | None |
| `/app/ca/audit` | Full | Read-only | None | None | None | None | None | None |
| `/app/swarm` | Full | Read-only | None | None | None | None | None | None |
| `/app/prune` | Full | Read-only | None | None | None | None | None | None |
| `/app/prune/cache` | Full | Read-only | None | None | None | None | None | None |
| `/app/prune/waf` | Full | Read-only | None | None | None | None | None | None |
| `/app/prune/redaction` | Full | None | None | None | None | None | None | None |
| `/app/ayush` | None | None | None | Full | None | None | None | None |
| `/app/home` | None | None | None | None | None | None | None | Full |
| `/app/home/thread` | None | None | None | None | None | None | None | Full |
| `/app/home/check-in` | None | None | None | None | None | None | None | Full |
| `/app/home/drift` | None | None | None | None | None | None | None | Full |
| `/app/home/refill` | None | None | None | None | None | None | None | Full |
| `/app/home/prescriptions` | None | None | None | None | None | None | None | Full |
| `/app/home/her` | None | None | None | None | None | None | None | Full |
| `/app/home/vitalis` | None | None | None | None | None | None | None | Full |
| `/app/home/yoga` | None | None | None | None | None | None | None | Full |
| `/app/home/prakriti` | None | None | None | None | None | None | None | Full |

Clinic-scoped permissions are enforced through both `org_id` and `clinic_id` at the
data/API authorization layer. UI hiding is never authorization.

### 18.2 `/app` and Public Routes

`/app` is authenticated-only and role-aware. It is a redirect, not a shared dashboard:

- SUPER_ADMIN → `/app/command`
- HOSPITAL_ADMIN → `/app/command`
- CLINIC_ADMIN → `/app/command`
- DOCTOR → `/app/doctor`
- NURSE → `/app/ipd`
- STAT_NURSE → `/app/casualty/triage`
- CASHIER → `/app/pos`
- PATIENT → `/app/home`

The public route registry is separate from authenticated RBAC:

| Route | Page | Authentication | Access behavior |
|---|---|---|---|
| `/` | Public Overview | Public | Public |
| `/login` | Staff Login | Public | Public |
| `/reset-password` | Password Reset | Public | Public |
| `/register` | Account Registration | Public | Registration policy remains OPEN |
| `/kiosk` | Patient Intake Kiosk | Public | No staff session |
| `/home/sign-in` | Patient Sign-in | Public | ABHA/mobile OTP |

`/kiosk` is public and sessionless. Identity verification is performed inside the patient
intake workflow where required. `/home/sign-in` is public patient authentication.

### 18.3 Quick Access Evaluation Mapping

The Authentication Gateway may show only these seven evaluation presets:

| Preset | Persona |
|---|---|
| HQ Executive | HOSPITAL_ADMIN |
| Doctor OPD | DOCTOR |
| Ward Inpatient Nurse | NURSE |
| Emergency Triage Nurse | STAT_NURSE |
| Clinic Operations Hub | CLINIC_ADMIN |
| Patient Self-Service Kiosk | PATIENT |
| CA Financial & Audit Suite | SUPER_ADMIN |

CASHIER has no Quick Access preset and uses credential authentication only. Quick Access
is evaluation-only and never bypasses production authentication or authorization.

### 18.4 Role and Component Permission Locks

- CLINIC_ADMIN `/app/command/roster` is clinic-scoped Full access for the local
  shift-management and local doctor-roster scope established for that persona.
- CLINIC_ADMIN `/app/command/expenses` is None.
- CLINIC_ADMIN `/app/command/equipment` is None.
- SUPER_ADMIN `/app/command/roster` is None.
- SUPER_ADMIN `/app/command/expenses` is None.
- SUPER_ADMIN `/app/command/equipment` is None.
- STAT_NURSE has no `/app/ipd` route access. STAT_NURSE bed availability is read-only
  only inside the explicitly authorized shared Admission Modal.
- DOCTOR has no `/app/pos` access.
- SavingsMeter is owned by Pharmacy POS only.
- CallBudgetSlider and OutreachOutcomeButtons are owned by Nurse Call Queue.
- Hash-chain verification and audit-period locking are SUPER_ADMIN-only.
- SUPER_ADMIN has full audit control.
- HOSPITAL_ADMIN audit access is Read-only only to explicitly authorized status or records.
- Other personas have no audit access unless the source explicitly grants it.

### 18.5 Procurement and GRN Boundary

CASHIER access is:

- `/app/procurement`: None
- `/app/procurement/suppliers`: None
- `/app/procurement/orders`: None
- `/app/procurement/grn`: Full

CASHIER may execute the authorized GRN workflow, including receiving physical
shipments, matching them to an authorized purchase order, recording received/damaged/
accepted quantities, and capturing delivered batch and expiration data.

CASHIER cannot create, edit or approve Purchase Orders. Procurement UI must not provide
CASHIER a route or control for Suppliers or Orders. Accepted stock posting must use
Inventory-owned stock mutation operations. The independent GRN child route must not be
blocked by a parent procurement layout guard.
