-- Public prompt audio only. This namespace contains no patient or tenant records.
CREATE TABLE IF NOT EXISTS kiosk_speech_cache (
  org_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  audio_base64 TEXT CHECK (length(audio_base64) <= 750000),
  retry_after INTEGER NOT NULL,
  PRIMARY KEY (org_id, cache_key)
);
