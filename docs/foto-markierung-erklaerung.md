# Foto-Markierung erklärt — für den Vertrieb

Kurzanleitung + Hintergrund: Wie lege ich eine Dachfläche auf ein Drohnenfoto,
warum die einzelnen Schritte da sind, und was bei schwierigen Dächern/Fotos gilt.

---

## Das Grundprinzip in einem Satz

Das Tool baut **kein 3D-Modell**. Es legt eine **flache, rechteckige Dachebene**
perspektivisch über das Foto. Dafür sagst du dem Tool **zwei verschiedene Dinge**:

1. **WIE** das Dach im Foto liegt → die **Perspektive** (das „Rechteck", 4 Ecken).
2. **WELCHE FORM** es wirklich hat → der **Umriss** (nur bei nicht-rechteckigen Dächern).

Das sind zwei verschiedene Aufgaben. Deshalb fühlt es sich an wie „zweimal
dasselbe" — ist es aber nicht. (Merksatz weiter unten.)

---

## Der Ablauf (pro Dachfläche)

1. **First-/Trauflinie ziehen** (2 Klicks entlang der waagerechten Dachkante).
   Legt fest, was **hochkant** und was **quer** ist. Ohne das kann die Belegung
   verdreht liegen.
2. **Das Rechteck: die 4 Ecken** der Dachebene anklicken → die **Perspektive**.
3. **Der Umriss (optional)**: die echte Kante nachzeichnen — nur, wenn das Dach
   **kein** simples Rechteck ist (Walm, Trapez, L-Form, abgeschnittene Ecke …).
4. **Hindernisse** (Kamin, Dachfenster, SAT) mit 2 Klicks einrahmen.

---

## Schritt 2 im Detail: Warum ein Rechteck?

Jede Dachfläche sitzt auf einer gedachten **rechteckigen Ebene**: Traufe unten,
First oben, zwei Ortgänge seitlich. Die **4 Ecken dieser Ebene** sind der Anker.

- Du klickst die 4 Ecken dort an, wo sie im Foto **wirklich** liegen — entlang der
  Haus-/Dachecken.
- Daraus rechnet das Tool die **Perspektive** aus: Es weiß danach, wie ein Meter
  auf dem Dach im Foto aussieht — überall, auch wenn das Foto schräg ist.

### Muss es ein „perfektes" Rechteck sein?

**Nein.** Auf dem Bildschirm wird es meist **kein** rechter Winkel sein. Weil das
Foto perspektivisch ist, bilden die 4 echten Dachecken im Bild oft ein **Trapez**
oder schiefes Viereck. **Genau das ist richtig** — die Verzerrung *sagt* dem Tool
die Perspektive.

- Richtig ist: die 4 Punkte müssen die 4 echten Ecken **derselben Dachebene** sein
  (nach den Hausecken/Dachkanten) — **nicht** ein am Bildschirm gerades Rechteck.
- Liegt eine Ecke „in der Luft" (Walmspitze, über einer Terrasse …): trotzdem dort
  anklicken, wo die Dachkante **hin verlängert** läuft. Das **Fadenkreuz** hilft
  beim sauberen Ausrichten an den Kanten.

---

## Warum dann NOCH ein Umriss? (der „zweite" Schritt)

Das Rechteck liefert nur **Perspektive + Maßstab** für die ganze Ebene. Über die
echte **Form** sagt es nichts.

- Simples rechteckiges Dach → **Umriss überspringen**, fertig (Umriss = das Rechteck).
- Walm / Trapez / L-Form / abgeschnittene Ecke → mit dem **Umriss** die echte Kante
  nachzeichnen. Die Module werden dann **nur innerhalb** dieser echten Form gelegt,
  nicht über die Kanten hinaus.

> **Merksatz für den Vertrieb:**
> **Rechteck = Perspektive (immer).  Umriss = echte Form (nur wenn nicht rechteckig).**

---

## Komplexe Dachformen

- **Walmdach (Trapez) — der einfache Weg:** Im Schritt „Dachflächen" die Form
  **Trapez** wählen und die Firstbreite eingeben. Dann im Foto einfach die
  **4 echten Trapez-Ecken** anklicken (2 an der Traufe, 2 am kurzen First) —
  **keine Ecken in die Luft verlängern!** Das Tool kennt die Trapez-Geometrie und
  rechnet Perspektive + Form automatisch. Kein Umriss nötig.
- **L-Form / Erker / Gauben** (keine Trapez-Form wählbar): Rechteck über die
  Hauptebene (Ecken notfalls „in der Luft" verlängert), dann Umriss entlang der
  echten Kante; Kamin/Fenster/SAT separat als Hindernis markieren.

---

## Verzerrte Bilder (Drohne zu weit rechts/links/schräg)

**Beispiel:** von zu weit rechts geschossen → die linke Dachseite wirkt kleiner,
das Dach sieht aus wie ein Trapez.

- Für die **Platzierung** ist das **kein Problem**: die 4-Ecken-Methode korrigiert
  die Perspektive. Klick die 4 echten Ecken (das Bildschirm-Viereck wird ein Trapez)
  — die Module sitzen danach perspektivisch korrekt.
- **Aber:** je schräger das Foto, desto ungenauer die **Größen-Schätzung aus dem
  Bild**. Wichtig zu wissen:
  - Die **Modulgrößen kommen nicht aus dem Foto**, sondern aus den eingegebenen
    **Maßen** (Traufe/Sparren → mm × Maßstab). Stimmen die Maße, stimmen die Module —
    auch bei schrägem Foto.
  - Das Foto dient nur der **Lage/Optik**. Das **Aufmaß gewinnt immer.**
  - Der **Belegungs-Check** warnt, wenn das Foto stark schräg ist (First/Traufe-
    Verhältnis) oder die Foto-Maße stark von den eingegebenen abweichen.
- **Bestes Ergebnis:** möglichst **senkrecht von oben (Nadir)** fotografieren. Bei
  starker Schräge lieber näher am Nadir wiederholen.

---

## Häufige Fehler

- Nur den sichtbaren Dachrand statt der **4 Rechteck-Ecken** markieren → Perspektive
  stimmt nicht. **Erst das Rechteck (Ebene), dann den Umriss (Form).**
- **First-/Trauflinie vergessen** → hoch/quer kann verdreht sein. Dann „↻ Traufe
  wechseln" oder „Ausrichtung neu".
- Foto sehr schräg **und** Maße nicht geprüft → Größen unrealistisch. Maße eingeben
  und den Belegungs-Check beachten.

---

## Die Knöpfe kurz erklärt

- **First-/Trauflinie** — Ausrichtung (hoch/quer) festlegen.
- **4 Ecken** — Perspektive der Dachebene.
- **Umriss zeichnen** — echte Form (nur wenn nötig).
- **Hindernis markieren** — Kamin/Fenster/SAT aussparen.
- **↻ Traufe wechseln** — falls hoch/quer vertauscht sitzt.
- **Ausrichtung neu** — First + 4 Ecken komplett neu setzen.
- **Ziegel zählen** — Maßstab aus einer Ziegelreihe (Notnagel, wenn die Traufe
  nicht sicher bekannt ist); liefert den Belegungs-Check.
- **↔ Verschieben / ⌖ Beste Position** — die ganze Belegung cm-weise schieben bzw.
  automatisch die Lage mit den meisten Modulen finden.
- **⟳ Reihe drehen** — eine ganze Reihe zwischen quer/hochkant umschalten.
- **➕ Modul setzen** — ein einzelnes Zusatzmodul frei platzieren (z. B. am Walm,
  wo sich zwei Reihen treffen).
