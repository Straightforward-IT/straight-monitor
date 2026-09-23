# Überblick

**HR Exchange**

&nbsp;

## Erste Schritte

1. Registrieren/ Anmelden  
2. Organisation beitreten oder anlegen und weitere Nutzer einladen  
3. App erstellen und Credentials erhalten  
4. Produkt abonnieren und APIs anbinden (auf Sandbox)  
5. Auf Produktion upgraden  
   &nbsp;

#### 1\. Registrieren/ Anmelden

Die Anmeldung im DATEV Developer Portal erfolgt mit einem DATEV-Konto. Falls Sie noch keines haben \- einfach [registrieren](https://apps.datev.de/idmui/#/registration/form) und dann [anmelden](https://apps.datev.de/authenticate/#/?goto=https:%2F%2Fsignin.datev.de:443%2Fdatevam%2Foauth2%2Frealms%2Froot%2Frealms%2Fuser%2Fauthorize%3Fclient_id%3Dd8faf827-5e4e-4f45-91e6-94b86dad2165%26response_type%3Dcode%26scope%3Dopenid%2520profile%2520email%26state%3Dabc123%26nonce%3D123abc%26redirect_uri%3Dhttps:%2F%2Fdevportal.datev.de%2Fen&realm=%2Fuser).

&nbsp;

#### 2\. Organisation beitreten oder anlegen und weitere Nutzer einladen

Die Organisation ermöglicht Ihnen Ihr Unternehmen im DATEV Developer Portal zu verwalten, Nutzer einzuladen, Apps anzulegen und damit die Produkte zu nutzen. Erkundigen Sie sich, ob es in Ihrem Unternehmen bereits eine Organisation im DATEV Developer Portal gibt. Der Eigentümer kann Sie im Dashboard unter Nutzer dazu einladen. Sie erhalten eine Einladungsmail. Um eine neue Organisation anzulegen, müssen Sie ein Geschäftspartner von DATEV sein. Falls Sie schon Geschäftspartner von DATEV sind, verbinden Sie Ihre Organisation durch die Eingabe Ihrer Beraternummer mit Ihrem bereits vorhandenen Geschäftspartner. Wenn Sie noch kein Geschäftspartner von DATEV sind und keine Beraternummer haben, wird bei der Anlage ein neuer Geschäftspartner für Sie erstellt.

&nbsp;

#### 3\. App erstellen und Credentials erhalten

Erstellen Sie eine App im Dashboard Ihrer Organisation, um Credentials (Client ID und Client Secret) zu erhalten. Dadurch können Sie Produkte abonnieren, APIs anbinden, und sich mit den Credentials authentifizieren, weitere Informationen finden Sie im Guide [Authentifizierung](https://developer.datev.de/de/guides/authentication).

&nbsp;

#### 4\. Produkt abonnieren und APIs anbinden (auf Sandbox)

Abonnieren Sie die gewünschten Produkte mit Ihrer App und Sie erhalten damit die Berechtigung die enthaltenen APIs anzubinden und auf der Sandbox-Umgebung entwickeln zu können. DATEV stellt zu jeder Online-API eine zugehörige Sandbox zur Verfügung, sofern es in der Dokumentation nicht anders geregelt ist.

&nbsp;

#### 5\. Auf Produktion upgraden

Um eine App auf Produktion hochzustufen, muss sie im Rahmen der technischen Prüfung erfolgreich abgenommen werden, sofern in der Dokumentation nicht anders geregelt.  
Beachten Sie dafür die [Hinweise zum Freigabeprozess](https://go.datev.de/online-api-integration) und buchen Sie dafür einen [Freigabetermin](https://go.datev.de/online-kalender-schnittstellen), um eine Abnahme durchzuführen.

#  **Vorgaben**

## Schnittstellenvorgaben

Der DATEV Lohnaustauschdatenservice eröffnet die Möglichkeit, Personal-, Mandanten- und Bewegungsdaten effizient zwischen den DATEV Lohnabrechnung Systemen und einem vorgelagerten Drittsystem, wie beispielsweise einem HR-System, auszutauschen.

Durch den Einsatz des DATEV Lohnaustauschdatenservices werden kollaborative Prozesse optimiert, die Sicherheit der Datenübertragung gewährleistet und ein automatisierter, bidirektionaler Datenaustausch zwischen dem Drittsystem und dem Lohnabrechnungssystem realisiert.

Im Folgenden wird der Standard-API-Workflow beschrieben, einschließlich der relevanten Online-APIs und Endpunkte, die für die Nutzung der bidirektionalen API erforderlich sind.

Hinweis: Für den Freigabeprozess einer Cloud Integration sind zusätzlich zu den nachfolgenden API-spezifischen Schnittstellenvorgaben  
noch die [Allgemeinen Schnittstellenvorgaben](https://developer.datev.de/de/guides/interface-requirements#allgemeine-schnittstellenvorgaben) zu beachten.

## Use Cases

Folgende Use Cases können mit dem Datenservice umgesetzt werden:

1. Initialer Datenabgleich von Lohnprogramm und Drittsystem  
2. Gehaltsbestandteile lesen, anlegen oder ändern  
3. Mitarbeiterstammdaten abrufen, erstellen oder modifizieren  
4. An- und Abwesenheiten abrufen, erstellen oder modifizieren  
5. Monatliche Bewegungsdaten erfassen (z. B. Stunden, Zuschläge)

MUST: Prüfen Sie, welche der Use Cases für Ihre Integration benötigt werden und teilen Sie diese dem Berater zu Beginn der technischen Prüfung mit.

### 1\. Initialer Datenabgleich von Lohnprogramm und Drittsystem

Mit diesem Use Case werden die bestehenden Mandanten-, Mitarbeiter- und Bewegungsdaten aus dem führenden DATEV-Lohnsystem in das Drittsystem übernommen. Ziel ist die initiale Synchronisation beider Systeme. Die Übernahme erfolgt ausschließlich lesend und basiert auf einem Job-Verfahren. Für die vollständige Umsetzung des Datenservices ist jedoch auch das Schreiben von Daten relevant.

### 2\. Gehaltsbestandteile lesen, anlegen oder ändern

Mit diesem Use Case können zyklische Entgeltbestandteile wie Monatsgehälter oder weitere, regelmäßig wiederkehrende Festbezüge gelesen oder gepflegt werden. Grundlage jeder Änderung ist ein vorab durchgeführter Leseabruf zur Ermittlung gültiger IDs.

### 3\. Mitarbeiterstammdaten abrufen, erstellen oder modifizieren

Mit diesem Use Case können neue Mitarbeiter angelegt sowie bestehende Stammdaten geändert oder ausgelesen werden. Das umfasst z. B. Personalnummer, Adressdaten, Arbeitsverhältnis, Vertragsdaten, SV-Daten usw.

### 4\. An- und Abwesenheiten abrufen, erstellen oder modifizieren

Mit diesem Use Case können Abwesenheiten wie Urlaub, Krankheit oder Sonderurlaub aus dem Lohnsystem gelesen und anschließend im Drittsystem komplett neu angelegt oder gelöscht und neu angelegt werden. Sie können nicht bearbeitet werden, sondern müssen gelöscht und neu angelegt werden. Die Umsetzung unterscheidet sich je nach eingesetztem DATEV-Lohnsystem: LODAS oder Lohn und Gehalt (LuG).

### 5\. Monatliche Bewegungsdaten erfassen

Mit diesem Use Case können monatlich variable Daten wie Überstunden, Nachtzuschläge oder Einmalzahlungen übermittelt werden. Diese Bewegungsdaten fließen in die laufende Lohnabrechnung ein. Änderungen erfolgen durch Storno und erneute Meldung.

&nbsp;

MUST: Korrekturen erfolgen durch Gegenbuchung \+ neue Übermittlung im entsprechenden Abrechnungszeitraum.

&nbsp;

### ONLINE API & ENDPUNKTE für SANDBOX

(Base URL: https://hr-exchange.api.datev.de/platform-sandbox/)

Die Sandbox dient der technischen Prüfung mit Testdaten. Alle Endpunkte der Sandbox sind identisch mit der Produktionsumgebung. Lediglich der Base-Path unterscheidet sich ("/platform-sandbox" vs. "/platform").

#### Initialer Datenabgleich von Lohnprogramm und Drittsystem

Mit diesem Use Case werden die bestehenden Mandanten-, Mitarbeiter- und Bewegungsdaten aus dem führenden DATEV-Lohnsystem in das Drittsystem übernommen. Ziel ist die initiale Synchronisation beider Systeme. Die Übernahme erfolgt ausschließlich lesend und basiert auf einem Job-Verfahren.

##### API-WORKFLOW

1. Prüfung der Berechtigungen  
2. Job anlegen (initialer Abruf)  
3. Verarbeitungsstatus prüfen  
4. Ergebnisdaten abrufen

##### 1\. Prüfung der Berechtigungen

GET /clients/{client-id}

Mit diesem API Request wird geprüft, ob der Kunde die nötigen Voraussetzungen für den Einsatz des Lohnaustauschdatenservices besitzt. Hierfür muss der Kunde in der 3rd-Party App die entsprechende {client-id}, d. h. "Beraternummer-Mandantennummer", bereitstellen.

&nbsp;

MUST: Führen Sie die Berechtigungsprüfung durch. Dem Kunden ist anzuzeigen, ob die Authentifizierung erfolgreich (Statuscode 200\) oder nicht erfolgreich (Statuscode ≠ 200\) war.

&nbsp;

##### 2\. Job anlegen (initialer Abruf)

POST /clients/{client-id}/jobs

Ein Job wird erstellt, um Mandantenstammdaten (client-data), Mitarbeiterdaten (employees) und Bewegungsdaten (month-records) aus dem Lohnsystem bereitzustellen. Der gewünschte Umfang wird im Body angegeben.

&nbsp;

MUST: Erstellen Sie ein oder mehrere Job Requests, um die benötigten Daten zu lesen.

MUST: Vor jeder späteren Neuanlage oder Änderung (z. B. bei Gehaltsdaten) ist ein vollständiger Abruf erforderlich, um eventuelle Stammdifferenzen festzustellen.

&nbsp;

##### 3\. Verarbeitungsstatus prüfen

GET /clients/{client-id}/jobs/{uuid}

Nachdem der POST zur Job-Anlage abgesetzt wurde, muss mindestens 1–2 Minuten auf die Verarbeitung im DATEV-Rechenzentrum gewartet werden. Anschließend kann der Status abgefragt werden.

&nbsp;

MUST: Abfrage des Jobstatus nach mindestens 1 Minute.

MUST: Zyklische Abfragen (Polling) im Abstand von 1 Request/Minute.

MUST: Das Polling ist nach spätestens 15 Minuten zu beenden. Bei unverändertem Status liegt in der Regel ein Fehler vor.

&nbsp;

##### 4\. Ergebnisdaten abrufen

&nbsp;

GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType}\*

&nbsp;

Nach erfolgreicher Verarbeitung liefert das System die abgerufenen Daten getrennt nach Ressourcentyp. Jeder Endpoint muss einzeln aufgerufen werden.

&nbsp;

MUST: Alle drei Ressourcentypen vollständig abrufen und im Drittsystem speichern.

MUST: Die initialen Daten gelten als führend. Abweichungen im Drittsystem sind zu bereinigen.

MUST: Ergebnisse sind zu protokollieren und ggf. an den Anwender anzuzeigen.

&nbsp;

#### Gehaltsbestandteile lesen, anlegen oder ändern

Mit diesem Use Case können zyklische Entgeltbestandteile wie Monatsgehälter oder weitere, regelmäßig wiederkehrende Festbezüge gelesen oder gepflegt werden. Grundlage jeder Änderung ist ein vorab durchgeführter Leseabruf zur Ermittlung gültiger IDs.

##### API-WORKFLOW

1. Prüfung der Berechtigungen  
2. Job anlegen (Abruf der Gehaltsdaten)  
3. Verarbeitungsstatus prüfen  
4. Gehaltsbestandteile lesen (IDs)  
5. Gehaltsbestandteile anlegen oder ändern

##### 1\. Prüfung der Berechtigungen

GET /clients/{client-id}

Mit diesem API Request wird geprüft, ob der Kunde die nötigen Voraussetzungen für den Einsatz des Lohnaustauschdatenservices besitzt. Hierfür muss der Kunde in der 3rd-Party App die entsprechende {client-id}, d. h. "Beraternummer-Mandantennummer", bereitstellen.

&nbsp;

MUST: Führen Sie die Berechtigungsprüfung durch. Dem Kunden ist anzuzeigen, ob die Authentifizierung erfolgreich (Statuscode 200\) oder nicht erfolgreich (Statuscode ≠ 200\) war.

&nbsp;

##### 2\. Job anlegen (Abruf der Gehaltsdaten)

POST /clients/{client-id}/jobs

Ein Job wird erstellt, um aktuelle Gehaltsbestandteile (gross-payments) im DATEV-Rechenzentrum zu erzeugen. Im Request-Body wird die Ressource gross-payments angegeben.

&nbsp;

MUST: Vor jeder Neuanlage oder Änderung ist ein vollständiger Abruf erforderlich, um bestehende IDs zu ermitteln.

MUST: Die Ressource gross-payments muss korrekt im Request-Body angegeben werden.

SHOULD: Ein separater Job pro Mitarbeiter oder Zeitraum erleichtert die Nachverfolgbarkeit.

&nbsp;

##### 3\. Verarbeitungsstatus prüfen

GET /clients/{client-id}/jobs/{uuid}

Nachdem der POST zur Job-Anlage abgesetzt wurde, muss mindestens 1–2 Minuten auf die Verarbeitung im DATEV-Rechenzentrum gewartet werden. Anschließend kann der Status abgefragt werden.

&nbsp;

MUST: Abfrage des Jobstatus nach mindestens 1 Minute.

MUST: Zyklische Abfragen (Polling) im Abstand von 1 Request/Minute.

MUST: Das Polling ist nach spätestens 15 Minuten zu beenden. Bei unverändertem Status liegt in der Regel ein Fehler vor.

&nbsp;

##### 4\. Gehaltsbestandteile lesen (IDs)

GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType}\*/code\>

Nach erfolgreichem Abschluss liefert dieser Endpoint alle vorhandenen Gehaltsbestandteile samt IDs und Zeiträumen.

&nbsp;

MUST: Abruf muss vor jeder Änderung erfolgen. Nur so kann die korrekte Festbezugs-ID ermittelt werden.

&nbsp;

##### 5\. Gehaltsbestandteile anlegen oder ändern

&nbsp;

POST /clients/{client-id}/employees/{personnel-number}/gross-payments

PUT  /clients/{client-id}/employees/{personnel-number}/gross-payments/{gross-payment-id}

&nbsp;

Neue Festbezüge (POST) oder Änderungen bestehender (PUT) werden mit vollständiger ID und Zeitraum übermittelt.

&nbsp;

MUST: Nutzung der korrekten, zuvor abgerufenen Festbezugs-IDs ist Pflicht.

MUST: Änderungen ohne vorherigen Abruf führen zu Fehlern.

SHOULD: Pro Änderung nur ein Eintrag je Zeitraum und Personalnummer übergeben.

&nbsp;

#### Mitarbeiterstammdaten abrufen, erstellen oder modifizieren

Mit diesem Use Case können neue Mitarbeiter im DATEV-Lohnsystem angelegt oder bestehende Stammdaten (z. B. Adresse, Steuer-ID, SV-Daten) abgerufen bzw. angepasst werden. Grundlage für jede Änderung sollte ein vorheriger Abruf der Daten sein.

##### API-WORKFLOW

1. Prüfung der Berechtigungen  
2. Job anlegen (Abruf der Mitarbeiterdaten)  
3. Verarbeitungsstatus prüfen  
4. Mitarbeiterdaten lesen  
5. Mitarbeiter anlegen oder ändern

##### 1\. Prüfung der Berechtigungen

GET /clients/{client-id}

Mit diesem API Request wird geprüft, ob der Kunde die nötigen Voraussetzungen für den Einsatz des Lohnaustauschdatenservices besitzt. Hierfür muss der Kunde in der 3rd-Party App die entsprechende {client-id}, d. h. "Beraternummer-Mandantennummer", bereitstellen.

&nbsp;

MUST: Führen Sie die Berechtigungsprüfung durch. Dem Kunden ist anzuzeigen, ob die Authentifizierung erfolgreich (Statuscode 200\) oder nicht erfolgreich (Statuscode ≠ 200\) war.

&nbsp;

##### 2\. Job anlegen (Abruf der Mitarbeiterdaten)

POST /clients/{client-id}/jobs

Ein Job wird erstellt, um Mitarbeiterstammdaten (employees) im DATEV-Rechenzentrum bereitzustellen. Der gewünschte Umfang wird im Body angegeben.

&nbsp;

MUST: Vor jeder Änderung ist ein vollständiger Abruf erforderlich, um bestehende Datenstände und IDs zu ermitteln.

MUST: Die Ressource employees muss korrekt im Request-Body angegeben werden.

SHOULD: Pro Abfragezeitraum oder Mitarbeitergruppe separate Jobs anlegen.

&nbsp;

##### 3\. Verarbeitungsstatus prüfen

GET /clients/{client-id}/jobs/{uuid}

Nach dem POST zur Job-Anlage sollte mindestens 1–2 Minuten gewartet werden, bevor der Verarbeitungsstatus abgefragt wird.

&nbsp;

MUST: Status frühestens nach 1 Minute abfragen.

MUST: Polling nicht häufiger als alle 60 Sekunden.

MUST: Nach 15 Minuten ohne Änderung abbrechen und Fehler dokumentieren.

&nbsp;

##### 4\. Mitarbeiterdaten lesen

GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType}\*

Dieser Endpoint liefert die abgerufenen Mitarbeiterstammdaten mit vollständiger Struktur zur weiteren Verarbeitung.

&nbsp;

MUST: Abruf und Analyse vor jeder Anlage oder Änderung notwendig.

MUST: Daten lokal speichern oder weiterverarbeiten.

&nbsp;

##### 5\. Mitarbeiter anlegen oder ändern

&nbsp;

POST /clients/{client-id}/employees

PUT  /clients/{client-id}/employees/{personnel-number}

&nbsp;

Neue Mitarbeiter werden via POST angelegt. Änderungen an bestehenden Datensätzen erfolgen via PUT. Die Personalnummer dient als eindeutiger Schlüssel.

&nbsp;

MUST: Alle Pflichtfelder gemäß Spezifikation müssen übermittelt werden.

MUST: Personalnummern müssen eindeutig sein.

MUST: Ein zweiter POST mit derselben Personalnummer muss vom System abgefangen werden.

SHOULD: Verwenden Sie PUT, wenn der Mitarbeiter bereits existiert.

COULD: Wird keine Personalnummer angegeben, kann das Lohnsystem automatisch eine neue vergeben.

COULD: Wenn ein Stundenlohn gepflegt werden soll, kann dieser entweder direkt bei der Anlage übergeben oder anschließend separat über

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;POST /clients/{client-id}/employees/{personnel-number}/hourly-wages erfasst werden.

&nbsp;

#### An- und Abwesenheiten abrufen, erstellen oder modifizieren

Mit diesem Use Case können Abwesenheiten wie Urlaub, Krankheit oder Sonderurlaub aus dem Lohnsystem gelesen und anschließend im Drittsystem neu angelegt oder verändert werden. Die Umsetzung unterscheidet sich je nach eingesetztem DATEV-Lohnsystem: LODAS oder Lohn und Gehalt (LuG).

##### API-WORKFLOW

1. Prüfung der Berechtigungen  
2. Job anlegen (Abruf der Abwesenheiten)  
3. Verarbeitungsstatus prüfen  
4. Abwesenheiten lesen (per Ergebnis-Endpunkt)  
5. Abwesenheiten anlegen oder ändern

##### 1\. Prüfung der Berechtigungen

GET /clients/{client-id}

Mit diesem API Request wird geprüft, ob der Kunde die nötigen Voraussetzungen für den Einsatz des Lohnaustauschdatenservices besitzt. Hierfür muss der Kunde in der 3rd-Party App die entsprechende {client-id}, d. h. "Beraternummer-Mandantennummer", bereitstellen.

&nbsp;

MUST: Führen Sie die Berechtigungsprüfung durch. Dem Kunden ist anzuzeigen, ob die Authentifizierung erfolgreich (Statuscode 200\) oder nicht erfolgreich (Statuscode ≠ 200\) war.

&nbsp;

##### 2\. Job anlegen (Abruf der Abwesenheiten)

POST /clients/{client-id}/jobs

Ein Job wird erstellt, um aktuelle Abwesenheitsdaten (absences) im DATEV-Rechenzentrum bereitzustellen. Die Ressource absences wird im Request-Body spezifiziert.

&nbsp;

MUST: Vor jeder Neuanlage oder Änderung ist ein vollständiger Abruf erforderlich.

MUST: Die Ressource absences muss im Request korrekt gesetzt sein.

&nbsp;

##### 3\. Verarbeitungsstatus prüfen

GET /clients/{client-id}/jobs/{uuid}

Nach der Job-Anlage muss der Status regelmäßig abgefragt werden, bis die Verarbeitung abgeschlossen ist.

&nbsp;

MUST: Erste Statusabfrage frühestens nach 1 Minute.

MUST: Nur 1 Polling-Request pro Minute erlaubt.

MUST: Polling nach 15 Minuten ohne Statusänderung abbrechen.

&nbsp;

##### 4\. Abwesenheiten lesen

GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType}\*

Der Endpoint liefert alle vorhandenen Abwesenheiten mit Startdatum, Typ, System und ggf. ID. Diese Werte werden für spätere PUT-Requests benötigt.

&nbsp;

MUST: Die Daten müssen vollständig übernommen und analysiert werden.

MUST: Jede Abwesenheit muss eindeutig über Startdatum \+ Typ (LODAS) oder ID (LuG) identifiziert werden.

&nbsp;

##### 5\. Abwesenheiten anlegen oder ändern

Für LODAS:

&nbsp;

POST /clients/{client-id}/employees/{personnel-number}/absences/lodas

PUT  /clients/{client-id}/employees/{personnel-number}/absences/lodas/{absence-start-date}

&nbsp;

Die Verarbeitung erfolgt über Startdatum und Abwesenheitsart. Änderungen müssen auf dem korrekten Datum basieren.

&nbsp;

MUST: Nur gültige Kombinationen aus Startdatum, Abwesenheitsart und Personalnummer zulässig.

MUST: Fehlerhafte Kombinationen führen zu Abbruch.

&nbsp;

Für Lohn und Gehalt (LuG):

&nbsp;

POST /clients/{client-id}/employees/{personnel-number}/absences/lug

PUT  /clients/{client-id}/employees/{personnel-number}/absences/lug/{absence-id}

&nbsp;

Hier erfolgt die Identifikation über eine eindeutige Abwesenheits-ID aus dem vorherigen Abruf. Jede Änderung muss sich exakt auf diese ID beziehen.

&nbsp;

MUST: Nur gültige LuG-Abwesenheitstypen übermitteln.

MUST: Die ID muss exakt mit der beim GET-Abruf erhaltenen übereinstimmen.

&nbsp;

#### Monatliche Bewegungsdaten erfassen (z. B. Stunden, Zuschläge)

Mit diesem Use Case können monatlich variable Daten wie Überstunden, Nachtzuschläge oder Einmalzahlungen übermittelt werden. Diese Bewegungsdaten fließen in die laufende Lohnabrechnung ein. Änderungen erfolgen durch Storno und erneute Meldung.

##### API-WORKFLOW

1. Prüfung der Berechtigungen  
2. Job anlegen (Abruf der Monatsdaten)  
3. Verarbeitungsstatus prüfen  
4. Monatsdaten lesen (per Ergebnis-Endpunkt)  
5. Monatsdaten anlegen oder ändern

##### 1\. Prüfung der Berechtigungen

GET /clients/{client-id}

Mit diesem API Request wird geprüft, ob der Kunde die nötigen Voraussetzungen für den Einsatz des Lohnaustauschdatenservices besitzt. Hierfür muss der Kunde in der 3rd-Party App die entsprechende {client-id}, d. h. "Beraternummer-Mandantennummer", bereitstellen.

&nbsp;

MUST: Führen Sie die Berechtigungsprüfung durch. Dem Kunden ist anzuzeigen, ob die Authentifizierung erfolgreich (Statuscode 200\) oder nicht erfolgreich (Statuscode ≠ 200\) war.

&nbsp;

##### 2\. Job anlegen (Abruf der Monatsdaten)

POST /clients/{client-id}/jobs

Ein Job wird erstellt, um Bewegungsdaten (month-records) im DATEV-Rechenzentrum aufzubereiten. Die Ressource month-records wird im Body angegeben.

&nbsp;

MUST: Vor jeder Neuanlage oder Änderung ist ein Abruf erforderlich, um bestehende Monatswerte zu erkennen.

MUST: Die Ressource month-records muss korrekt im Request-Body angegeben werden.

&nbsp;

##### 3\. Verarbeitungsstatus prüfen

GET /clients/{client-id}/jobs/{uuid}

Nach dem POST zur Job-Anlage sollte mindestens 1–2 Minuten gewartet werden, bevor der Verarbeitungsstatus geprüft wird.

&nbsp;

MUST: Status frühestens nach 1 Minute prüfen.

MUST: Nur 1 Abfrage pro Minute.

MUST: Nach 15 Minuten ohne Fortschritt beenden.

&nbsp;

##### 4\. Monatsdaten lesen

GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType}\*

