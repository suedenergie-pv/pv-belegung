# Unabhängiger Review: Markenpassung, Dichte und Bildarbeitsfläche

Stand: 30.09.2026. Review-only, keine Änderungen an Entwürfen oder Produktcode.

**Ergebnis: A ist die stärkste Grundlage, danach C, danach B. Keine uneingeschränkte Freigabe der vorliegenden Renders: Ein gemeinsamer Major betrifft den fehlenden Speicherstatus auf Smartphone quer.** A hat in diesem Review darüber hinaus keine Major-Feststellung. C und B benötigen zusätzliche kompositorische Reparaturen oder werden für die Auswahl verworfen.

## Prüfgrundlage und Grenzen

- Gelesen: SPEC, verbindlicher Änderungsauftrag vom 30.09.2026; `frontend-quality-gate` und `visual-review`.
- Tatsächlich geöffnet und visuell geprüft: alle 45 PNGs in `.debug-shots/fotoeditor-entwuerfe-2026-09-30/`, jeweils A/B/C × Einrichtung/Belegung/Korrektur × 1440×900, 1024×768, 768×1024, 375×812 und 812×375.
- Zusätzlich geöffnet: bestehende Ansicht `.debug-shots/ux-review-2026-09-30/desktop-07-arbeitsbereich.png`. Marken- und Modulquellen `apps/web/lib/logo.ts` und `apps/web/lib/modul-assets.ts` gelesen.
- Keine Autorenbegründung, bevorzugte Variante oder anderen Reviewberichte als Bewertungsgrundlage verwendet.
- Dies ist ein interner Fachanwendungseditor. Marketing- und Conversion-Funnel-Kriterien wurden nicht auf ihn übertragen.
- Die Dachillustration ist sichtbar als Beispiel gekennzeichnet. Sie wurde weder als echtes Projektfoto noch als Beleg für Fotoqualität bewertet. Die Zahlen sind Prototypdaten. Die PNGs belegen keine funktionierende Engine, Touchbedienung oder produktive Integration.
- Die dunkle Leiste „Editorentwürfe“ gehört zur Vergleichsumgebung; ihr Platzverbrauch wurde nicht als Produktfehler gewertet. Interaktionsreichweite und Tastaturbedienung sind nicht aus Screenshots ableitbar.

## Gemeinsame Feststellungen

### G1 — Major: Speicherstatus verschwindet bei Smartphone quer

**Beleg:** alle `*-setup-mobil-quer.png`, `*-placement-mobil-quer.png` und `*-correction-mobil-quer.png`, 812×375. Kopf zeigt SüdEnergie, Hauptschritte und Gesamtleistung, jedoch keinen Speicherstatus. Auch im Arbeitsbereich ist kein Ersatz sichtbar. Das widerspricht dem festgelegten geräteübergreifenden Status und entzieht gerade im komprimierten Arbeitsmodus die Information, ob Änderungen gesichert sind.

**Reparatur:** Die Textmeldung „In diesem Browser gespeichert“ bzw. Speichern/Fehler auch in der Queransicht sichtbar halten; eine kompakte eigene Zeile oder Platz im Kopf genügt. Dabei die Arbeitsfläche erhalten. Anschließend diese drei Zustände erneut rendern.

### G2 — Minor: sehr kleine Hilfs- und Maßbeschriftung

**Beleg:** Smartphone quer alle Zustände; Tablet quer A-Flächenliste; mobile Formlabels. Kleine Beschriftungen sind trotz dunkler Farbe nur mühsam lesbar. Im Querformat werden die auf das Dach projizierten Maßzahlen besonders winzig. Große Trefferflächen ersetzen keine lesbaren Beschriftungen.

**Reparatur:** Für benötigte Formlabels und Statusinformationen lesbare Textgröße beibehalten und stattdessen redundante Hilfstexte aus der dauerhaften Ansicht nehmen. Maßzahlen auf dem Foto bei kleinem Maßstab gezielt ausblenden oder mit eigener Bildschirmgröße darstellen; die identischen Werte bleiben im Maßformular sichtbar.

### G3 — Minor: Flächenlabel verdeckt die Breitenangabe

