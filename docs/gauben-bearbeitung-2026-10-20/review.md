# Unabhängiger Review der Gaubenbearbeitung · 20.10.2026

Prüfer: vom Erzeuger getrennter Agent `gauben_unabhaengiger_review_20261020`. Produktcode nur gelesen. Prüfgrundlage: `93fa958` und der aktuelle Gauben-Diff; Nutzerfreigabe, SPEC §4.3, `exec-plan.json` und `evidence.json`.

## Abschlussurteil: PASS · keine offenen Findings

F01 und F02 wurden begrenzt repariert und unabhängig nachgeprüft. Dieses Urteil betrifft den geprüften Gauben-Diff und die benannten Darstellungen; Tests und Build des gesamten Repositories werden vom Hauptagenten separat protokolliert.

### F01 · Major · behoben: Ungültige Satteldach-Topologie konnte gespeichert werden

Betroffen sind `apps/web/components/GaubenEditor.tsx` (`markierungAusPunkten`, `pruefungAusPunkten`), `apps/web/lib/gauben-geometrie.ts` (`satteldachSeitenEcken`, `wendeGaubenMarkierungAn`) und der gemeinsame Rand in `apps/web/lib/gauben-umriss.ts`.

Reproduktion mit Hauptdach 10 × 6 m / Foto 1000 × 600 px:

1. Gaube mit Außenpunkten `[[200,500],[600,500],[600,200],[200,200]]` und First `[[400,180],[400,520]]` anlegen.
2. Bei Formkorrektur die erste Außenecke auf `[700,300]` ziehen. Die vier Außenpunkte sind dann `[[700,300],[600,500],[600,200],[200,200]]`.
3. Die beiden automatisch sortierten Seiten liefern weiterhin `pruefePerspektive(...).status === 'ok'`. Die vom Editor ausschließlich auf diese Seiten gestützte Prüfung sperrt die Übernahme daher nicht.
4. `gaubenFotoUmriss` liefert nur `[[400,520],[600,200],[400,180],[200,200]]`: Teile der rechten Seite fehlen in der gekoppelten Hauptdach-Aussparung.

Weiterer Fall derselben Defektklasse: Außenrechteck unverändert lassen, die komplette Firstlinie auf `[[650,180],[650,520]]` bewegen. Beide Quads sind einzeln gültig, überlappen sich aber auf derselben Seite der Firstlinie. Eine Prüfung nur des Außenvierecks reicht deshalb nicht aus.

Die Helper-Reproduktion wurde tatsächlich über das repository-eigene `tsx` ausgeführt (`.release/review-gauben-geometry.ts`, ignoriertes QA-Artefakt). Erforderliche Invariante: zwei gültige Dachseiten auf entgegengesetzten Seiten einer echten gemeinsamen Firstkante und eine vollständig geschlossene gemeinsame Außenkontur; ungültige Entwürfe dürfen die letzte gültige Modulvorschau und gespeicherte gekoppelte Aussparung nicht ersetzen.

Nachprüfung: `pruefeGaubenTopologie` prüft nun die gemeinsame echte Firstkante, die vier unverwechselbaren Außenpunkte und die Lage beider Seiten strikt auf entgegengesetzten Seiten der Firstgeraden. Der Editor ruft die Invariante vor der Perspektivprüfung auf; der Transaktionshelper prüft erneut vor jeder Mutation. Beide genannten Fehlerfälle wurden im eigenen Repro mit Assertions erneut ausgeführt und abgewiesen, der reguläre Fall akzeptiert. Gültige konkave sechspunktige Gesamtkonturen und Firstenden außerhalb des Hilfsrahmens bleiben erlaubt. Die vorhandene letzte gültige Vorschau wird durch die neue Fehlerprüfung geschützt.

### F02 · Minor · behoben: kompakte Maßformulare schnitten Eingabefelder unten an

Im ursprünglichen `mobil-quer-04-masse.png` (812 × 375) lagen die unteren ungefähr zwölf Pixel der Zahlenfelder unter dem festen Fuß. Werte blieben lesbar und durch Scrollen des Eigenschaftspanels waren die Felder vollständig erreichbar. Trigger war die automatische Scrollposition nach dem programmgesteuerten Fokussieren/Befüllen. Kein gesperrter Ablauf und kein Major; betroffen war die kurze Gauben-Maßformular-Darstellung, nicht die neue feste Erreichbarkeit der Übernahme.

Die erste Reparatur deckte das kurze Querformat ab; beim anschließenden statischen Build zeigte sich zusätzlich eine kleine Unterkanten-Clipping-Abweichung im Hochformat. Die endgültige Nachprüfung umfasst deshalb beide Ausrichtungen und Tablet hoch.

