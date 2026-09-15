# Mitarbeiter- und Einsatzortkarte

Einstieg: **Tools → Mitarbeiter- & Einsatzortkarte**. Der Eintrag und die Route
`/mitarbeiter-einsatzortkarte` sind derzeit ausschließlich für die Rolle `ADMIN`
freigegeben. Das Fenster verwendet `ModalFrame`, `Toolbar` und `LocationFilter`.
Leaflet und Markercluster werden erst beim Öffnen geladen. OpenStreetMap liefert
außerhalb der Anwendung ausschließlich die Hintergrundkacheln.

## Server-Konfiguration

Die folgenden Variablen gehören in die Server-Umgebung, niemals in `VITE_*`:

```dotenv
MAP_EXTERNAL_PROCESSING_ENABLED=true
MAP_GEOCODING_PROVIDER=mapbox
MAP_ROUTING_PROVIDER=mapbox
MAPBOX_ACCESS_TOKEN=<serverseitiger Mapbox-Token>
MAP_REQUEST_INTERVAL_MS=1100
```

Ohne explizite Freischaltung und Token werden **keine externen Adress- oder
Routing-Anfragen** gesendet. Vorhandene, gültige Cache-Einträge bleiben sichtbar.
Die Einführung muss die externe Verarbeitung der Mitarbeiteradressen abdecken.
Die Hintergrundkacheln werden beim Öffnen der Karte unabhängig davon geladen.

