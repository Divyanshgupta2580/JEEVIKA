import type { Context } from "hono";
import { z } from "zod";
import { kioskSpeechText } from "../../../../packages/shared/kiosk-copy";
import { patientLanguage, patientLanguages } from "../../../../packages/shared/patient-experience";
import { requestSarvamAudio, sarvamAudioResponse, sarvamVoice } from "../../../../services/lang-gateway";
import type { Env } from "../../context";
import { tenantDb } from "../../database";
import { tokenHash } from "../../security";
import { clinicalOriginAllowed } from "../../staff-session";

const params = z.object({ locale: patientLanguage, prompt: z.string().max(32) });
const maxAudioLength = 750_000;
const retryDelay = 5 * 60_000;

function decodeWav(encoded: string) {
  if (encoded.length > maxAudioLength) throw new Error("Audio exceeds limit");
  const bytes = atob(encoded);
  if (bytes.length <= 44 || !bytes.startsWith("RIFF") || bytes.slice(8, 12) !== "WAVE")
    throw new Error("Invalid WAV audio");
  return Uint8Array.from(bytes, (byte) => byte.charCodeAt(0));
}

function audioResponse(audio: Uint8Array<ArrayBuffer>, range?: string) {
  const headers = new Headers({
    "Content-Type": "audio/wav",
    "Cache-Control": "public, max-age=300",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    const start = match[1] ? Number(match[1]) : Math.max(0, audio.length - Number(match[2]));
    const end = Math.min(audio.length - 1, match[1] && match[2] ? Number(match[2]) : audio.length - 1);
    if (start > end) {
      headers.set("Content-Range", `bytes */${audio.length}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${audio.length}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(audio.subarray(start, end + 1), { status: 206, headers });
  }
  headers.set("Content-Length", String(audio.length));
  return new Response(audio, { headers });
}

export async function kioskSpeech(c: Context<{ Bindings: Env }>) {
  c.header("Cache-Control", "no-store");
  if (!clinicalOriginAllowed(c.req.raw, c.env)) {
    return c.json({ error: "Cross-origin speech request unavailable." }, 403);
  }
  const parsed = params.safeParse(c.req.param());
  if (!parsed.success) return c.json({ error: "Unknown kiosk prompt." }, 404);
  const { locale, prompt } = parsed.data;
  const text = kioskSpeechText(locale, prompt);
  if (!text) return c.json({ error: "Unknown kiosk prompt." }, 404);
  if (!c.env?.DB) return c.json({ error: "Kiosk speech unavailable." }, 503);

  const language = patientLanguages[locale][1];
  const cacheKey = await tokenHash(JSON.stringify([language, prompt, text, sarvamVoice]));
  // Every kiosk can share this library of built-in prompts. No request selects a tenant.
  const db = tenantDb({ db: c.env.DB, orgId: "public-kiosk-voice" });
  const cached = () => db.statement(
    "SELECT audio_base64 FROM kiosk_speech_cache WHERE org_id=:org AND cache_key=?",
    cacheKey,
  ).first<{ audio_base64: string | null }>();
  const range = c.req.header("Range");

  try {
    const existing = await cached();
    if (existing?.audio_base64) return audioResponse(decodeWav(existing.audio_base64), range);
    const key = c.env.SARVAM_API_KEY;
    if (!key || c.env.SARVAM_SPEECH_ENABLED === "false") {
      return c.json({ error: "Kiosk speech unavailable." }, 503);
    }

    // One atomic claim across Workers. A failed provider call can be retried after cooldown.
    const now = Date.now();
    const retryAfter = now + retryDelay;
    const claim = await db.statement(
      `INSERT INTO kiosk_speech_cache (org_id, cache_key, retry_after) VALUES (:org, ?, ?)
       ON CONFLICT (org_id, cache_key) DO UPDATE SET retry_after=excluded.retry_after
       WHERE kiosk_speech_cache.audio_base64 IS NULL AND kiosk_speech_cache.retry_after<=?
       RETURNING retry_after`,
      cacheKey, retryAfter, now,
    ).first();
    if (!claim) {
      const ready = await cached();
      if (ready?.audio_base64) return audioResponse(decodeWav(ready.audio_base64), range);
      return c.json({ error: "Kiosk speech temporarily unavailable." }, 503);
    }

    const response = await requestSarvamAudio(key, language, text);
    if (!response.ok) return c.json({ error: "Kiosk speech temporarily unavailable." }, 503);
    const { audios: [encoded] } = sarvamAudioResponse.parse(await response.json());
    if (!encoded) return c.json({ error: "Kiosk speech temporarily unavailable." }, 503);
    const audio = decodeWav(encoded);
    await db.statement(
      `UPDATE kiosk_speech_cache SET audio_base64=?
       WHERE org_id=:org AND cache_key=? AND retry_after=?`,
      encoded, cacheKey, retryAfter,
    ).run();
    return audioResponse(audio, range);
  } catch {
    return c.json({ error: "Kiosk speech temporarily unavailable." }, 503);
  }
}
