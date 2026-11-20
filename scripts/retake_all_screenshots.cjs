const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const outDir = path.resolve(__dirname, '../docs/screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function retakeAllScreenshots() {
  console.log('Launching browser for high-resolution JEEVIKA screenshot suite...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop context (1440x900 at 2x Retina scale = 2880x1800)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await desktopContext.newPage();

  // Screen 1: Desktop Login Page
  console.log('1. Capturing 01_desktop_login_page.png...');
  await page.goto('http://localhost:5174/#/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '01_desktop_login_page.png') });

  // Screen 2: Patient Intake Kiosk (Phase 1)
  console.log('2. Capturing 02_patient_kiosk.png...');
  await page.locator('h3:has-text("Patient Self-Service Kiosk")').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, '02_patient_kiosk.png') });

  // Screen 3: Differential Triage Interceptor
  console.log('3. Capturing 08_differential_triage_interceptor.png...');
  await page.locator('button:has-text("English")').click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Sample QR (Priya Sharma · 34F)")').click();
  await page.waitForTimeout(600);
  await page.locator('button:has-text("Continue to Symptom Intake")').click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Stomach Pain & Acidity")').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, '08_differential_triage_interceptor.png') });

  // Screen 4: STAT Emergency Token
  console.log('4. Capturing 09_stat_resuscitation_token.png...');
  await page.locator('button:has-text("YES — Chest tightness")').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '09_stat_resuscitation_token.png') });

  // Ensure active distress alert exists on backend
  try {
    await fetch('http://localhost:8790/api/v1/ipd/beds/bed_105_1/distress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bedNumber: 'Bed 1',
        roomId: 'Room 105',
        wardName: 'Room 105',
        patientId: 'pat_priya_01',
        patientName: 'Priya Sharma',
        patientAge: 34,
        patientGender: 'Female',
        assignedDoctorId: 'doc_malhotra',
        assignedDoctorName: 'Dr. Malhotra',
        reporterType: 'PATIENT_BEDSIDE_SOS',
        reporterName: 'Patient Bedside SOS',
        reason: 'Acute Bedside Distress Call',
        acuity: 'CODE_BLUE_CRITICAL'
      })
    });
  } catch (e) {
    console.warn('Backend distress notification note:', e.message);
  }

  // Screen 5: Doctor Distress Interrupt Alert
  console.log('5. Capturing 11_doctor_distress_alert.png...');
  await page.goto('http://localhost:5174/#/app?view=doctor-consultation', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '11_doctor_distress_alert.png') });

  // Screen 6: Doctor OPD Cockpit & Ambient Scribe
  console.log('6. Capturing 03_doctor_opd_cockpit.png...');
  // Acknowledge the alert so the normal cockpit view is visible
  try {
    const ackBtn = page.locator('button:has-text("Acknowledge & En Route")');
    if (await ackBtn.isVisible()) {
      await ackBtn.click();
      await page.waitForTimeout(800);
    }
  } catch (_) {}
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '03_doctor_opd_cockpit.png') });

  // Screen 7: Inpatient (IPD) Ward & Bedside SOS Modal
  console.log('7. Capturing 10_ipd_bedside_sos.png...');
  await page.goto('http://localhost:5174/#/app?view=ipd', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // Open the Bed Distress Console modal
  try {
    const viewConsoleBtn = page.locator('button:has-text("View Bed Distress Console")');
    if (await viewConsoleBtn.isVisible()) {
      await viewConsoleBtn.click();
      await page.waitForTimeout(600);
    }
  } catch (_) {}
  await page.screenshot({ path: path.join(outDir, '10_ipd_bedside_sos.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Screen 8: Nurse STAT Distress Reporter
  console.log('8. Capturing 12_nurse_stat_reporter.png...');
  try {
    const nurseStatBtn = page.locator('button:has-text("Nurse STAT Bed Distress Reporter")');
    if (await nurseStatBtn.isVisible()) {
      await nurseStatBtn.click();
      await page.waitForTimeout(600);
    }
  } catch (_) {}
  await page.screenshot({ path: path.join(outDir, '12_nurse_stat_reporter.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Screen 9: Floor Emergency Triage Station
  console.log('9. Capturing 04_emergency_triage.png...');
  await page.goto('http://localhost:5174/#/app?view=emergency-triage', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, '04_emergency_triage.png') });

  // Screen 10: Hospital Command Center
  console.log('10. Capturing 05_hospital_command_center.png...');
  await page.goto('http://localhost:5174/#/app?view=admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, '05_hospital_command_center.png') });

  // Screen 11: Prune AI Cost Engine & WAF
  console.log('11. Capturing 07_prune_ai_gateway.png...');
  await page.goto('http://localhost:5174/#/app?view=prune-gateway', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, '07_prune_ai_gateway.png') });

  // Screen 12: Maritime Agent Swarm Mesh
  console.log('12. Capturing 06_maritime_swarm_mesh.png...');
  await page.goto('http://localhost:5174/#/app?view=maritime-agents', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, '06_maritime_swarm_mesh.png') });

  // Screen 13: Landing Page
  console.log('13. Capturing 01_landing_page.png...');
  await page.goto('http://localhost:5174/#/landing', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, '01_landing_page.png') });

  await desktopContext.close();

  // 2. Mobile Context (iPhone 14 standard: 390x844 at 2x scale)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });
  const mobilePage = await mobileContext.newPage();

  // Screen 14: Mobile Clinical Pad / Login Roles
  console.log('14. Capturing 02_mobile_login_roles.png...');
  await mobilePage.goto('http://localhost:5174/#/login', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(outDir, '02_mobile_login_roles.png') });

  // Screen 15: Mobile Login Credentials
  console.log('15. Capturing 03_mobile_login_credentials.png...');
  try {
    const credTab = mobilePage.locator('button:has-text("Staff Credentials")');
    if (await credTab.isVisible()) {
      await credTab.click();
      await mobilePage.waitForTimeout(600);
    }
  } catch (_) {}
  await mobilePage.screenshot({ path: path.join(outDir, '03_mobile_login_credentials.png') });

  await mobileContext.close();
  await browser.close();

  console.log('All 15 screenshots successfully captured and saved to docs/screenshots/!');
}

retakeAllScreenshots().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