**Beleg:** insbesondere `A-correction-desktop.png` und `C-correction-desktop.png`, außerdem Tablet hoch. Das breite aktive Label „A · Hauptdach Süd“ liegt über einem Teil der am unteren Dachrand gezeichneten Maßzahl. Die Angabe im Formular bleibt lesbar, daher kein Blocker.

**Reparatur:** Labels und Maßzahlen getrennte Anker bzw. Abstand zur Dachkante geben; kleine Bildbereiche dürfen auf das kurze A-Label wechseln. Mit langen Flächennamen nachprüfen.

## Kandidaten

### A — bevorzugte Richtung

Die fachliche Struktur wird ohne zusätzliche Erklärung sichtbar: Hauptdach und Gaubenseiten links, gemeinsames Bild in der Mitte, aktuelle Aufgabe rechts. Das ist eine sinnvolle Zuordnung für diese Anwendung. Es entsteht keine austauschbare Dashboard-Kachelwand. Die wenigen Flächenkennzeichen stehen für konkrete auswählbare Objekte. Die mittlere Bildfläche bleibt auf 1024×768 gut nutzbar, während Dachform, Maße und Änderungsfolgen daneben stehen.

Einrichtung und Korrektur haben jeweils eine erkennbare Hauptaktion. Der Vorher/Nachher-Vergleich bleibt dem Formular zugeordnet. Auf Smartphone hoch ist die Belegungsfläche größer als bei B und C, weil kein zweiter Titelblock „Aktive Fläche A / Hauptdach Süd“ unter dem Foto Platz verbraucht. Die Umordnung für Tablet hoch ist nachvollziehbar; sie ist keine bloße Liste gestapelter Karten.

**Offen:** gemeinsamer Major G1; kleinere Beschriftungs-/Überlagerungsprobleme G2/G3. Bei Mobile hoch Belegung zeigt das Foto viel ungenutzten Rand über und unter dem Dach. Das ist bei „ganzes Foto anzeigen“ verständlich; für die spätere echte Bedienung sollte der Nutzer schnell zur aktiven Dachfläche zoomen können. Dies ist kein Nachweis einer fehlerhaften Zoomfunktion im Produkt.

### C — zweite Wahl, Major an der Bildüberlagerung

Die Idee einer sichtbaren Aufgabenfolge passt zur geführten Einrichtung. Die Seitenleiste ist aber dichter: Hauptnavigation, weiterer Ablauf und Detailwerkzeuge konkurrieren. Auf Tablet hoch steht ein großer Bedienblock über dem Bild; die aktive Fläche erscheint dadurch mehrfach. Das ist als Richtung erkennbar, gegenüber A jedoch weniger unmittelbar auf die Bildarbeit ausgerichtet.

**C1 — Major:** In `C-placement-tablet-quer.png` und `C-placement-tablet-hoch.png` verdeckt die schwebende Zoomleiste Teile des rechten unteren Modulbereichs bzw. der Feldkante. Die zusätzliche Werkzeugleiste liegt auf Tablet hoch außerdem über dem aktiven Dachlabel. Die ohnehin knappe Arbeitsfläche wird dort von mehreren festen Elementen belegt. Das ist keine rein dekorative Unsauberkeit: Genau dort liegen bearbeitbare Module und Griffe.

**Reparatur:** Zoom und Werkzeugpalette in eine reservierte Randzone oder außerhalb des Bildinhalts legen; bei kurzem Viewport zusammenfassen. Das gesamte aktive Feld einschließlich unterer und rechter Griffe muss sichtbar bleiben. Danach beide Tabletformate in Belegung und Korrektur erneut prüfen.

**C2 — Minor:** Der zusätzliche Ablaufblock in Desktop/Tablet quer drückt zentrale Aktionen weit nach unten; in `C-correction-tablet-quer.png` liegt „Übernehmen“ nicht mehr im sichtbaren Ausschnitt. Ein scrollbarer Inspector kann das lösen, braucht aber einen klaren Abschlussbereich. Die doppelte Navigation sollte nach der Einrichtung deutlich weniger Raum erhalten.

