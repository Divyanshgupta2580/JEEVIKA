import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/basic";
import { InlineBanner } from "@/components/ui/design-primitives";

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

export function VoiceControls({
  caption,
  locale,
  onTranscript,
}: {
  caption: string;
  locale: string;
  onTranscript?: (text: string) => void;
}) {
  const [status, setStatus] = useState("Voice idle");
  const recognition = useRef<LocalRecognizer | null>(null);
  const attempt = useRef(0);
  useEffect(
    () => () => {
      attempt.current++;
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [caption, locale],
  );

  function speak() {
    const speech = window.speechSynthesis;
    const voice = speech
      ?.getVoices()
      .find(
        (voice) =>
          voice.localService &&
          voice.lang.toLowerCase().split("-")[0] === locale.split("-")[0],
      );
    if (!voice) {
      setStatus("Local playback unavailable. Read the caption below.");
      return;
    }
    speech.cancel();
    const utterance = new SpeechSynthesisUtterance(caption);
    utterance.voice = voice;
    utterance.lang = locale;
    utterance.onstart = () => setStatus("Playing caption");
    utterance.onend = () => setStatus("Voice idle");
    utterance.onerror = () =>
      setStatus("Playback unavailable. Read the caption below.");
    speech.speak(utterance);
  }

  async function listen() {
    const current = ++attempt.current;
    recognition.current?.abort();
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
        setStatus("Microphone unavailable or permission denied. Type instead.");
      };
      recognizer.onresult = (event) => {
        setStatus("Review the transcript");
        onTranscript?.(event.results[0]?.[0]?.transcript ?? "");
      };
      recognizer.onend = () => {
        if (!failed) setStatus("Voice idle");
      };
      recognizer.start();
      setStatus("Listening…");
    } catch (error) {
      if (current === attempt.current)
        setStatus(
          error instanceof Error
            ? error.message
            : "Microphone unavailable. Type instead.",
        );
    }
  }

  function stop() {
    attempt.current++;
    recognition.current?.abort();
    window.speechSynthesis?.cancel();
    setStatus("Voice idle");
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
}: {
  onFound: (number: string) => void;
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
}: {
  value: string;
  onChange: (text: string) => void;
  label?: string;
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
