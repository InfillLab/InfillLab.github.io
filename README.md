# InfillLab

Interaktivna aplikacija za proucavanje rasporedivanja prijelaznog materijala u infill i optimizacije putanje. React, TypeScript i Vite. Svi izracuni odvijaju se u pregledniku, u zasebnom Web Workeru. Nije potreban backend, baza podataka ni API kljuc.

## Pokretanje u VS Codeu

Otvorite ovu mapu u VS Codeu. Potreban je Node.js 22.12 ili noviji (preporuka: Node 24).

```powershell
npm install
npm run dev
```

Otvorite adresu koju terminal ispise, obicno http://127.0.0.1:5173. Terminal mora ostati pokrenut.

```powershell
npm test
npm run build
npm run preview
```

`build` stvara produkcijsku aplikaciju u `dist`. Nemojte otvarati `index.html` dvoklikom: modulima i Web Workeru treba HTTP posluzitelj.

## GitHub Pages

1. Napravite GitHub repozitorij, primjerice `InfillLab`, s granom `main`.
2. Prenesite sadrzaj ove mape u korijen repozitorija. Ukljucite `src`, `public`, `.github/workflows/deploy.yml`, `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `.gitignore` i dokumentaciju. Nemojte prenositi `node_modules` ni `dist`. VS Code Source Control postuje `.gitignore`.
3. U repozitoriju odaberite Settings > Pages > Source > GitHub Actions.
4. Workflow "Deploy InfillLab" pokrece testove i build pa objavljuje stranicu. Ako je prvi pokusaj bio prije aktivacije Pagesa, ponovno ga pokrenite iz kartice Actions.
5. Adresa objavljene aplikacije prikazat ce se u Settings > Pages i u izvrsenom workflowu.

Vite koristi relativni `base: './'`, pa ime repozitorija nije potrebno upisivati u kod. Ako koristite drugu granu, promijenite `branches` u workflowu. Dostupnost Pagesa za privatni repozitorij ovisi o GitHub planu.

## Sto aplikacija radi

- Generira paralelne, chevron ili naizmjenicne kratke putanje kroz jedan ili vise slojeva.
- Prati pretpostavljeni udio materijala B prema istisnutom volumenu.
- Usporeduje fiksni raster, najblizi dopusteni segment i eksperimentalnu adaptivnu pretragu.
- Animira postupno polaganje putanja, kretanje mlaznice i slojeve na rotirajucoj radnoj ploci. Animacija je shematska, nije simulacija stvarne brzine stroja.
- Izracunava dodijeljeni i odbaceni volumen, duljinu praznih pomaka, pokrivenost i idealizirano vrijeme.
- Ponovljene pretrage koriste zapisane seedove. Glavni prikaz koristi prvi seed, bez skrivene selekcije najboljeg rezultata.
- Izvozi puni eksperiment u JSON, usporednu tablicu u CSV i trenutni prikaz putanje u PNG. JSON se moze ponovno uvesti; rezultati se tada ponovno racunaju.
- Ukljucuje provjerljivi slucaj s dva segmenta i iscrpnim pretrazivanjem svih osam rasporeda.

## Predlozeni prvi eksperiment

1. Kliknite karticu materijala da odaberete filament i boju. Drugi materijal dodaje se gumbom `Add a second material`.
2. Pokrenite `Start simulation`, zatim kliknite `Compare` za usporedbu metoda na istoj geometriji.
3. Promijenite `Transition volume`, razmak ili `Path family`, zatim kliknite `Start simulation`.
4. Promatrajte razliku izmedu `Complete allocation` i `Partial allocation`. Kraca nepotpuna putanja nije dokaz boljeg ispisa.
5. Odaberite `Advanced settings > Reference case > Load verification case`. Tocno rjesenje treba imati 12 mm3 dodijeljenog materijala, bez otpada i oko 28.2843 mm praznog pomaka.
6. Izvezite JSON radi ponovljivosti i CSV/PNG za daljnju obradu i figure.

## Znanstveni opseg

Ovo je geometrijski model raspodjele materijala i rasporedivanja putanja. Ne simulira naprezanje, lom, adheziju, kemijsku kompatibilnost ili stvarno mijesanje PLA i TPU. Imena materijala su oznake. Parametri sastava i prihvatljivosti su pretpostavke korisnika, bez automatske kalibracije iz literature.

Model prati jednu monotonicnu promjenu materijala. Cijeli segment mora stati u svoj dopusteni interval sastava. Nedodijeljeni segmenti nisu proizvedeni; njihovo kasnije popunjavanje cistim materijalom izvan je modela. Ne generira se G-code. Projekcija slojeva nije FEM model ni dokaz mehanickog uklapanja.

Adaptivna pretraga koristi pojacavanje odabranih veza inspirirano transportnim mrezama. Nije implementacija objavljenog Slime Mould Algorithm algoritma i ne jamci globalni optimum. Za mali referentni slucaj optimum se provjerava iscrpnim pretrazivanjem.

Detaljne jednadzbe, ogranicenja i 11 referenci dostupni su u aplikaciji pod `Methods`. Ne prenose se PDF-ovi radova.

## Struktura

- `src/model/engine.ts`: geometrija, bilanca volumena, ogranicenja i algoritmi.
- `src/model/engine.test.ts`: provjere modela i ulaznih podataka.
- `src/model/worker.ts`: racunanje izvan glavne dretve sucelja.
- `src/components/Plot.tsx`: SVG prikaz putanje i sastava.
- `src/components/Controls.tsx`: parametri eksperimenta.
- `src/components/Methods.tsx`: metodologija i reference.
- `src/io.ts`: izvoz rezultata.
- `src/Studio.tsx`: pojednostavljeni radni prostor, materijali i usporedba.
- `src/components/PrintScene.tsx`: animacija i projekcija slojeva.
- `src/studio.css`: dizajn novog sucelja.
- `src/styles.css`: responzivni dizajn i stil za ispis.

Eksperiment spremite u JSON za kasniji uvoz. `Advanced settings > Reset to starter sample` vraca pocetne vrijednosti nakon potvrde `Apply changes`. Nema korisnickih racuna ni slanja rezultata na posluzitelj.