Dieser Endpoint liefert bestehende Monatsdaten zur weiteren Auswertung und möglichen Anpassung.

&nbsp;

MUST: Vor jedem Schreiben prüfen, ob bereits ein Eintrag für denselben Monat und Typ vorhanden ist.

SHOULD: Wiederholungen vermeiden – doppelte Bewegungsarten pro Monat verhindern.

&nbsp;

##### 5\. Monatsdaten anlegen oder ändern

POST /clients/{client-id}/month-records

Mit diesem Endpoint werden neue monatliche Einträge für Überstunden, Zuschläge oder Einmalzahlungen übermittelt.

&nbsp;

MUST: Jeder Eintrag muss Personalnummer, Zeitraum, Lohnart und Wert enthalten.

MUST: Änderungen erfolgen durch Gegenbuchung (negativer Wert) und erneute korrekte Übermittlung im enstsprechenden Zeitraum.

SHOULD: Klar definierte Zeiträume und Typen verwenden.

&nbsp;

## ONLINE API & ENDPUNKTE für PRODUKTION

Base URL: https://hr-exchange.api.datev.de/platform/

MUST: Die Tests in der produktiven Umgebung MÜSSEN aus einem dafür vorgesehenen, eingerichteten Testsystem erfolgen. Es dürfen ausschließlich Musterdaten verwendet werden. Der Zugriff auf produktive Echtdaten ist im Rahmen der Abnahme strikt untersagt. Wir empfehlen bereits zu Beginn der Integration einen gesonderten Testbestand einzurichten.

### Use Cases

In der Produktionsumgebung gelten dieselben Use Cases wie in der Sandbox, jedoch mit besonderem Fokus auf Validität, Datenintegrität und UI-konforme Fehlerbehandlung:

1. Initialer Datenabgleich von Lohnprogramm und Drittsystem  
2. Gehaltsbestandteile lesen, anlegen oder ändern  
3. Mitarbeiterstammdaten abrufen, erstellen oder modifizieren  
4. An- und Abwesenheiten abrufen, erstellen oder modifizieren  
5. Monatliche Bewegungsdaten erfassen (z. B. Stunden, Zuschläge)

### API-WORKFLOW (Produktion)

Die folgende Struktur gilt für alle produktiv geprüften Use Cases. Die API-Endpunkte sind identisch zur Sandbox, jedoch ist zwingend ein produktiver Mandantenbestand zu verwenden, der ausschließlich aus zuvor eingerichteten Musterdaten besteht. Echtdaten oder produktiv genutzte Personalfälle dürfen nicht verwendet werden.

1. Prüfung der Berechtigungen (GET /clients/{client-id})  
2. Job anlegen (POST /clients/{client-id}/jobs)  
3. Verarbeitungsstatus prüfen (GET /clients/{client-id}/jobs/{uuid})  
4. Ergebnisdaten abrufen (GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType})  
5. Erstellen oder Ändern der Daten (z. B. POST/PUT /employees, /gross-payments, /absences)

### Produktionsspezifische Persistenz-Prüfungen

Die folgenden Prüfungen gelten ausschließlich für die produktive Umgebung, da sie dort technisch relevant und validierbar sind.

&nbsp;

MUST: Nach jeder Neuanlage oder Änderung muss ein GET-Job durchgeführt werden, um die Persistenz der Daten zu prüfen.

MUST: Ein zweiter POST-Vorgang mit bereits verwendeter Personalnummer muss produktiv einen Fehler auslösen (z. B. 409 Conflict).

MUST: Jede PUT-Änderung muss durch erneuten GET-Job validiert und im System nachvollziehbar gespeichert sein.

MUST: Die produktive Änderung muss in Folgeprozessen technisch nachweisbar sein.

&nbsp;

#### Initialer Datenabgleich von Lohnprogramm und Drittsystem

Mit diesem Use Case werden die bestehenden Mandanten-, Mitarbeiter- und Bewegungsdaten aus dem führenden DATEV-Lohnsystem in das Drittsystem übernommen. Ziel ist die initiale Synchronisation beider Systeme. Die Übernahme erfolgt ausschließlich lesend und basiert auf einem Job-Verfahren.

##### API-WORKFLOW

1. Prüfung der Berechtigungen  
2. Job anlegen (initialer Abruf)  
3. Verarbeitungsstatus prüfen  
4. Ergebnisdaten abrufen

##### 1\. Prüfung der Berechtigungen

GET /clients/{client-id}

Mit diesem API Request wird geprüft, ob der Kunde die nötigen Voraussetzungen für den Einsatz des Lohnaustauschdatenservices besitzt. Hierfür muss der Kunde in der 3rd-Party App die entsprechende {client-id}, d. h. "Beraternummer-Mandantennummer", bereitstellen.

&nbsp;

MUST: Führen Sie die Berechtigungsprüfung durch. Dem Kunden ist anzuzeigen, ob die Authentifizierung erfolgreich (Statuscode 200\) oder nicht erfolgreich (Statuscode ≠ 200\) war.

&nbsp;

##### 2\. Job anlegen (initialer Abruf)

POST /clients/{client-id}/jobs

Ein Job wird erstellt, um Mandantenstammdaten (client-data), Mitarbeiterdaten (employees) und Bewegungsdaten (month-records) aus dem Lohnsystem bereitzustellen. Der gewünschte Umfang wird im Body angegeben.

&nbsp;

MUST: Erstellen Sie ein oder mehrere Job Requests, um die benötigten Daten zu lesen.

MUST: Vor jeder späteren Neuanlage oder Änderung (z. B. bei Gehaltsdaten) ist ein vollständiger Abruf erforderlich, um eventuelle Stammdifferenzen festzustellen.

&nbsp;

##### 3\. Verarbeitungsstatus prüfen

GET /clients/{client-id}/jobs/{uuid}

Nachdem der POST zur Job-Anlage abgesetzt wurde, muss mindestens 1–2 Minuten auf die Verarbeitung im DATEV-Rechenzentrum gewartet werden. Anschließend kann der Status abgefragt werden.

&nbsp;

MUST: Abfrage des Jobstatus nach mindestens 1 Minute.

MUST: Zyklische Abfragen (Polling) im Abstand von 1 Request/Minute.

MUST: Das Polling ist nach spätestens 15 Minuten zu beenden. Bei unverändertem Status liegt in der Regel ein Fehler vor.

&nbsp;

##### 4\. Ergebnisdaten abrufen

&nbsp;

GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType}\*

&nbsp;

Nach erfolgreicher Verarbeitung liefert das System die abgerufenen Daten getrennt nach Ressourcentyp. Jeder Endpoint muss einzeln aufgerufen werden.

&nbsp;

MUST: Alle drei Ressourcentypen vollständig abrufen und im Drittsystem speichern.

MUST: Die initialen Daten gelten als führend. Abweichungen im Drittsystem sind zu bereinigen.

MUST: Ergebnisse sind zu protokollieren und ggf. an den Anwender anzuzeigen.

&nbsp;

#### Gehaltsbestandteile lesen, anlegen oder ändern

Mit diesem Use Case können zyklische Entgeltbestandteile wie Monatsgehälter oder weitere, regelmäßig wiederkehrende Festbezüge gelesen oder gepflegt werden. Grundlage jeder Änderung ist ein vorab durchgeführter Leseabruf zur Ermittlung gültiger IDs.

##### API-WORKFLOW

1. Prüfung der Berechtigungen  
2. Job anlegen (Abruf der Gehaltsdaten)  
3. Verarbeitungsstatus prüfen  
4. Gehaltsbestandteile lesen (IDs)  
5. Gehaltsbestandteile anlegen oder ändern

##### 1\. Prüfung der Berechtigungen

GET /clients/{client-id}

Mit diesem API Request wird geprüft, ob der Kunde die nötigen Voraussetzungen für den Einsatz des Lohnaustauschdatenservices besitzt. Hierfür muss der Kunde in der 3rd-Party App die entsprechende {client-id}, d. h. "Beraternummer-Mandantennummer", bereitstellen.

&nbsp;

MUST: Führen Sie die Berechtigungsprüfung durch. Dem Kunden ist anzuzeigen, ob die Authentifizierung erfolgreich (Statuscode 200\) oder nicht erfolgreich (Statuscode ≠ 200\) war.

&nbsp;

##### 2\. Job anlegen (Abruf der Gehaltsdaten)

POST /clients/{client-id}/jobs

Ein Job wird erstellt, um aktuelle Gehaltsbestandteile (gross-payments) im DATEV-Rechenzentrum zu erzeugen. Im Request-Body wird die Ressource gross-payments angegeben.

&nbsp;

MUST: Vor jeder Neuanlage oder Änderung ist ein vollständiger Abruf erforderlich, um bestehende IDs zu ermitteln.

MUST: Die Ressource gross-payments muss korrekt im Request-Body angegeben werden.

SHOULD: Ein separater Job pro Mitarbeiter oder Zeitraum erleichtert die Nachverfolgbarkeit.

&nbsp;

##### 3\. Verarbeitungsstatus prüfen

GET /clients/{client-id}/jobs/{uuid}

Nachdem der POST zur Job-Anlage abgesetzt wurde, muss mindestens 1–2 Minuten auf die Verarbeitung im DATEV-Rechenzentrum gewartet werden. Anschließend kann der Status abgefragt werden.

&nbsp;

MUST: Abfrage des Jobstatus nach mindestens 1 Minute.

MUST: Zyklische Abfragen (Polling) im Abstand von 1 Request/Minute.

MUST: Das Polling ist nach spätestens 15 Minuten zu beenden. Bei unverändertem Status liegt in der Regel ein Fehler vor.

&nbsp;

##### 4\. Gehaltsbestandteile lesen (IDs)

GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType}\*/code\>

Nach erfolgreichem Abschluss liefert dieser Endpoint alle vorhandenen Gehaltsbestandteile samt IDs und Zeiträumen.

&nbsp;

MUST: Abruf muss vor jeder Änderung erfolgen. Nur so kann die korrekte Festbezugs-ID ermittelt werden.

&nbsp;

##### 5\. Gehaltsbestandteile anlegen oder ändern

&nbsp;

POST /clients/{client-id}/employees/{personnel-number}/gross-payments

PUT  /clients/{client-id}/employees/{personnel-number}/gross-payments/{gross-payment-id}

&nbsp;

Neue Festbezüge (POST) oder Änderungen bestehender (PUT) werden mit vollständiger ID und Zeitraum übermittelt.

&nbsp;

MUST: Nutzung der korrekten, zuvor abgerufenen Festbezugs-IDs ist Pflicht.

MUST: Änderungen ohne vorherigen Abruf führen zu Fehlern.

SHOULD: Pro Änderung nur ein Eintrag je Zeitraum und Personalnummer übergeben.

&nbsp;

#### Mitarbeiterstammdaten abrufen, erstellen oder modifizieren

Mit diesem Use Case können neue Mitarbeiter im DATEV-Lohnsystem angelegt oder bestehende Stammdaten (z. B. Adresse, Steuer-ID, SV-Daten) abgerufen bzw. angepasst werden. Grundlage für jede Änderung sollte ein vorheriger Abruf der Daten sein.

##### API-WORKFLOW

1. Prüfung der Berechtigungen  
2. Job anlegen (Abruf der Mitarbeiterdaten)  
3. Verarbeitungsstatus prüfen  
4. Mitarbeiterdaten lesen  
5. Mitarbeiter anlegen oder ändern

##### 1\. Prüfung der Berechtigungen

GET /clients/{client-id}

Mit diesem API Request wird geprüft, ob der Kunde die nötigen Voraussetzungen für den Einsatz des Lohnaustauschdatenservices besitzt. Hierfür muss der Kunde in der 3rd-Party App die entsprechende {client-id}, d. h. "Beraternummer-Mandantennummer", bereitstellen.

&nbsp;

MUST: Führen Sie die Berechtigungsprüfung durch. Dem Kunden ist anzuzeigen, ob die Authentifizierung erfolgreich (Statuscode 200\) oder nicht erfolgreich (Statuscode ≠ 200\) war.

&nbsp;

##### 2\. Job anlegen (Abruf der Mitarbeiterdaten)

POST /clients/{client-id}/jobs

Ein Job wird erstellt, um Mitarbeiterstammdaten (employees) im DATEV-Rechenzentrum bereitzustellen. Der gewünschte Umfang wird im Body angegeben.

&nbsp;

MUST: Vor jeder Änderung ist ein vollständiger Abruf erforderlich, um bestehende Datenstände und IDs zu ermitteln.

MUST: Die Ressource employees muss korrekt im Request-Body angegeben werden.

SHOULD: Pro Abfragezeitraum oder Mitarbeitergruppe separate Jobs anlegen.

&nbsp;

##### 3\. Verarbeitungsstatus prüfen

GET /clients/{client-id}/jobs/{uuid}

Nach dem POST zur Job-Anlage sollte mindestens 1–2 Minuten gewartet werden, bevor der Verarbeitungsstatus abgefragt wird.

&nbsp;

MUST: Status frühestens nach 1 Minute abfragen.

MUST: Polling nicht häufiger als alle 60 Sekunden.

MUST: Nach 15 Minuten ohne Änderung abbrechen und Fehler dokumentieren.

&nbsp;

##### 4\. Mitarbeiterdaten lesen

GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType}\*

Dieser Endpoint liefert die abgerufenen Mitarbeiterstammdaten mit vollständiger Struktur zur weiteren Verarbeitung.

&nbsp;

MUST: Abruf und Analyse vor jeder Anlage oder Änderung notwendig.

MUST: Daten lokal speichern oder weiterverarbeiten.

&nbsp;

##### 5\. Mitarbeiter anlegen oder ändern

&nbsp;

POST /clients/{client-id}/employees

PUT  /clients/{client-id}/employees/{personnel-number}

&nbsp;

Neue Mitarbeiter werden via POST angelegt. Änderungen an bestehenden Datensätzen erfolgen via PUT. Die Personalnummer dient als eindeutiger Schlüssel.

&nbsp;

MUST: Alle Pflichtfelder gemäß Spezifikation müssen übermittelt werden.

MUST: Personalnummern müssen eindeutig sein.

MUST: Ein zweiter POST mit derselben Personalnummer muss vom System abgefangen werden.

SHOULD: Verwenden Sie PUT, wenn der Mitarbeiter bereits existiert.

COULD: Wird keine Personalnummer angegeben, kann das Lohnsystem automatisch eine neue vergeben.

COULD: Wenn ein Stundenlohn gepflegt werden soll, kann dieser entweder direkt bei der Anlage übergeben oder anschließend separat über

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;POST /clients/{client-id}/employees/{personnel-number}/hourly-wages erfasst werden.

&nbsp;

#### An- und Abwesenheiten abrufen, erstellen oder modifizieren

Mit diesem Use Case können Abwesenheiten wie Urlaub, Krankheit oder Sonderurlaub aus dem Lohnsystem gelesen und anschließend im Drittsystem neu angelegt oder verändert werden. Die Umsetzung unterscheidet sich je nach eingesetztem DATEV-Lohnsystem: LODAS oder Lohn und Gehalt (LuG).

##### API-WORKFLOW

1. Prüfung der Berechtigungen  
2. Job anlegen (Abruf der Abwesenheiten)  
3. Verarbeitungsstatus prüfen  
4. Abwesenheiten lesen (per Ergebnis-Endpunkt)  
5. Abwesenheiten anlegen oder ändern

##### 1\. Prüfung der Berechtigungen

GET /clients/{client-id}

Mit diesem API Request wird geprüft, ob der Kunde die nötigen Voraussetzungen für den Einsatz des Lohnaustauschdatenservices besitzt. Hierfür muss der Kunde in der 3rd-Party App die entsprechende {client-id}, d. h. "Beraternummer-Mandantennummer", bereitstellen.

&nbsp;

MUST: Führen Sie die Berechtigungsprüfung durch. Dem Kunden ist anzuzeigen, ob die Authentifizierung erfolgreich (Statuscode 200\) oder nicht erfolgreich (Statuscode ≠ 200\) war.

&nbsp;

##### 2\. Job anlegen (Abruf der Abwesenheiten)

POST /clients/{client-id}/jobs

Ein Job wird erstellt, um aktuelle Abwesenheitsdaten (absences) im DATEV-Rechenzentrum bereitzustellen. Die Ressource absences wird im Request-Body spezifiziert.

&nbsp;

MUST: Vor jeder Neuanlage oder Änderung ist ein vollständiger Abruf erforderlich.

MUST: Die Ressource absences muss im Request korrekt gesetzt sein.

&nbsp;

##### 3\. Verarbeitungsstatus prüfen

GET /clients/{client-id}/jobs/{uuid}

Nach der Job-Anlage muss der Status regelmäßig abgefragt werden, bis die Verarbeitung abgeschlossen ist.

&nbsp;

MUST: Erste Statusabfrage frühestens nach 1 Minute.

MUST: Nur 1 Polling-Request pro Minute erlaubt.

MUST: Polling nach 15 Minuten ohne Statusänderung abbrechen.

&nbsp;

##### 4\. Abwesenheiten lesen

GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType}\*

Der Endpoint liefert alle vorhandenen Abwesenheiten mit Startdatum, Typ, System und ggf. ID. Diese Werte werden für spätere PUT-Requests benötigt.

&nbsp;

