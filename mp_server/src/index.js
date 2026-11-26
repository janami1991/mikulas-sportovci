// Herní server pro hru více hráčů: jedna místnost = jeden Durable Object.
// Logika místnosti je v room.js, tady je jen napojení na Cloudflare (WebSocket Hibernation API).
import { DurableObject } from "cloudflare:workers";
import { Room } from "./room.js";

const POVOLENE = [/^https:\/\/janami1991\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

export class Mistnost extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = new Room({
      all: () => this.ctx.getWebSockets(),
      att: w => { try { return w.deserializeAttachment(); } catch { return null; } },
      setAtt: (w, a) => w.serializeAttachment(a),
      send: (w, s) => { try { w.send(s); } catch {} },
      close: (w, c, r) => { try { w.close(c, r); } catch {} },
      get: k => this.ctx.storage.get(k),
      put: (k, v) => this.ctx.storage.put(k, v),
    });
  }
  async fetch(req) {
    const jmeno = new URL(req.url).searchParams.get("jmeno") || "";
    const [klient, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    await this.room.open(server, jmeno);
    return new Response(null, { status: 101, webSocket: klient });
  }
  async webSocketMessage(ws, msg) { await this.room.msg(ws, msg); }
  async webSocketClose(ws, code) { try { ws.close(1000, "konec"); } catch {} await this.room.close(ws); }
  async webSocketError(ws) { await this.room.close(ws); }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/mistnost\/([A-Za-z0-9_-]{1,24})$/);
    if (!m) return new Response("Mikulášská hra – server pro hru více hráčů běží.", { headers: { "content-type": "text/plain; charset=utf-8" } });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Očekávám WebSocket", { status: 426 });
    const origin = req.headers.get("Origin") || "";
    if (!POVOLENE.some(r => r.test(origin))) return new Response("Nepovolený původ", { status: 403 });
    return env.MISTNOST.get(env.MISTNOST.idFromName(m[1].toUpperCase())).fetch(req);
  },
};
