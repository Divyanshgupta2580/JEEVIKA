const { chromium } = require('/Users/apple/Desktop/JEEVIKA/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const VIEWPORTS = [
  { name: 'mobile_375', width: 375, height: 812 },
  { name: 'mobile_390', width: 390, height: 844 },
  { name: 'tablet_768', width: 768, height: 1024 },
  { name: 'desktop_1440', width: 1440, height: 900 }
];

const ROUTES = [
  { name: 'LandingPage', url: 'http://localhost:5174/' },
  { name: 'PatientKiosk', url: 'http://localhost:5174/#/kiosk' },
  { name: 'DoctorConsultation', url: 'http://localhost:5174/#/app?view=doctor-consultation' },
  { name: 'IPDDashboard', url: 'http://localhost:5174/#/app?view=ipd' },
  { name: 'EmergencyTriage', url: 'http://localhost:5174/#/app?view=emergency-triage' },
  { name: 'POSBilling', url: 'http://localhost:5174/#/app?view=pos' },
  { name: 'SubscriptionBilling', url: 'http://localhost:5174/#/app?view=billing' },
  { name: 'PruneGateway', url: 'http://localhost:5174/#/app?view=prune-gateway' },
  { name: 'MaritimeAgents', url: 'http://localhost:5174/#/app?view=maritime-agents' }
];

const screenshotDir = path.join(__dirname, '../docs/screenshots/responsive_audit');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    for (const route of ROUTES) {
      console.log(`Auditing ${route.name} at ${vp.name} (${vp.width}x${vp.height})...`);
      try {
        await page.goto(route.url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000);

        // Check horizontal overflow
        const overflowData = await page.evaluate(() => {
          const docWidth = document.documentElement.scrollWidth;
          const winWidth = window.innerWidth;
          const bodyWidth = document.body.scrollWidth;
          const hasOverflow = docWidth > winWidth + 2;

          let overflowingElements = [];
          if (hasOverflow) {
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > winWidth + 2 && rect.width > 0 && rect.height > 0) {
                const tag = el.tagName.toLowerCase();
                const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 100) : '';
                const id = el.id ? `#${el.id}` : '';
                overflowingElements.push({
                  selector: `${tag}${id}.${cls.split(' ').slice(0, 3).join('.')}`,
                  rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }
                });
                if (overflowingElements.length >= 5) break;
              }
            }
          }

          return {
            docWidth,
            winWidth,
            bodyWidth,
            hasOverflow,
            overflowingElements
          };
        });

        const screenshotPath = path.join(screenshotDir, `${route.name}_${vp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        results.push({
          route: route.name,
          url: route.url,
          viewport: vp.name,
          width: vp.width,
          overflow: overflowData.hasOverflow,
          docWidth: overflowData.docWidth,
          winWidth: overflowData.winWidth,
          overflowingElements: overflowData.overflowingElements,
          screenshot: screenshotPath
        });
      } catch (err) {
        console.error(`Error on ${route.name} at ${vp.name}:`, err.message);
        results.push({
          route: route.name,
          viewport: vp.name,
          error: err.message
        });
      }
    }
    await context.close();
  }

  await browser.close();

  console.log('\n=== RESPONSIVENESS AUDIT SUMMARY ===');
  let failures = 0;
  for (const res of results) {
    if (res.overflow) {
      failures++;
      console.log(`[OVERFLOW FAIL] ${res.route} on ${res.viewport} (doc: ${res.docWidth}px > win: ${res.winWidth}px)`);
      if (res.overflowingElements && res.overflowingElements.length) {
        console.log(`   Offending: ${JSON.stringify(res.overflowingElements[0])}`);
      }
    } else if (res.error) {
      failures++;
      console.log(`[ERROR] ${res.route} on ${res.viewport}: ${res.error}`);
    } else {
      console.log(`[PASS] ${res.route} on ${res.viewport}`);
    }
  }

  const reportPath = path.join(screenshotDir, 'audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nAudit finished. Total failures: ${failures}. Report saved to ${reportPath}`);
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