### B — dritte Wahl, Major an der Gewichtung

B gibt dem Bild nominell die größte Bühne. Auf Desktop und Tablet quer führt die breite, niedrige Bildfläche mit vollständig eingepasstem Beispielbild aber zu einem deutlich kleineren tatsächlichen Dach. Große Flächen links und rechts bleiben informationsarm. Die Interaktion rückt in einen quer über die Seite verteilten Formularstreifen, während das zu bearbeitende Dach kleiner erscheint als bei A oder C. Auf Tablet hoch funktioniert diese Bühne deutlich besser; die Schwäche ist konkret das Querformat.

**B1 — Major:** `B-placement-desktop.png`, `B-correction-desktop.png` sowie die entsprechenden Tablet-quer-Renders haben ein ungünstiges Verhältnis zwischen Bildschirmfläche und bearbeitbarem Dach. Im 1024×768-Belegungsrender ist die rechteckige Modulbelegung sichtbar kleiner als in A, obwohl B fast die ganze Breite als Bildbereich beansprucht. Zusammen mit dem flächigen unteren Bedienband wird Platz ohne zusätzlichen Arbeitsnutzen verbraucht.

**Reparatur:** Querformat-Komposition ändern: kontextabhängige Werkzeuge neben das Bild, oder den unteren Bereich deutlich kürzen und eine sinnvolle Vergrößerung des aktiven Dachs vorsehen. Keine automatische Beschneidung relevanter Nachbarflächen. Nur „Foto vollbreit“ ist kein Vorteil für die praktische Bildarbeit.

**B2 — Minor:** `B-placement-mobil-hoch.png` wiederholt „Aktive Fläche A / Hauptdach Süd“ unter dem Foto, obwohl die Fläche schon oben gewählt ist. Dieser Block verbraucht sichtbare Höhe ohne eine zusätzliche Entscheidung. Der Platz kann direkt dem Foto gehören; die Detailaktion öffnet die benötigten Informationen.

## Marken- und Kontrastbewertung

Alle Kandidaten behalten die wiedererkennbare bestehende Anwendungssprache bei: SüdEnergie-Wortmarke mit orangefarbenem Punkt, sachliche dunkle Typografie, weiße Werkzeugbereiche und kanonische schwarze Moduloptik. Die stärker abgedunkelte orange Aktionsfarbe bleibt derselben Farbfamilie zugeordnet. Ein neues Markenmotiv oder zusätzliche dekorative Akzentfarben werden nicht eingeführt. Die fachlichen Begriffe und Gaubenbezüge machen die Oberfläche produktspezifisch.

Es gibt keine sichtbare Kachelflut, künstliche Erfolgsmetriken, Schmuckdiagramme oder dekorative Glasflächen. Die abgerundeten Werkzeugflächen erfüllen überwiegend eine konkrete Auswahl- oder Bedienfunktion. B besitzt dennoch eine zu große informationsarme Bühne; C zu viele gleichzeitig über dem Bild liegende Bedienflächen.

Ergänzend zur Bildprüfung wurden die vorliegenden CSS-Farben rechnerisch gegen Weiß geprüft: Aktionsfarbe `#b83e1f` ca. 5,60:1; Hilfstext `#536171` ca. 6,33:1; Status-/Prüftext `#415465` ca. 7,83:1. Diese konkreten Paare erfüllen 4,5:1. Das ist keine vollständige Kontrastfreigabe für jeden Zustand, Fotohintergrund oder spätere Implementierung. Winzige Schrift bleibt unabhängig davon eine Lesbarkeitsfrage.

## Auswahlvotum

**A nach Reparatur von G1 bevorzugen.** Die Flächenhierarchie ist unmittelbar sichtbar, die Bildarbeit bleibt dominant und die kontextuelle Formbearbeitung ist räumlich klar. C bleibt als alternative stärker geführte Richtung nur nach Beseitigung der Bildüberlagerungen tragfähig. B ist im Tablet-Querformat für diesen Auftrag derzeit die schwächste Richtung. Eine endgültige Produktoberflächenfreigabe und echte iPad-Praxisabnahme werden mit diesem Review nicht behauptet.
