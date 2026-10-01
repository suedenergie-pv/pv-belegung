# Drei konkrete Fotoeditor-Entwürfe

Stand: 30.09.2026. Eigenständige Ansichtsprototypen, keine neue Produktionsoberfläche. Eine Richtung ist noch nicht durch den Nutzer freigegeben. Die unabhängigen Bewertungen werden vom Hauptagenten getrennt geführt.

## Gemeinsame Vorgaben

Helles internes SüdEnergie-Werkzeug, bestehendes Orange als Markenakzent; dunkleres Orange für lesbare Schaltflächen. Die Fotoarbeitsfläche ist der dominante Inhalt. Drei Hauptschritte, projektweite Historie, sichtbarer Speicherstatus, eindeutig aktive Dachfläche, explizites Werkzeug, separate Maß-/Perspektiv-/Prüfzustände und Maßentwurf mit Vorher/Nachher bleiben in allen Kandidaten gleich. Die Prototypen verwenden die kanonische Jolywood-Moduloptik aus `apps/web/lib/modul-assets.ts`.

Der Hintergrund ist eine eigens erzeugte SVG-Illustration und ausdrücklich als „Beispieldach · Illustration“ bezeichnet. Es gab kein verwendbares reales Dachfoto im bereitgestellten Repository-Kontext. Stückzahlen, Maße und kWp sind konsistente Beispieldaten für die Oberfläche, aber nicht durch die Engine ermittelte Projektergebnisse. Kein Render dieser Entwürfe gilt als geometrischer, elektrischer oder iPad-Nachweis.

## A — Flächenliste und Inspektor

Die sichtbare Dachflächenhierarchie steht links, die aktive Fläche und ihre Eigenschaften rechts. Das Foto bleibt dazwischen. Gaubenseiten sind unter dem Hauptdach eingeordnet. Flächenwechsel und Bearbeitung haben feste Orte; aufrechte Tablets verschieben die Eigenschaften unter das Foto. Auf Smartphones verschwinden beide Seitenleisten: Flächenwahl oben, Hauptaktionen unten, Details auf Abruf.

Die sichtbare Spannung liegt zwischen der ruhigen Flächenliste und der konkreten Modulbelegung. Der vorhandene Dachkontext bleibt bei der Arbeit erhalten. Die Variante ermöglicht direkten Vergleich und Wechsel zwischen mehreren Ebenen, beansprucht dafür mehr horizontalen Platz.

## B — Foto mit unterem Kontextstreifen

Das Foto nimmt die gesamte Breite ein. Flächenwahl und Fotoverwaltung liegen darüber, aktive Werkzeuge links im Bild. Die Eigenschaften und Aktionen stehen in einem horizontalen Streifen unter dem Foto. Einrichtung, Auswahl und Korrektur ersetzen jeweils dessen Inhalt. Auf Smartphones bleibt nur eine kurze aktive-Fläche-Zeile stehen; Details werden geöffnet.

Die dominante Figur ist die breite Arbeitsfläche. Kontextkontrollen sitzen entlang ihrer Unterkante und folgen der Auswahl. Eine schmale Fotoaufnahme wird in diesem breiten Arbeitsbereich mit seitlichem Freiraum eingepasst; sie wird nicht beschnitten, um mehr Bildfläche vorzutäuschen. Der Entwurf lässt mehr horizontale Fläche zu, verlangt aber eine klare Begrenzung der Höhe des Kontextstreifens.

## C — Geführte Aufgabe neben dem Foto

Links steht die aktuelle Aufgabe mit dem sichtbaren Einrichtungsfortschritt, rechts das Foto. Die Flächenliste ist aufrufbar. Der Werkzeugschalter liegt am unteren Rand des Bilds. Beim Maßentwurf wird die allgemeine Aufgabenliste ausgeblendet. Die Aktionen liegen in einem festen Bereich; nur der Formularinhalt scrollt. Auf dem aufrechten Tablet und beim Einrichten auf dem Smartphone wandert die Aufgabe über das Foto.

Die Hierarchie folgt der nächsten konkreten Entscheidung: Maße bestätigen, Belegung bearbeiten oder Änderung prüfen. Bild und Aufgabe stehen im direkten Zusammenhang; die Bildansicht bleibt neben beziehungsweise unter den Eingaben sichtbar. Wiederkehrende Flächenwechsel benötigen den aufrufbaren Wähler.

## Artefakte und Bedienung

