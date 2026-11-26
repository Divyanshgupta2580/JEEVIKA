import { afterEach, expect, it, vi } from "vitest";
import { LocalDatabase } from "../backend/local/database";
import { migrateLocal } from "../backend/local/migrate";
import { app } from "../backend/src/index";
import { kioskPrompts } from "../packages/shared/kiosk-copy";
import { patientLanguages } from "../packages/shared/patient-experience";

const wav = btoa("RIFF" + "\0".repeat(4) + "WAVE" + "\0".repeat(34));

function fixture() {
  const db = new LocalDatabase();
  migrateLocal(db);
  return {
    db,
    audio(locale: string, prompt: string, key?: string, headers?: HeadersInit) {
      return app.request(
        `http://127.0.0.1/api/v1/kiosk/speech/${locale}/${prompt}`,
        { headers },
        { DB: db, ENVIRONMENT: "test", SARVAM_API_KEY: key },
      );
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

it("plays fixed prompts in all kiosk languages and reuses D1 audio without the key", async () => {
  const { db, audio } = fixture();
  const provider = vi.fn<typeof fetch>(async () => Response.json({ audios: [wav] }));
  vi.stubGlobal("fetch", provider);
  try {
    for (const locale of Object.keys(patientLanguages) as Array<keyof typeof patientLanguages>) {
      const response = await audio(locale, "language", "synthetic-test-key");
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("audio/wav");
      const [destination, request] = provider.mock.lastCall!;
      expect(destination).toBe("https://api.sarvam.ai/text-to-speech");
      expect(JSON.parse(String(request?.body))).toMatchObject({
        language_code: patientLanguages[locale][1],
        text: kioskPrompts[locale][0],
      });
      expect(await (await audio(locale, "language")).arrayBuffer()).toEqual(await response.arrayBuffer());
    }
    expect(provider).toHaveBeenCalledTimes(Object.keys(patientLanguages).length);
    const range = await audio("gu", "language", undefined, { Range: "bytes=0-1" });
    expect(range.status).toBe(206);
    expect(range.headers.get("Content-Range")).toBe("bytes 0-1/46");
    expect(await range.text()).toBe("RI");
    expect((await audio("gu", "language", undefined, { Range: "bytes=99-" })).status).toBe(416);
    expect((await audio("gu", "patient-entered-text", "synthetic-test-key")).status).toBe(404);
    expect((await audio("unknown", "language", "synthetic-test-key")).status).toBe(404);
    expect(provider).toHaveBeenCalledTimes(Object.keys(patientLanguages).length);
  } finally {
    db.close();
  }
});

it("generates a prompt once even while multiple workers request it", async () => {
  const { db, audio } = fixture();
  let complete!: (response: Response) => void;
  const provider = vi.fn<typeof fetch>(() => new Promise((resolve) => { complete = resolve; }));
  vi.stubGlobal("fetch", provider);
  try {
    const generating = audio("gu", "stemi-radiation", "synthetic-test-key");
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
    try {
      expect((await audio("gu", "stemi-radiation", "synthetic-test-key")).status).toBe(503);
    } finally {
      complete(Response.json({ audios: [wav] }));
      expect((await generating).status).toBe(200);
    }
    expect((await audio("gu", "stemi-radiation")).status).toBe(200);
    expect(provider).toHaveBeenCalledTimes(1);
  } finally {
    db.close();
  }
});

it("returns a caption-compatible failure and suppresses repeat provider errors", async () => {
  const { db, audio } = fixture();
  const provider = vi.fn<typeof fetch>(async () => new Response("private response", { status: 401 }));
  vi.stubGlobal("fetch", provider);
  try {
    expect((await audio("ta", "visit")).status).toBe(503);
    const rejected = await audio("ta", "visit", "synthetic-test-key");
    expect(rejected.status).toBe(503);
    expect(await rejected.text()).not.toContain("private response");
    expect((await audio("ta", "visit", "synthetic-test-key")).status).toBe(503);
    expect(provider).toHaveBeenCalledTimes(1);
  } finally {
    db.close();
  }
});
