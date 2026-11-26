/* Napojení webu na databázi Firebase (přihlášení + data). Hesla a obsah jsou chráněné pravidly v databázi (firestore.rules),
   ne kódem stránky – kód stránky je veřejný a nic tajného v něm není. */
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, writeBatch,
  arrayUnion, arrayRemove, addDoc, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';
import CFG from './firebase-config.js';

export const configured = !!(CFG && CFG.apiKey && !/DOPLNIT/.test(CFG.apiKey));
const app = configured ? initializeApp(CFG) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

/* přihlašovací jméno → interní adresa účtu (e-maily se nikam neposílají) */
const DOM = '@sportovci.example.com';
const mail = (jmeno, n) => `${jmeno}.${n || 1}${DOM}`;
export const okName = j => /^[a-z0-9._-]{3,30}$/.test(j);

let ME = null;   // přihlášený člen {uid, jmeno, name, role, ...}
export const me = () => ME;
async function loadMe(user) {
  if (!user) { ME = null; return null }
  const s = await getDoc(doc(db, 'clenove', user.uid));
  if (!s.exists()) { ME = null; await signOut(auth); return null }   // účet bez člena (odebraný) → nic nevidí
  ME = { uid: user.uid, ...s.data() }; return ME
}
/* čeká na obnovení přihlášení po načtení stránky */
export function whenReady() {
  if (!configured) return Promise.resolve(null);
  return new Promise(res => { const off = onAuthStateChanged(auth, async u => { off(); try { res(await loadMe(u)) } catch (e) { res(null) } }) })
}
export async function login(jmeno, heslo) {
  jmeno = jmeno.trim().toLowerCase();
  if (!okName(jmeno)) throw new Error('Špatné jméno nebo heslo.');
  let u;
  try { u = await getDoc(doc(db, 'uzivatele', jmeno)) } catch (e) { throw new Error('Nepodařilo se spojit s databází.') }
  if (!u.exists()) throw new Error('Špatné jméno nebo heslo.');
  try { const c = await signInWithEmailAndPassword(auth, u.data().email, heslo); const m = await loadMe(c.user); if (!m) throw 0; return m }
  catch (e) { if (e && e.code === 'auth/too-many-requests') throw new Error('Moc pokusů – zkuste to za chvíli.'); throw new Error('Špatné jméno nebo heslo.') }
}
export async function logout() { ME = null; if (auth) await signOut(auth) }

/* první správce (jen dokud web není založený) */
export async function founded() { return (await getDoc(doc(db, 'nastaveni', 'zalozeno'))).exists() }
export async function found(jmeno, name, heslo) {
  jmeno = jmeno.trim().toLowerCase();
  const c = await createUserWithEmailAndPassword(auth, mail(jmeno, 1), heslo), uid = c.user.uid, b = writeBatch(db);
  b.set(doc(db, 'clenove', uid), { jmeno, name, role: 3, n: 1 });
  b.set(doc(db, 'nastaveni', 'zalozeno'), { uid });
  b.set(doc(db, 'uzivatele', jmeno), { email: mail(jmeno, 1) });
  await b.commit(); return loadMe(c.user)
}

/* ===== členové ===== */
export async function members() { return (await getDocs(collection(db, 'clenove'))).docs.map(d => ({ uid: d.id, ...d.data() })) }
export async function saveMember(uid, data) { await updateDoc(doc(db, 'clenove', uid), data); if (ME && uid === ME.uid) Object.assign(ME, data) }
/* nový účet se založí přes druhou instanci, aby správce zůstal přihlášený */
async function newAccount(email, heslo) {
  const sec = initializeApp(CFG, 'novy' + Date.now()), a = getAuth(sec);
  try { const c = await createUserWithEmailAndPassword(a, email, heslo); return c.user.uid }
  finally { try { await signOut(a) } catch (e) {} ; try { await deleteApp(sec) } catch (e) {} }
}
export async function addMember(jmeno, name, heslo, role) {
  jmeno = jmeno.trim().toLowerCase();
  if ((await getDoc(doc(db, 'uzivatele', jmeno))).exists()) throw new Error('Toto přihlašovací jméno už existuje.');
  const uid = await newAccount(mail(jmeno, 1), heslo), b = writeBatch(db);
  b.set(doc(db, 'clenove', uid), { jmeno, name, role, n: 1 });
  b.set(doc(db, 'uzivatele', jmeno), { email: mail(jmeno, 1) });
  await b.commit(); return uid
}
/* správce nastaví členovi nové heslo: založí se nový účet a profil se na něj přesune */
export async function resetPassword(m, heslo) {
  const n = (m.n || 1) + 1, uid = await newAccount(mail(m.jmeno, n), heslo), b = writeBatch(db);
  const { uid: old, ...data } = m;
  b.set(doc(db, 'clenove', uid), { ...data, n });
  b.delete(doc(db, 'clenove', old));
  b.set(doc(db, 'uzivatele', m.jmeno), { email: mail(m.jmeno, n) });
  await b.commit(); return uid
}
export async function removeMember(m) { const b = writeBatch(db); b.delete(doc(db, 'clenove', m.uid)); b.delete(doc(db, 'uzivatele', m.jmeno)); await b.commit() }
export async function changeMyPassword(stare, nove) {
  const u = auth.currentUser;
  try { await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, stare)) } catch (e) { throw new Error('Současné heslo nesedí.') }
  try { await updatePassword(u, nove) } catch (e) { throw new Error(e.code === 'auth/weak-password' ? 'Heslo je moc slabé (aspoň 6 znaků).' : 'Heslo se nepodařilo změnit.') }
}

