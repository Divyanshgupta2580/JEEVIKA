import { z } from "zod";
import { packSocketDocument, unpackSocketDocument } from "../../../../packages/shared/socket-binary";
import { CLOUDFLARE_API_BASE } from "./supabase";

const protocol = "jeevika.data.v1";
const responseSchema = z.object({
  id: z.string(),
  status: z.number().int().min(200).max(599),
  body: z.unknown().optional(),
  documentType: z.enum(["application/pdf", "image/png", "image/jpeg"]).optional(),
});
type SocketResponse = z.infer<typeof responseSchema> & { bytes?: ArrayBuffer };
type Pending = {
  frame: string | ArrayBuffer;
  sent: boolean;
  finish: (error?: Error, response?: SocketResponse) => void;
};

class DataSocket {
  private socket?: WebSocket;
  private reconnect?: ReturnType<typeof setTimeout>;
  private opening?: ReturnType<typeof setTimeout>;
  private delay = 250;
  private closed = false;
  private readonly pending = new Map<string, Pending>();

  constructor(private readonly token: string, private readonly apiBase: string) {}

  request(method: string, path: string, body?: unknown, signal?: AbortSignal, key?: string, document?: { bytes: ArrayBuffer; type: string }) {
    return new Promise<SocketResponse>((resolve, reject) => {
      if (this.closed || signal?.aborted) {
        reject(new DOMException("Request cancelled", "AbortError"));
        return;
      }

      const id = crypto.randomUUID();
      const metadata = { id, method, path, body, key };
      const frame = document
        ? packSocketDocument({ ...metadata, retainSource: true, documentType: document.type }, document.bytes)
        : JSON.stringify(metadata);
      const abort = () => finish(new DOMException("Request cancelled", "AbortError"));
      const timer = setTimeout(() => finish(new Error("WebSocket request timed out")), document || path.endsWith("/document") ? 45000 : 15000);
      const finish = (error?: Error, response?: SocketResponse) => {
        this.pending.delete(id);
        signal?.removeEventListener("abort", abort);
        clearTimeout(timer);
        if (response) resolve(response);
        else reject(error);
      };

      this.pending.set(id, { frame, sent: false, finish });
      signal?.addEventListener("abort", abort, { once: true });
      if (this.socket?.readyState === WebSocket.OPEN) this.flush(this.socket);
      else this.connect();
    });
  }

  private flush(socket: WebSocket) {
    for (const item of this.pending.values()) {
      if (item.sent) continue;
      try {
        socket.send(item.frame);
        item.sent = true;
      } catch {
        socket.close();
        return;
      }
    }
  }

  private connect() {
    if (this.closed || this.socket || this.reconnect) return;
    const url = new URL(`${this.apiBase}/socket`, window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    let socket: WebSocket;
    try {
      socket = new WebSocket(url, [protocol, `session.${this.token}`]);
    } catch {
      this.retry();
      return;
    }
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    this.opening = setTimeout(() => socket.close(), 5000);
    socket.onopen = () => {
      clearTimeout(this.opening);
      this.delay = 250;
      this.flush(socket);
    };
    socket.onmessage = ({ data }) => {
      try {
        const frame = data instanceof ArrayBuffer ? unpackSocketDocument(data) : undefined;
        const result = responseSchema.parse(frame ? frame.metadata : JSON.parse(data));
        this.pending.get(result.id)?.finish(undefined, { ...result, bytes: frame?.bytes });
      } catch {
        // Frames without a request ID cannot complete a request.
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      this.detach(socket);
      // The server may already have applied a sent mutation.
      for (const item of this.pending.values()) {
        if (item.sent) item.finish(new Error("WebSocket connection interrupted"));
      }
      this.retry();
    };
  }

  private retry() {
    if (this.closed) return;
    this.reconnect = setTimeout(() => {
      this.reconnect = undefined;
      this.connect();
    }, this.delay + Math.random() * 200);
    this.delay = Math.min(this.delay * 2, 10000);
  }

  private detach(socket: WebSocket) {
    clearTimeout(this.opening);
    socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
    this.socket = undefined;
  }

  close() {
    this.closed = true;
    clearTimeout(this.reconnect);
    const socket = this.socket;
    if (socket) {
      this.detach(socket);
      socket.close();
    }
    for (const item of this.pending.values()) item.finish(new DOMException("Session ended", "AbortError"));
  }
}

const sessions = new Map<string, DataSocket>();
export function closeDataSocket(token: string) {
  sessions.get(token)?.close();
  sessions.delete(token);
}

export function socketRequest(token: string, path: string, method: string, body?: unknown, signal?: AbortSignal, key?: string, document?: { bytes: ArrayBuffer; type: string }, apiBase = CLOUDFLARE_API_BASE) {
  if (signal?.aborted) return Promise.reject(new DOMException("Request cancelled", "AbortError"));
  let socket = sessions.get(token);
  if (!socket) {
    socket = new DataSocket(token, apiBase);
    sessions.set(token, socket);
  }
  return socket.request(method, path, body, signal, key, document);
}
