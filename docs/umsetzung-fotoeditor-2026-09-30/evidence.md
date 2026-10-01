# Entscheidungsgrundlage – 30.09.2026

Interner Fotoeditor für Vertriebsmitarbeitende. Grundlage ist der ausdrücklich beauftragte Plan; bestehende Fachentscheidungen werden erhalten.

## Im Repository beobachtet

- Die Rückgängig-Liste liegt im Belegungsschritt und geht bei dessen Unmount verloren. Der Audit reproduzierte dies auf Desktop, Tablet und Smartphone.
- Neue Flächen besitzen voreingestellte Maße und können ohne ausdrückliche Maßbestätigung bis zur Belegung gelangen.
- Fehlender Ziegelmaßstab wird im bisherigen Foto-Check mit grünem Gesamtstatus kombiniert.
- Auf 375 px bleibt zwischen den gestapelten Werkzeugen eine etwa 297 × 185 px große Fotofläche. Der gesamte Schritt war im Audit etwa 3692 px hoch.
- Die PL-Aktion setzt lediglich eine lokale Markierung. Der Speicherstatus wird auf kleinen Geräten ausgeblendet.
- Akzent #e8603a mit weißem Text erreicht etwa 3,41:1; #94a3b8 auf Weiß etwa 2,56:1.

Messungen und tatsächlich betrachtete Screenshots: `.debug-shots/ux-review-2026-09-30/`. Testfotos sind synthetische Testbilder, keine Kundendächer. Drei Auditfälle bestanden, aber der Testprozess musste nach hängendem Teardown beendet werden; das ist kein vollständig erfolgreicher Regressionstest.

## Direkt gelesene Primärquellen

- [W3C: Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): 4,5:1 für normalen Text.
- [W3C: Ziehbewegungen](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): Alternative ohne Ziehbewegung. Daraus folgt hier zusätzliches Zeichnen mit zwei Eckpunkten.
- [W3C: minimale Zielgröße](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): die dortige Mindestanforderung ist 24 px; 44 px ist die strengere, im Nutzerplan gewählte Projektanforderung.
- [NN/g: Usability-Heuristiken](https://www.nngroup.com/articles/ten-usability-heuristics/): sichtbarer Systemstatus, Fehlervermeidung und rückgängig machbare Aktionen.
- [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): seltener benötigte Details auf Abruf.
- [NN/g: komplexe Anwendungen](https://www.nngroup.com/articles/complex-application-design/): Kontext und wichtige Arbeitsabläufe erhalten.
- [OpenSolar: Application Flow](https://support.opensolar.com/hc/en-us/articles/13211447430799-Application-Flow): Design als eigener Arbeitsbereich und explizites Hinzufügen von Modulen.
- [GoodWe: Modules](https://learn-designer.goodwe.com/en/documentation/editor/modules): zwei Eckpunkte für eine Modulgruppe und Bearbeitung der ausgewählten Gruppe.

Die konkrete gemeinsame Arbeitsfläche, Position der Werkzeuge und Smartphone-Rekomposition sind Gestaltungsentscheidungen, keine durch diese Quellen bewiesene optimale Lösung. Drei vollständige Richtungen werden deshalb gerendert und getrennt bewertet. Das interne Werkzeug ist keine Conversion-Seite. Elektrische Werte und Engine-Regeln werden durch diese Recherche nicht verändert.

## Grenzen der Abnahme

Touch-Emulation ist kein Nachweis für ein echtes iPad. Eine native Praxisabnahme bleibt ausdrücklich separat. Der konkrete Editorentwurf ist noch nicht freigegeben; der freigegebene Plan erlaubt davor die Verlässlichkeitsarbeiten und die Entwürfe.
