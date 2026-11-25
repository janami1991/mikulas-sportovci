# Web Mikuláš Sportovci – zveřejnění na GitHubu

Kód webu je na GitHubu veřejný (to je podmínka bezplatného GitHub Pages). Nic tajného v něm proto není:
hesla, členové, příspěvky, fotky z příspěvků i kronika jsou v databázi **Firebase** a čte je jen ten, komu to dovolí pravidla v souboru `firestore.rules`.

Veřejné zůstává: kód stránek, fotky ve složce `media` (úvodní stránka) a hra.

## 1. Databáze Firebase (zdarma, bez platební karty)

1. Otevřete <https://console.firebase.google.com> a přihlaste se účtem Google.
2. **Vytvořit projekt** (název třeba `mikulas-sportovci`), Google Analytics můžete vypnout.
3. Vlevo **Build → Authentication → Začít** → záložka **Sign-in method** → **E-mail/heslo** → zapnout → Uložit.
4. Vlevo **Build → Firestore Database → Vytvořit databázi** → umístění v Evropě (např. `eur3`) → **produkční režim**.
5. Ve Firestore otevřete záložku **Pravidla (Rules)**, smažte vše, vložte celý obsah souboru `firestore.rules` a dejte **Publikovat**.
6. Ozubené kolo → **Nastavení projektu** → dole **Vaše aplikace** → ikona **`</>`** (web) → zadejte název → **Registrovat** (Firebase Hosting nezaškrtávat).
7. Zobrazí se kód s `firebaseConfig`. Hodnoty `apiKey`, `authDomain`, `projectId` a `appId` zkopírujte do souboru `firebase-config.js` místo slov `DOPLNIT`.
   Tyto údaje nejsou tajné, smí být na GitHubu.

## 2. GitHub Pages

1. Založte si účet na <https://github.com>.
2. Vpravo nahoře **+ → New repository** → název např. `mikulas-sportovci` → **Public** → **Create repository**.
3. Klikněte na **uploading an existing file** a přetáhněte do okna **obsah** složky `web_mikulasi` (soubory a složky `media`, `hra`, ne složku samotnou) → **Commit changes**.
4. V repozitáři **Settings → Pages** → Source: **Deploy from a branch** → větev `main`, složka `/ (root)` → **Save**.
5. Za pár minut poběží web na adrese `https://VAŠE-JMÉNO.github.io/mikulas-sportovci/`.
6. Ve Firebase: **Authentication → Nastavení (Settings) → Autorizované domény** → přidejte `VAŠE-JMÉNO.github.io`.

## 3. První spuštění

Při prvním otevření webu se na přihlašovací stránce objeví **Založení webu** – vytvořte účet prvního správce.
Další členy pak přidáte v menu **Členové → Přidat člena** (přihlašovací jméno a počáteční heslo jim pošlete sami).

- Člen si heslo změní v **Můj profil** (zadá současné heslo).
- Když heslo zapomene, správce mu v jeho profilu nastaví nové.
- Odebraný člen se už nepřihlásí.

## Úpravy webu později

Změněný soubor nahrajte na GitHub znovu (**Add file → Upload files**), přepíše se.
Úpravy mapy ve hře: v editoru hry **Soubor → Stáhnout upravy.js** a nahrajte ho do složky `hra`.

## Dobré vědět

- Web už nejde spustit dvojklikem z disku (prohlížeč tak nepovolí načíst databázi). Hra z disku funguje dál.
- Bezplatná databáze: 1 GiB dat, 50 000 čtení a 20 000 zápisů denně. Fotky se před uložením zmenšují, soubory max. 5 MB, videa jen jako odkaz (např. YouTube).
- Firebase hesla ukládá šifrovaně (jako hash) – ani správce je nevidí.
- Automatické zálohy v bezplatné verzi nejsou.