Nachprüfung der endgültigen Reparatur: `MassEingabe` korrigiert nur bei maximal 900 px Breite oder kurzem Querformat die Scrollposition des nächstgelegenen bestehenden `[data-inspektor-inhalt]`. Der lokale Fokus-Handler prüft nach dem Layout-Frame die tatsächlichen Eingabefeld- und Scrollbereichsgrenzen sowie den klebenden Kopf und hält acht Pixel Abstand. Er ändert weder Maße noch Navigation, scrollt kein globales Fenster und wirkt nicht auf übrige Formulare. Die danach erneuerten Captures `mobil-hoch-04-masse.png`, `mobil-quer-04-masse.png` und `tablet-hoch-04-masse.png` selbst geöffnet: alle Zahlenfelder vollständig oberhalb des festen Fußes. Die E2E-Prüfung kontrolliert zusätzlich unverändert die Unterkante des fokussierten Feldes gegen die Oberkante des Maßfußes; der Hauptagent meldet die drei erneut ausgeführten Fälle als bestanden. F02 ist damit geschlossen.

## Weitere geprüfte Pfade

- Gemeinsame Translation benutzt ein gemeinsames begrenztes Delta, keine individuelle Eckpunkt-Klemmung. Fotoecken beider Seiten und die verknüpfte Aussparung werden im selben Projektupdate gespeichert; Metermaße, Felder und gelöschte Zellen bleiben im Markierungspfad erhalten.
- Die ausgewählte Foto-ID wird aus der Workbench in Editor, Rekonstruktion, Vorschau, Anlage und Speichern durchgereicht. Ein Gaubeneditor-Wechsel zwischen Foto-IDs bekommt eine neue Komponentenidentität; vorhandene Entwürfe werden vor Ansichtswechsel über die bestehende Navigation geschützt.
- Kopien übernehmen asymmetrische Seitenmaße und die Messherkunft je Seite. Neue Belegung wird als solche im Kopierhinweis benannt. Änderungen am Original werden bei Abbrechen nicht gespeichert.
- Maßentwurf ist auf eine Seite begrenzt; Quelldaten, Abbrechen und Navigation benutzen den vorhandenen Entwurfsschutz. Eine geschätzte Herkunft wird nicht durch bloßes Öffnen/Übernehmen zum bestätigten Aufmaß.
- Bestehender Gaubentyp ist während Korrektur kein umschaltbarer Knopf mehr. Der frühere scheinbar erfolgreiche Typwechsel kann über diese Oberfläche nicht ausgelöst werden.
- Mauszug hat Pointer-Capture, letztes Frame-Flush sowie Fenster-`pointerup`/`pointercancel`/`blur`-Fallback. Die vorhandene Viewport-Integration fängt Touch und Zwei-Finger-Ansichtsgesten vor den Modellhandlern ab. Ein nur gegriffenes Touch-Objekt kann nicht übernommen werden, bis es abgelegt oder die Bewegung abgebrochen wurde.
- Die Punkt-`aria-pressed`-Zustände sind an das tatsächlich ausgewählte `punkt:i`-Element gekoppelt; eine Kanten-/Firstauswahl kündigt nicht gleichzeitig eine alte Ecke als gedrückt an.
- Neue Gestaltung ist auf Gaubenkomponente, Gauben-Maßformular, Gaubenseiten-Navigation und explizit durch Gaubenattribute aktivierte gemeinsame Editor-Regeln begrenzt. Keine neue Hauptnavigation, keine Engine-/Elektrikänderung und kein neuer Deploy im Auftrag.

## Eigene Sichtprüfung

Folgende tatsächlich geöffneten Captures aus `.debug-shots/gauben-bearbeitung-2026-10-20/` wurden beurteilt:

- Desktop 1440 × 900: Übersicht, Position, Form, Maße, Kopie, Module.
- Mobil 375 × 812: Position und Maße; nach der auf Gauben begrenzten 55%-Fotokorrektur beide neu geöffnet.
- Tablet hoch 768 × 1024: Formkorrektur und finales Maßformular.
- Mobil quer 812 × 375: Formkorrektur und finales Maßformular.

Die Gaubenkarte beansprucht nun die Panelbreite. Aufgaben, Gaubenname, aktiver Modus und feste Übernahme sind erkennbar. Die aktualisierte mobile Position zeigt das Foto in brauchbarer Breite statt der zuvor mittig verkleinerten Miniatur. Der finale Maßfuß wurde nach Umstellung auf eine horizontale Aktionsreihe auf Desktop, Mobil hoch und Mobil quer erneut geöffnet: Übernehmen und Abbrechen sind sichtbar; im Hochformat bleiben Eingabelabel und Felder gemeinsam sichtbar. Keine Walter-/iPad-Abnahme und kein allgemeiner Verständlichkeitsnachweis daraus abgeleitet.

## Selbst ausgeführte Prüfungen

- Eigene gezielte Helper-Reproduktion und Nachprüfung mit repository-eigenem `tsx`: zwei zuvor akzeptierte ungültige Topologien jetzt gesperrt, regulärer Fall weiterhin erlaubt.
- `npx vitest run --root apps/web components/GaubenEditor.test.tsx lib/gauben-geometrie.test.ts components/GaubenMassEditor.test.tsx`: **53/53 Tests bestanden** (38 Geometrie, 12 Maße, 3 Editor).
- Eigene Code- und Sichtprüfung wie oben abgegrenzt. Gesamtzahlen und gerenderte End-to-End-Abläufe des Hauptagenten werden nicht als selbst ausgeführt ausgegeben.
