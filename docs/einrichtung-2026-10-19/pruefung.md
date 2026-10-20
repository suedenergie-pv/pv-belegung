# Fotoeinrichtung – Prüfung 19.10.2026

## Umgesetzter Umfang

Die konkrete aktuelle Aufgabe ersetzt den generischen Inspektortitel und die kleine, umbrechende Sechser-Schrittleiste. Eine kurze Fotoanweisung, echter Punktfortschritt und nummerierte Eckpunkte im Bild führen die Markierung. Der feste Abschluss existiert schon bei null Punkten und nennt den Fehlbestand. Korrekturen und zusätzliche Prüfungen folgen nach der aktuellen Aufgabe. Der Inspektor scrollt bei einem Aufgabenwechsel an den Anfang. Tablet/Smartphone ordnen den Punktfortschritt zuerst an; kurze Queransichten verwenden eine reduzierte Darstellung und die konkrete Anweisung über dem Foto.

Die vorhandene Workbench, Projekteinstieg, Modell-/Speicherformate, Geometrie- und Enginefunktionen bleiben erhalten. Bestehende Fachhandler werden weiterverwendet. Keine Datenblätter oder elektrischen Werte verändert.

## Ausgeführt

- `npm test`: 141 Engine- und 223 Web-Tests bestanden (364), darunter ein neuer Verhaltenstest für Fortschritt, fehlende Punkte, deaktivierten Abschluss und ausschließlich ausdrückliche Übernahme. Nach den letzten Flächenbezeichnungen die 17 FotoHintergrund-Tests erneut bestanden.
- `npm run typecheck` und `git diff --check`: bestanden.
- Vorhandene `playwright.walter.config.ts`: 10/10 Fälle bestanden auf Desktop 1440×900, Tablet quer 1024×768 und hoch 768×1024 (WebKit/Touch), Smartphone hoch 375×812 und quer 812×375 (Chromium/Touch). Neue Dachfläche bis echtem PDF-Download und anschließender Bestandskorrektur; zusätzliche Layoutprüfung mehrerer Dachflächen. Jetzt explizite Assertions für sichtbare Aufgabe, sichtbaren Fortschritt, sichtbare feste Aktion, deaktivierten Abschluss bei fehlenden Punkten und Änderung des Zählers pro Punkt.
- Nach dem unabhängigen Review erweitert: derselbe Ablauf erzeugt auf allen fünf Größen zunächst vier kollineare Punkte. Er prüft den sichtbaren konkreten Sperrgrund, Korrekturanweisung über dem Foto, direkt erreichbares „Punkt zurück“, den gesperrten Abschluss und die Rückkehr zur regulären Markierung. Finaler Lauf in `.debug-shots/einrichtung-2026-10-19/fehler-final`: 10/10 bestanden. Die 17 fokussierten FotoHintergrund-Tests und Typprüfung danach erneut bestanden.
- Vorhandene `playwright.touch.config.ts`, Projekte `webkit-tablet-quer` und `chromium-mobil`: 2/2 bestanden; Fadenkreuz, Punktbestätigung, Pinch und Entwurfsschutz.
- Finaler `npm run build:vps`: erfolgreich. `npm run test:vps`: 2/2 bestanden, Desktop/Smartphone gegen das lokale statische Artefakt einschließlich Foto, Belegung, PDF und Reload.
- Evidence- und ExecPlan-Validatoren der globalen Orchestrierung: gültig.

## Sichtprüfung

Ausgangsbild: der vom Nutzer markierte Inspektor. Aktuelle lokale Evidence in `.debug-shots/einrichtung-2026-10-19/final/`, mit dem bereits vorhandenen privaten Drohnenfoto als lokaler Fixture. Hauptagent hat Desktop/Tablet/Mobile sowie die Zustände vor, während und nach der Eckmarkierung tatsächlich geöffnet. Fokussiertes Panelbild: `desktop-inspektor-zwei-ecken.png`.

Die Prüfung fand neben dem ursprünglichen Problem zwei relevante Folgefehler: beibehaltene Scrollposition nach Maßformular und zu wenig sichtbarer Platz für Fortschritt auf kleinen Panels. Beide wurden korrigiert; die finale Suite enthält ausdrücklich eine vollständige Sichtbarkeitsprüfung für den Fortschrittsbereich. Technisch erfolgreiche Vorläufe ohne diese Sichtbarkeitsbedingung wurden nicht als Nachweis ausreichender Führung verwendet.

Der unabhängige Reviewer fand zusätzlich einen Major bei ungültiger Perspektivmarkierung: konkrete Ursache außerhalb des sichtbaren Panels und widersprüchliche Übernahme-Anweisung im Foto. Die Korrektur zeigt die Ursache im festen Footer, eine direkt erreichbare Korrekturaktion, rote Punktnummern statt Häkchen und die passende Foto-Anweisung. Hauptagent hat die finalen Fehlerzustände auf Mobile hoch/quer tatsächlich geöffnet. Die unabhängige Nachprüfung ist im Review dokumentiert.

Unabhängiger Review steht in `review.md`. Nutzerverständnis und Gebrauchstauglichkeit sind trotz visueller und technischer Evidence noch nicht durch einen echten Nutzertest nachgewiesen.

## Grenzen

Keine native iPad-Abnahme. Keine Veröffentlichung, kein Push oder Deploy. Das private Testfoto und die erzeugten Screenshots bleiben gitignored und außerhalb des statischen Builds. Vorhandene Nutzeränderungen und der zuvor umgesetzte Projekteinstieg wurden erhalten. Lokaler Entwicklungsserver weiterhin auf `http://localhost:3100/`.