MUST: Die Daten müssen vollständig übernommen und analysiert werden.

MUST: Jede Abwesenheit muss eindeutig über Startdatum \+ Typ (LODAS) oder ID (LuG) identifiziert werden.

&nbsp;

##### 5\. Abwesenheiten anlegen oder ändern

Für LODAS:

&nbsp;

POST /clients/{client-id}/employees/{personnel-number}/absences/lodas

PUT  /clients/{client-id}/employees/{personnel-number}/absences/lodas/{absence-start-date}

&nbsp;

Die Verarbeitung erfolgt über Startdatum und Abwesenheitsart. Änderungen müssen auf dem korrekten Datum basieren.

&nbsp;

MUST: Nur gültige Kombinationen aus Startdatum, Abwesenheitsart und Personalnummer zulässig.

MUST: Fehlerhafte Kombinationen führen zu Abbruch.

&nbsp;

Für Lohn und Gehalt (LuG):

&nbsp;

POST /clients/{client-id}/employees/{personnel-number}/absences/lug

PUT  /clients/{client-id}/employees/{personnel-number}/absences/lug/{absence-id}

&nbsp;

Hier erfolgt die Identifikation über eine eindeutige Abwesenheits-ID aus dem vorherigen Abruf. Jede Änderung muss sich exakt auf diese ID beziehen.

&nbsp;

MUST: Nur gültige LuG-Abwesenheitstypen übermitteln.

MUST: Die ID muss exakt mit der beim GET-Abruf erhaltenen übereinstimmen.

&nbsp;

#### Monatliche Bewegungsdaten erfassen (z. B. Stunden, Zuschläge)

Mit diesem Use Case können monatlich variable Daten wie Überstunden, Nachtzuschläge oder Einmalzahlungen übermittelt werden. Diese Bewegungsdaten fließen in die laufende Lohnabrechnung ein. Änderungen erfolgen durch Storno und erneute Meldung.

##### API-WORKFLOW

1. Prüfung der Berechtigungen  
2. Job anlegen (Abruf der Monatsdaten)  
3. Verarbeitungsstatus prüfen  
4. Monatsdaten lesen (per Ergebnis-Endpunkt)  
5. Monatsdaten anlegen oder ändern

##### 1\. Prüfung der Berechtigungen

GET /clients/{client-id}

Mit diesem API Request wird geprüft, ob der Kunde die nötigen Voraussetzungen für den Einsatz des Lohnaustauschdatenservices besitzt. Hierfür muss der Kunde in der 3rd-Party App die entsprechende {client-id}, d. h. "Beraternummer-Mandantennummer", bereitstellen.

&nbsp;

MUST: Führen Sie die Berechtigungsprüfung durch. Dem Kunden ist anzuzeigen, ob die Authentifizierung erfolgreich (Statuscode 200\) oder nicht erfolgreich (Statuscode ≠ 200\) war.

&nbsp;

##### 2\. Job anlegen (Abruf der Monatsdaten)

POST /clients/{client-id}/jobs

Ein Job wird erstellt, um Bewegungsdaten (month-records) im DATEV-Rechenzentrum aufzubereiten. Die Ressource month-records wird im Body angegeben.

&nbsp;

MUST: Vor jeder Neuanlage oder Änderung ist ein Abruf erforderlich, um bestehende Monatswerte zu erkennen.

MUST: Die Ressource month-records muss korrekt im Request-Body angegeben werden.

&nbsp;

##### 3\. Verarbeitungsstatus prüfen

GET /clients/{client-id}/jobs/{uuid}

Nach dem POST zur Job-Anlage sollte mindestens 1–2 Minuten gewartet werden, bevor der Verarbeitungsstatus geprüft wird.

&nbsp;

MUST: Status frühestens nach 1 Minute prüfen.

MUST: Nur 1 Abfrage pro Minute.

MUST: Nach 15 Minuten ohne Fortschritt beenden.

&nbsp;

##### 4\. Monatsdaten lesen

GET /clients/{client-id}/jobs/{uuid}/result/{ressourceType}\*

Dieser Endpoint liefert bestehende Monatsdaten zur weiteren Auswertung und möglichen Anpassung.

&nbsp;

MUST: Vor jedem Schreiben prüfen, ob bereits ein Eintrag für denselben Monat und Typ vorhanden ist.

SHOULD: Wiederholungen vermeiden – doppelte Bewegungsarten pro Monat verhindern.

&nbsp;

##### 5\. Monatsdaten anlegen oder ändern

POST /clients/{client-id}/month-records

Mit diesem Endpoint werden neue monatliche Einträge für Überstunden, Zuschläge oder Einmalzahlungen übermittelt.

&nbsp;

MUST: Jeder Eintrag muss Personalnummer, Zeitraum, Lohnart und Wert enthalten.

MUST: Änderungen erfolgen durch Gegenbuchung (negativer Wert) und erneute korrekte Übermittlung im entsprechenden Zeitraum.

SHOULD: Klar definierte Zeiträume und Typen verwenden.

## Implementierungsinformation

### Unterstützung bei der Umsetzung

Die Anmeldung zur Integration unserer Online-APIs ist über unser Anmeldeformular möglich. Die technische Integration der DATEV-Datendienste kann von allen interessierten Softwareanbietern umgesetzt werden, entsprechende Informationen sind unter folgendem Link verfügbar:

[So integrieren Sie einen DATEV-Datendienst](https://developer.datev.de/datev/platform/online-api-integration)

### GoBD-Konformität

Der Anwender muss Dokumente GoBD-konform digitalisieren und archivieren. Die Datensätze und elektronischen Dokumente, die beim Kunden erstellt oder digital an das Unternehmen des Anwenders übermittelt wurden, müssen ab der Übertragung über hr:exchange unverändert und in ihrer ursprünglichen Form in der Drittlösung des Softwareanbieters aufbewahrt werden.

DATEV ist nicht dafür verantwortlich, den Anwender darüber zu informieren, dass bei der Übertragung ein Fehler aufgetreten ist. Nach jeder Anfrage erhält die Drittlösung eine Antwort von DATEV, die vom Anwender geprüft und gemeldet werden muss.

### Anforderungen an die Autorisierung mittels OAuth-Verfahren

Beim Abmelden aus der Anwendung des Softwareanbieters muss auch die Verbindung zum DATEV-System getrennt werden. Nach jedem Abmelden muss sich der Benutzer erneut an der Anwendung des Softwareanbieters anmelden und sich erneut bei DATEV authentifizieren. Bei browserbasierten Anwendungen gilt dies auch bei jedem Schließen des Browsers.

Die Anwendung des Softwareanbieters muss sicherstellen, dass der Zugriffstoken nach einem Abmelden ungültig wird und ein neuer Zugriffstoken eingeholt werden muss. Der Zugriffstoken darf nicht für mehrere Benutzer und mehrere HTTP-Sitzungen gespeichert werden. Auch beim Anmelden in der Anwendung des Softwareanbieters in einem weiteren Browserfenster oder auf einem anderen Gerät muss erneut eine Authentifizierung bei DATEV erfolgen.

Auch nach dem Abmelden des Benutzers aus der Anwendung des Softwareanbieters kann die Anwendung den Zugriffstoken noch verwenden, um bereits gestartete Anfragen abzuschließen. Allerdings muss der Benutzer den Authentifizierungsprozess nach einem erneuten Login wiederholen, wenn er Daten an DATEV überträgt.

### Abwärtskompatibilität

Die Anwendung des Softwareanbieters muss abwärtskompatibel implementiert werden, damit sie nach den folgenden Änderungen weiterhin funktioniert:

Zu einer bestehenden Ressource wird eine neue Ressource mit einer neuen URI hinzugefügt, die ein neues http-Verb unterstützt. Eine Ressource unterstützt einen zusätzlichen Medientyp, der über Content Negotiation ausgewählt werden kann. Bei einer bestehenden Ressource wird die URI geändert und eine entsprechende Weiterleitung angeboten. Einführung neuer, optionaler Header.Ein neues, optionales Attribut wird einer Darstellung hinzugefügt.

### Anforderungen an den Benutzer

Der Benutzer benötigt ein DATEV-Authentifizierungsmedium (z. B. SmartLogin) und den DATEV-Vertrag für Lohnaustauschdatenservice. Der Steuerberater konfiguriert das DATEV-Authentifizierungsmedium des Benutzers entsprechend, um die Datenübertragung von DATEV über hr:exchange zu ermöglichen.

Nach erfolgreicher Authentifizierung und Autorisierung kann der Kunde die notwendigen Daten an das DATEV-Rechenzentrum senden oder die aktuellen Daten aus dem Lohnsystem abholen (bidirektional). Der Lohnsachbearbeiter kann die Daten ins Lohnsystem übernehmen.

&nbsp;

# HR-exchange Technische Einführung

hr-exchange erlaubt die bidirektionale Kommunikation mit den onPremise DATEV Lohnsystemen LODAS und Lohn und Gehalt (LuG).

## Allgemeine Informationen

Requests müssen immer angeben, für welches Lohnsystem ein Request gedacht ist. Das geschieht mit dem Header "Target-System"; mögliche Werte sind 'lug' und 'lodas'. Wird der Header weggelassen, wird 'lodas' als Default angenommen.

Achtung: Authentifizierungsprüfungen basieren immer auf Berater-, Mandanten- und Personalnummern, dieselbe Berater- und Mandantennummer Konstellation kann aber potentiell in beiden Lohnprogrammen parallel genutzt werden.

Die Datenübertragung läuft bei dieser API immer asynchron. Es gibt 3 Phasen dieser Kommunikation:

1. Senden des initialen Requests, welcher bei Erfolg einen Job anlegt und dessen UUID zurück liefert  
   2a. Polling, ob der Job abgeschlossen ist oder  
   2b. Warten auf eine aktive Benachrichtigung von hr-exchange, dass der Job abgeschlossen wurde  
2. Abholen des Ergebnisses der asynchronen Operation mittels des Job Result Endpunkts

Achtung: Für aktive Benachrichtigungen mit REST hooks oder Notify-URL muss zuerst die Zieladresse bei DATEV manuell whitelisted werden. Um diesen Prozess zu starten, wenden Sie sich an das technische Onboarding (schnittstellenberatung@datev.de).

Normalerweise dauern Jobs (asynchrone Operationen) etwa eine bis zwei Minuten.  
Da wir aber auf die Erreichbarkeit eines onPremise-Systems angewiesen sind, können wir hier keinerlei Laufzeitgarantien geben.  
Deshalb ist es nicht ratsam, auf die Verarbeitung eines Jobs in hr-exchange in irgendeiner blockierenden Art (z.B. in einem User UI) zu warten.

Für schreibende Operationen können Fehler aufgrund von fehlenden oder invaliden Daten entstehen.  
In solchen Fällen wird die komplette Ressource, in welcher der Fehler aufgetreten ist, nicht aktualisiert/angelegt.

Example: Wenn wir einen Mitarbeiter mit einem invaliden Wert für das Feld "tax class" in der Subressource "tax card" des Mitarbeiters senden, wird die "tax card" Ressource nicht erzeugt.

{

&nbsp;&nbsp;"surname" : "Joyfella",&nbsp;

&nbsp;&nbsp;"first\_name" : "Esmeralda",

&nbsp;&nbsp;"personal\_data": {

&nbsp;&nbsp;&nbsp;&nbsp;"sex": "W"

&nbsp;&nbsp;},

&nbsp;&nbsp;"employment\_periods": {

&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_commencement\_of\_employment": "2025-01-01"

&nbsp;&nbsp;},

&nbsp;&nbsp;"tax\_card": {

&nbsp;&nbsp;&nbsp;&nbsp;"annual\_tax\_allowance": 1200,

&nbsp;&nbsp;&nbsp;&nbsp;"child\_tax\_allowances": 80.0,

&nbsp;&nbsp;&nbsp;&nbsp;"denomination": "rk",

&nbsp;&nbsp;&nbsp;&nbsp;"factor": null,

&nbsp;&nbsp;&nbsp;&nbsp;"monthly\_tax\_allowance": 300,

&nbsp;&nbsp;&nbsp;&nbsp;"spouses\_denomination": "ev",

&nbsp;&nbsp;&nbsp;&nbsp;"tax\_class": 9999

&nbsp;&nbsp;}

}

&nbsp;

Die Antwort dieses Jobs (GET job result) wird dann in etwa wie folgt aussehen:

{

&nbsp;&nbsp;"employees": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"surname": "Joyfella",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"personnel\_number": 14,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"first\_name": "Esmeralda",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"personal\_data": {

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"sex": "W"

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"employment\_periods": {

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_commencement\_of\_employment": "2025-01-01"

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\],

&nbsp;&nbsp;"errors": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"error": "\#DCO02426",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"error\_description": "restapi.ValidationError",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"error\_uri": "http://www.datev.de/dnlexos/mobile/webApp.aspx?sq=DCO02426",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"request\_id": null,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"additional\_messages": \[

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": "\#DCO02420",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"severity": "ERROR",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"description": "taxCard.taxClass must not exceed 1 digit",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"path": "/employees/\[0\]",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"affected\_fields": \[

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"/employees/\[0\]/tax\_card.tax\_class"

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\]

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\]

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\]

}

&nbsp;

Die tax class Ressource ist in der Antwort unter "employees" nicht enthalten, was anzeigt, dass diese Daten nicht im onPremise System angelegt wurden.  
Der Fehler in den "errors" zeigt den Grund für den Auftreten eines Fehlers und auch, dass dieser eben in der "tax card" Ressource zu verorten ist.

Info: Manche Fehler werden auch synchron erkannt und in der unmittelbaren Antwort auf den initialen POST Request zurückgegeben. Solange ein 202 Accepted HTTP status code und eine Job ID zurückgegeben werden, werden die Daten allerdings weiter an das onPremise System gesendet. Für eine Liste aller Fehler ist es sinnvoll, auf die Antwort der asynchronen Operation zu warten.

## Unterschiede zwischen beiden onPremise Systemen Lodas und LuG

Während hr-exchange versucht, eine einheitliche API für beide Lohnprogramme anzubieten, war das in manchen Aspekten nicht möglich.

Ein Aspekt sind die Fehlzeiten, die für das jeweilige Lohnprogramm spezifische Endpunkte haben:

/v1/clients/{client-id}/absences/lodas

&nbsp;

und

/v1/clients/{client-id}/absences/lodas

&nbsp;

Ein anderer Unterschied existiert in den Fehlermeldungen. Lodas-Fehlermeldungen sind in unserer OpenAPI Spezifikation dokumentiert und in Englisch,  
während in LuG so viele Fehlermeldungen existieren, dass wir hier keine vollständige Liste liefern können.  
Die LuG Fehlermeldungen können auch in Englisch oder Deutsch sein, je nach Fehler.

Lodas Fehlermeldungen haben als error code \#DXLO..., LuG Fehlermeldungen haben \#LN... error codes.

## Daten von onPremise Systemen lesen

Für das Holen von Daten von onPremise Lohnprogrammen muss der Endpunkt POST Job verwendet werden:

POST /v1/clients/{client-id}/jobs

&nbsp;

Der Request body gibt dabei an, welche Art von Daten geholt werden sollen. Beispiele hierzu finden sich auf der Seite "Request Examples \- Reading data".

## Daten in die onPremise Systeme schreiben

Für das Schreiben von Daten existieren verschieden Endpunkte für verschiedene Arten von Daten. Normalerweise existieren POST Endpunkte für die Neuanlage von Ressourcen und PUT Endpunkte für das Aktualisieren.  
Manche Ressourcen können auch via DELETE Endpunkten wieder gelöscht werden.

Für Mandantendaten existieren keine schreibenden Endpunkte.

Um beispielsweise einen neuen Mitarbeiter in einem DATEV Lohnprogramm anzulegen kann der Endpunkt POST employee verwendet werden:

POST /v1/clients/{client-id}/employees/{employee-id}&nbsp;

&nbsp;

wobei die "client-id" die Verbindung von Beraternummer und Mandantennummer mit einem Bindestrich ist (z.B. 123457-101).  
Dieser Endpunkt erlaubt es auch, alle Unterressourcen eines Mitarbeiters direkt mitzuschicken.

Für 1:N Unterressourcen eines Mitarbeiters existieren auch spezifische Endpunkte:

PUT /v1/clients/{client-id}/employees/{employee-id}/\[subresource\]&nbsp;

&nbsp;

wobei \[subresource\] eine der folgenden sein kann:

* employment-periods  
* gross-payments  
* hourly-wages  
* month-records  
* absences/lug  
* absences/lodas

Für month-records (Monats- oder Bewegungsdaten) existiert auch ein Endpunkt auf Mandantenebene, welcher die Übertragung von month-records für mehrere Mitarbeiter auf einmal erlaubt:

POST  /v1/clients/{client-id}/month-records

&nbsp;

# Hr-Exchange Requestbeispiele \- Daten lesen

## Einführungsbeispiele

### Vorbedingungen:

Jeder Request muss folgende Header pflichtmäßig mitschicken:

Content-Type : "application/json"

Target-System : "lodas" oder "lug"

X-Datev-Client-ID :  (client-id einer Applikation im DATEV Developer Portal)

Authorization: oAuth2 Token

&nbsp;

Info: Auch wenn "client-id" einer Anwendung im DATEV Developer Portal und die "client-id" in der URL vieler Requests gleich heißen, sind es verschiedene Dinge. Die "client-id" in der URL ist die Beraternummer und Mandantennummer verbunden durch einen Bindestrich (z.B. 123457-101).

Info: In diesem Dokument wird für Phase 2 ein Polling-Ansatz angenommen, hr-exchange bietet aber auch Mechanismen, bei denen bei Jobabschluss aktiv Benachrichtigungen verschickt werden. Diese sind unter "Asynchrone Benachrichtigungen bei Jobabschluss" beschrieben.

### Beispiel: Mandantendaten lesen

Phase 1: Lesen von Mandantendaten für Beraternummer 1234567 Mandantennummer 12345 für Januar 2025:

Im Request body gibt man hierzu "client-data" als resource name an und "2025-01" als reference date.

POST /v1/clients/1234567-12345/jobs

&nbsp;

&nbsp;

{ "resource\_name": "client-data", "reference\_date": "2025-01" }

Dieser Request gibt bei Erfolg eine job-uuid zurück, z.B. 97ddd8dc-d755-4b7b-93e1-b52756ee791a:

{&nbsp;

&nbsp;&nbsp;"id": "97ddd8dc-d755-4b7b-93e1-b52756ee791a",

&nbsp;&nbsp;"state": "accepted",

&nbsp;&nbsp;"time\_stamp": "2025-01-23T11:18:33.16854679",

&nbsp;&nbsp;"time\_stamp\_updated": "2025-01-23T11:18:33.16863121"

}

&nbsp;

#### Status pollen

Phase 2: Den Status der asynchronen Operation über den GET Job Endpunkt abfragen mit dem Endpunkt:

GET /v1/clients/1234567-12345/jobs/97ddd8dc-d755-4b7b-93e1-b52756ee791a&nbsp;

&nbsp;

bis in der JSON response der Status "successful" erscheint:

{

&nbsp;&nbsp;"id": "97ddd8dc-d755-4b7b-93e1-b52756ee791a",&nbsp;

&nbsp;&nbsp;"state": "successful",&nbsp;

&nbsp;&nbsp;"time\_stamp": "2025-01-23T11.25.36.6228314",&nbsp;

&nbsp;&nbsp;"time\_stamp\_updated": "2025-01-23T11.25.36.6230451"&nbsp;

}&nbsp;

&nbsp;

#### Resultat der asynchronen Operation abholen

Phase 3: Das Resultat mittels result Endpunkt abholen:

GET /v1/clients/1234567-12345/jobs/97ddd8dc-d755-4b7b-93e1-b52756ee791a/result&nbsp;

&nbsp;

Das wird dann direkt weiterleiten auf den Ressourcen-spezifischen Endpunkt, in diesem Fall:

GET /v1/clients/1234567-12345/jobs/97ddd8dc-d755-4b7b-93e1-b52756ee791a/result/client-data

&nbsp;

Hier ist der HTTP status dann jener der onPremise REST operation (in diesem Fall 200 OK) und der body wird die eigentlichen Daten liefern:

{&nbsp;

&nbsp;&nbsp;"clients": \[&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"program": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"product": "LODAS",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"variant": 2,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"version": "14.5"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"current\_accounting\_month": "2024-01-01",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"is\_test\_client": false,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"salary\_types": \[&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 100,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Gehalt"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 110,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Ausbildungsvergütung"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 200,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Stundenlohn"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 250,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Feiertagslohn"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 338,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Familienheimfahrten"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 350,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Urlaubsgeld"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 924,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Betr.AV.AN EBZ Geh.Ver"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\],&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "DATEVmuster GmbH",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"health\_insurers": \[&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "AOK Bayern",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"company\_number\_of\_health\_insurer": "87880235"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "BUN Die Bundesknappsch",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"company\_number\_of\_health\_insurer": "98000006"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\],&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"business\_units": \[&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": "1",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "DATEVmuster GmbH"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\],&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"instant\_registration\_required": false&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;\],&nbsp;

&nbsp;&nbsp;"errors": \[\]&nbsp;

}

&nbsp;

### Beispiel: Lesen von Mitarbeiterdaten eines Mitarbeiters

Phase 1: Lesen von Mitarbeiterdaten für die Beraternummer 123457, Mandantennummer 12345 und Personalnummer 98765 für Januar 2025:

