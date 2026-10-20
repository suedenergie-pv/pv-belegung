# Unabhängiger Review · Aussparungen · 19.10.2026

Status: PASS nach Reparatur. Keine offenen Blocker oder Majors im geprüften Auftrag. Reviewer `aussparung_review`, unabhängig von der Implementierung; keine Änderungen am Produktcode vorgenommen.

Geprüft: FotoHintergrund einschließlich Auswahl, Verschieben, freien Eckgriffen, metrischen Maßen, Entwurfsschutz, Touch-Steuerung und Gestenabbruch; Konturhelfer, Modellskalierung sowie Polygonverwendung in Engine und DachSvg. SPEC-Auftrag zur Bearbeitung bestehender manueller Aussparungen; automatische Gaubenaussparungen bleiben gekoppelt.

## Unabhängig reproduzierte und anschließend nachgeprüfte Fehler

1. **Major, behoben:** Erneutes Auswählen derselben Aussparung setzte nach „Übernehmen“ die vor dem Dialog gecachte Form in die lokale Auswahl zurück. Nachprüfung: Breite 3 m bleibt nach erneutem Listenknopf erhalten, kein unnötiger Dialog. Evidence: `review-same-selection.png` (vorher), `review-repaired-desktop.png` (nachher).
2. **Major, behoben:** Aussparung 1 ändern, Aussparung 2 entfernen und im Dialog „Übernehmen“ wählen überschrieb die Änderung an 1 mit dem alten Array. Nachprüfung: 1 bleibt 3 m breit, 2 ist entfernt. Evidence: `review-delete-other.png` (vorher), `review-repaired-desktop.png` (nachher).
3. **Major, behoben:** Undo bei nur ausgewählter Aussparung aktualisierte das Modell, ließ aber Vorschau und Maßfeld auf dem rückgängig gemachten Stand. Nachprüfung: gespeicherte 3 m rückgängig auf 2,39 m, anschließend Nudge und Übernehmen; 2,39 m bleibt erhalten. Evidence: `review-undo-selected.png` (vorher), `review-undo-repaired.png` (nachher).
4. **Minor, behoben:** Touch-Aktion außerhalb der gewählten Kontur hieß „Punkt setzen“ und tat nichts. Aktuelle Capture zeigt eine deaktivierte Aufforderung zum Anvisieren eines Griffs.

Zusätzlich unabhängig headless ausgeführt: Tastatur-Nudge verändert die Vorschau; laufender Maus-Drag und `pointercancel` stellt den schon vorher offenen Entwurf wieder her, statt ihn zu löschen; Übernehmen bleibt danach verfügbar. Browser aus der lokalen Repository-Abhängigkeit, headless Chrome gegen localhost:3100, keine Browserinstallation und kein In-App-Browser.

## Sichtprüfung

Tatsächlich geöffnet: Desktop 1440×900, Tablet quer 1024×768, Tablet hoch 768×1024, Mobil hoch 375×812 und Mobil quer 812×375. Entscheidende Captures unter `.debug-shots/aussparungen-2026-10-19/`: `desktop-02-frei-verziehen.png`, `tablet-quer-02-frei-verziehen.png`, `tablet-hoch-03-masse.png`, `mobil-hoch-02-frei-verziehen.png`, aktualisierte `mobil-hoch-03-masse.png`, `mobil-quer-02-frei-verziehen.png`, aktualisierte `mobil-quer-03-masse.png` sowie die unabhängigen Review-Captures oben.

Auswahl und vier Eckgriffe sind erkennbar. Maßänderung und Übernahme sind im Inspektor getrennt; der feste Abschluss bleibt sichtbar. Auf schmalen/kurzen Displays erfordert präzise Fotobearbeitung den vorhandenen Zoom. Kleiner Hinweis weitergegeben: langer deaktivierter Touchtext kann bei 375 px die Ansichtssteuerung umbrechen und das Foto weiter verkleinern; kürzerer Text vermeidet dies.

Die vollständigen Produktions-Builds und die gesamte automatisierte Testmatrix sind Sache des Abschluss-Gates des Hauptagents; sie wurden in diesem Review nicht nochmals ausgeführt. Native iPad-Bedienung ist durch Headless-Touch-Emulation nicht nachgewiesen. Kein Push oder Deploy im Review.
