export const maxSocketMetadataBytes = 64 * 1024;
export const maxSocketDocumentBytes = 10 * 1024 * 1024;
export const maxSocketFrameBytes =
  4 + maxSocketMetadataBytes + maxSocketDocumentBytes;

export function packSocketDocument(
  metadata: object,
  bytes: ArrayBuffer,
): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify(metadata));
  if (
    json.length > maxSocketMetadataBytes ||
    bytes.byteLength > maxSocketDocumentBytes
  )
    throw new Error("WebSocket document exceeds size limit");

  const frame = new ArrayBuffer(4 + json.length + bytes.byteLength);
  const view = new Uint8Array(frame);
  new DataView(frame).setUint32(0, json.length);
  view.set(json, 4);
  view.set(new Uint8Array(bytes), 4 + json.length);
  return frame;
}

export function unpackSocketDocument(frame: ArrayBuffer): {
  metadata: unknown;
  bytes: ArrayBuffer;
} {
  if (frame.byteLength < 4 || frame.byteLength > maxSocketFrameBytes)
    throw new Error("Invalid WebSocket document");
  const size = new DataView(frame).getUint32(0);
  if (
    size > maxSocketMetadataBytes ||
    size > frame.byteLength - 4 ||
    frame.byteLength - 4 - size > maxSocketDocumentBytes
  )
    throw new Error("Invalid WebSocket document");

  const json = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: false,
  }).decode(new Uint8Array(frame, 4, size));
  return { metadata: JSON.parse(json), bytes: frame.slice(4 + size) };
}