Im Request wird hierzu der resource name auf "employees" gesetzt, die id auf die Personalnummer des Mitarbeiters und das reference date auf "2025-01".

POST /v1/clients/1234567-12345/jobs&nbsp;

&nbsp;

&nbsp;

{ "resource\_name": "employees", "id": "98765", "reference\_date": "2025-01" }

Dieser Request gibt bei Erfolg eine job-uuid zurück, z.B. 5ea7ff4b-5959-46ef-a7a4-262a93f0d28c:

{&nbsp;

&nbsp;&nbsp;"id": "5ea7ff4b-5959-46ef-a7a4-262a93f0d28c",&nbsp;

&nbsp;&nbsp;"state": "accepted",&nbsp;

&nbsp;&nbsp;"time\_stamp": "2025-01-24T09:44:45.283715465",&nbsp;

&nbsp;&nbsp;"time\_stamp\_updated": "2025-01-24T09:44:45.283730113"&nbsp;

}&nbsp;

&nbsp;

#### Status pollen

Phase 2: Den Status der asynchronen Operation über den GET Job Endpunkt abfragen mit dem Endpunkt:

GET /v1/clients/1234567-12345/jobs/5ea7ff4b-5959-46ef-a7a4-262a93f0d28c

&nbsp;

bis in der JSON response der Status "successful" erscheint:

{

&nbsp;&nbsp;"id": "5ea7ff4b-5959-46ef-a7a4-262a93f0d28c",&nbsp;

&nbsp;&nbsp;"state": "successful",&nbsp;

&nbsp;&nbsp;"time\_stamp": "2025-01-23T11.25.36.6228314",&nbsp;

&nbsp;&nbsp;"time\_stamp\_updated": "2025-01-23T11.25.36.6230451"&nbsp;

}

&nbsp;

#### Resultat der asynchronen Operation abholen

Phase 3: Das Resultat mittels result Endpunkt abholen:

GET /v1/clients/1234567-12345/jobs/5ea7ff4b-5959-46ef-a7a4-262a93f0d28c/result&nbsp;

&nbsp;

Das wird dann direkt weiterleiten auf den Ressourcen-spezifischen Endpunkt, in diesem Fall:

GET /v1/clients/1234567-12345/jobs/5ea7ff4b-5959-46ef-a7a4-262a93f0d28c/result/employees

&nbsp;

Hier ist der HTTP status dann jener der onPremise REST operation (in diesem Fall 200 OK) und der body wird die eigentlichen Daten liefern:

{&nbsp;

&nbsp;&nbsp;"employees": \[&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"surname": "Müller",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"personnel\_number": 98765,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"company\_personnel\_number": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"first\_name": "Hugo-Muster",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"employment\_id": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"business\_unit\_id": 1,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"payment\_method": "4",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"activity": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"highest\_level\_of\_professional\_training": 2,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"highest\_level\_of\_education": 3,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_monday": 2,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_tuesday": 2,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_wednesday": 2,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_thursday": 2,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_friday": 2,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_saturday": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_sunday": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"weekly\_working\_hours": 10,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"individual\_cost\_center\_id": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"occupational\_title": "Aushilfsfahrer",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"employee\_type": "109",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"contractual\_structure": "2",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"activity\_type": 4,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"department\_id": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"personnel\_leasing": 0&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"account": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"iban": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"bic": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"differing\_account\_holder": null&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"address": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"address\_affix": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"city": "Nürnberg",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"country": "D",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"house\_number": "2",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"postal\_code": "90329",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"street": "Theodorstr."&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"gross\_payments": \[&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 1,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"amount": 500,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"salary\_type\_id": 205,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"payment\_months": "1,2,3,4,5,6,7,8,9,10,11,12"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\],&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"personal\_data": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"nationality": "000",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"sex": "M",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"email": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"phone": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"academic\_title": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name\_prefix": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name\_affix": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"birth\_name": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"birth\_name\_prefix": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"birth\_name\_affix": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"country\_of\_birth": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_birth": "1971-10-05",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"place\_of\_birth": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"work\_permit": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"residency\_permit": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"certificate\_of\_study": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"social\_security\_number": "26051071F493",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"european\_social\_security\_number": null&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"social\_insurance": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_health\_insurance": 6,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_nursing\_insurance": 0,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_pension\_insurance": 5,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_unemployment\_insurance": 0,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"company\_number\_of\_health\_insurer": "98000006",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"health\_insurance\_id": 30,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"is\_additional\_contribution\_to\_nursing\_insurance\_for\_childless\_ignored": false,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"health\_insurer\_for\_marginal\_employee": "87880235"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"tax\_card": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"annual\_tax\_allowance": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"child\_tax\_allowances": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"denomination": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"factor": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"monthly\_tax\_allowance": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"spouses\_denomination": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"tax\_class": null&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"taxation": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"employment\_type": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"requested\_annual\_allowance": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"tax\_identification\_number": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"flat\_rate\_tax": 1&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"vacation\_entitlement": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"basic\_vacation\_entitlement": 11&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"vocational\_training": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"start": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"expected\_end": null,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"actual\_end": null&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;\],&nbsp;

&nbsp;&nbsp;"errors": \[\]&nbsp;

}&nbsp;

&nbsp;

### Beispiel: Lesen aller Festbezüge eines Mitarbeiters

Phase 1: Lesen der Festbezüge eines Mitarbeiters für Beraternummer 1234567, Mandantennummer 12345 und der Personalnummer 98765 für Januar 2025:

Im Request body wird hier zuerst "employees" als resource name angegeben (da es sich bei Festbezügen um eine Unterressource des Mitarbeiters handelt) und die Personalnummer als id.  
Zudem wird eine Unterressource in sub resource definiert, bei der in resource name angegeben wird, dass Festbezüge geholt werden sollen mit dem reference date "2025-01".  
Info: Das reference date darf hierbei nur in der sub resource angegeben werden.

POST /v1/clients/1234567-12345/jobs&nbsp;

&nbsp;

{

&nbsp;&nbsp;"resource\_name": "employees",

&nbsp;&nbsp;"id": "98765",

&nbsp;&nbsp;"sub\_resource" : {

&nbsp;&nbsp;&nbsp;&nbsp;"resource\_name": "gross-payments",

&nbsp;&nbsp;&nbsp;&nbsp;"reference\_date": "2025-01"

&nbsp;&nbsp;}

}

&nbsp;

Dieser Request gibt bei Erfolg eine job-uuid zurück, z.B. 1e11ca82-1c06-4faf-958f-384eb0e1e0ad:

{&nbsp;

&nbsp;&nbsp;"id": "1e11ca82-1c06-4faf-958f-384eb0e1e0ad",&nbsp;

&nbsp;&nbsp;"state": "accepted",&nbsp;

&nbsp;&nbsp;"time\_stamp": "2025-01-24T09:44:45.283715465",&nbsp;

&nbsp;&nbsp;"time\_stamp\_updated": "2025-01-24T09:44:45.283730113"&nbsp;

}&nbsp;

&nbsp;

#### Status pollen

Phase 2: Den Status der asynchronen Operation über den GET Job Endpunkt abfragen mit dem Endpunkt:

GET /v1/clients/1234567-12345/jobs/1e11ca82-1c06-4faf-958f-384eb0e1e0ad

&nbsp;

bis in der JSON response der Status "successful" erscheint:

{

&nbsp;&nbsp;"id": "1e11ca82-1c06-4faf-958f-384eb0e1e0ad",&nbsp;

&nbsp;&nbsp;"state": "successful",&nbsp;

&nbsp;&nbsp;"time\_stamp": "2025-01-23T11.25.36.6228314",&nbsp;

&nbsp;&nbsp;"time\_stamp\_updated": "2025-01-23T11.25.36.6230451"&nbsp;

}

&nbsp;

#### Resultat der asynchronen Operation abholen

Phase 3: Das Resultat mittels result Endpunkt abholen:

GET /v1/clients/1234567-12345/jobs/1e11ca82-1c06-4faf-958f-384eb0e1e0ad/result&nbsp;

&nbsp;

Das wird dann direkt weiterleiten auf den Ressourcen-spezifischen Endpunkt, in diesem Fall:

GET /v1/clients/1234567-12345/jobs/1e11ca82-1c06-4faf-958f-384eb0e1e0ad/result/gross-payments

&nbsp;

Hier ist der HTTP status dann jener der onPremise REST operation (in diesem Fall 200 OK) und der body wird die eigentlichen Daten liefern:

{

&nbsp;&nbsp;"gross\_payments": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 1,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"amount": 3400,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"salary\_type\_id": 100,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"payment\_months": "1,2,3,4,5,6,7,8,9,10,11,12"

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\],

&nbsp;&nbsp;"errors": \[\]

}

# Asynchrone Benachrichtigungen bei Jobabschluss

hr-exchange bietet zwei Wege, um aktiv über den Abschluss einer asynchronen Datenverarbeitung benachrichtigt zu werden, um so ein Polling des jobs/{uuid}-Endpunkts zu vermeiden.

REST hooks \- Die Applikation registiert eine callback URL, die bei Abschluss jedes Jobs für einen Mandanten aufgerufen wird  
Notify-URL header \- Die Applikation sendet diesen Header um speziell für diesen Job (der im Zuge des Requests erzeugt wird) benachrichtigt zu werden

Um diese Benachrichtigungen nutzen zu können, muss auf Seite der konsumierenden Applikation ein Endpunkt bereitgestellt werden, der eingehende POST Requests annimmt.  
Damit hr-exchange eine solche URL ansprechen kann, muss diese manuell auf DATEV-Seite whitelisted werden. Um diesen Prozess für Ihre Applikation zu starten, wenden sie sich ans technische Onboarding (schnittstellenberatung@datev.de).

## REST hooks

Um eine permanente Registrierung für alle Jobs eines Mandanten einzurichten, nutzen sie den REST hooks Endpunkt:

/v1/clients/{client-id}/resthooks&nbsp;

&nbsp;

Die client url ist hierbei ein Pflichtfeld, optional kann auch ein authorization header mitgegeben werden, dass sich hr-exchange an Ihrem Server damit authentifizieren kann.  
Der Wert dieses Felds wird im "Authorization" header mitgeschickt, wenn Benachrichtigungen verschickt werden.

Wenn ein REST hook registriert ist, sendet hr-exchange für alle Job-Status-Updates für diesen Mandanten eine Benachrichtigung an die jeweilige Adresse.  
Maximal drei REST hooks können für einen Mandanten gleichzeitig registriert sein.  
Jeder REST hook hat als Identifier eine UUID, mit dem dieser hook aktualisiert oder gelöscht werden kann, mithilfe von PUT oder DELETE-Requests an:

/v1/clients/{client-id}/resthooks/{hook-uuid}&nbsp;

&nbsp;

Um zu testen, ob Benachrichtigungen funktionieren, kann außerdem folgender Endpunkt genutzt werden, welcher testweise eine Benachrichtigung versendet:

/v1/clients/{client-id}/resthooks/{hook-uuid}/test&nbsp;

&nbsp;

## Notify-URL header

Bei jedem Request, welcher einen Job anlegt (schreibend und lesend) kann auch eine Notification URL und Authentifizierungs-Information per Header mitgegeben werden.  
Hierfür dienen die Header "Notify-URL" und "Notify-Auth" beim initialen Request.  
Die Benachrichtigungs-Informationen, die so erzeugt werden, gelten nur für diesen einen Job und wird einmalig aufgerufen, wenn dieser Job abgeschlossen wird.

### Beispiel: Mandantendaten lesen mit einmaliger Benachrichtigung

Senden eines initialen Requests zum Lesen der Mandantendaten für Beraternummer 1234567 und Mandantennummer 12345 für Januar 2025 mit folgenden Headern:

POST /v1/clients/1234567-12345/jobs

Content-Type :  application/json

Target-System: "lodas" or "lug"

X-Datev-Client-ID :  (client-id which identifies sender app. Obtained by creating an application in the DATEV Developer Portal)

Authorization: oAuth2 Token

Notify-Url: https://my-hr-app.com/hr-exchange/callback&nbsp;

Notify-Auth: Basic am9obi5kb2VAYWNtZS5jb206dG9wc2VjcmV0cGFzc3dvcmQ=

&nbsp;

&nbsp;

{  
&nbsp;&nbsp;"resource\_name": "client\_data",  
&nbsp;&nbsp;"reference\_date": "2025-01"  
}

Der Job-Status wird initial "accepted" sein und sich bei Abschluss der asynchronen Operation entweder auf "sucessful" oder "failed" aktualisieren ("partially\_successful" kann nur bei schreibenden Operation auftreten).  
Sobald dies passiert, wird eine Benachrichtigung an die URL, welche initial im Notify-URL header mitgegeben wurde.

### Behandeln der POST Benachrichtigung mit folgendem Beispiel-body:

{

&nbsp;&nbsp;"time\_stamp": "2025-01-28T14:10:26.970445400",

&nbsp;&nbsp;"client\_url": "https://my-hr-app.com/hr-exchange/callback",

&nbsp;&nbsp;"id": "7abd1a4e-a3c4-4c2a-bfc3-875334cfc4f3",

&nbsp;&nbsp;"event\_resource": {

&nbsp;&nbsp;&nbsp;&nbsp;"additional\_info": null,

&nbsp;&nbsp;&nbsp;&nbsp;"server\_url": "https://hr-exchange.api.datev.de/platform/v1/clients/1234567-12345/jobs/7abd1a4e-a3c4-4c2a-bfc3-875334cfc4f3/result",

&nbsp;&nbsp;&nbsp;&nbsp;"http\_method": "POST",

&nbsp;&nbsp;&nbsp;&nbsp;"resource\_id": "7abd1a4e-a3c4-4c2a-bfc3-875334cfc4f3",

&nbsp;&nbsp;&nbsp;&nbsp;"resource": "jobs"

&nbsp;&nbsp;}

}

&nbsp;

Die wichtigste Information in dieser Benachrichtigung ist dann die "server\_url", unter welcher dann das Ergebnis des Jobs inklusive der Nutzdaten abgeholt werden kann.

### Resultat der asynchronen Operation abholen:

GET https://hr-exchange.api.datev.de/platform/v1/clients/1234567-12345/jobs/7abd1a4e-a3c4-4c2a-bfc3-875334cfc4f3/result

&nbsp;

Bei erfolgreicher Authentifizierung können hier dann die Nutzdaten des Auftrags gelesen werden:

{&nbsp;

&nbsp;&nbsp;"clients": \[&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"program": {&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"product": "LODAS",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"variant": 2,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"version": "14.5"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"current\_accounting\_month": "2024-01-01",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"is\_test\_client": false,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"salary\_types": \[&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 100,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Gehalt"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 110,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Ausbildungsvergütung"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 200,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Stundenlohn"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 250,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Feiertagslohn"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 338,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Familienheimfahrten"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 350,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Urlaubsgeld"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 924,&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "Betr.AV.AN EBZ Geh.Ver"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\],&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "DATEVmuster GmbH",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"health\_insurers": \[&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "AOK Bayern",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"company\_number\_of\_health\_insurer": "87880235"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "BUN Die Bundesknappsch",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"company\_number\_of\_health\_insurer": "98000006"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\],&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"business\_units": \[&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": "1",&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"name": "DATEVmuster GmbH"&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\],&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"instant\_registration\_required": false&nbsp;

&nbsp;&nbsp;&nbsp;&nbsp;}&nbsp;

&nbsp;&nbsp;\],&nbsp;

&nbsp;&nbsp;"errors": \[\]&nbsp;

}

# Hr-Exchange Requestbeispiele \- Daten schreiben

## Einführungsbeispiele

### Vorbedingungen:

Jeder Request muss folgende Header pflichtmäßig mitschicken:

Content-Type : "application/json"

Target-System : "lodas" oder "lug"

X-Datev-Client-ID :  (client-id einer Applikation im DATEV Developer Portal)

Authorization: oAuth2 Token

&nbsp;

Info: Auch wenn "client-id" einer Anwendung im DATEV Developer Portal und die "client-id" in der URL vieler Requests gleich heißen, sind es verschiedene Dinge. Die "client-id" in der URL ist die Beraternummer und Mandantennummer verbunden durch einen Bindestrich (z.B. 123457-101).

Info: In diesem Dokument wird für Phase 2 ein Polling-Ansatz angenommen, hr-exchange bietet aber auch Mechanismen, bei denen bei Jobabschluss aktiv Benachrichtigungen verschickt werden. Diese sind unter "Asynchrone Benachrichtigungen bei Jobabschluss" beschrieben.

### Beispiel: Einen neuen Mitarbeiter anlegen

Phase 1: POST-Request für die Anlage einer neuen Mitarbeiterin senden, der im Januar 2025 anfängt:

Dieses Beispiel sendet nur den minimalen Feldumfang, welcher für eine Mitarbeiterneuanlage notwendig ist.  
Es ist auch möglich, mehrere Mitarbeiterdatensätze auf einmal zu schicken, hierfür muss nur im body eine Liste mitgeschickt werden.

POST /v1/clients/1234567-12345/employees?reference-date=2025-01

&nbsp;

{

&nbsp;&nbsp;"surname" : "Joyfella",&nbsp;

&nbsp;&nbsp;"first\_name" : "Esmeralda",

&nbsp;&nbsp;"personal\_data": {

&nbsp;&nbsp;&nbsp;&nbsp;"sex": "W"

&nbsp;&nbsp;},

&nbsp;&nbsp;"employment\_periods": {

&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_commencement\_of\_employment": "2025-01-01"

&nbsp;&nbsp;}

}

&nbsp;

Dieser Request gibt bei Erfolg eine job-uuid zurück, z.B. bda4e561-4539-4638-b051-e0d68f653e38:

{

&nbsp;&nbsp;"id": "bda4e561-4539-4638-b051-e0d68f653e38",

&nbsp;&nbsp;"state": "accepted",

&nbsp;&nbsp;"time\_stamp": "2025-01-24T14:18:39.384084859",

&nbsp;&nbsp;"time\_stamp\_updated": "2025-01-24T14:18:39.384104557",

}

&nbsp;

#### Status pollen

Phase 2: Den Status der asynchronen Operation über den GET Job Endpunkt abfragen mit dem Endpunkt:

GET /v1/clients/1234567-12345/jobs/bda4e561-4539-4638-b051-e0d68f653e38

&nbsp;

bis in der JSON response der Status "successful" erscheint:

{

&nbsp;&nbsp;"id": "bda4e561-4539-4638-b051-e0d68f653e38",&nbsp;

&nbsp;&nbsp;"state": "successful",&nbsp;

&nbsp;&nbsp;"time\_stamp": "2025-01-23T11.25.36.6228314",&nbsp;

&nbsp;&nbsp;"time\_stamp\_updated": "2025-01-23T11.25.36.6230451"&nbsp;

}&nbsp;

&nbsp;

#### Resultat der asynchronen Operation abholen

Phase 3: Das Resultat mittels result Endpunkt abholen:

GET /v1/clients/1234567-12345/jobs/bda4e561-4539-4638-b051-e0d68f653e38/result&nbsp;

&nbsp;

Das wird dann direkt weiterleiten auf den Ressourcen-spezifischen Endpunkt, in diesem Fall:

GET /v1/clients/1234567-12345/jobs/bda4e561-4539-4638-b051-e0d68f653e38/result/client-data

&nbsp;

Hier ist der HTTP status dann jener der onPremise REST operation (in diesem Fall 201 Created) und der body wird die angelegten Daten und möglicherweise aufgetretene Fehler liefern:

{

&nbsp;&nbsp;"employees": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"surname": "Joyfella",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"personnel\_number": 14,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"first\_name": "Esmeralda",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"personal\_data": {

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"sex": "W"

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;},

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"employment\_periods": {

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_commencement\_of\_employment": "2025-01-01"

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\],

&nbsp;&nbsp;"errors": \[\]

}

&nbsp;

### Beispiel: Anlage eines neuen Festbezugs für einen Mitarbeiter

Phase 1: Auftrag zur Anlage der neuen Festbezüge im Januar 2025 schicken:

In diesem Beispiel werden 2 neue Festbezüge angelegt, eine monatliche Zahlung ab Januar 2025 und eine vierteljährliche Zahlung, welche das erste mal im März 2025 ausgezahlt werden soll.

POST /v1/clients/1234567-12345/employees/14/gross-payments?reference-date=2025-01

&nbsp;

\[

&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;"id": 2,

&nbsp;&nbsp;&nbsp;&nbsp;"amount": 1675.28,

&nbsp;&nbsp;&nbsp;&nbsp;"salary\_type\_id": 260,

&nbsp;&nbsp;&nbsp;&nbsp;"payment\_months": "1,2,3,4,5,6,7,8,9,10,11,12"

&nbsp;&nbsp;},

&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;"id": 3,

&nbsp;&nbsp;&nbsp;&nbsp;"amount": 65.33,

&nbsp;&nbsp;&nbsp;&nbsp;"salary\_type\_id": 310,

&nbsp;&nbsp;&nbsp;&nbsp;"payment\_months": "3,6,9,12"

&nbsp;&nbsp;}&nbsp;&nbsp;

\]

&nbsp;

Dieser Request gibt bei Erfolg eine job-uuid zurück, z.B. fdc5aa73-8145-40c9-9a53-0d7e67f90104:

