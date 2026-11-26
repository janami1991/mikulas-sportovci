// Test multiplayeru: jedna místnost = jeden Durable Object, přeposílá zprávy ostatním.
// Používá WebSocket Hibernation API (bez účtování doby nečinnosti).
import { DurableObject } from "cloudflare:workers";

const POVOLENE = [/^https:\/\/janami1991\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const MAX_HRACU = 16;

export class Mistnost extends DurableObject {
  async fetch(req) {
    if (this.ctx.getWebSockets().length >= MAX_HRACU) return new Response("Místnost je plná", { status: 409 });
    const [klient, server] = Object.values(new WebSocketPair());
    const id = crypto.randomUUID().slice(0, 8);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id });
    server.send(JSON.stringify({ t: "ahoj", id, n: this.ctx.getWebSockets().length }));
    return new Response(null, { status: 101, webSocket: klient });
  }
  webSocketMessage(ws, msg) {
    if (typeof msg !== "string" || msg.length > 4000) return;
    const { id } = ws.deserializeAttachment();
    const out = JSON.stringify({ t: "m", id, d: msg });
    for (const o of this.ctx.getWebSockets()) if (o !== ws) { try { o.send(out); } catch {} }
  }
  webSocketClose(ws) { this.pryc(ws); }
  webSocketError(ws) { this.pryc(ws); }
  pryc(ws) {
    const { id } = ws.deserializeAttachment() || {};
    const out = JSON.stringify({ t: "pryc", id });
    for (const o of this.ctx.getWebSockets()) if (o !== ws) { try { o.send(out); } catch {} }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/mistnost\/([A-Za-z0-9_-]{1,24})$/);
    if (!m) return new Response("Mikulášská hra – multiplayer server běží.", { headers: { "content-type": "text/plain; charset=utf-8" } });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Očekávám WebSocket", { status: 426 });
    const origin = req.headers.get("Origin") || "";
    if (!POVOLENE.some(r => r.test(origin))) return new Response("Nepovolený původ", { status: 403 });
    return env.MISTNOST.get(env.MISTNOST.idFromName(m[1])).fetch(req);
  },
};