- Einstieg: `.debug-shots/fotoeditor-entwuerfe-2026-09-30/index.html`.
- Kandidat/Zustand lässt sich oben umschalten; direkte Auswahl über `?direction=A&state=placement` (auch B/C und setup/correction).
- Dateinamen: `{A|B|C}-{setup|placement|correction}-{desktop|tablet-quer|tablet-hoch|mobil-hoch|mobil-quer}.png`.
- Die Fotoliste öffnet sich, auf Smartphones auch die Details und „Weitere Aktionen“. Zoomknöpfe und „Alles anzeigen“ verändern die Ansicht. Übernehmen/Abbrechen wechseln demonstrativ zwischen den Korrekturansichten.
- Nicht implementierte Projektaktionen geben einen ausdrücklichen Prototyp-Hinweis aus. Es gibt keine Speicherung, kein echtes Zeichnen, keine Historie, kein Drag/Resize und keine Zwei-Finger-Geste in diesen Ansichtsprototypen. Die Maßvorschau verwendet Beispieldaten.

## Ausgeführte Prüfung

Repository-Abhängigkeit `@playwright/test`, vorhandener Chrome-Kanal, ausschließlich headless. Keine Installation und kein In-App-Browser.

```powershell
node .debug-shots/fotoeditor-entwuerfe-2026-09-30/render.cjs
node .debug-shots/fotoeditor-entwuerfe-2026-09-30/interaction-check.cjs
node .debug-shots/fotoeditor-entwuerfe-2026-09-30/status-check.cjs
```

45 Hauptansichten: drei Kandidaten × drei Zustände × fünf Größen (1440×900, 1024×768, 768×1024, 375×812, 812×375). Letzter vollständiger Renderlauf: erfolgreich; keine Seitenfehler, kein horizontaler Dokumentüberlauf, keine HTML-App-Schaltflächen kleiner als 44×44 CSS-Pixel. Messungen: `qa-metrics.json`. Die zusätzliche Prototyp-Navigationsleiste gehört nicht zum Produkt und ist aus diesem App-Zielgrößencheck ausgenommen.

Neun interaktive Prüfungen: jeder Kandidat auf Desktop, Smartphone hoch/quer. Fotoliste öffnen/schließen, Zoom, Ansicht zurücksetzen, Korrektur abbrechen; auf Smartphone hoch zusätzlich Details/weitere Aktionen. Ergebnis erfolgreich, `qa-interactions.json`. SVG-Flächenwahl hat in diesen geprüften Ansichten mindestens 44×44 CSS-Pixel große Ziele (Rundungstoleranz 0,1 px). Ein erster Prüflauf adressierte den verborgenen statt des sichtbaren Abbrechen-Knopfs; der Selektor wurde korrigiert und der gesamte Lauf erfolgreich wiederholt.

Tatsächlich als Bilder geprüft wurden unter anderem alle drei Kandidaten auf Desktop, Tablet quer und Smartphone hoch; zusätzlich A und C auf Tablet hoch, C auf Smartphone quer sowie die aufgerufene Fotoliste und Detailansicht auf Smartphone hoch. Die Auswahl umfasste Einrichtung, Belegung und Korrektur. Die unabhängigen Kritiker müssen ihre eigenen konkret betrachteten Dateien separat benennen.

Beobachtete und korrigierte Darstellungsfehler: abgeschnittenes Foto in B; zu hohe Detailinhalte mit unsichtbarem Maßvergleich auf dem Smartphone; überlappende Hauptnavigation bei geringer Querformat-Höhe; zu kleine SVG-Flächenbeschriftungen; in C zu viel Fortschrittsliste vor primären Aktionen. Die aktuelle C-Einrichtung und Korrektur auf 1024×768 haben einen festen Aktionsbereich und innen scrollende Formulare. Smartphone quer zeigt die Korrekturaktionen vollständig.

Die anschließende unabhängige Kritik führte zu einer gemeinsamen Reparatur: Feldzeichnen ist während der Einrichtung deaktiviert; der Speicherstatus bleibt im Smartphone-Querformat sichtbar; B/C verwenden auf dem Smartphone einen tatsächlichen Detailauslöser statt eines verwaisten Flächentitels; Flächenbeschriftungen vermeiden Maßzahlen, Bildlegende und Werkzeugschalter. Die verlangte offene Detailansicht von A wurde als `A-placement-details-mobil-hoch.png` aufgenommen: „2 Felder drehen“, „Alle auswählen“, Pfeiltasten, untere Hauptaktionen und Foto sind gleichzeitig sichtbar. Die Bildfläche bleibt dabei ungefähr 227 px hoch. Die Reparatur zählt zur vom Hauptagenten koordinierten dritten Layout-Runde; weitere wesentliche Befunde erfordern eine ausdrückliche Neubewertung, kein endloses Nachpolieren.

