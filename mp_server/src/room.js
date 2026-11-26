// Logika místnosti (bez závislosti na Cloudflare – stejný kód běží i v testovacím serveru).
// io: { all():[ws], att(ws), setAtt(ws,a), send(ws,str), close(ws,code,why), get(k), put(k,v) }
export const LIMIT = { mikulas: 1, smrtka: 1, konik: 1, prda: 1, cert: 8, napalovac: 6 };
export const MAX_HRACU = 12;      // hráčů v družině (napalovači mají vlastní limit 6)
export const MAX_SPOJENI = 22;    // včetně těch, kdo si teprve vybírají
const MAX_ZPRAVA = 32000;

const rid = () => Math.random().toString(36).slice(2, 8);
const cisteJmeno = s => String(s || "").replace(/[<>&"'`]/g, "").trim().slice(0, 16) || "Hráč";

export class Room {
  constructor(io) { this.io = io; }

  zive(bez) { return this.io.all().filter(w => w !== bez && this.io.att(w)); }

  async stav(bez) {
    const hraci = this.zive(bez).map(w => this.io.att(w));
    const hraje = !!(await this.io.get("hraje"));
    /* hostitel: nejdřív připojený, kdo není pryč (skrytá karta); při hře přednostně s postavou */
    const kand = hraci.filter(a => !a.away && (!hraje || a.r));
    const pool = kand.length ? kand : hraci;
    const host = pool.length ? pool.reduce((m, a) => (a.seq < m.seq ? a : m)).id : null;
    return { t: "lobby", hraje, host, hraci: hraci.map(a => ({ id: a.id, n: a.n, r: a.r, v: a.v, away: a.away ? 1 : 0 })) };
  }

  /* přehled pro seznam místností: počet hráčů s postavou, všech připojených a jestli se hraje */
  async prehled() {
    const h = this.zive().map(w => this.io.att(w));
    return { hraci: h.filter(a => a.r).length, pripojeni: h.length, hraje: h.length ? !!(await this.io.get("hraje")) : false,
             seznam: h.map(a => ({ n: a.n, r: a.r || "" })) };   /* přezdívky a postavy pro seznam her */
  }

  async rozeslat(bez) {
    const s = JSON.stringify(await this.stav(bez));
    for (const w of this.zive(bez)) this.io.send(w, s);
  }

  async open(ws, jmeno) {
    if (this.zive(ws).length >= MAX_SPOJENI) {
      this.io.send(ws, JSON.stringify({ t: "plno" }));
      this.io.close(ws, 4000, "plno");
      return;
    }
    if (!this.zive(ws).length) await this.io.put("hraje", false);   /* prázdná místnost začíná znovu */
    const seq = ((await this.io.get("seq")) || 0) + 1;
    await this.io.put("seq", seq);
    const a = { id: rid(), seq, n: cisteJmeno(jmeno), r: "", v: 1, away: 0 };
    this.io.setAtt(ws, a);
    this.io.send(ws, JSON.stringify({ t: "ahoj", id: a.id }));
    await this.rozeslat();
  }

  async msg(ws, str) {
    if (typeof str !== "string" || str.length > MAX_ZPRAVA) return;
    const a = this.io.att(ws);
    if (!a) return;
    let m;
    try { m = JSON.parse(str); } catch { return; }
    if (!m || typeof m.t !== "string") return;
    const st = m.t === "p" || m.t === "s" ? null : await this.stav();
    const jsemHost = st && st.host === a.id;

    if (m.t === "role") {
      const r = String(m.r || "");
      if (r && !(r in LIMIT)) return;
      if (r) {
        const ost = this.zive(ws).map(w => this.io.att(w));
        const stejne = ost.filter(o => o.r === r).length, celkem = ost.filter(o => o.r && o.r !== "napalovac").length;
        const plno = r !== "napalovac" && celkem >= MAX_HRACU;
        if (stejne >= LIMIT[r] || plno) {
          this.io.send(ws, JSON.stringify({ t: "chyba", m: plno ? "Družina je plná (12 hráčů)." : r === "napalovac" ? "Napalovačů je už 6." : "Tahle postava je už obsazená." }));
          return;
        }
      }
      a.r = r; a.v = Math.max(1, Math.min(5, m.v | 0 || 1));
      this.io.setAtt(ws, a);
      await this.rozeslat();
      return;
    }
    if (m.t === "vis") { a.away = m.away ? 1 : 0; this.io.setAtt(ws, a); await this.rozeslat(); return; }
    if (m.t === "jmeno") { a.n = cisteJmeno(m.n); this.io.setAtt(ws, a); await this.rozeslat(); return; }
    if (m.t === "go" || m.t === "end") {
      if (!jsemHost) return;
      await this.io.put("hraje", m.t === "go");
    }
    /* ostatní zprávy jen přepošle (s odesílatelem); "to" = jen jednomu hráči */
    const out = '{"from":"' + a.id + '",' + str.trim().slice(1);
    for (const w of this.zive(ws)) {
      if (m.to && this.io.att(w).id !== m.to) continue;
      this.io.send(w, out);
    }
    if (m.t === "go" || m.t === "end") await this.rozeslat();
  }

  async close(ws) {
    if (!this.zive(ws).length) { await this.io.put("hraje", false); return; }
    await this.rozeslat(ws);
  }
}
