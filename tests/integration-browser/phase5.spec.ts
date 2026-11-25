import { expect, test } from "@playwright/test";
import QRCode from "qrcode";
import { demoPatientIdentity } from "../../packages/shared/patient-experience";

test("public overview and the sessionless kiosk support local Indic fonts and media permission fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
    class DeniedSpeech {
      static async available() {
        return "available";
      }
      onerror: (() => void) | null = null;
      start() {
        setTimeout(() => this.onerror?.(), 10);
      }
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { value: DeniedSpeech });
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/erp.html");
  const nav = page.getByRole("navigation", { name: "Public navigation" });
  await expect(nav.getByRole("link", { name: "Enter workspace" })).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Patient sign-in" }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Patient kiosk" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a language" }),
  ).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Public navigation" }),
  ).toHaveCount(0);
  expect(
    await page.getByRole("button", { name: "English" }).evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return {
        height: rect.height,
        textSize: parseFloat(getComputedStyle(button).fontSize),
      };
    }),
  ).toMatchObject({ height: expect.any(Number), textSize: 18 });
  expect(
    await page
      .getByRole("button", { name: "English" })
      .evaluate((button) => button.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(56);
  const fonts = await page.evaluate(async () => {
    const pairs = [
      ["Devanagari", "हिन्दी"],
      ["Devanagari", "मराठी"],
      ["Gurmukhi", "ਪੰਜਾਬੀ"],
      ["Tamil", "தமிழ்"],
      ["Bengali", "বাংলা"],
      ["Telugu", "తెలుగు"],
      ["Gujarati", "ગુજરાતી"],
      ["Kannada", "ಕನ್ನಡ"],
    ];
    return await Promise.all(
      pairs.map(async ([name, sample]) =>
        (
          await document.fonts.load(`700 18px "Noto Sans ${name}"`, sample)
        ).some((face) => face.status === "loaded"),
      ),
    );
  });
  expect(fonts).toEqual(Array(8).fill(true));
  await page.getByRole("button", { name: "मराठी" }).click();
  await expect(
    page.getByRole("heading", { name: "भाषा निवडा" }),
  ).toHaveAttribute("lang", "mr-IN");
  await page.getByRole("button", { name: "English" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (const checkbox of await page.getByRole("checkbox").all()) {
    await checkbox.check();
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Scan ABHA QR" }).click();
  await expect(
    page.getByText(/Camera unavailable or permission denied/),
  ).toBeVisible();
  const buffer = await QRCode.toBuffer(demoPatientIdentity.abha);
  await page
    .getByLabel("Upload QR image")
    .setInputFiles({ name: "synthetic-qr.png", mimeType: "image/png", buffer });
  await expect(page.getByLabel("ABHA number", { exact: true })).toHaveValue(
    demoPatientIdentity.abha,
  );
  await page.getByRole("button", { name: "Request demo code" }).click();
  const code = await page
    .getByText(/Demo verification code/)
    .locator("strong")
    .textContent();
  await page.getByLabel("Verification code", { exact: true }).fill(code ?? "");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText("Synthetic identity verified")).toBeVisible();
  await page.getByRole("button", { name: "Use microphone" }).click();
  await expect(
    page.getByText(/Microphone unavailable or permission denied/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Stomach pain, acidity or burning" })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText(/Does the pain spread to your left arm/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.getByText(/^EMERG-/)).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Consent receipt reference QR code" }),
  ).toBeVisible();
});

test("patient OTP protects deep links, all five tabs and a persistent daily check-in at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/erp.html#/app/home/thread");
  await expect(page).toHaveURL(/#\/home\/sign-in$/);
  await page.getByRole("radio", { name: "Mobile number" }).check();
  await page.getByRole("button", { name: "Use synthetic identifier" }).click();
  await page.getByRole("button", { name: "Request demo code" }).click();
  const code = await page
    .getByText(/Demo verification code/)
    .locator("strong")
    .textContent();
  await page.getByLabel("Verification code", { exact: true }).fill(code ?? "");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(
    page.getByRole("heading", { name: "Health Thread" }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Patient home navigation" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Next action" })).toHaveCount(
    1,
  );
  await nav.getByRole("link", { name: "Check-In", exact: true }).click();
  await page.getByLabel("How are you feeling today?").selectOption("same");
  await page
    .getByLabel("Did you take your scheduled medicines?")
    .selectOption("not-applicable");
  await page
    .getByLabel("Do you need urgent help right now?")
    .selectOption("no");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByText("Check-in saved.")).toBeVisible();
  await nav.getByRole("link", { name: "Drift" }).click();
  await expect(page.getByText("Learning your baseline")).toBeVisible();
  await nav.getByRole("link", { name: "Medicines" }).click();
  await expect(
    page.getByRole("heading", { name: "Refill", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Prescriptions", exact: true }).click();
  await expect(nav.getByRole("link", { name: "Medicines" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await nav.getByRole("link", { name: "More" }).click();
  for (const route of [
    "HER Wellness",
    "Vitalis",
    "Gentle Yoga",
    "Prakriti & Agni",
  ]) {
    await page.getByRole("link", { name: route, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: route, exact: true }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: "More" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await nav.getByRole("link", { name: "Thread", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily check-in", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next action" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/#\/home\/sign-in$/);
  await page.goto("/erp.html#/app/home/prescriptions");
  await expect(page).toHaveURL(/#\/home\/sign-in$/);
});

test("a routine kiosk visit can read an image locally, review its text and print a token", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => window.dispatchEvent(new Event("kiosk-test-print"));
    window.addEventListener("kiosk-test-print", () => {
      document.body.dataset.printInvoked = "true";
    });
  });
  await page.goto("/kiosk");
  await expect(
    page.getByRole("heading", { name: "Choose a language" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
    "BUTTON",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (const checkbox of await page.getByRole("checkbox").all()) {
    await checkbox.check();
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue without verification" })
    .click();
  await page.getByRole("button", { name: "Fever or chills" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (let i = 0; i < 7; i++)
    await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review a document" }),
  ).toBeVisible();
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 250;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable in Chromium.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 900, 250);
    ctx.fillStyle = "black";
    ctx.font = "46px Arial";
    ctx.fillText("SYNTHETIC DOCUMENT REVIEW", 40, 130);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  });
  await page.getByLabel("Take or upload a JPG or PNG").setInputFiles({
    name: "synthetic-doc.png",
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  });
  await expect(page.getByText(/OCR confidence/)).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByLabel("Confirmed document text")).toHaveValue(
    /SYNTHETIC DOCUMENT REVIEW/i,
  );
  await page
    .getByLabel("I checked the extracted text and want to share it.")
    .check();
  await page
    .getByRole("button", { name: "Request token", exact: true })
    .click();
  await expect(page.getByText(/^OPD-/)).toBeVisible();
  await page.getByRole("button", { name: "Print token" }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-print-invoked",
    "true",
  );
});