Die separat freigegebene Defektklasse „Status-Erreichbarkeit“ wurde anschließend behoben. Alle Kandidaten bieten in ihren Details einen aufklappbaren Prüfstatus mit **Perspektive**, **Maße** und **Foto-Prüfung**. „Nicht geprüft“ bleibt neutral; beim Maßentwurf steht „Entwurf offen“. Die Inhalte sind auch in schmalen/kurzen Ansichten erreichbar. Die Smartphone-Details von B/C mussten dafür ebenfalls tatsächlich ausgeklappt werden; eine zu spezifische Verbergeregel wurde korrigiert.

Zusätzlicher Prüflauf: neun Statusansichten (A/B/C × Tablet hoch/Smartphone hoch/Smartphone quer), erfolgreich; `qa-status.json`. Neue Evidenz: `{A|B|C}-placement-status-{tablet-hoch|mobil-hoch|mobil-quer}.png`. Diese zeigen die geöffneten drei Statusanzeigen bei weiterhin sichtbarer Bildfläche. A und B auf Smartphone hoch, B und C auf Tablet hoch sowie C auf Smartphone quer wurden als Bilder betrachtet. Alle drei Prüfbefehle wurden nach der Statuskorrektur erfolgreich ausgeführt; die Hauptansichten bleiben ohne Seitenfehler, horizontalen Überlauf oder zu kleine HTML-App-Schaltflächen. Die native iPad-Prüfung bleibt ausstehend.

## Abnahmegrenze

### Letzte gezielte A-Korrektur nach Selector-Befund

Der Selector fand in A auf 1024×768 ein abgeschnittenes Abbrechen und im Smartphone-Querformat nicht vollständig sichtbare Abschlussaktionen. Ausschließlich A erhielt daher für Einrichtung und Korrektur einen feststehenden Aktionsbereich; Formulardetails scrollen innerhalb ihres Bereichs. Für schmale Geräte liegt die Zoomsteuerung jetzt in einer eigenen 44-px-Zeile außerhalb des Fotoausschnitts. Das gilt auch bei geöffneten Details und Statusanzeigen. Der Flächentitel wird im geöffneten Smartphone-Detailbereich nicht doppelt wiederholt, sodass die Auswahlaktionen und Pfeile dort Platz haben. B und C wurden nicht weiter geändert.

Gezielter Nachweis: `node .debug-shots/fotoeditor-entwuerfe-2026-09-30/check-a-completion.cjs`. **19 neue Aufnahmen erfolgreich:** A-Einrichtung/Belegung/Korrektur auf allen fünf Größen sowie offene Smartphone-Details und drei schmale Statusansichten. `qa-a-completion.json` enthält die aktuellen A-Messungen und ersetzt für A die früheren Standmessungen. Es prüft bei Übernehmen/Abbrechen die vollständige Sichtbarkeit einschließlich aller begrenzenden Vorfahren, Mindestgröße 44×44 px, Seitenfehler, horizontalen Überlauf und die räumliche Trennung der Zoomzeile vom Foto. Keine Fehler. Die Bildhöhe bleibt mindestens 193 px im Smartphone-Querformat; bei offenen Smartphone-Details und Statusanzeigen beträgt sie 222 px.

Tatsächlich betrachtet: A-Korrektur in allen fünf Größen, A-Einrichtung auf Smartphone quer, A-Details und A-Status auf Smartphone hoch sowie die nachgezogenen schmalen Statusansichten. Beide Korrekturaktionen und die Einrichtung bestätigen bleiben vollständig sichtbar. Diese Aufnahmen sind der eingefrorene A-Stand für den erneuten Selector-Check; daraus folgt noch keine Nutzerfreigabe.

Die Prototypen erlauben eine konkrete Auswahl der Arbeitsansicht. Sie ersetzen weder die spätere Integration noch Regressionstests, Engine-Vergleiche, eine echte Tablet-Gestenprüfung oder eine native iPad-Praxisabnahme. Insbesondere sind echte Fotoaufnahmen, exakte perspektivische Eingaben und die Zustände Traufkante/Dachecken/Aussparungen nach der Richtungswahl mit den bestehenden Komponenten umzusetzen und erneut zu prüfen.
