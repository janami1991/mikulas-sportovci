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
    if (new URL(req.url).pathname === "/stav") return Response.json(await this.room.prehled());
    const jmeno = new URL(req.url).searchParams.get("jmeno") || "", strana = new URL(req.url).searchParams.get("strana") || "";
    const [klient, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    await this.room.open(server, jmeno, strana);
    return new Response(null, { status: 101, webSocket: klient });
  }
  async webSocketMessage(ws, msg) { await this.room.msg(ws, msg); }
  async webSocketClose(ws, code) { try { ws.close(1000, "konec"); } catch {} await this.room.close(ws); }
  async webSocketError(ws) { await this.room.close(ws); }
}

export const MISTNOSTI = 3;   // pevné hry (místnosti) 1–3
const mistnost = (env, n) => env.MISTNOST.get(env.MISTNOST.idFromName(String(n)));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    /* seznam místností pro okno Více hráčů (1 dotaz na Worker + 1 na každou místnost) */
    if (url.pathname === "/mistnosti") {
      const ok = POVOLENE.some(r => r.test(origin));
      const stav = await Promise.all([...Array(MISTNOSTI)].map((_, i) =>
        mistnost(env, i + 1).fetch("https://mistnost/stav").then(r => r.json()).catch(() => null)));
      return Response.json({ m: stav.map((s, i) => ({ c: i + 1, ...(s || { hraci: 0, pripojeni: 0, hraje: false, chyba: 1 }) })) },
        { headers: ok ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {} });
    }
    const m = url.pathname.match(/^\/mistnost\/([1-9])$/);
    if (!m) return new Response("Mikulášská hra – server pro hru více hráčů běží.", { headers: { "content-type": "text/plain; charset=utf-8" } });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Očekávám WebSocket", { status: 426 });
    if (+m[1] > MISTNOSTI) return new Response("Neznámá místnost", { status: 404 });
    if (!POVOLENE.some(r => r.test(origin))) return new Response("Nepovolený původ", { status: 403 });
    return mistnost(env, m[1]).fetch(req);
  },
};