/* ===== úrovně: 1 všichni, 2 členové, 3 správci ===== */
const lvl = () => !ME ? 1 : ME.role === 3 ? 3 : 2;
async function byLevel(col) {
  const out = [];
  for (let k = 1; k <= lvl(); k++)(await getDocs(query(collection(db, col), where('level', '==', k)))).forEach(d => out.push({ id: d.id, ...d.data() }));
  return out
}
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ===== příspěvky ===== */
export const posts = () => byLevel('prispevky');
export async function addPost(p) { const id = rid(); await setDoc(doc(db, 'prispevky', id), p); return id }
export const updatePost = (id, data) => updateDoc(doc(db, 'prispevky', id), data);
export const delPost = id => deleteDoc(doc(db, 'prispevky', id));
export const like = (id, jmeno, on) => updateDoc(doc(db, 'prispevky', id), { likes: on ? arrayUnion(jmeno) : arrayRemove(jmeno) });
export const comment = (id, c) => updateDoc(doc(db, 'prispevky', id), { comments: arrayUnion(c) });

/* ===== soubory a fotky: uložené po kouscích v databázi ===== */
const CH = 700000, cache = new Map();
export async function putMedia(dataUrl, level, name) {
  const id = rid(), n = Math.ceil(dataUrl.length / CH), b = writeBatch(db);
  for (let i = 0; i < n; i++) b.set(doc(db, 'media', id + '_' + i), { level, owner: ME.jmeno, i, n, d: dataUrl.slice(i * CH, (i + 1) * CH), ...(i === 0 && name ? { name } : {}) });
  await b.commit(); cache.set(id + ':' + n, dataUrl); return id + ':' + n
}
export async function getMedia(ref) {
  if (cache.has(ref)) return cache.get(ref);
  const [id, n] = ref.split(':'), parts = await Promise.all([...Array(+n)].map((_, i) => getDoc(doc(db, 'media', id + '_' + i))));
  const url = parts.map(p => p.data().d).join(''); cache.set(ref, url); return url
}
export async function setMediaLevel(refs, level) {
  const b = writeBatch(db); let any = false;
  for (const ref of refs) { if (!ref) continue; const [id, n] = ref.split(':'); for (let i = 0; i < +n; i++) { b.update(doc(db, 'media', id + '_' + i), { level }); any = true } }
  if (any) await b.commit()
}
export async function delMedia(refs) {
  const b = writeBatch(db); let any = false;
  for (const ref of refs) { if (!ref) continue; const [id, n] = ref.split(':'); for (let i = 0; i < +n; i++) { b.delete(doc(db, 'media', id + '_' + i)); any = true }; cache.delete(ref) }
  if (any) await b.commit()
}

/* ===== kronika ===== */
export const kronika = () => byLevel('kronika');
export async function saveKr(id, data) { id = id || rid(); await setDoc(doc(db, 'kronika', id), data); return id }
export const delKr = id => deleteDoc(doc(db, 'kronika', id));

/* ===== mapa hry (úpravy z editoru): čte každý, ukládá jen správce; JSON po kouscích v kolekci mapa ===== */
const MCH = 700000;
export async function loadMapa() {
  const m = await getDoc(doc(db, 'mapa', 'meta')); if (!m.exists()) return null;
  const { n, t, by } = m.data(), parts = await Promise.all([...Array(n)].map((_, i) => getDoc(doc(db, 'mapa', 'u' + i))));
  return { t, by, json: parts.map(p => p.data().d).join('') }
}
export async function saveMapa(json, t) {
  const old = await getDoc(doc(db, 'mapa', 'meta')), n0 = old.exists() ? old.data().n : 0, n = Math.max(1, Math.ceil(json.length / MCH)), b = writeBatch(db);
  for (let i = 0; i < n; i++) b.set(doc(db, 'mapa', 'u' + i), { d: json.slice(i * MCH, (i + 1) * MCH) });
  for (let i = n; i < n0; i++) b.delete(doc(db, 'mapa', 'u' + i));
  b.set(doc(db, 'mapa', 'meta'), { n, t, by: ME ? ME.jmeno : '' });
  await b.commit()
}

/* ===== žebříček hry: čte každý, zapíše kdokoliv (pravidla hlídají tvar záznamu), maže správce ===== */
export async function addScore(z) { const r = await addDoc(collection(db, 'zebricek'), { ...z, ts: serverTimestamp() }); return r.id }
export async function topScores(n) {
  const q = query(collection(db, 'zebricek'), orderBy('s', 'desc'), limit(n || 10));
  return (await getDocs(q)).docs.map(d => { const x = d.data(); return { id: d.id, ...x, ts: x.ts && x.ts.toMillis ? x.ts.toMillis() : 0 } })
}
export const delScore = id => deleteDoc(doc(db, 'zebricek', id));