{&nbsp;

&nbsp;&nbsp;"id": "5ea7ff4b-5959-46ef-a7a4-262a93f0d28c",&nbsp;

&nbsp;&nbsp;"state": "accepted",&nbsp;

&nbsp;&nbsp;"time\_stamp": "2025-01-24T09:44:45.283715465",&nbsp;

&nbsp;&nbsp;"time\_stamp\_updated": "2025-01-24T09:44:45.283730113"&nbsp;

}&nbsp;

&nbsp;

#### Status pollen

Phase 2: Den Status der asynchronen Operation über den GET Job Endpunkt abfragen mit dem Endpunkt:

GET /v1/clients/1234567-12345/jobs/fdc5aa73-8145-40c9-9a53-0d7e67f90104

&nbsp;

bis in der JSON response der Status "successful" erscheint:

{

&nbsp;&nbsp;"id": "fdc5aa73-8145-40c9-9a53-0d7e67f90104",

&nbsp;&nbsp;"state": "accepted",

&nbsp;&nbsp;"time\_stamp": "2025-01-24T14:18:39.384084859",

&nbsp;&nbsp;"time\_stamp\_updated": "2025-01-24T14:18:39.384104557",

}

&nbsp;

#### Resultat der asynchronen Operation abholen

Phase 3: Das Resultat mittels result Endpunkt abholen:

GET /v1/clients/1234567-12345/jobs/fdc5aa73-8145-40c9-9a53-0d7e67f90104/result&nbsp;

&nbsp;

Das wird dann direkt weiterleiten auf den Ressourcen-spezifischen Endpunkt, in diesem Fall:

GET /v1/clients/1234567-12345/jobs/fdc5aa73-8145-40c9-9a53-0d7e67f90104/result/gross-payments

&nbsp;

Hier ist der HTTP status dann jener der onPremise REST operation (in diesem Fall 201 Created) und der body wird die eigentlichen Daten liefern:

{

&nbsp;&nbsp;"employment\_periods": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_commencement\_of\_employment": "2001-01-01",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_termination\_of\_employment": "2005-12-31"

&nbsp;&nbsp;&nbsp;&nbsp;},

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_commencement\_of\_employment": "2007-04-01",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_termination\_of\_employment": "2007-04-30"

&nbsp;&nbsp;&nbsp;&nbsp;},

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_commencement\_of\_employment": "2008-07-15",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_termination\_of\_employment": null

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\],

&nbsp;&nbsp;"errors": \[\]

}

## Fachliche Übersicht \- Use Cases

Der Lohnaustauschdatenservice dient dem bidirektionalen Austausch von Lohndaten zwischen Lohnabrechnungsprogramm (Lohn und Gehalt oder LODAS) und Drittsystem auf Feldebene.

Vor der Integration ist es sinnvoll, sich einen Überblick über die Use Cases zu verschaffen, die der Lohnaustauschdatenservice abdeckt. Die Anwendungsbereiche für den Lohnaustauschdatenservice sehen wie folgt aus:

| Erstbestückung | Mitarbeiter-Neuanlage | Änderung der Daten | Bewegungsdaten |
| :---- | :---- | :---- | :---- |
| Daten mit Lohnsystem abgleichen\* | Mitarbeiter einstellen\* | Name/Adresse\* | Monatsdaten\* |
|  |  | Bankdaten\* | Fehlzeiten |
|  |  | Anpassung Gehalt/Stundenlohn\* | Nachberechnung |
|  |  | Krankenkassendaten |  |
|  |  | Sonstige persönliche Daten |  |
|  |  | Mitarbeiter austreten lassen |  |

*\* Mit Stern markierte Use Cases sind aus fachlicher Sicht verpflichtend/empfohlen, um eine fachlich korrekte Anbindung der Schnittstelle zu gewährleisten.*

Fachliche Übersicht \- Onboardingprozess für DATEV-Marktplatz Schnittstellen Partner

Eine Grundfachlichkeit ist vor einem Erstgespräch mit DATEV sinnvoll. Diese kann mithilfe einer Checkliste erarbeitet werden. Dabei stellen sich Fragen bzgl. des zukünftigen Funktionsumfang der Softwarelösung, die den Lohnaustauschdatenservice anbinden soll. Die Fragen unter Punkt 3 dienen einer Einschätzung zum eigenen Wissensstand und helfen bei einer Vorabschätzung von Ressourcen und zusätzlichen Aufwänden.

## 1\. Überblick verschaffen \- Ziel und Zweck der Schnittstelle

### Zweck und Anwendungsfall:

Mit der API DATEV Lohnaustauschdatenservice können Personaldaten, Mandantendaten und Bewegungsdaten zwischen den DATEV-Lohnabrechnungssystemen und einem vorgelagerten Drittsystem (z. B. HR-System) ausgetauscht werden.

### Wert der Schnittstelle:

DATEV Lohnaustauschdatenservice verbessert und unterstützt die kollaborativen Prozesse, die Sicherheit in der Datenübertragung über das DATEV-Rechenzentrum und ermöglicht einen automatisierten, bidirektionalen Datenaustausch zwischen Ihrem System (z.B. HR-System) und dem lohnabrechnenden System.

### Voraussetzung:

Voraussetzung für dieses Vorgehen ist eine Schnittstelle zwischen dem Lohnprogramm und der vom Unternehmen eingesetzten Lösung. DATEV Lohnaustauschdatenservice kann nicht ohne Lohnprogramm genutzt werden.

## 2\. Unterstützte Anwendungsfälle

Folgende Szenarien werden unterstützt:

Erstbestückung des Lohnprogramms und Ihrem System  
&nbsp;Mitarbeiter-Neuanlage  
&nbsp;Änderung von Mitarbeiter-Stammdaten  
&nbsp;Anpassung Gehalt/Stundenlohn  
&nbsp;Erfassung von Fehlzeiten  
&nbsp;Erfassung von Bewegungs-/Monatsdaten

Diese Übersicht unterstützt Sie bei Ihrer Entscheidung, welche Use-Cases Sie mit Ihrem System abdecken möchten. Die Details sowie der Feldumfang der einzelnen Use Cases sind im Developer-Portal in der Dokumentation beschrieben.

## 3\. Fragen zur Ausgangslage

Welche Bereiche der vorgelagerten Prozesse in der Personalwirtschaft soll Ihre Lösung abdecken (ERP, Personalmanagement, Zeitwirtschaft, etc.)?  
&nbsp;Haben Sie oder Ihre Kunden bereits DATEV-Programme oder –Schnittstellen im Einsatz?  
&nbsp;Welche spezifischen Ziele sollen durch die Integration erreicht werden?  
&nbsp;Welche Prozesse der Lohnabrechnung sollen durch die Integration automatisiert werden?  
&nbsp;Erfolgt die Lohnabrechnung über DATEV-Lohn-Programme?

## 4\. Schritte bis zur Freigabe

Sobald der fachliche Onboarding-Prozess durchlaufen ist und die Schnittstelle integriert wurde, kann der [Prozess zur Marktplatzlistung](https://www.datev.de/web/de/ueber-datev/das-digitale-oekosystem-von-datev/partnering/datev-marktplatz/datev-marktplatz-schnittstellen-partner-die-ersten-schritte-zum-partnerstatus/) fortgesetzt werden.

## 5\. Fachliche Beratung

Neben der technischen Integration der API ergeben sich oft grundlegende Fragen hinsichtlich der Lohn- und Gehaltsabrechnung und dem zugrundeliegendem Prozess.

Als Softwarehersteller können Sie auf das Beratungsangebot von Steuerberatenden zurückgreifen, die Sie fachlich zum Lohn beraten. Klicken Sie [hier](https://www.smartexperts.de/suche/professional/city?concern=hr:exchange) um auf DATEV SmartExperts zu gelangen und die passenden Experten zu finden.

&nbsp;

# Use Cases

## Use Case \- Erstbestückung

### Fachliche Beschreibung

Die initiale Erstbestückung synchronisiert die Daten aus dem Lohnprogramm, um einen medienbruchfreien Abgleich der Daten zu ermöglichen. Dadurch sind beidseitig die relevanten Mandantendaten angelegt und es ist gewährleistet, dass die Datenmodelle synchron und deckungsgleich sind.

Verpflichtend? Ja. (Grundfunktion)

### Prämissen

Die initiale Erstbestückung erfolgt für alle Varianten aus dem Lohnsystem heraus. Ein Abgleich der Daten zwischen HR System und Lohnsystem findet statt.

### Anforderungen

Der Prozess hat drei verschiedene mögliche Pfade. Das Vorgehen hängt von dem bereits existierenden Bestand der Daten ab und wo dieser vorhanden ist:

| Lohnbestand | Drittsystem-Bestand | Vorgehen |
| :---- | :---- | :---- |
| Ja | Nein | Import aller Mitarbeiter und Mandantendaten (über die Schnittstelle oder über Importdatei, die von LuG/LODAS exportiert werden kann) |
| Nein | Ja | Abruf der Mandantendaten und Anlage des Lohnbestandes aus dem HR System heraus |
| Ja | Ja | Abgleich der Daten des Lohnsystems mit HR System (Personalnummern, Daten, Mandantendaten (Lohnarten..) |

### Validierung

* Die Daten werden vor dem Export aus dem Lohnsystem komplett validiert  
* Eine Validierung bei der Übergabe aus dem HR System findet statt  
* Nach der ersten Übergabe aus dem HR System muss eine Probeabrechnung zwischen HR System und Lohnsystem stattfinden

### Feldbereiche

analog Technisches Beispiel

### Technisches Beispiel

{

&nbsp;&nbsp;"personnel\_number": 42,

&nbsp;&nbsp;"company\_personnel\_number": "BX1dd2",

&nbsp;&nbsp;"surname": "Doe",

&nbsp;&nbsp;"first\_name": "John",

&nbsp;&nbsp;"business\_unit\_id": "1",

&nbsp;&nbsp;"payment\_method": "5",

&nbsp;&nbsp;"employment\_periods": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_commencement\_of\_employment": "2020-12-12",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_termination\_of\_employment": "2099-12-31"

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\],

&nbsp;&nbsp;"gross\_payments": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 1,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"amount": 4200.00,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"salary\_type\_id": 200,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"payment\_months": "1, 4, 7, 10"

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\],

&nbsp;&nbsp;"hourly\_wages": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 1,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"amount": 13.37

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\],

&nbsp;&nbsp;"account": {

&nbsp;&nbsp;&nbsp;&nbsp;"iban": "DE02500105170137075030",

&nbsp;&nbsp;&nbsp;&nbsp;"bic": "GENODEF1P17",

&nbsp;&nbsp;&nbsp;&nbsp;"differing\_account\_holder": "Max Muster"

&nbsp;&nbsp;},

&nbsp;&nbsp;"activity": {

&nbsp;&nbsp;&nbsp;&nbsp;"highest\_level\_of\_professional\_training": 2,

&nbsp;&nbsp;&nbsp;&nbsp;"highest\_level\_of\_education": 2,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_monday": 5.00,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_tuesday": 5.00,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_wednesday": 5.00,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_thursday": 5.00,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_friday": 5.00,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_saturday": null,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_sunday": null,

&nbsp;&nbsp;&nbsp;&nbsp;"weekly\_working\_hours": 25.00,

&nbsp;&nbsp;&nbsp;&nbsp;"individual\_cost\_center\_id": "TEST123",

&nbsp;&nbsp;&nbsp;&nbsp;"occupational\_title": "DevOps Engineer",

&nbsp;&nbsp;&nbsp;&nbsp;"job\_carried\_out": "15864",

&nbsp;&nbsp;&nbsp;&nbsp;"employee\_type": 101,

&nbsp;&nbsp;&nbsp;&nbsp;"contractual\_structure": 1,

&nbsp;&nbsp;&nbsp;&nbsp;"department\_id": "KST123",

&nbsp;&nbsp;&nbsp;&nbsp;"personnel\_leasing": 0

&nbsp;&nbsp;},

&nbsp;&nbsp;"address": {

&nbsp;&nbsp;&nbsp;&nbsp;"street": "Bahnhofstr.",

&nbsp;&nbsp;&nbsp;&nbsp;"house\_number": "12a",

&nbsp;&nbsp;&nbsp;&nbsp;"city": "Nuernberg",

&nbsp;&nbsp;&nbsp;&nbsp;"postal\_code": "90429",

&nbsp;&nbsp;&nbsp;&nbsp;"country": "D",

&nbsp;&nbsp;&nbsp;&nbsp;"address\_affix": "auf"

&nbsp;&nbsp;},

&nbsp;&nbsp;"personal\_data": {

&nbsp;&nbsp;&nbsp;&nbsp;"academic\_title": "Bachelor of Eng.",

&nbsp;&nbsp;&nbsp;&nbsp;"name\_prefix": "an",

&nbsp;&nbsp;&nbsp;&nbsp;"name\_affix": "Baron",

&nbsp;&nbsp;&nbsp;&nbsp;"birth\_name\_prefix": "von",

&nbsp;&nbsp;&nbsp;&nbsp;"birth\_name\_affix": "Erbgraf",

&nbsp;&nbsp;&nbsp;&nbsp;"birth\_name": "Hilfiger",

&nbsp;&nbsp;&nbsp;&nbsp;"nationality": "000",

&nbsp;&nbsp;&nbsp;&nbsp;"sex": "M",

&nbsp;&nbsp;&nbsp;&nbsp;"social\_security\_number": "15070649C103",

&nbsp;&nbsp;&nbsp;&nbsp;"european\_social\_security\_number": null,

&nbsp;&nbsp;&nbsp;&nbsp;"country\_of\_birth": "122",

&nbsp;&nbsp;&nbsp;&nbsp;"place\_of\_birth": "Bruegge",

&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_birth": "2000-01-02",

&nbsp;&nbsp;&nbsp;&nbsp;"email": "baron@erbgraf.de",

&nbsp;&nbsp;&nbsp;&nbsp;"work\_permit": "2000-02-02",

&nbsp;&nbsp;&nbsp;&nbsp;"residency\_permit": "2000-03-02",

&nbsp;&nbsp;&nbsp;&nbsp;"certificate\_of\_study": "2000-04-02"

&nbsp;&nbsp;},

&nbsp;&nbsp;"social\_insurance": {

&nbsp;&nbsp;&nbsp;&nbsp;"company\_number\_of\_health\_insurer": "21203214",

&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_health\_insurance": 3,

&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_nursing\_insurance": 1,

&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_pension\_insurance": 1,

&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_unemployment\_insurance": 2,

&nbsp;&nbsp;&nbsp;&nbsp;"health\_insurance\_id": 1,

&nbsp;&nbsp;&nbsp;&nbsp;"is\_additional\_contribution\_to\_nursing\_insurance\_for\_childless\_ignored": true

&nbsp;&nbsp;},

&nbsp;&nbsp;"tax\_card": {

&nbsp;&nbsp;&nbsp;&nbsp;"annual\_tax\_allowance": 1200,

&nbsp;&nbsp;&nbsp;&nbsp;"child\_tax\_allowances": 80.0,

&nbsp;&nbsp;&nbsp;&nbsp;"denomination": "rk",

&nbsp;&nbsp;&nbsp;&nbsp;"factor": null,

&nbsp;&nbsp;&nbsp;&nbsp;"monthly\_tax\_allowance": 300,

&nbsp;&nbsp;&nbsp;&nbsp;"spouses\_denomination": "ev",

&nbsp;&nbsp;&nbsp;&nbsp;"tax\_class": 2

&nbsp;&nbsp;},

&nbsp;&nbsp;"taxation": {

&nbsp;&nbsp;&nbsp;&nbsp;"employment\_type": "2",

&nbsp;&nbsp;&nbsp;&nbsp;"requested\_annual\_allowance": 123,

&nbsp;&nbsp;&nbsp;&nbsp;"tax\_identification\_number": "12345678912",

&nbsp;&nbsp;&nbsp;&nbsp;"flat\_rate\_tax": 2

&nbsp;&nbsp;},

&nbsp;&nbsp;"vacation\_entitlement": {

&nbsp;&nbsp;&nbsp;&nbsp;"basic\_vacation\_entitlement": 30.0

&nbsp;&nbsp;},

&nbsp;&nbsp;"vocational\_training": {

&nbsp;&nbsp;&nbsp;&nbsp;"actual\_end": "2023-12-12",

&nbsp;&nbsp;&nbsp;&nbsp;"expected\_end": "2023-12-12",

&nbsp;&nbsp;&nbsp;&nbsp;"start": "2023-12-12"

&nbsp;&nbsp;}

}

## Use Case \- Mitarbeiter-Neuanlage

### Fachliche Beschreibung

Bei Neueinstellung ist es möglich, einen neuen Mitarbeiter über die Schnittstelle zu übergeben.

Verpflichtend? Ja. (Grundfunktion)

### Prämissen

* Es erfolgt ein regelmäßiger Datenabgleich zwischen Drittsystem & Lohnsystem (HR System ruft Daten ab)  
* Mitarbeiterneuanlagen laufen immer im Lohnsystem – auch im SOME Fall  
* Kostenstelle und Krankenkassen müssen im Lohnsystem angelegt sein

### Anforderungen

* Es werden alle Pflichtfelder zur Neuanlage eines Mitarbeiters übergeben (Liste siehe Feldbereiche)  
* Es wird aktiv eine neue Personalnummer im Lohnsystem vergeben  
* Das PMS System reagiert auf Validierungsmeldungen aus dem Lohnsystem  
* Es existiert ein datenschutzkonformes Rechtemanagement im PMS System (Grundlage für Partnerschaft)

### Validierung

* Spezielle Validierungsprüfungen für die SV Nummer, Steuer ID, IBAN  
* Wertebereichsprüfungen  
* Maximaler Wertebereich wird angeboten; HR System erhält lohnabrechnungsspezifische Rückmeldung  
* HR System erhält HTTP Statuscodes und lohnsystemspezifische Meldungen

### Feldbereiche

analog Technisches Beispiel

### Technisches Beispiel \- Beispielmitarbeiter

{

&nbsp;&nbsp;"personnel\_number": 42,

&nbsp;&nbsp;"company\_personnel\_number": "BX1dd2",

&nbsp;&nbsp;"surname": "Doe",

&nbsp;&nbsp;"first\_name": "John",

&nbsp;&nbsp;"business\_unit\_id": "1",

&nbsp;&nbsp;"payment\_method": "5",

&nbsp;&nbsp;"employment\_periods": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_commencement\_of\_employment": "2020-12-12",

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_termination\_of\_employment": "2099-12-31"

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\],

&nbsp;&nbsp;"gross\_payments": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 1,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"amount": 4200.00,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"salary\_type\_id": 200,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"payment\_months": "1, 4, 7, 10"

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\],

&nbsp;&nbsp;"hourly\_wages": \[

&nbsp;&nbsp;&nbsp;&nbsp;{

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": 1,

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"amount": 13.37

&nbsp;&nbsp;&nbsp;&nbsp;}

&nbsp;&nbsp;\],

&nbsp;&nbsp;"account": {

&nbsp;&nbsp;&nbsp;&nbsp;"iban": "DE02500105170137075030",

&nbsp;&nbsp;&nbsp;&nbsp;"bic": "GENODEF1P17",

&nbsp;&nbsp;&nbsp;&nbsp;"differing\_account\_holder": "Max Muster"

&nbsp;&nbsp;},

&nbsp;&nbsp;"activity": {

&nbsp;&nbsp;&nbsp;&nbsp;"highest\_level\_of\_professional\_training": 2,

&nbsp;&nbsp;&nbsp;&nbsp;"highest\_level\_of\_education": 2,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_monday": 5.00,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_tuesday": 5.00,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_wednesday": 5.00,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_thursday": 5.00,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_friday": 5.00,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_saturday": null,

&nbsp;&nbsp;&nbsp;&nbsp;"allocation\_of\_working\_hours\_sunday": null,

&nbsp;&nbsp;&nbsp;&nbsp;"weekly\_working\_hours": 25.00,

&nbsp;&nbsp;&nbsp;&nbsp;"individual\_cost\_center\_id": "TEST123",

&nbsp;&nbsp;&nbsp;&nbsp;"occupational\_title": "DevOps Engineer",

&nbsp;&nbsp;&nbsp;&nbsp;"job\_carried\_out": "15864",

&nbsp;&nbsp;&nbsp;&nbsp;"employee\_type": 101,

&nbsp;&nbsp;&nbsp;&nbsp;"contractual\_structure": 1,

&nbsp;&nbsp;&nbsp;&nbsp;"department\_id": "KST123",

&nbsp;&nbsp;&nbsp;&nbsp;"personnel\_leasing": 0

&nbsp;&nbsp;},

&nbsp;&nbsp;"address": {

&nbsp;&nbsp;&nbsp;&nbsp;"street": "Bahnhofstr.",

&nbsp;&nbsp;&nbsp;&nbsp;"house\_number": "12a",

&nbsp;&nbsp;&nbsp;&nbsp;"city": "Nuernberg",

&nbsp;&nbsp;&nbsp;&nbsp;"postal\_code": "90429",

&nbsp;&nbsp;&nbsp;&nbsp;"country": "D",

&nbsp;&nbsp;&nbsp;&nbsp;"address\_affix": "auf"

&nbsp;&nbsp;},

