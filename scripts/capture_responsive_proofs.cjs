const { chromium } = require('/Users/apple/Desktop/JEEVIKA/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const outDir = '/Users/apple/Desktop/JEEVIKA/docs/screenshots/responsive_verified';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch({ headless: true });

  // 1. Mobile (iPhone 14 / Android Standard 390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });
  const mobilePage = await mobileContext.newPage();

  // Route 1: Doctor Consultation (Doctor Mobile View)
  await mobilePage.goto('http://localhost:5174/#/app?view=doctor-consultation', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(outDir, '01_doctor_mobile_390.png') });
  console.log('Saved 01_doctor_mobile_390.png');

  // Route 2: IPD Inpatients & Code Blue (Nurse Mobile View)
  await mobilePage.goto('http://localhost:5174/#/app?view=ipd', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(outDir, '02_nurse_ipd_mobile_390.png') });
  console.log('Saved 02_nurse_ipd_mobile_390.png');

  // Route 3: Nurse STAT Bed Distress Reporter Modal
  try {
    const nurseBtn = mobilePage.locator('button:has-text("Nurse STAT Bed Distress Reporter")');
    if (await nurseBtn.isVisible()) {
      await nurseBtn.click();
      await mobilePage.waitForTimeout(600);
      await mobilePage.screenshot({ path: path.join(outDir, '03_nurse_distress_modal_mobile_390.png') });
      console.log('Saved 03_nurse_distress_modal_mobile_390.png');
      await mobilePage.keyboard.press('Escape');
      await mobilePage.waitForTimeout(400);
    }
  } catch (e) {
    console.warn('Nurse modal note:', e.message);
  }

  // Route 4: Bedside Distress SOS Modal
  try {
    const bedBtn = mobilePage.locator('button:has-text("View Bed Distress Console")');
    if (await bedBtn.isVisible()) {
      await bedBtn.click();
      await mobilePage.waitForTimeout(600);
      await mobilePage.screenshot({ path: path.join(outDir, '04_patient_bedside_sos_mobile_390.png') });
      console.log('Saved 04_patient_bedside_sos_mobile_390.png');
      await mobilePage.keyboard.press('Escape');
      await mobilePage.waitForTimeout(400);
    }
  } catch (e) {
    console.warn('Bedside modal note:', e.message);
  }

  // Route 5: Patient Kiosk & Autonomous Triage Sentry (Patient Mobile View)
  await mobilePage.goto('http://localhost:5174/#/kiosk', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(outDir, '05_patient_kiosk_mobile_390.png') });
  console.log('Saved 05_patient_kiosk_mobile_390.png');

  // Route 6: Hospital Subscription & Billing (Subscription Plan View)
  await mobilePage.goto('http://localhost:5174/#/app?view=billing', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(outDir, '06_hospital_subscription_mobile_390.png') });
  console.log('Saved 06_hospital_subscription_mobile_390.png');

  // Route 7: Patient Follow-up & Clinic POS
  await mobilePage.goto('http://localhost:5174/#/app?view=pos', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(outDir, '07_patient_followup_pos_mobile_390.png') });
  console.log('Saved 07_patient_followup_pos_mobile_390.png');

  await mobileContext.close();

  // 2. Tablet (iPad / Medical Tablet 768x1024)
  const tabletContext = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2
  });
  const tabletPage = await tabletContext.newPage();

  // Route 8: Doctor Tablet Consultation
  await tabletPage.goto('http://localhost:5174/#/app?view=doctor-consultation', { waitUntil: 'networkidle' });
  await tabletPage.waitForTimeout(1000);
  await tabletPage.screenshot({ path: path.join(outDir, '08_doctor_tablet_768.png') });
  console.log('Saved 08_doctor_tablet_768.png');

  // Route 9: Nurse IPD Console Tablet
  await tabletPage.goto('http://localhost:5174/#/app?view=ipd', { waitUntil: 'networkidle' });
  await tabletPage.waitForTimeout(1000);
  await tabletPage.screenshot({ path: path.join(outDir, '09_nurse_ipd_tablet_768.png') });
  console.log('Saved 09_nurse_ipd_tablet_768.png');

  await tabletContext.close();
  await browser.close();
  console.log('All responsive proofs captured successfully.');
}

capture().catch(err => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
