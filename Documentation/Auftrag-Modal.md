# Auftragsdetails als Modal

Im Auftrags-Sidepanel steht neben dem Drei-Punkte-Menü der Button „Auftrag in
Fenster öffnen“ (Abdocken). Er öffnet die ausgewählten Auftragsdetails im globalen
Modal-Dock und schließt das Sidepanel. Das Fenster lässt sich minimieren und
bleibt bei einem Seitenwechsel erhalten. Ein erneuter Aufruf derselben
Auftragsnummer stellt das bestehende Fenster samt lokalem Zustand wieder her.

Interne Öffnen-Aktionen in Dispo (auch „Einsatz öffnen“), Mitarbeiter- und
Kundenkarten, Dokumentkarten, Signaturen, Reports, Kundenanalysen, Dashboard-
Widgets und der produktiven Lohnansicht verwenden denselben Modal-Aufruf.
Die aktuelle Seite und bereits geöffnete Karten bleiben dabei erhalten.

Im Modal-Fußbereich ist immer der Link „Im Auftragskalender öffnen“ verfügbar,
auch während des Ladens oder nach einem Ladefehler. Er führt zu `/auftraege`
mit ausgewähltem Kalender-Tab, Auftragsnummer und – sobald bekannt – dem
Auftragsdatum und Standort. Ein normaler Klick schließt das Modal und zeigt den Auftrag im
Kalender. Über die üblichen Link-Aktionen lässt sich das Ziel auch in einem
neuen Browser-Tab öffnen; das Modal bleibt dabei erhalten.

Aufruf aus anderen Vue-Komponenten:

```js
import { useAuftragModals } from '@/composables/useAuftragModals';

const { openAuftrag } = useAuftragModals();
openAuftrag(2510447); // Alternativ: '2510447' oder ein Auftrag mit auftragNr
```

`Modals/AuftragModal.vue` nutzt den Detailmodus des bestehenden
`AuftragCalendarWorkspace`. `AuftragDetailsSidePanel` stellt denselben Inhalt
über die Modal-Präsentation von `SidePanelFrame` / `ModalFrame` dar. Auftragsdaten,
Schichten, Team, Dokumente, Stundenlisten und Aktionen verwenden dieselbe Logik
wie im Sidepanel. Die bestehenden Rollenprüfungen bleiben auch dort wirksam.
Der Event-Editor wird weiterhin über das Drei-Punkte-Menü separat geöffnet.

Der Detailmodus lädt ausschließlich den angegebenen Auftrag und dessen
zugehörige Daten. Kalender, Monatslisten, Suchfilter und Routenauswahl werden
nicht initialisiert. Änderungen an der Kalenderroute und die dort gespeicherte
Auswahl beeinflussen das Fenster nicht. Ladefehler sind sichtbar und lassen sich
erneut versuchen; Schließen bricht laufende Detailabrufe ab.