&nbsp;&nbsp;"personal\_data": {

&nbsp;&nbsp;&nbsp;&nbsp;"academic\_title": "Bachelor of Eng.",

&nbsp;&nbsp;&nbsp;&nbsp;"name\_prefix": "an",

&nbsp;&nbsp;&nbsp;&nbsp;"name\_affix": "Baron",

&nbsp;&nbsp;&nbsp;&nbsp;"birth\_name\_prefix": "von",

&nbsp;&nbsp;&nbsp;&nbsp;"birth\_name\_affix": "Erbgraf",

&nbsp;&nbsp;&nbsp;&nbsp;"birth\_name": "Hilfiger",

&nbsp;&nbsp;&nbsp;&nbsp;"nationality": "000",

&nbsp;&nbsp;&nbsp;&nbsp;"sex": "M",

&nbsp;&nbsp;&nbsp;&nbsp;"social\_security\_number": "15070649C103",

&nbsp;&nbsp;&nbsp;&nbsp;"european\_social\_security\_number": null,

&nbsp;&nbsp;&nbsp;&nbsp;"country\_of\_birth": "122",

&nbsp;&nbsp;&nbsp;&nbsp;"place\_of\_birth": "Bruegge",

&nbsp;&nbsp;&nbsp;&nbsp;"date\_of\_birth": "2000-01-02",

&nbsp;&nbsp;&nbsp;&nbsp;"email": "baron@erbgraf.de",

&nbsp;&nbsp;&nbsp;&nbsp;"work\_permit": "2000-02-02",

&nbsp;&nbsp;&nbsp;&nbsp;"residency\_permit": "2000-03-02",

&nbsp;&nbsp;&nbsp;&nbsp;"certificate\_of\_study": "2000-04-02"

&nbsp;&nbsp;},

&nbsp;&nbsp;"social\_insurance": {

&nbsp;&nbsp;&nbsp;&nbsp;"company\_number\_of\_health\_insurer": "21203214",

&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_health\_insurance": 3,

&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_nursing\_insurance": 1,

&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_pension\_insurance": 1,

&nbsp;&nbsp;&nbsp;&nbsp;"contribution\_class\_unemployment\_insurance": 2,

&nbsp;&nbsp;&nbsp;&nbsp;"health\_insurance\_id": 1,

&nbsp;&nbsp;&nbsp;&nbsp;"is\_additional\_contribution\_to\_nursing\_insurance\_for\_childless\_ignored": true

&nbsp;&nbsp;},

&nbsp;&nbsp;"tax\_card": {

&nbsp;&nbsp;&nbsp;&nbsp;"annual\_tax\_allowance": 1200,

&nbsp;&nbsp;&nbsp;&nbsp;"child\_tax\_allowances": 80.0,

&nbsp;&nbsp;&nbsp;&nbsp;"denomination": "rk",

&nbsp;&nbsp;&nbsp;&nbsp;"factor": null,

&nbsp;&nbsp;&nbsp;&nbsp;"monthly\_tax\_allowance": 300,

&nbsp;&nbsp;&nbsp;&nbsp;"spouses\_denomination": "ev",

&nbsp;&nbsp;&nbsp;&nbsp;"tax\_class": 2

&nbsp;&nbsp;},

&nbsp;&nbsp;"taxation": {

&nbsp;&nbsp;&nbsp;&nbsp;"employment\_type": "2",

&nbsp;&nbsp;&nbsp;&nbsp;"requested\_annual\_allowance": 123,

&nbsp;&nbsp;&nbsp;&nbsp;"tax\_identification\_number": "12345678912",

&nbsp;&nbsp;&nbsp;&nbsp;"flat\_rate\_tax": 2

&nbsp;&nbsp;},

&nbsp;&nbsp;"vacation\_entitlement": {

&nbsp;&nbsp;&nbsp;&nbsp;"basic\_vacation\_entitlement": 30.0

&nbsp;&nbsp;},

&nbsp;&nbsp;"vocational\_training": {

&nbsp;&nbsp;&nbsp;&nbsp;"actual\_end": "2023-12-12",

&nbsp;&nbsp;&nbsp;&nbsp;"expected\_end": "2023-12-12",

&nbsp;&nbsp;&nbsp;&nbsp;"start": "2023-12-12"

&nbsp;&nbsp;}

}

Use Case \- Änderung von Daten

## Fachliche Beschreibung

Mitarbeiterdaten können über die Schnittstelle geändert werden. Die Pflichtbereiche beziehen sich auf Felder, die in einer Selfservice-Lösung geändert werden können (Name, Bankverbindung und Adresse). Diese Felder sollen im Falle von z. B. Scheidung oder Umzug vom Mitarbeiter selbst verwaltet werden. Außerdem sind Felder zum Gehalt bzw. Stundenlohn in den verpflichtenden Grundfunktionen enthalten.

Verpflichtend? Teilweise. (Bestimmte Felder)

### Prämissen

* Es erfolgt ein regelmäßiger Datenabgleich zwischen Drittsystem und Lohnsystem  
* HR-System holt sich den aktuellen Datenbestand  
* Vor Senden der Daten durch HR an Lohnprodukt muss ein initialer Datenabzug aus dem Lohnsystem für alle Felder erfolgen

### Anforderungen

* Prozess: MA erfasst die Änderung im SelfService des HR-Systems und lädt parallel einen Nachweis dessen hoch (dieses Vorgehen definiert die verpflichtenden Felder Name, Adresse und Bankdaten)  
* weiterer Pflicht-Use Case ist die Änderung des Gehalts / des Stundenlohns

### Validierung

* Spezielle Validierungsprüfungen (Unicode-Fähigkeit)  
* Wertebereichsprüfungen  
* Validierung deutsche / ausländische Adresse  
* Feldlänge und Aufteilung falls Straße und HausNr. in einem Feld übergeben wird. Sonderfall Mannheim Quadrate klären.

### Verpflichtende Felder

Diese Felder müssen vollständig und richtig ans Lohnprogramm übertragen werden.

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| personnel\_number | Vorschlag Personalnummer |
| company\_personnel\_number | Betriebliche Personalnummer |

#### Persönliche Daten

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| first\_name | Vorname |
| surname | Familienname |
| street | Straße |
| house\_number | Hausnummer |
| postal\_code | Postleitzahl |
| city | Ort |
| date\_of\_birth | Geburtsdatum |
| sex | Geschlecht |
| nationality | Staatsangehörigkeit |
| social\_security\_number | Sozialversicherungsnummer |

#### Arbeitszeit und Tätigkeit

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| allocation\_of\_working\_hours\_monday | Arbeitszeit Montag |
| allocation\_of\_working\_hours\_tuesday | Arbeitszeit Dienstag |
| allocation\_of\_working\_hours\_wednesday | Arbeitszeit Mittwoch |
| allocation\_of\_working\_hours\_thursday | Arbeitszeit Donnerstag |
| allocation\_of\_working\_hours\_friday | Arbeitszeit Freitag |
| allocation\_of\_working\_hours\_saturday | Arbeitszeit Samstag |
| allocation\_of\_working\_hours\_sunday | Arbeitszeit Sonntag |
| id | Festbezugs-ID |
| salary\_type\_id | Lohnart |
| Salary\_Type \-\> id;name | Lohnartenname |
| amount | Betrag |
| payment\_month | Intervall |
| reference\_date | Gültigkeit in den Monaten (bei wiederkehrenden Zahlungen) |
| business\_unit\_id | Beschäftigungsbetrieb |
| employee\_type (key group) | Personengruppenschlüssel |

#### Neunstelliger Tätigkeitsschlüssel

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| occupational\_title | Ausgeübte Tätigkeit |
| highest\_level\_of\_education | Höchster Schulabschluss (Auswahlliste) |
| highest\_level\_of\_professional\_training | Höchster Ausbildungsabschluss (Auswahlliste) |
| contractual\_structure | Vertragsform (Auswahlliste) |
| personnel\_leasing | Arbeitnehmerüberlassung (Auswahlliste) |

#### Steuermerkmale

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| tax\_identification\_number | Steueridentifikationsnummer |
| employment\_type | Kennzeichnung Arbeitgeber (Haupt/Neben AG) |
| factor | Faktor |
| annual\_tax\_allowance | Frei- bzw. Hinzurechnungsbetrag Jahr |
| monthly\_tax\_allowance | Frei- bzw. Hinzurechnungsbetrag Monat |

#### Sonstiges

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| iban | IBAN |
| current\_year\_vacation\_entitlement | Urlaubsanspruch aktuelles Jahr |
| basic\_vacation\_entitlement | allgemeiner Urlaubsanspruch pro Jahr |
| date\_of\_termination\_of\_employment | Eintrittsdatum |
| date\_of\_commencement\_of\_employment | Austrittsdatum |

Use Case \- Erfassung von Monatsdaten

## Fachliche Beschreibung

Um sinnvoll Bewegungsdaten zu bestücken muss in einem ersten Schritt ein Abruf von bestehenden Lohnarten erfolgen. Einmalzahlungen, Boni und Stundendaten der Mitarbeiter werden daraufhin im Lohnsystem erfasst. Die kumulierten Monatsdaten werden an das Lohnsystem übergeben und es erfolgt eine Validierung, ob die angesprochenen Lohnarten im Lohnbestand existieren bzw. dass die Monatsdaten im gültigen Wertebereich liegen. Danach werden die Daten in das Lohnsystem eingespielt. Damit ist eine automatische Übernahme von Monatsdaten in das Lohnsystem möglich und durch das Übertragen dieser Massedaten erfolgt eine wesentliche Prozesskostenoptimierung.

Verpflichtend? Ja, wenn vorhanden.

### Prämissen

* Einmalige Gehaltsbestandteile (Stunden, Bruttobezüge, Nettobezüge, Urlaubstage, Krankheitstage) werden über die Bewegungsdaten an das Lohnsystem übergeben.  
* Es erfolgt ein "regelmäßiger" Datenabgleich zwischen HR System und Lohnsystem (HR System holt sich den aktuellen Lohnarten aus dem Lohnbestand)

### Validierung

* Ist die Lohnart im Lohnbestand enthalten?  
* Sind die Bewegungsdaten im gültigen Wertebereich?

### Feldbereiche

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| month\_of\_emergence | Abrechnungsmonat |
| differing\_factor | Abweichender Lohnfaktor |
| processing\_code | Bearbeitungsschlüssel |
| cost\_center\_id | Kostenstelle |
| salary\_type\_id | Lohnart |
| value | Wert |

Use Case \- Erfassung von Fehlzeiten

## Fachliche Beschreibung

Mit dem Lohnaustauschdatenservice ist es möglich, Fehlzeiten auszutauschen, um keine manuelle Erfassung der Daten in der Kanzlei und im HR System des Mandanten machen zu müssen sowie einen sicheren und automatisierten Datenaustausch zu gewährleisten.

Verpflichtend? Nein.

### Validierung

* Standardvalidierung

### Feldbereiche

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| absence\_start\_date | Beginn Fehlzeit |
| absence\_end\_date | Ende Fehlzeit |
| reason\_for\_absence | Fehlzeitgrund |

Use Case \- Anpassung Gehalt/Stundenlohn

## Fachliche Beschreibung

Mit einem Abruf der aktuell im Lohnsystem gespeicherten Festbezüge kann eine Neuanlage oder Änderung von bestehenden Festbezügen erfolgen. Die Gehaltsänderung wird vom HR Manager durchgrührt und an das Lohnprogramm übergeben. Es erfolgt eine Validierung, ob es sich um eine korrekte Neuanlage bzw. Änderung an den Festbezügen handelt und die Daten werden ins Lohnprogramm eingespielt.

Verpflichtend? Ja.

### Prämissen

* Gehaltsbestandteile werden in den Festbezugsmasken in LODAS/ LUG erfasst bzw. geändert  
* Es erfolgt ein "regelmäßiger" Datenabgleich zwischen HR System und Lohnsystem (HR System holt sich den aktuellen Datenbestand)  
* grundsätzlich sehen wir das HR System als das führende System für den Austausch von Festbezügen  
* es muss immer der komplette Festbezug übergeben werden und nicht die ggf. anteilige Kürzung aufgrund einer Unterbrechung

### Anforderungen

* Regelmäßiger Abruf der Festbezüge aus dem Lohnsystem  
* Speicherung der Festbezugs ID im HR System

### Validierung

* Maximal 5 (LuG) / 3(LODAS) Stundenlöhne mit höchstens 999,99 (LuG) und 99,99 (LODAS) Euro  
* Validierung, ob eine Neuanlage auch tatsächlich auf eine leeres Festbezugsfeld stattfindet

### Feldbereiche

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| id | Festbezugs-ID |
| salary\_type\_id | Lohnart |
| Salary\_Type \-\> id;name | Lohnartenname |
| amount | Betrag |
| payment\_month | Intervall |
| reference\_date | Gültigkeit in den Monaten (bei wiederkehrenden Zahlungen) |
| HourlyWage (id= 1, amount) | Stundenlohn 1-3/5 |

Feldumfang Lohnaustauschdatenservice

Die folgende Liste zeigt alle Felder auf, die über den Lohnaustauschdatenservice ausgetauscht werden können.

