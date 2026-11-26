import { useEffect, useRef, useState } from "react";
import { Mic, QrCode, Square, Upload, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/basic";
import { InlineBanner } from "@/components/ui/design-primitives";
import { CLOUDFLARE_API_BASE } from "@/lib/api";
import type { KioskSpeechPrompt } from "../../../../../packages/shared/kiosk-copy";

export function playKioskAlert() {
  if (typeof window.AudioContext !== "function") return;
  try {
    const audio = new AudioContext();
    const tone = audio.createOscillator();
    const envelope = audio.createGain();
    const now = audio.currentTime;
    tone.frequency.value = 660;
    envelope.gain.setValueAtTime(0.06, now);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    tone.connect(envelope).connect(audio.destination);
    tone.onended = () => {
      void audio.close().catch(() => undefined);
    };
    tone.start(now);
    tone.stop(now + 0.3);
  } catch {
    // The emergency message and token stay visible if audio is unavailable.
  }
}

type LocalRecognizer = {
  processLocally: boolean;
  lang: string;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};
type RecognizerType = {
  new (): LocalRecognizer;
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<string>;
};

function releaseAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

export function VoiceControls({
  caption,
  locale,
  onTranscript,
  uiVariant = "default",
  kioskPrompt,
}: {
  caption: string;
  locale: string;
  onTranscript?: (text: string) => void;
  uiVariant?: "default" | "kiosk";
  kioskPrompt?: KioskSpeechPrompt;
}) {
  const [status, setStatus] = useState("Voice idle");
  const [listening, setListening] = useState(false);
  const recognition = useRef<LocalRecognizer | null>(null);
  const attempt = useRef(0);
  const voiceAttempt = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(
    () => () => {
      attempt.current++;
      recognition.current?.abort();
      setListening(false);
      voiceAttempt.current++;
      window.speechSynthesis?.cancel();
      releaseAudio(audioRef.current);
      audioRef.current = null;
    },
    [caption, locale, kioskPrompt],
  );

  function speak() {
    const current = ++voiceAttempt.current;
    const speech = window.speechSynthesis;
    speech?.cancel();
    releaseAudio(audioRef.current);
    audioRef.current = null;
    const unavailable = "Playback unavailable. Read the caption below.";

    function playKioskPrompt() {
      if (voiceAttempt.current !== current) return;
      if (!kioskPrompt) {
        setStatus(unavailable);
        return;
      }
      const language = locale.toLowerCase().split("-")[0];
      const audio = new Audio(`${CLOUDFLARE_API_BASE}/kiosk/speech/${language}/${kioskPrompt}`);
      audioRef.current = audio;
      setStatus("Preparing audio…");
      const finish = (status: string) => {
        if (audioRef.current !== audio) return;
        audioRef.current = null;
        releaseAudio(audio);
        setStatus(status);
      };
      audio.onerror = () => finish(unavailable);
      audio.onended = () => finish("Voice idle");
      void audio.play().then(
        () => {
          if (audioRef.current === audio) setStatus("Playing caption");
        },
        () => finish(unavailable),
      );
    }

    const voice = speech
      ?.getVoices()
      .find(
        (voice) =>
          voice.localService &&
          voice.lang.toLowerCase().split("-")[0] === locale.split("-")[0],
      );
    if (!voice) {
      if (kioskPrompt) playKioskPrompt();
      else setStatus("Local playback unavailable. Read the caption below.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(caption);
    utterance.voice = voice;
    utterance.lang = locale;
    utterance.onstart = () => {
      if (voiceAttempt.current === current) setStatus("Playing caption");
    };
    utterance.onend = () => {
      if (voiceAttempt.current === current) setStatus("Voice idle");
    };
    utterance.onerror = playKioskPrompt;
    speech?.speak(utterance);
  }

  async function listen() {
    const current = ++attempt.current;
    recognition.current?.abort();
    setListening(false);
    const browser = window as Window & {
      SpeechRecognition?: RecognizerType;
      webkitSpeechRecognition?: RecognizerType;
    };
    const Constructor =
      browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    setStatus("Checking microphone…");
    try {
      if (
        !Constructor?.available ||
        (await Constructor.available({
          langs: [locale],
          processLocally: true,
        })) !== "available"
      )
        throw new Error(
          "On-device speech recognition is unavailable. Type instead.",
        );
      if (current !== attempt.current) return;
      const recognizer = new Constructor();
      recognizer.lang = locale;
      recognizer.processLocally = true;
      recognition.current = recognizer;
      let failed = false;
      recognizer.onerror = () => {
        failed = true;
        setListening(false);
        setStatus("Microphone unavailable or permission denied. Type instead.");
      };
      recognizer.onresult = (event) => {
        setStatus("Review the transcript");
        onTranscript?.(event.results[0]?.[0]?.transcript ?? "");
      };
      recognizer.onend = () => {
        setListening(false);
        if (!failed) setStatus("Voice idle");
      };
      recognizer.start();
      setListening(true);
      setStatus("Listening…");
    } catch (error) {
      if (current === attempt.current) {
        setListening(false);
        setStatus(
          error instanceof Error
            ? error.message
            : "Microphone unavailable. Type instead.",
        );
      }
    }
  }

  function stop() {
    attempt.current++;
    voiceAttempt.current++;
    recognition.current?.abort();
    setListening(false);
    window.speechSynthesis?.cancel();
    releaseAudio(audioRef.current);
    audioRef.current = null;
    setStatus("Voice idle");
  }

  if (uiVariant === "kiosk") {
    return (
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={speak}
            className="jvk-kiosk-compact-btn inline-flex items-center gap-2 rounded-xl border border-[#DCE3DA] bg-white px-3.5 py-2 text-[13.5px] font-semibold text-[#132924] shadow-[0_1px_2px_rgba(14,36,32,0.03)] transition-colors hover:border-[#78B9A3] hover:bg-[#F3F9F5] cursor-pointer"
          >
            <Volume2 aria-hidden="true" className="size-4 shrink-0 text-[#057C61]" />
            <span>Read aloud</span>
          </button>
          {onTranscript && (
            <button
              type="button"
              onClick={() => void listen()}
              aria-pressed={listening}
              className={`jvk-kiosk-compact-btn inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13.5px] font-semibold shadow-[0_1px_2px_rgba(14,36,32,0.03)] transition-colors cursor-pointer ${
                listening
                  ? "border-[#047C61] bg-[#E5F4EC] text-[#045E4A]"
                  : "border-[#DCE3DA] bg-white text-[#132924] hover:border-[#78B9A3] hover:bg-[#F3F9F5]"
              }`}
            >
              <Mic aria-hidden="true" className="size-4 shrink-0 text-[#057C61]" />
              <span>Use microphone</span>
            </button>
          )}
          <button
            type="button"
            onClick={stop}
            className="jvk-kiosk-compact-btn inline-flex items-center gap-2 rounded-xl border border-[#DCE3DA] bg-white px-3.5 py-2 text-[13.5px] font-semibold text-[#132924] shadow-[0_1px_2px_rgba(14,36,32,0.03)] transition-colors hover:border-[#78B9A3] hover:bg-[#F3F9F5] cursor-pointer"
          >
            <Square
              aria-hidden="true"
              className="size-3.5 shrink-0 fill-[#057C61] text-[#057C61]"
            />
            <span>Stop voice</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#E2EAE1] bg-[#EFF4EE] px-3.5 py-2">
          <span
            aria-hidden="true"
            className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${
              listening
                ? "bg-[#047C61] text-white ring-4 ring-[#047C61]/20"
                : "bg-[#DCECE1] text-[#05735C]"
            }`}
          >
            <Mic className="size-3.5" />
          </span>
          <span
            role="status"
            className="jvk-kiosk-meta-text font-semibold text-[#163029]"
          >
            {status}
          </span>
          <span
            className="jvk-kiosk-meta-text min-w-0 flex-1 text-[#4A5E57]"
            lang={locale}
          >
            <span key={`${locale}-${caption}`}>{caption}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={speak}>
          Read aloud
        </Button>
        {onTranscript && (
          <Button type="button" variant="outline" onClick={() => void listen()}>
            Use microphone
          </Button>
        )}
        <Button type="button" variant="outline" onClick={stop}>
          Stop voice
        </Button>
      </div>
      <p role="status">{status}</p>
      <p
        className="rounded-lg bg-[var(--ds-surface-subtle)] px-3 py-2"
        lang={locale}
      >
        {caption}
      </p>
    </div>
  );
}

function abhaNumber(scanned: string) {
  const normalize = (text: string) =>
    /^\d{2}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/.test(text.trim())
      ? text.replace(/[^0-9]/g, "")
      : null;
  const plain = normalize(scanned);
  if (plain) return plain;
  try {
    const decoded: unknown = JSON.parse(scanned);
    if (typeof decoded !== "object" || !decoded) return null;
    for (const key of [
      "abhaNumber",
      "abha_number",
      "healthIdNumber",
      "ABHANumber",
      "hidn",
      "phrAddress",
    ]) {
      const value = (decoded as Record<string, unknown>)[key];
      if (typeof value === "string" && normalize(value))
        return normalize(value);
    }
  } catch {
    /* An unknown QR format can be entered manually. */
  }
  return null;
}

export function AbhaQrScanner({
  onFound,
  uiVariant = "default",
}: {
  onFound: (number: string) => void;
  uiVariant?: "default" | "kiosk";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const camera = useRef<HTMLVideoElement>(null);
  const onResult = useRef(onFound);
  onResult.current = onFound;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let frame = 0;
    let stream: MediaStream | undefined;
    const video = camera.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    async function scan() {
      try {
        if (!video || !ctx || !navigator.mediaDevices?.getUserMedia)
          throw new Error();
        const decoder = (await import("jsqr")).default;
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => {
            track.stop();
          });
          return;
        }
        video.srcObject = stream;
        await video.play();
        const tick = () => {
          if (cancelled) return;
          if (video.videoWidth && video.currentTime > 0) {
            canvas.width = Math.min(video.videoWidth, 640);
            canvas.height = Math.max(
              1,
              Math.round((canvas.width * video.videoHeight) / video.videoWidth),
            );
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const found = decoder(
              ctx.getImageData(0, 0, canvas.width, canvas.height).data,
              canvas.width,
              canvas.height,
            );
            if (found) {
              const id = abhaNumber(found.data);
              if (id) onResult.current(id);
              else
                setError(
                  "This QR does not contain a supported ABHA number. Enter it manually.",
                );
              setOpen(false);
              return;
            }
          }
          frame = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        if (!cancelled) {
          setOpen(false);
          setError(
            "Camera unavailable or permission denied. Enter the ABHA number or upload a QR image.",
          );
        }
      }
    }
    void scan();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      if (video) video.srcObject = null;
    };
  }, [open]);

  async function upload(file: File) {
    setError("");
    try {
      if (
        !["image/png", "image/jpeg"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error();
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(1200, bitmap.width);
        canvas.height = Math.max(
          1,
          Math.round((canvas.width * bitmap.height) / bitmap.width),
        );
        const context = canvas.getContext("2d");
        if (!context) throw new Error();
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const decoder = (await import("jsqr")).default;
        const result = decoder(
          context.getImageData(0, 0, canvas.width, canvas.height).data,
          canvas.width,
          canvas.height,
        );
        const id = result && abhaNumber(result.data);
        if (!id) throw new Error();
        onResult.current(id);
      } finally {
        bitmap.close();
      }
    } catch {
      setError(
        "Could not read an ABHA number from that image. Enter it manually or try another QR image.",
      );
    }
  }

  if (uiVariant === "kiosk") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(175px,0.8fr)_minmax(275px,1.2fr)] gap-3">
          <button
            type="button"
            onClick={() => {
              setOpen((value) => !value);
              setError("");
            }}
            aria-pressed={open}
            className="flex min-h-[58px] items-center gap-2.5 rounded-xl border border-[#DFE5DC] bg-white px-3.5 py-2.5 text-left text-[15px] font-semibold text-[#132924] shadow-[0_1px_2px_rgba(14,36,32,0.03)] transition-colors hover:border-[#78B9A3] hover:bg-[#F3F9F5] cursor-pointer"
          >
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#D4E6DB] bg-[#ECF6F0] text-[#05735C]"
            >
              <QrCode className="size-5" />
            </span>
            <span className="whitespace-nowrap">{open ? "Close camera" : "Scan ABHA QR"}</span>
          </button>

          <label className="flex min-h-[58px] items-center gap-2.5 rounded-xl border border-[#DFE5DC] bg-white px-3.5 py-2 text-sm text-[#132924] shadow-[0_1px_2px_rgba(14,36,32,0.03)]">
            <Upload aria-hidden="true" className="size-5 shrink-0 text-[#05735C]" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <span className="block text-[13px] font-semibold text-[#132924]">
                Upload QR image
              </span>
              <input
                className="jvk-kiosk-file-input block w-full max-w-full"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = "";
                }}
              />
            </div>
          </label>
        </div>
        {open && (
          <video
            ref={camera}
            muted
            playsInline
            aria-label="ABHA QR camera preview"
            className="max-h-64 max-w-full rounded-xl border border-[#DFE5DC]"
          />
        )}
        {error && <InlineBanner tone="warning" title={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setOpen((value) => !value);
            setError("");
          }}
        >
          {open ? "Close camera" : "Scan ABHA QR"}
        </Button>
        <label className="rounded-lg border px-3 py-2">
          Upload QR image{" "}
          <input
            className="block max-w-full"
            type="file"
            accept="image/jpeg,image/png"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {open && (
        <video
          ref={camera}
          muted
          playsInline
          aria-label="ABHA QR camera preview"
          className="max-h-64 max-w-full rounded-lg"
        />
      )}
      {error && <InlineBanner tone="warning" title={error} />}
    </div>
  );
}

export function DocumentReview({
  value,
  onChange,
  label = "Confirmed document text",
  uiVariant = "default",
}: {
  value: string;
  onChange: (text: string) => void;
  label?: string;
  uiVariant?: "default" | "kiosk";
}) {
  const [status, setStatus] = useState("");
  const [reading, setReading] = useState(false);
  const active = useRef(0);
  useEffect(
    () => () => {
      active.current++;
    },
    [],
  );
  async function read(file: File) {
    const request = ++active.current;
    setReading(true);
    setStatus("Reading document on this device…");
    let worker:
      | Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>
      | undefined;
    try {
      if (
        file.size === 0 ||
        file.size > 8 * 1024 * 1024 ||
        !["image/jpeg", "image/png"].includes(file.type)
      )
        throw new Error();
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        workerPath: "/cbc-assets/worker.min.js",
        corePath: "/cbc-assets/",
        langPath: "/cbc-assets",
        workerBlobURL: false,
        cacheMethod: "none",
        errorHandler: () => {},
      });
      if (request !== active.current) return;
      const { data } = await worker.recognize(file);
      if (request !== active.current) return;
      if (!data.text.trim()) throw new Error();
      onChange(data.text.trim().slice(0, 4000));
      setStatus(
        `OCR confidence ${Math.round(data.confidence)}%. Review all text before using it.`,
      );
    } catch {
      if (request === active.current)
        setStatus(
          "Unable to read the image. Try a clearer JPG or PNG, or enter the text manually.",
        );
    } finally {
      await worker?.terminate().catch(() => undefined);
      if (request === active.current) setReading(false);
    }
  }
  if (uiVariant === "kiosk") {
    return (
      <div className="space-y-3.5">
        <label className="flex items-start gap-3 rounded-xl border border-[#DFE5DC] bg-white px-4 py-3 text-sm font-semibold text-[#132924] shadow-[0_1px_2px_rgba(14,36,32,0.03)]">
          <Upload aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#05735C]" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="block text-sm font-semibold text-[#132924]">
              Take or upload a JPG or PNG
            </span>
            <input
              className="jvk-kiosk-file-input block w-full max-w-full"
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              disabled={reading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void read(file);
                event.target.value = "";
              }}
            />
          </div>
        </label>
        {status && (
          <p
            role="status"
            className="jvk-kiosk-meta-text rounded-xl border border-[#DCE8E0] bg-[#EFF6F1] px-3.5 py-2 font-medium text-[#164236]"
          >
            {status}
          </p>
        )}
        <label className="block space-y-1.5">
          <span className="block text-sm font-semibold text-[#132924]">{label}</span>
          <textarea
            className="block w-full rounded-xl border border-[#D8DED7] bg-[#FAFBF8] p-3.5 text-sm text-[#0E2420] placeholder:text-[#788781] focus:bg-white focus:border-[#047C61] focus:outline-none focus:ring-2 focus:ring-[#047C61]/20"
            rows={4}
            maxLength={4000}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block rounded-lg border p-3">
        Take or upload a JPG or PNG
        <input
          className="block max-w-full"
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          disabled={reading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void read(file);
            event.target.value = "";
          }}
        />
      </label>
      {status && <p role="status">{status}</p>}
      <label className="block">
        {label}
        <textarea
          className="block w-full rounded-lg border bg-background p-3"
          rows={4}
          maxLength={4000}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}