Geocoding verwendet Mapbox v6 mit `permanent=true`, weil Ergebnisse gespeichert
werden. Das Konto muss Permanent Geocoding unterstützen. Siehe
[Mapbox: Speicherung von Geocoding-Ergebnissen](https://docs.mapbox.com/api/search/geocoding/#storing-geocoding-results).
Abgerechnet werden die tatsächlich ausgelösten Provider-Anfragen; ein erster
Backfill kann entsprechend viele Anfragen verursachen.

## Daten und Berechtigungen

`GET /api/personal/map-data` wird im bestehenden Mitarbeiter-Router registriert.
Die Route lädt den Benutzer bei jedem Aufruf neu aus MongoDB und akzeptiert
vorläufig nur `ADMIN`. Damit ist der Schutz nicht auf das ausgeblendete UI oder
die clientseitige Router-Prüfung beschränkt.

| Parameter | Bedeutung |
| --- | --- |
| `entityType` | `mitarbeiter` (Standard) oder `einsatzort` |
| `locationV2` | Standort-ID oder `all` für alle freigegebenen aktiven Standorte |
| `einsatzortId` | Optional, nur im Mitarbeitermodus: Fahrzeiten ab diesem Einsatzort |

Ohne Standortparameter wird die aktuelle Benutzer-Niederlassung ausgewählt.
Fehlt `locationV2`, wird der alte Standortname mit einem aktiven Standort
abgeglichen. Ohne passende Standard-Niederlassung gilt die Menge der erlaubten
Standorte. Jeder Aufruf lädt den bestätigten Benutzer neu aus MongoDB.
Administratoren sehen alle aktiven Standorte; andere Benutzer sehen ihren
eigenen Standort und `locationAccess`. Ein explizit unberechtigter Standort
ergibt 403. Ein Einsatzort außerhalb der aktuellen Auswahl ergibt 404.

Nur aktive Mitarbeiter/Einsatzorte werden angezeigt. Einsatzorte beziehen ihren
Standort über den zugeordneten Kunden. Datensätze ohne zuordenbaren aktiven
Standort und Einsatzorte ohne zugeordneten Kunden werden nicht freigegeben.
Inaktive zentrale Adressen werden nicht geocodiert.

Die Antwort enthält `entries`, optional `origin` und `nearest`, erlaubte
`locations`, einen optionalen Standort-Mittelpunkt und `summary`. Jeder
Adresspunkt enthält nur IDs, Name/Kundenlabel, Standort, Adressart,
formatierte Adresse, Koordinaten und Auflösungsstatus. Kontaktdaten,
Personalnummern und sonstige Personaldaten werden weder projiziert noch
ausgegeben. Antworten tragen `Cache-Control: private, no-store`.
Fehler werden lokal behandelt, ohne die sensiblen Daten und Request-Header an
den bisherigen globalen Error-Logger zu übergeben.

## Auflösung und Cache

- Normalisierte Adressbestandteile ergeben einen SHA-256-Schlüssel. Provider und
  Schlüssel identifizieren gemeinsam einen `Geodata`-Eintrag.
- Gültige Cache-Treffer erzeugen keine Provider-Anfragen. Positive Ergebnisse
  gelten 90 Tage, nicht gefundene Adressen 7 Tage, Providerfehler 5 Minuten.
- Straße und mindestens PLZ oder Ort sind erforderlich. Es werden nur
  Adress-Ergebnisse akzeptiert, keine Stadt-/Land-Mittelpunkte. Ergebnisse mit
  niedriger Match-Konfidenz bleiben unaufgelöst.
- Das API wartet nicht auf alle externen Abfragen. Eine begrenzte, deduplizierte
  Hintergrundwarteschlange verarbeitet Cache-Misses. Das Modal aktualisiert
  ausstehende Daten alle 3 Sekunden; Abfragen werden beim Schließen abgebrochen,
  Hintergrundtab-Polling pausiert. Bereits gestartete Serverarbeit kann fertig
  werden und den Cache füllen.
- Datenbank-Leases verhindern doppelte Auflösung derselben Adresse/Route durch
  mehrere API-Prozesse. Abgelaufene Leases werden bei späteren Anfragen erneut
  beansprucht; ein Prozessneustart verliert keine endgültigen Cache-Ergebnisse.
- Provider-Anfragen sind pro Prozess serialisiert und standardmäßig auf eine
  Anfrage pro 1,1 Sekunden begrenzt. Transiente Fehler werden bis zu zweimal
  mit Wartezeit wiederholt. Bei mehreren API-Instanzen ist das gemeinsame
  Provider-Limit bei der Konfiguration des Intervalls zu berücksichtigen.
  Das Intervall wird auf 100–10.000 Millisekunden begrenzt; ungültige Werte
  verwenden den Standardwert.
- Adressänderungen verwenden sofort einen neuen Schlüssel, auch bei Bulk-Imports.
  Modell-Hooks markieren die alten Schlüssel nach normalen Mitarbeiter-/Adress-
  Änderungen und Einsatzort-Adresswechseln/Löschungen zusätzlich als veraltet.
  `bulkWrite` und direkte Collection-Schreibzugriffe umgehen diese Hooks, können
  aber aufgrund der inhaltsbasierten Schlüssel keine alten Koordinaten einer
  neuen Adresse zuordnen. Nicht erneut aufgelöste Geodaten verfallen nach 180 Tagen.
- Ein Adresswechsel auf bereits bekannte Adressbestandteile nutzt deren Cache.
  Kontaktdaten- oder reine Namensänderungen benötigen kein neues Geocoding.

## Fahrzeiten

Die Matrix API liefert unabhängige PKW-Verbindungen **vom Einsatzort zur
Wohnadresse**. Die Richtung ist im Fenster ausdrücklich bezeichnet. Das Profil
ist `mapbox/driving`, ohne Live-Verkehr und ohne konkrete Abfahrtszeit.
Eine Anfrage enthält den Ausgangspunkt und bis zu 24 Wohnkoordinaten. Siehe
[Mapbox Matrix API](https://docs.mapbox.com/api/navigation/matrix/).

Alle aufgelösten Adressen der Standortauswahl werden berücksichtigt; es gibt
keine Vorauswahl per Luftlinie. Verbindungen werden 6 Stunden gespeichert,
Providerfehler 5 Minuten. Die Antwort liefert die ersten 20, sortiert nach
Dauer in Sekunden und danach Strecke in Metern. Während noch Daten fehlen,
kennzeichnet die Oberfläche die Rangliste als vorläufig. Haupt-/Zweitadresse
derselben Person mit gleichen Koordinaten zählen einmal; unterschiedliche
Wohnadressen bleiben zwei Kandidaten. Unaufgelöste, ausstehende und nicht
befahrbare Einträge bleiben in `nearest.excluded` und in der Adressliste sichtbar.
Eine leere Matrix-Verbindung wird niemals durch Luftlinienentfernung ersetzt.

Provider-Adapter liegen in `services/geodata/`; API und UI sind unabhängig vom
konkreten Anbieter. Ein zusätzlicher Adapter implementiert `geocode(address)`
und/oder `routesFrom(origin, destinations)` und wird in `providers.js` registriert.

## Initialer Backfill

Aus dem `api`-Verzeichnis:

```sh
# Nur zählen, keine Provider-Anfragen und keine Cache-Schreibzugriffe
npm run backfill:map -- --limit=500

# Geocoding freischalten und fehlende/veraltete Einträge gedrosselt auflösen
npm run backfill:map -- --write --limit=500

# Auf einen aktiven Standort begrenzen
npm run backfill:map -- --write --location=OBJECT_ID
```

Das Limit bezieht sich auf eindeutige gültige Adressen einschließlich Cache-
Treffern, in der Reihenfolge Standorte, Mitarbeiter, Einsatzorte. Der Befehl ist
wiederholbar; gültige Ergebnisse werden nicht erneut extern abgefragt. Für einen
vollständigen Backfill das Limit weglassen. Ausgaben enthalten ausschließlich
Zähler, keine Wohnadressen oder Token. Fahrzeiten entstehen erst bei Auswahl
eines Einsatzorts. Der Backfill wurde bei der Implementierung nicht ausgeführt.

## Umfang der Umsetzung

Die Karte unterstützt Entdeckung und Fahrzeitvergleich. Verfügbarkeit,
Schichtkonflikte, Zuweisung und Tourenoptimierung gehören nicht zu diesem Ablauf.
Auf ausdrücklichen Wunsch wurden keine Tests, Builds oder interaktiven
Browserprüfungen ausgeführt.
