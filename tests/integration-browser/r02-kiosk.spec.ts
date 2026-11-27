import { expect, test } from "@playwright/test";
import QRCode from "qrcode";
import { kioskGuidance } from "../../packages/shared/kiosk-guidance";
import { kioskPrompts } from "../../packages/shared/kiosk-copy";
import { demoPatientIdentity, patientLanguages } from "../../packages/shared/patient-experience";
import { demoPassword } from "../../backend/local/seed";

test("renders all nine language headings and guidance and retains only the locale across reload", async ({ page }) => {
  await page.goto("/erp.html");
  await expect(page.getByLabel("Platform highlights")).toContainText(/9\s*Intake\s*language choices/);
  await page.goto("/erp.html#/kiosk");
  for (const locale of Object.keys(patientLanguages) as Array<keyof typeof patientLanguages>) {
    await page.getByRole("button", { name: patientLanguages[locale][0], exact: true }).click();
    await expect(page.getByRole("heading", { name: kioskPrompts[locale][0] })).toBeVisible();
    await expect(page.getByText(kioskGuidance[locale][0], { exact: true })).toBeVisible();
    await page.getByRole("button", { name: kioskPrompts[locale][8], exact: true }).click();
    await expect(page.getByRole("heading", { name: kioskPrompts[locale][1] })).toBeVisible();
    await expect(page.getByText(kioskGuidance[locale][5], { exact: true })).toBeVisible();
    await page.getByRole("button", { name: kioskGuidance[locale][9], exact: true }).click();
  }
  await page.reload();
  await expect(page.getByRole("button", { name: "ಕನ್ನಡ", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.includes("kiosk"))))
    .toEqual(["jeevika.kiosk.locale"]);
});

test("requires only care for adults and guardian authorization for minors, while urgent help bypasses both", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/erp.html#/kiosk");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await expect(next).toBeDisabled();
  await page.getByRole("checkbox", { name: "Use my information for direct care and examination" }).check();
  await expect(next).toBeEnabled();
  await page.getByRole("checkbox", { name: "The patient is under 18" }).check();
  await expect(next).toBeDisabled();
  await page.getByRole("checkbox", { name: /authorized to consent/ }).check();
  await expect(next).toBeEnabled();
  await page.getByRole("checkbox", { name: /authorized to consent/ }).uncheck();
  await page.getByRole("button", { name: "Get urgent help" }).click();
  await expect(page.getByText(/^EMERG-/)).toBeVisible();
  await page.getByRole("button", { name: "Start a new visit" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "The patient is under 18" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Use my information for direct care and examination" })).not.toBeChecked();
  await expect(page.getByText(/^EMERG-/)).toHaveCount(0);
});

test("stops fixed audio and hands the care-only token to the staff queue", async ({ page, browser, baseURL }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { value: { cancel() {}, getVoices: () => [] } });
    class SyntheticAudio {
      async play() { document.body.dataset.audio = "playing"; }
      pause() { document.body.dataset.audio = "paused"; }
      removeAttribute() {}
      load() {}
    }
    Object.defineProperty(window, "Audio", { value: SyntheticAudio });
  });
  await page.goto("/erp.html#/kiosk");
  await page.getByRole("button", { name: "Read aloud" }).click();
  await expect(page.getByText("Playing caption", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop voice" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-audio", "paused");
  await expect(page.getByText("Voice idle", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: "Use my information for direct care and examination" }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue without verification" }).click();
  await page.getByRole("button", { name: "Fever or chills" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (let i = 0; i < 7; i++) await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Request token" }).click();
  const token = await page.getByText(/^OPD-/).textContent();
  expect(token).toBeTruthy();
  await expect(page.getByText("Use my information for direct care and examination · Yes")).toBeVisible();
  await expect(page.getByText("Share with pharmacy for fulfilment · No")).toBeVisible();
  await expect(page.getByRole("img", { name: "Consent receipt reference QR code" })).toBeVisible();

  const context = await browser.newContext({ baseURL });
  try {
    const doctor = await context.newPage();
    await doctor.goto("/erp.html#/app/doctor/queue");
    await expect(doctor.locator("[data-jvk-splash]")).toHaveCount(0);
    await doctor.getByLabel("Staff Email", { exact: true }).fill("doctor@demo.test");
    await doctor.getByLabel("Password", { exact: true }).fill(demoPassword);
    await doctor.getByRole("button", { name: "Sign In with Credentials" }).click();
    await expect(doctor).toHaveURL(/#\/app\/doctor\/queue$/);
    await expect(doctor.getByText(token!, { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("supports synthetic QR upload and typed symptoms after device permission denial", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); } },
    });
    class DeniedRecognizer {
      static async available() { return "available"; }
      onerror: (() => void) | null = null;
      start() { setTimeout(() => this.onerror?.(), 0); }
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { value: DeniedRecognizer });
  });
  await page.goto("/erp.html#/kiosk");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: "Use my information for direct care and examination" }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Scan ABHA QR" }).click();
  await expect(page.getByText(/Camera unavailable or permission denied/)).toBeVisible();
  await page.getByLabel("Upload QR image").setInputFiles({
    name: "synthetic-qr.png", mimeType: "image/png", buffer: await QRCode.toBuffer(demoPatientIdentity.abha),
  });
  const identifier = page.getByLabel("ABHA number", { exact: true });
  await expect(identifier).toHaveValue(demoPatientIdentity.abha);
  await identifier.clear();
  await identifier.fill(demoPatientIdentity.abha);
  await page.getByRole("button", { name: "Request demo code" }).click();
  const code = await page.getByText(/Demo verification code/).locator("strong").textContent();
  await page.getByLabel("Verification code", { exact: true }).fill(code ?? "");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText("Synthetic identity verified")).toBeVisible();
  await page.getByRole("button", { name: "Use microphone" }).click();
  await expect(page.getByText(/Microphone unavailable or permission denied/)).toBeVisible();
  await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("Synthetic symptom note");
  await expect(page.getByRole("textbox", { name: "Describe your symptoms" })).toHaveValue("Synthetic symptom note");
});

test("decodes a synthetic camera frame and releases its video track", async ({ page }) => {
  const image = await QRCode.toDataURL(demoPatientIdentity.abha, { width: 320 });
  await page.addInitScript((url) => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: async () => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 320;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Synthetic camera canvas unavailable");
        context.drawImage(image, 0, 0, 320, 320);
        const stream = canvas.captureStream(15);
        const track = stream.getVideoTracks()[0]!;
        const draw = () => {
          if (track.readyState === "ended") {
            document.body.dataset.camera = "released";
            return;
          }
          context.drawImage(image, 0, 0, 320, 320);
          requestAnimationFrame(draw);
        };
        draw();
        return stream;
      } },
    });
  }, image);
  await page.goto("/erp.html#/kiosk");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: "Use my information for direct care and examination" }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Scan ABHA QR" }).click();
  await expect(page.getByLabel("ABHA number", { exact: true })).toHaveValue(demoPatientIdentity.abha);
  await expect(page.locator("body")).toHaveAttribute("data-camera", "released");
});
