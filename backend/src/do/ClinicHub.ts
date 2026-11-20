// Retain the registered Durable Object class while clinic-room authorization is unimplemented.
export class ClinicHub implements DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return Response.json({ error: "Clinic room subscriptions are unavailable" }, { status: 403 });
    }
    return Response.json({ ok: true, activeConnections: 0 });
  }
}