In unseren Lohnabrechnungsprogrammen sind einige Felder durch Schlüssel-Wert-Paare definiert. Für LODAS gibt es ein Schnittstellenhandbuch [hier](https://wissensplattform.apps.datev.de/api/amr/knowledge-common/v1/entities/st81064830359671307_de.pdf). Für LuG gibt es mehrere Dokumente auf folgender [Seite im Hilfe-Center](https://help-center.apps.datev.de/documents/1080789) unter *6.2 Lohn und Gehalt*.

⚠️ Info  
Beim Mappen der Felder ist darauf zu achten, dass sich Schlüssel-Wert-Paare zwischen LuG und LODAS unterscheiden.

&nbsp;

### Allgemeine Daten

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| surname | Nachname |
| client\_id | Mandanten-ID |
| personnel\_number | Personalnummer |
| company\_personnel\_number | Firmen-Personalnummer |
| first\_name | Vorname |
| employment\_id | Beschäftigungs-ID |
| business\_unit\_id | Beschäftigungsbetrieb |
| payment\_method | Zahlungsart |
| date\_of\_instant\_registration | Datum der Sofortmeldung |
| instant\_registration\_uuid | UUID der Sofortmeldung |

&nbsp;

### Tätigkeit

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| highest\_level\_of\_professional\_training | Höchster beruflicher Ausbildungsabschluss |
| highest\_level\_of\_education | Höchster Bildungsabschluss |
| allocation\_of\_working\_hours\_monday | Verteilung der Arbeitszeit Montag |
| allocation\_of\_working\_hours\_tuesday | Verteilung der Arbeitszeit Dienstag |
| allocation\_of\_working\_hours\_wednesday | Verteilung der Arbeitszeit Mittwoch |
| allocation\_of\_working\_hours\_thursday | Verteilung der Arbeitszeit Donnerstag |
| allocation\_of\_working\_hours\_friday | Verteilung der Arbeitszeit Freitag |
| allocation\_of\_working\_hours\_saturday | Verteilung der Arbeitszeit Samstag |
| allocation\_of\_working\_hours\_sunday | Verteilung der Arbeitszeit Sonntag |
| weekly\_working\_hours | Wöchentliche Arbeitszeit |
| individual\_cost\_center\_id | Individuelle Kostenstellen-ID |
| occupational\_title | Berufsbezeichnung |
| job\_carried\_out | Ausgeübte Tätigkeit |
| employee\_type | Mitarbeiterart |
| contractual\_structure | Vertragsstruktur |
| activity\_type | Tätigkeitsart |
| department\_id | Abteilungs-ID |
| personnel\_leasing | Arbeitnehmerüberlassung |

&nbsp;

### Bankverbindung

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| iban | IBAN |
| bic | BIC |
| differing\_account\_holder | Abweichender Kontoinhaber |

&nbsp;

### Adresse

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| address\_affix | Adresszusatz |
| city | Stadt |
| country | Land |
| house\_number | Hausnummer |
| postal\_code | Postleitzahl |
| street | Straße |

&nbsp;

### Beschäftigungszeitraum

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| date\_of\_commencement\_of\_employment | Beschäftigungsbeginn |
| date\_of\_termination\_of\_employment | Beschäftigungsende |

&nbsp;

### Festbezüge

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| id | Festbezugs-ID |
| amount | Betrag |
| salary\_type\_id | Lohnart |
| payment\_months | Intervall |

&nbsp;

### Stundenlohn

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| id | Stundenlohn-ID |
| amount | Betrag |

&nbsp;

### Individuelle Felder

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| id | ID |
| long\_field\_name | Langbezeichnung Feld 1 |
| short\_field\_name | Kurzbezeichnung Feld 1 |
| date | Datum Feld 1 |
| amount | Betrag Feld 1 |
| long\_field\_name2 | Langbezeichnung Feld 2 |
| short\_field\_name2 | Kurzbezeichnung Feld 2 |
| date2 | Datum Feld 2 |
| amount2 | Betrag Feld 2 |
| long\_field\_name3 | Langbezeichnung Feld 3 |
| short\_field\_name3 | Kurzbezeichnung Feld 3 |
| date3 | Datum Feld 3 |
| amount3 | Betrag Feld 3 |
| long\_field\_name4 | Langbezeichnung Feld 4 |
| short\_field\_name4 | Kurzbezeichnung Feld 4 |
| date4 | Datum Feld 4 |
| amount4 | Betrag Feld 4 |
| long\_field\_name5 | Langbezeichnung Feld 5 |
| short\_field\_name5 | Kurzbezeichnung Feld 5 |
| date5 | Datum Feld 5 |
| amount5 | Betrag Feld 5 |
| long\_field\_name6 | Langbezeichnung Feld 6 |
| short\_field\_name6 | Kurzbezeichnung Feld 6 |
| date6 | Datum Feld 6 |
| amount6 | Betrag Feld 6 |
| long\_field\_name7 | Langbezeichnung Feld 7 |
| short\_field\_name7 | Kurzbezeichnung Feld 7 |
| date7 | Datum Feld 7 |
| amount7 | Betrag Feld 7 |
| long\_field\_name8 | Langbezeichnung Feld 8 |
| short\_field\_name8 | Kurzbezeichnung Feld 8 |
| date8 | Datum Feld 8 |
| amount8 | Betrag Feld 8 |

&nbsp;

### Persönliche Daten

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| nationality | Staatsangehörigkeit |
| sex | Geschlecht |
| email | E-Mail-Adresse |
| phone | Telefonnummer |
| academic\_title | Akademischer Titel |
| name\_prefix | Namensvorsatz |
| name\_affix | Namenszusatz |
| birth\_name | Geburtsname |
| birth\_name\_prefix | Vorsatz des Geburtsnamens |
| birth\_name\_affix | Zusatz des Geburtsnamens |
| country\_of\_birth | Geburtsland |
| date\_of\_birth | Geburtsdatum |
| place\_of\_birth | Geburtsort |
| work\_permit | Arbeitserlaubnis |
| residency\_permit | Aufenthaltserlaubnis |
| certificate\_of\_study | Studienbescheinigung |
| social\_security\_number | Sozialversicherungsnummer |
| european\_social\_security\_number | Europäische Sozialversicherungsnummer |
| initial\_day\_of\_entrance | Erstes Eintrittsdatum |

&nbsp;

### Sozialversicherungsdaten

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| contribution\_class\_health\_insurance | Beitragsgruppe Krankenversicherung |
| contribution\_class\_nursing\_insurance | Beitragsgruppe Pflegeversicherung |
| contribution\_class\_pension\_insurance | Beitragsgruppe Rentenversicherung |
| contribution\_class\_unemployment\_insurance | Beitragsgruppe Arbeitslosenversicherung |
| company\_number\_of\_health\_insurer | Betriebsnummer der Krankenkasse |
| health\_insurance\_id | Krankenkassen-ID |
| is\_additional\_contribution\_to\_nursing\_insurance\_for\_childless\_ignored | Kinderlosenzuschlag Pflegeversicherung ignorieren |
| branch\_office\_of\_health\_insurer | Geschäftsstelle der Krankenkasse |
| health\_insurer\_for\_marginal\_employee | Krankenkasse für geringfügig Beschäftigte |

&nbsp;

### Steuerkarte

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| annual\_tax\_allowance | Jährlicher Steuerfreibetrag |
| child\_tax\_allowances | Kinderfreibeträge |
| denomination | Religionszugehörigkeit / Konfession |
| factor | Faktorverfahren |
| monthly\_tax\_allowance | Monatlicher Steuerfreibetrag |
| spouses\_denomination | Religionszugehörigkeit des Ehepartners |
| tax\_class | Steuerklasse |

&nbsp;

### Steueridentifikationsmerkmale

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| employment\_type | Beschäftigungsart |
| requested\_annual\_allowance | Beantragter jährlicher Freibetrag |
| tax\_identification\_number | Steuer-Identifikationsnummer |
| flat\_rate\_tax | Pauschalbesteuerung |

&nbsp;

### Urlaubsanspruch

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| basic\_vacation\_entitlement | Grundurlaubsanspruch |

&nbsp;

### Berufsausbildung

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| personnel\_number | Personalnummer |
| start | Beginn |
| expected\_end | Voraussichtliches Ende |
| actual\_end | Tatsächliches Ende |

&nbsp;

### Monatsdaten

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| personnel\_number | Personalnummer |
| value | Wert |
| salary\_type\_id | Lohnart-ID |
| differing\_factor | Abweichender Faktor |
| cost\_center\_id | Kostenstellen-ID |
| month\_of\_emergence | Entstehungsmonat |
| processing\_code | Verarbeitungsschlüssel |

&nbsp;

### Abwesenheiten

#### LODAS

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| personnel\_number | Personalnummer |
| absence\_start\_date | Beginn der Abwesenheit |
| absence\_end\_date | Ende der Abwesenheit |
| reason\_for\_absence | Abwesenheitsgrund |

#### LuG

| Feldbezeichnung | Deutsche Bezeichnung |
| :---- | :---- |
| id | ID |
| personnel\_number | Personalnummer |
| date\_of\_emergence | Entstehungsdatum |
| reason\_for\_absence | Abwesenheitsgrund |
| salary\_type\_id | Lohnart-ID |
| hours | Stunden |
| days | Tage |
| differing\_factor | Abweichender Faktor |
| differing\_pay\_change | Abweichende Entgeltänderung |
| cost\_center\_id | Kostenstellen-ID |

# Referenz

## Definitions

AbsenceLodas

Body

personnel\_number

integer (int32)

Beispiel:

`personnel_number = 12345`

Maximum:

`99999`

Minimum:

`1`

absence\_start\_date

string (date)

Beispiel:

`absence_start_date = 2021-01-01`

Max Length:

`10`

absence\_end\_date

string (date)

Beispiel:

`absence_end_date = 2021-01-01`

Max Length:

`10`

reason\_for\_absence

integer (int32)

Beispiel:

`reason_for_absence = 32`

Request Beispiel

`{`

`"personnel_number":12345,`

`"absence_start_date":"2021-01-01",`

`"absence_end_date":"2021-01-01",`

`"reason_for_absence":32`

`}`

AbsenceLug

Body

id

string (int32)

Beispiel:

`id = "abc"`

Maximum:

`2147483647`

Minimum:

`1`

personnel\_number

integer (int32)

Beispiel:

`personnel_number = 12345`

Maximum:

`99999`

Minimum:

`1`

date\_of\_emergence

string (date)

Beispiel:

`date_of_emergence = 2021-01-01`

Max Length:

`10`

reason\_for\_absence

string (enum)

For an explanation of codes, see [Tabelle der Ausfallschlüssel \- DATEV Hilfe-Center](https://apps.datev.de/help-center/documents/9222265)

Beispiel:

`reason_for_absence = K`

salary\_type\_id

integer (int32)

salary type to be used for calculation

Beispiel:

`salary_type_id = 0`

Maximum:

`9999`

Minimum:

`1`

hours

number (double)

The number of hours on the given day.

Beispiel:

`hours = 0`

Maximum:

`24`

days

number (double)

The (proportionate) number of days on the given day.

Beispiel:

`days = 0`

Maximum:

`1`

differing\_factor

number (double)

Differing factor in EURO. Can only be used with hourly and time wage types.

Beispiel:

`differing_factor = 0`

Maximum:

`99.99`

differing\_pay\_change

number (double)

Divergent percentage pay adjustment. Can only be used with hourly and time wage types.

Beispiel:

`differing_pay_change = 0`

Maximum:

`999.99`

Minimum:

`-999.99`

cost\_center\_id

string

The identification number of the allocated cost unit of the calendar record.

Beispiel:

`cost_center_id = "abc"`

Max Length:

`13`

Request Beispiel

`{`

`"id":"abc",`

`"personnel_number":12345,`

`"date_of_emergence":"2021-01-01",`

`"reason_for_absence":"K",`

`"salary_type_id":0,`

`"hours":0,`

`"days":0,`

`"differing_factor":0,`

`"differing_pay_change":0,`

`"cost_center_id":"abc"`

`}`

Account

Body

iban

string

Beispiel:

`iban = "abc"`

Max Length:

`34`

bic

string

Beispiel:

`bic = "abc"`

Max Length:

`11`

differing\_account\_holder

string

Beispiel:

`differing_account_holder = "abc"`

Max Length:

`25`

Request Beispiel

`{`

`"iban":"abc",`

`"bic":"abc",`

`"differing_account_holder":"abc"`

`}`

Activity

Body

highest\_level\_of\_professional\_training

integer (int32)

Beispiel:

`highest_level_of_professional_training = 1`

Maximum:

`9`

Minimum:

`1`

highest\_level\_of\_education

integer (int32)

Beispiel:

`highest_level_of_education = 1`

Maximum:

`9`

Minimum:

`1`

allocation\_of\_working\_hours\_monday

number (double)

Beispiel:

`allocation_of_working_hours_monday = 0`

Maximum:

`24`

allocation\_of\_working\_hours\_tuesday

number (double)

Beispiel:

`allocation_of_working_hours_tuesday = 0`

Maximum:

`24`

allocation\_of\_working\_hours\_wednesday

number (double)

Beispiel:

`allocation_of_working_hours_wednesday = 0`

Maximum:

`24`

allocation\_of\_working\_hours\_thursday

number (double)

Beispiel:

`allocation_of_working_hours_thursday = 0`

Maximum:

`24`

allocation\_of\_working\_hours\_friday

number (double)

Beispiel:

`allocation_of_working_hours_friday = 0`

Maximum:

`24`

allocation\_of\_working\_hours\_saturday

number (double)

Beispiel:

`allocation_of_working_hours_saturday = 0`

Maximum:

`24`

allocation\_of\_working\_hours\_sunday

number (double)

Beispiel:

`allocation_of_working_hours_sunday = 0`

Maximum:

`24`

weekly\_working\_hours

number (double)

Beispiel:

`weekly_working_hours = 0`

Maximum:

`99`

individual\_cost\_center\_id

string

Beispiel:

`individual_cost_center_id = "abc"`

Max Length:

`13`

occupational\_title

string

Beispiel:

`occupational_title = "abc"`

Max Length:

`30`

job\_carried\_out

string

This field can not be deleted in LuG and LODAS.

Beispiel:

`job_carried_out = "abc"`

Max Length:

`5`

employee\_type

string (enum)

Beispiel:

`employee_type = 101`

Max Length:

`3`

contractual\_structure

string (enum)

This field can not be deleted in LuG and LODAS.

Beispiel:

`contractual_structure = 1`

Max Length:

`1`

activity\_type

integer (int32)

Beispiel:

`activity_type = 0`

Maximum:

`11`

department\_id

string

Beispiel:

`department_id = "abc"`

Max Length:

`8`

personnel\_leasing

integer (int32)

This field can not be deleted in LuG and LODAS.

Beispiel:

`personnel_leasing = 0`

Maximum:

`2`

Request Beispiel

`{`

`"highest_level_of_professional_training":1,`

`"highest_level_of_education":1,`

`"allocation_of_working_hours_monday":0,`

`"allocation_of_working_hours_tuesday":0,`

`"allocation_of_working_hours_wednesday":0,`

`"allocation_of_working_hours_thursday":0,`

`"allocation_of_working_hours_friday":0,`

`"allocation_of_working_hours_saturday":0,`

`"allocation_of_working_hours_sunday":0,`

`"weekly_working_hours":0,`

`"individual_cost_center_id":"abc",`

`"occupational_title":"abc",`

`"job_carried_out":"abc",`

`"employee_type":"101",`

`"contractual_structure":"1",`

`"activity_type":0,`

`"department_id":"abc",`

`"personnel_leasing":0`

`}`

AdditionalError

Body

id

string

Required

Beispiel:

`id = "abc"`

severity

string (enum)

Required

Beispiel:

`severity = ERROR`

description

string

Beispiel:

`description = "abc"`

help\_uri

string

Beispiel:

`help_uri = "abc"`

path

string

Beispiel:

`path = "abc"`

affected\_fields

array

Beispiel:

`affected_fields = []`

Request Beispiel

`{`

`"id":"abc",`

`"severity":"ERROR",`

`"description":"abc",`

`"help_uri":"abc",`

`"path":"abc",`

`"affected_fields": [`

`]`

`}`

Address

Body

address\_affix

string

Beispiel:

`address_affix = "abc"`

Max Length:

`40`

city

string

This field can not be deleted in LuG.

Beispiel:

`city = "abc"`

Max Length:

`34`

country

string (enum)

Required

Beispiel:

`country = A`

Max Length:

`3`

house\_number

string

This field can not be deleted in LuG.

Beispiel:

`house_number = "abc"`

Max Length:

`9`

postal\_code

string

Required

This field can not be deleted in LODAS.

Beispiel:

`postal_code = "abc"`

Max Length:

`10`

street

string

This field can not be deleted in LuG.

Beispiel:

`street = "abc"`

Max Length:

`33`

Request Beispiel

`{`

`"address_affix":"abc",`

`"city":"abc",`

`"country":"A",`

`"house_number":"abc",`

`"postal_code":"abc",`

`"street":"abc"`

`}`

Employee

Body

surname

string

Required

Beispiel:

`surname = "abc"`

Max Length:

`30`

client\_id

string

Beispiel:

`client_id = "abc"`

Max Length:

`13`

personnel\_number

integer (int32)

Beispiel:

`personnel_number = 0`

Maximum:

`99999`

Minimum:

`1`

company\_personnel\_number

string

Beispiel:

`company_personnel_number = "abc"`

Max Length:

`20`

first\_name

string

Beispiel:

`first_name = "abc"`

Max Length:

`30`

employment\_id

string

Beispiel:

`employment_id = "abc"`

Max Length:

`36`

business\_unit\_id

integer (int32)

Beispiel:

`business_unit_id = 0`

Maximum:

`9999`

payment\_method

string (enum)

Beispiel:

`payment_method = 1`

Maximum:

`1`

date\_of\_instant\_registration

string (date)

Beispiel:

`date_of_instant_registration = "abc"`

instant\_registration\_uuid

string (uuid)

Beispiel:

`instant_registration_uuid = "abc"`

activity

Activity

Beispiel:

`activity = {"highest_level_of_professional_training":1,"highest_level_of_education":1,"allocation_of_working_hours_monday":0,"allocation_of_working_hours_tuesday":0,"allocation_of_working_hours_wednesday":0,"allocation_of_working_hours_thursday":0,"allocation_of_working_hours_friday":0,"allocation_of_working_hours_saturday":0,"allocation_of_working_hours_sunday":0,"weekly_working_hours":0,"individual_cost_center_id":"abc","occupational_title":"abc","job_carried_out":"abc","employee_type":"101","contractual_structure":"1","activity_type":0,"department_id":"abc","personnel_leasing":0}`

Schema:

`{"highest_level_of_professional_training":"integer (int32)","highest_level_of_education":"integer (int32)","allocation_of_working_hours_monday":"number (double)","allocation_of_working_hours_tuesday":"number (double)","allocation_of_working_hours_wednesday":"number (double)","allocation_of_working_hours_thursday":"number (double)","allocation_of_working_hours_friday":"number (double)","allocation_of_working_hours_saturday":"number (double)","allocation_of_working_hours_sunday":"number (double)","weekly_working_hours":"number (double)","individual_cost_center_id":"string","occupational_title":"string","job_carried_out":"string","employee_type":"string (enum)","contractual_structure":"string (enum)","activity_type":"integer (int32)","department_id":"string","personnel_leasing":"integer (int32)"}`

account

Account

Beispiel:

`account = {"iban":"abc","bic":"abc","differing_account_holder":"abc"}`

Schema:

`{"iban":"string","bic":"string","differing_account_holder":"string"}`

address

Address

Beispiel:

`address = {"address_affix":"abc","city":"abc","country":"A","house_number":"abc","postal_code":"abc","street":"abc"}`

Schema:

`{"address_affix":"string","city":"string","country":"string (enum)","house_number":"string","postal_code":"string","street":"string"}`

employment\_periods

array

Beispiel:

`employment_periods = [{"date_of_commencement_of_employment":"abc","date_of_termination_of_employment":"abc"}]`

Schema:

`{"date_of_commencement_of_employment":"string (date)","date_of_termination_of_employment":"string (date)"}`

gross\_payments

array

Beispiel:

`gross_payments = [{"id":0,"amount":0,"salary_type_id":0,"payment_months":"abc"}]`

Schema:

`{"id":"integer (int64)","amount":"number (double)","salary_type_id":"integer (int32)","payment_months":"string"}`

hourly\_wages

array

Beispiel:

`hourly_wages = [{"id":0,"amount":0}]`

Schema:

`{"id":"integer (int32)","amount":"number (double)"}`

individual\_data

IndividualData

Beispiel:

`individual_data = {"id":"abc","long_field_name":"abc","short_field_name":"abc","date":"abc","amount":0,"long_field_name2":"abc","short_field_name2":"abc","date2":"abc","amount2":0,"long_field_name3":"abc","short_field_name3":"abc","date3":"abc","amount3":0,"long_field_name4":"abc","short_field_name4":"abc","date4":"abc","amount4":0,"long_field_name5":"abc","short_field_name5":"abc","date5":"abc","amount5":0,"long_field_name6":"abc","short_field_name6":"abc","date6":"abc","amount6":0,"long_field_name7":"abc","short_field_name7":"abc","date7":"abc","amount7":0,"long_field_name8":"abc","short_field_name8":"abc","date8":"abc","amount8":0}`

Schema:

`{"id":"string","long_field_name":"string","short_field_name":"string","date":"string (date)","amount":"number (double)","long_field_name2":"string","short_field_name2":"string","date2":"string (date)","amount2":"number (double)","long_field_name3":"string","short_field_name3":"string","date3":"string (date)","amount3":"number (double)","long_field_name4":"string","short_field_name4":"string","date4":"string (date)","amount4":"number (double)","long_field_name5":"string","short_field_name5":"string","date5":"string (date)","amount5":"number (double)","long_field_name6":"string","short_field_name6":"string","date6":"string (date)","amount6":"number (double)","long_field_name7":"string","short_field_name7":"string","date7":"string (date)","amount7":"number (double)","long_field_name8":"string","short_field_name8":"string","date8":"string (date)","amount8":"number (double)"}`

personal\_data

PersonalData

Beispiel:

`personal_data = {"nationality":"abc","sex":"D","email":"abc","phone":"abc","academic_title":"abc","name_prefix":"a","name_affix":"Bar","birth_name":"abc","birth_name_prefix":"a","birth_name_affix":"Bar","country_of_birth":"abc","date_of_birth":"abc","place_of_birth":"abc","work_permit":"abc","residency_permit":"abc","certificate_of_study":"abc","social_security_number":"abc","european_social_security_number":"abc","initial_day_of_entrance":"abc"}`

Schema:

`{"nationality":"string","sex":"string (enum)","email":"string","phone":"string","academic_title":"string","name_prefix":"string (enum)","name_affix":"string (enum)","birth_name":"string","birth_name_prefix":"string (enum)","birth_name_affix":"string (enum)","country_of_birth":"string","date_of_birth":"string (date)","place_of_birth":"string","work_permit":"string (date)","residency_permit":"string (date)","certificate_of_study":"string (date)","social_security_number":"string","european_social_security_number":"string","initial_day_of_entrance":"string (date)"}`

social\_insurance

SocialInsurance

Beispiel:

`social_insurance = {"contribution_class_health_insurance":0,"contribution_class_nursing_insurance":0,"contribution_class_pension_insurance":0,"contribution_class_unemployment_insurance":0,"company_number_of_health_insurer":"abc","health_insurance_id":0,"is_additional_contribution_to_nursing_insurance_for_childless_ignored":false,"branch_office_of_health_insurer":0,"health_insurer_for_marginal_employee":"abc"}`

Schema:

`{"contribution_class_health_insurance":"integer (int32)","contribution_class_nursing_insurance":"integer (int32)","contribution_class_pension_insurance":"integer (int32)","contribution_class_unemployment_insurance":"integer (int32)","company_number_of_health_insurer":"string","health_insurance_id":"integer (int32)","is_additional_contribution_to_nursing_insurance_for_childless_ignored":"boolean","branch_office_of_health_insurer":"integer (int32)","health_insurer_for_marginal_employee":"string"}`

tax\_card

TaxCard

Beispiel:

`tax_card = {"annual_tax_allowance":0,"child_tax_allowances":0,"denomination":"ak","factor":0,"monthly_tax_allowance":0,"spouses_denomination":"ak","tax_class":"abc"}`

Schema:

`{"annual_tax_allowance":"integer (int32)","child_tax_allowances":"number (double)","denomination":"string (enum)","factor":"number (double)","monthly_tax_allowance":"integer (int32)","spouses_denomination":"string (enum)","tax_class":"string (int32)"}`

taxation

Taxation

Beispiel:

`taxation = {"employment_type":1,"requested_annual_allowance":0,"tax_identification_number":"abc","flat_rate_tax":0}`

Schema:

`{"employment_type":"integer (int32)","requested_annual_allowance":"integer (int32)","tax_identification_number":"string","flat_rate_tax":"integer (int32)"}`

vacation\_entitlement

VacationEntitlement

Beispiel:

`vacation_entitlement = {"basic_vacation_entitlement":0}`

Schema:

`{"basic_vacation_entitlement":"number (double)"}`

vocational\_training

VocationalTraining

Beispiel:

`vocational_training = {"personnel_number":0,"start":"abc","expected_end":"abc","actual_end":"abc"}`

Schema:

`{"personnel_number":"integer (int32)","start":"string (date)","expected_end":"string (date)","actual_end":"string (date)"}`

Request Beispiel

`{`

`"surname":"abc",`

`"client_id":"abc",`

`"personnel_number":0,`

`"company_personnel_number":"abc",`

`"first_name":"abc",`

`"employment_id":"abc",`

`"business_unit_id":0,`

`"payment_method":"1",`

`"date_of_instant_registration":"abc",`

`"instant_registration_uuid":"abc",`

`"activity" : {`

`"highest_level_of_professional_training":1,`

`"highest_level_of_education":1,`

`"allocation_of_working_hours_monday":0,`

`"allocation_of_working_hours_tuesday":0,`

`"allocation_of_working_hours_wednesday":0,`

`"allocation_of_working_hours_thursday":0,`

`"allocation_of_working_hours_friday":0,`

`"allocation_of_working_hours_saturday":0,`

`"allocation_of_working_hours_sunday":0,`

`"weekly_working_hours":0,`

`"individual_cost_center_id":"abc",`

`"occupational_title":"abc",`

`"job_carried_out":"abc",`

`"employee_type":"101",`

`"contractual_structure":"1",`

`"activity_type":0,`

`"department_id":"abc",`

`"personnel_leasing":0`

`}`

`"account" : {`

`"iban":"abc",`

`"bic":"abc",`

`"differing_account_holder":"abc"`

`}`

`"address" : {`

`"address_affix":"abc",`

`"city":"abc",`

`"country":"A",`

`"house_number":"abc",`

`"postal_code":"abc",`

`"street":"abc"`

`}`

`"employment_periods": [`

`{`

`"date_of_commencement_of_employment":"abc",`

`"date_of_termination_of_employment":"abc"`

`}`

`]`

`"gross_payments": [`

`{`

`"id":0,`

`"amount":0,`

`"salary_type_id":0,`

`"payment_months":"abc"`

`}`

`]`

`"hourly_wages": [`

`{`

`"id":0,`

`"amount":0`

`}`

`]`

`"individual_data" : {`

`"id":"abc",`

`"long_field_name":"abc",`

`"short_field_name":"abc",`

`"date":"abc",`

`"amount":0,`

`"long_field_name2":"abc",`

`"short_field_name2":"abc",`

`"date2":"abc",`

`"amount2":0,`

`"long_field_name3":"abc",`

`"short_field_name3":"abc",`

`"date3":"abc",`

`"amount3":0,`

`"long_field_name4":"abc",`

`"short_field_name4":"abc",`

`"date4":"abc",`

`"amount4":0,`

`"long_field_name5":"abc",`

`"short_field_name5":"abc",`

`"date5":"abc",`

`"amount5":0,`

`"long_field_name6":"abc",`

`"short_field_name6":"abc",`

`"date6":"abc",`

`"amount6":0,`

`"long_field_name7":"abc",`

`"short_field_name7":"abc",`

`"date7":"abc",`

`"amount7":0,`

`"long_field_name8":"abc",`

`"short_field_name8":"abc",`

`"date8":"abc",`

`"amount8":0`

`}`

`"personal_data" : {`

`"nationality":"abc",`

`"sex":"D",`

`"email":"abc",`

`"phone":"abc",`

`"academic_title":"abc",`

`"name_prefix":"a",`

`"name_affix":"Bar",`

`"birth_name":"abc",`

`"birth_name_prefix":"a",`

`"birth_name_affix":"Bar",`

`"country_of_birth":"abc",`

`"date_of_birth":"abc",`

`"place_of_birth":"abc",`

`"work_permit":"abc",`

`"residency_permit":"abc",`

`"certificate_of_study":"abc",`

`"social_security_number":"abc",`

`"european_social_security_number":"abc",`

`"initial_day_of_entrance":"abc"`

`}`

`"social_insurance" : {`

`"contribution_class_health_insurance":0,`

`"contribution_class_nursing_insurance":0,`

`"contribution_class_pension_insurance":0,`

`"contribution_class_unemployment_insurance":0,`

`"company_number_of_health_insurer":"abc",`

`"health_insurance_id":0,`

`"is_additional_contribution_to_nursing_insurance_for_childless_ignored":"false",`

`"branch_office_of_health_insurer":0,`

`"health_insurer_for_marginal_employee":"abc"`

`}`

`"tax_card" : {`

`"annual_tax_allowance":0,`

`"child_tax_allowances":0,`

`"denomination":"ak",`

`"factor":0,`

`"monthly_tax_allowance":0,`

`"spouses_denomination":"ak",`

`"tax_class":"abc"`

`}`

`"taxation" : {`

`"employment_type":1,`

`"requested_annual_allowance":0,`

`"tax_identification_number":"abc",`

`"flat_rate_tax":0`

`}`

`"vacation_entitlement" : {`

`"basic_vacation_entitlement":0`

`}`

`"vocational_training" : {`

`"personnel_number":0,`

`"start":"abc",`

`"expected_end":"abc",`

`"actual_end":"abc"`

`}`

`}`

EmploymentPeriod

Body

date\_of\_commencement\_of\_employment

string (date)

Beispiel:

`date_of_commencement_of_employment = "abc"`

date\_of\_termination\_of\_employment

string (date)

Beispiel:

`date_of_termination_of_employment = "abc"`

Request Beispiel

`{`

`"date_of_commencement_of_employment":"abc",`

`"date_of_termination_of_employment":"abc"`

`}`

Error

Body

error

string

Required

Beispiel:

`error = "abc"`

error\_description

string

Beispiel:

`error_description = "abc"`

error\_uri

string

Beispiel:

`error_uri = "abc"`

request\_id

string

Beispiel:

`request_id = "abc"`

additional\_messages

array

Beispiel:

`additional_messages = [{"id":"abc","severity":"ERROR","description":"abc","help_uri":"abc","path":"abc","affected_fields":[]}]`

Schema:

`{"id":"string","severity":"string (enum)","description":"string","help_uri":"string","path":"string","affected_fields":"array"}`

Request Beispiel

`{`

`"error":"abc",`

`"error_description":"abc",`

`"error_uri":"abc",`

`"request_id":"abc",`

`"additional_messages": [`

`{`

`"id":"abc",`

`"severity":"ERROR",`

`"description":"abc",`

`"help_uri":"abc",`

`"path":"abc",`

`"affected_fields": [`

`]`

`}`

`]`

`}`

ErrorMessage5xx

Body

error\_description

string

Beispiel:

`error_description = "abc"`

request\_id

string

Beispiel:

`request_id = "abc"`

Request Beispiel

`{`

`"error_description":"abc",`

`"request_id":"abc"`

`}`

ExchangeObject

type: object \- description: ExchangeObject

Body

Request Beispiel

`{`

`}`

GrossPayment

Body

id

integer (int64)

Beispiel:

`id = 0`

Maximum:

`99`

Minimum:

`1`

amount

number (double)

Required

Beispiel:

`amount = 0`

Maximum:

`999999.99`

Minimum:

`-999999.99`

salary\_type\_id

integer (int32)

Required

Beispiel:

`salary_type_id = 0`

Maximum:

`9999`

Minimum:

`1`

payment\_months

string

Required

Beispiel:

`payment_months = "abc"`

Max Length:

`30`

Request Beispiel

`{`

`"id":0,`

`"amount":0,`

`"salary_type_id":0,`

`"payment_months":"abc"`

`}`

HourlyWage

Body

id

integer (int32)

Beispiel:

`id = 0`

Maximum:

`5`

Minimum:

`1`

amount

number (double)

Required

Beispiel:

`amount = 0`

Maximum:

`99.99`

Request Beispiel

`{`

`"id":0,`

`"amount":0`

`}`

IndividualData

Body

id

string

Beispiel:

`id = "abc"`

Max Length:

`5`

long\_field\_name

string

Beispiel:

`long_field_name = "abc"`

Max Length:

`50`

short\_field\_name

string

Beispiel:

`short_field_name = "abc"`

Max Length:

`8`

date

string (date)

Beispiel:

`date = "abc"`

amount

number (double)

Beispiel:

`amount = 0`

Maximum:

`999999.99`

Minimum:

`-999999.99`

long\_field\_name2

string

Beispiel:

`long_field_name2 = "abc"`

Max Length:

`50`

short\_field\_name2

string

Beispiel:

`short_field_name2 = "abc"`

Max Length:

`8`

date2

string (date)

Beispiel:

`date2 = "abc"`

amount2

number (double)

Beispiel:

`amount2 = 0`

Maximum:

`999999.99`

Minimum:

`-999999.99`

long\_field\_name3

string

Beispiel:

`long_field_name3 = "abc"`

Max Length:

`50`

short\_field\_name3

string

Beispiel:

`short_field_name3 = "abc"`

Max Length:

`8`

date3

string (date)

Beispiel:

`date3 = "abc"`

amount3

number (double)

Beispiel:

`amount3 = 0`

Maximum:

`999999.99`

Minimum:

`-999999.99`

long\_field\_name4

string

Beispiel:

`long_field_name4 = "abc"`

Max Length:

`50`

short\_field\_name4

string

Beispiel:

`short_field_name4 = "abc"`

Max Length:

`8`

date4

string (date)

Beispiel:

`date4 = "abc"`

amount4

number (double)

Beispiel:

`amount4 = 0`

Maximum:

`999999.99`

Minimum:

`-999999.99`

long\_field\_name5

string

Beispiel:

`long_field_name5 = "abc"`

Max Length:

`50`

short\_field\_name5

string

Beispiel:

`short_field_name5 = "abc"`

Max Length:

`8`

date5

string (date)

Beispiel:

`date5 = "abc"`

amount5

number (double)

Beispiel:

`amount5 = 0`

Maximum:

`999999.99`

Minimum:

`-999999.99`

long\_field\_name6

string

Beispiel:

`long_field_name6 = "abc"`

Max Length:

`50`

short\_field\_name6

string

Beispiel:

`short_field_name6 = "abc"`

Max Length:

`8`

date6

string (date)

Beispiel:

`date6 = "abc"`

amount6

number (double)

Beispiel:

`amount6 = 0`

Maximum:

`999999.99`

Minimum:

`-999999.99`

long\_field\_name7

string

Beispiel:

`long_field_name7 = "abc"`

Max Length:

`50`

short\_field\_name7

string

Beispiel:

`short_field_name7 = "abc"`

Max Length:

`8`

date7

string (date)

Beispiel:

`date7 = "abc"`

amount7

number (double)

Beispiel:

`amount7 = 0`

Maximum:

`999999.99`

Minimum:

`-999999.99`

long\_field\_name8

string

Beispiel:

`long_field_name8 = "abc"`

Max Length:

`50`

short\_field\_name8

string

Beispiel:

`short_field_name8 = "abc"`

Max Length:

`8`

date8

string (date)

Beispiel:

`date8 = "abc"`

amount8

number (double)

Beispiel:

`amount8 = 0`

Maximum:

`999999.99`

Minimum:

`-999999.99`

Request Beispiel

`{`

`"id":"abc",`

`"long_field_name":"abc",`

`"short_field_name":"abc",`

`"date":"abc",`

`"amount":0,`

`"long_field_name2":"abc",`

`"short_field_name2":"abc",`

`"date2":"abc",`

`"amount2":0,`

`"long_field_name3":"abc",`

`"short_field_name3":"abc",`

`"date3":"abc",`

`"amount3":0,`

`"long_field_name4":"abc",`

`"short_field_name4":"abc",`

`"date4":"abc",`

`"amount4":0,`

`"long_field_name5":"abc",`

`"short_field_name5":"abc",`

`"date5":"abc",`

`"amount5":0,`

`"long_field_name6":"abc",`

`"short_field_name6":"abc",`

`"date6":"abc",`

`"amount6":0,`

`"long_field_name7":"abc",`

`"short_field_name7":"abc",`

`"date7":"abc",`

`"amount7":0,`

`"long_field_name8":"abc",`

`"short_field_name8":"abc",`

`"date8":"abc",`

`"amount8":0`

`}`

Job

Body

id

string (uuid)

Beispiel:

`id = "abc"`

state

string

Required

Beispiel:

`state = "abc"`

Min Length:

`1`

time\_stamp

string (date-time)

Beispiel:

`time_stamp = "abc"`

time\_stamp\_updated

string (date-time)

Beispiel:

`time_stamp_updated = "abc"`

errors

array

Beispiel:

`errors = [{"error":"abc","error_description":"abc","error_uri":"abc","request_id":"abc","additional_messages":[{"id":"abc","severity":"ERROR","description":"abc","help_uri":"abc","path":"abc","affected_fields":[]}]}]`

Schema:

`{"error":"string","error_description":"string","error_uri":"string","request_id":"string","additional_messages":"array"}`

notify\_url

string

Beispiel:

`notify_url = "abc"`

notify\_authorization\_header

string

Beispiel:

`notify_authorization_header = "abc"`

Max Length:

`100`

Request Beispiel

`{`

`"id":"abc",`

`"state":"abc",`

`"time_stamp":"abc",`

`"time_stamp_updated":"abc",`

`"errors": [`

`{`

`"error":"abc",`

`"error_description":"abc",`

`"error_uri":"abc",`

`"request_id":"abc",`

`"additional_messages": [`

`{`

`"id":"abc",`

`"severity":"ERROR",`

`"description":"abc",`

`"help_uri":"abc",`

`"path":"abc",`

`"affected_fields": [`

`]`

`}`

`]`

`}`

`]`

`"notify_url":"abc",`

`"notify_authorization_header":"abc"`

`}`

JobResult

Body

httpStatus

string (enum)

Beispiel:

`httpStatus = 100 CONTINUE`

exchangeObjects

object

Beispiel:

`exchangeObjects = [null]`

errors

array

Beispiel:

`errors = [{"error":"abc","error_description":"abc","error_uri":"abc","request_id":"abc","additional_messages":[{"id":"abc","severity":"ERROR","description":"abc","help_uri":"abc","path":"abc","affected_fields":[]}]}]`

Schema:

`{"error":"string","error_description":"string","error_uri":"string","request_id":"string","additional_messages":"array"}`

Request Beispiel

`{`

`"httpStatus":"100 CONTINUE",`

`"exchangeObjects": [`

`]`

`"errors": [`

`{`

`"error":"abc",`

`"error_description":"abc",`

`"error_uri":"abc",`

`"request_id":"abc",`

`"additional_messages": [`

`{`

`"id":"abc",`

`"severity":"ERROR",`

`"description":"abc",`

`"help_uri":"abc",`

`"path":"abc",`

`"affected_fields": [`

`]`

`}`

`]`

`}`

`]`

`}`

MonthRecord

Body

personnel\_number

integer (int32)

Beispiel:

`personnel_number = 0`

value

number (double)

Beispiel:

`value = 0`

salary\_type\_id

integer (int32)

Beispiel:

`salary_type_id = 0`

differing\_factor

number (double)

Beispiel:

`differing_factor = 0`

cost\_center\_id

string

Beispiel:

`cost_center_id = "abc"`

month\_of\_emergence

string

Beispiel:

`month_of_emergence = "abc"`

processing\_code

integer (int32)

Beispiel:

`processing_code = 0`

Request Beispiel

`{`

`"personnel_number":0,`

`"value":0,`

`"salary_type_id":0,`

`"differing_factor":0,`

`"cost_center_id":"abc",`

`"month_of_emergence":"abc",`

`"processing_code":0`

`}`

PersonalData

Body

nationality

string

Beispiel:

`nationality = "abc"`

Max Length:

`3`

sex

string (enum)

Required

Beispiel:

`sex = D`

Max Length:

`1`

email

string

Beispiel:

`email = "abc"`

Max Length:

`60`

phone

string

Beispiel:

`phone = "abc"`

Max Length:

`60`

academic\_title

string

Beispiel:

`academic_title = "abc"`

Max Length:

`20`

name\_prefix

string (enum)

Beispiel:

`name_prefix = a`

Max Length:

`14`

name\_affix

string (enum)

Beispiel:

`name_affix = Bar`

Max Length:

`15`

birth\_name

string

Beispiel:

`birth_name = "abc"`

Max Length:

`30`

birth\_name\_prefix

string (enum)

Beispiel:

`birth_name_prefix = a`

Max Length:

`14`

birth\_name\_affix

string (enum)

Beispiel:

`birth_name_affix = Bar`

Max Length:

`15`

country\_of\_birth

string

Beispiel:

`country_of_birth = "abc"`

Max Length:

`3`

date\_of\_birth

string (date)

This field can not be deleted in LuG.

Beispiel:

`date_of_birth = "abc"`

Max Length:

`10`

place\_of\_birth

string

Beispiel:

`place_of_birth = "abc"`

Max Length:

`34`

work\_permit

string (date)

Beispiel:

`work_permit = "abc"`

Max Length:

`10`

residency\_permit

string (date)

Beispiel:

`residency_permit = "abc"`

Max Length:

`10`

certificate\_of\_study

string (date)

Beispiel:

`certificate_of_study = "abc"`

Max Length:

`10`

social\_security\_number

string

Beispiel:

`social_security_number = "abc"`

Max Length:

`12`

european\_social\_security\_number

string

Beispiel:

`european_social_security_number = "abc"`

Max Length:

`20`

initial\_day\_of\_entrance

string (date)

Property availability: LODAS 15.6 and up and LuG

Beispiel:

`initial_day_of_entrance = "abc"`

Max Length:

`10`

Request Beispiel

`{`

`"nationality":"abc",`

`"sex":"D",`

`"email":"abc",`

`"phone":"abc",`

`"academic_title":"abc",`

`"name_prefix":"a",`

`"name_affix":"Bar",`

`"birth_name":"abc",`

`"birth_name_prefix":"a",`

`"birth_name_affix":"Bar",`

`"country_of_birth":"abc",`

`"date_of_birth":"abc",`

`"place_of_birth":"abc",`

`"work_permit":"abc",`

`"residency_permit":"abc",`

`"certificate_of_study":"abc",`

`"social_security_number":"abc",`

`"european_social_security_number":"abc",`

`"initial_day_of_entrance":"abc"`

`}`

Resource

Body

path

string

Beispiel:

`path = "abc"`

innermostReferenceDate

string

Beispiel:

`innermostReferenceDate = "abc"`

resourceType

string (enum)

Beispiel:

`resourceType = CLIENTS`

innerResourceName

string

Beispiel:

`innerResourceName = "abc"`

innermostResourceType

string (enum)

Beispiel:

`innermostResourceType = CLIENTS`

resource\_name

string

Beispiel:

`resource_name = "abc"`

id

string

Beispiel:

`id = "abc"`

reference\_date

string

Beispiel:

`reference_date = "abc"`

sub\_resource

Resource

Beispiel:

`sub_resource = {"path":"abc","innermostReferenceDate":"abc","resourceType":"CLIENTS","innerResourceName":"abc","innermostResourceType":"CLIENTS","resource_name":"abc","id":"abc","reference_date":"abc","sub_resource":{"circular_reference ":"#/components/schemas/Resource"}}`

Schema:

`{"path":"string","innermostReferenceDate":"string","resourceType":"string (enum)","innerResourceName":"string","innermostResourceType":"string (enum)","resource_name":"string","id":"string","reference_date":"string","sub_resource":"Resource"}`

Request Beispiel

`{`

`"path":"abc",`

`"innermostReferenceDate":"abc",`

`"resourceType":"CLIENTS",`

`"innerResourceName":"abc",`

`"innermostResourceType":"CLIENTS",`

`"resource_name":"abc",`

`"id":"abc",`

`"reference_date":"abc",`

`"sub_resource" : {`

`"path":"abc",`

`"innermostReferenceDate":"abc",`

`"resourceType":"CLIENTS",`

`"innerResourceName":"abc",`

`"innermostResourceType":"CLIENTS",`

`"resource_name":"abc",`

`"id":"abc",`

`"reference_date":"abc",`

`"sub_resource" : {`

`"circular_reference ":"#/components/schemas/Resource"`

`}`

`}`

`}`

RestHook

Body

client\_url

string

Required

Beispiel:

`client_url = "abc"`

Min Length:

`1`

authorization\_header

string

Beispiel:

`authorization_header = "abc"`

Max Length:

`100`

time\_stamp

string

Beispiel:

`time_stamp = "abc"`

event\_resource

RestHookResourceInfo

Beispiel:

`event_resource = {"resource":"abc","resource_id":"abc","server_url":"abc","http_method":"abc","additional_info":"abc"}`

Schema:

`{"resource":"string","resource_id":"string","server_url":"string","http_method":"string","additional_info":"string"}`

Request Beispiel

`{`

`"client_url":"abc",`

`"authorization_header":"abc",`

`"time_stamp":"abc",`

`"event_resource" : {`

`"resource":"abc",`

`"resource_id":"abc",`

`"server_url":"abc",`

`"http_method":"abc",`

`"additional_info":"abc"`

`}`

`}`

RestHookResourceInfo

Body

resource

string

Beispiel:

`resource = "abc"`

resource\_id

string

Beispiel:

`resource_id = "abc"`

server\_url

string

Beispiel:

`server_url = "abc"`

http\_method

string

Beispiel:

`http_method = "abc"`

additional\_info

string

Beispiel:

`additional_info = "abc"`

Request Beispiel

`{`

`"resource":"abc",`

`"resource_id":"abc",`

`"server_url":"abc",`

`"http_method":"abc",`

`"additional_info":"abc"`

`}`

SocialInsurance

Body

contribution\_class\_health\_insurance

integer (int32)

Required

Beispiel:

`contribution_class_health_insurance = 0`

contribution\_class\_nursing\_insurance

integer (int32)

Required

Beispiel:

`contribution_class_nursing_insurance = 0`

Maximum:

`2`

contribution\_class\_pension\_insurance

integer (int32)

Required

Beispiel:

`contribution_class_pension_insurance = 0`

contribution\_class\_unemployment\_insurance

integer (int32)

Required

Beispiel:

`contribution_class_unemployment_insurance = 0`

Maximum:

`2`

company\_number\_of\_health\_insurer

string

Beispiel:

`company_number_of_health_insurer = "abc"`

Max Length:

`8`

health\_insurance\_id

integer (int32)

Beispiel:

`health_insurance_id = 0`

Maximum:

`999`

Minimum:

`1`

is\_additional\_contribution\_to\_nursing\_insurance\_for\_childless\_ignored

boolean

Required

Beispiel:

`is_additional_contribution_to_nursing_insurance_for_childless_ignored = false`

branch\_office\_of\_health\_insurer

integer (int32)

Beispiel:

`branch_office_of_health_insurer = 0`

Maximum:

`9999`

Minimum:

`1`

health\_insurer\_for\_marginal\_employee

string

Beispiel:

`health_insurer_for_marginal_employee = "abc"`

Max Length:

`8`

Request Beispiel

`{`

`"contribution_class_health_insurance":0,`

`"contribution_class_nursing_insurance":0,`

`"contribution_class_pension_insurance":0,`

`"contribution_class_unemployment_insurance":0,`

`"company_number_of_health_insurer":"abc",`

`"health_insurance_id":0,`

`"is_additional_contribution_to_nursing_insurance_for_childless_ignored":"false",`

`"branch_office_of_health_insurer":0,`

`"health_insurer_for_marginal_employee":"abc"`

`}`

Taxation

Body

employment\_type

integer (int32)

Beispiel:

`employment_type = 1`

requested\_annual\_allowance

integer (int32)

Beispiel:

`requested_annual_allowance = 0`

Maximum:

`999999999`

tax\_identification\_number

string

Beispiel:

`tax_identification_number = "abc"`

Max Length:

`11`

flat\_rate\_tax

integer (int32)

Beispiel:

`flat_rate_tax = 0`

Request Beispiel

`{`

`"employment_type":1,`

`"requested_annual_allowance":0,`

`"tax_identification_number":"abc",`

`"flat_rate_tax":0`

`}`

TaxCard

Body

annual\_tax\_allowance

integer (int32)

Beispiel:

`annual_tax_allowance = 0`

Maximum:

`999999999`

child\_tax\_allowances

number (double)

Beispiel:

`child_tax_allowances = 0`

denomination

string (enum)

Beispiel:

`denomination = ak`

Max Length:

`2`

factor

number (double)

Beispiel:

`factor = 0`

Maximum:

`0.999`

Minimum:

`0.001`

monthly\_tax\_allowance

integer (int32)

Beispiel:

`monthly_tax_allowance = 0`

Maximum:

`999999999`

spouses\_denomination

string (enum)

Beispiel:

`spouses_denomination = ak`

Max Length:

`2`

tax\_class

string (int32)

This field can not be deleted in LuG.

Beispiel:

`tax_class = "abc"`

Maximum:

`6`

Request Beispiel

`{`

`"annual_tax_allowance":0,`

`"child_tax_allowances":0,`

`"denomination":"ak",`

`"factor":0,`

`"monthly_tax_allowance":0,`

`"spouses_denomination":"ak",`

`"tax_class":"abc"`

`}`

VacationEntitlement

Body

basic\_vacation\_entitlement

number (double)

Beispiel:

`basic_vacation_entitlement = 0`

Maximum:

`99.5`

Request Beispiel

`{`

`"basic_vacation_entitlement":0`

`}`

VocationalTraining

Body

personnel\_number

integer (int32)

Beispiel:

`personnel_number = 0`

start

string (date)

This field can not be deleted in LuG.

Beispiel:

`start = "abc"`

Max Length:

`10`

expected\_end

string (date)

Beispiel:

`expected_end = "abc"`

Max Length:

`10`

actual\_end

string (date)

This field can not be deleted in LuG.

Beispiel:

`actual_end = "abc"`

Max Length:

`10`

Request Beispiel

`{`

`"personnel_number":0,`

`"start":"abc",`

`"expected_end":"abc",`

`"actual_end":"abc"`

`}`

&nbsp;