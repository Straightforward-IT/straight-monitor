<template>
  <teleport to="body">
    <transition name="modal">
      <div
        v-if="show"
        class="modal-overlay"
        @click.self="$emit('close')"
      >
        <div
          class="modal-container"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`legal-modal-title-${type}`"
        >
          <div class="modal-header">
            <h2 :id="`legal-modal-title-${type}`">
              {{ title }}
            </h2>

            <button
              class="close-btn"
              type="button"
              @click="$emit('close')"
              aria-label="Schließen"
            >
              <font-awesome-icon :icon="['fas', 'times']" />
            </button>
          </div>

          <div class="modal-body">
            <!-- =========================================================
                 DATENSCHUTZHINWEISE
            ========================================================== -->
            <div
              v-if="type === 'privacy'"
              class="legal-content"
            >
              <section>
                <h3>1. Verantwortlicher</h3>

                <p>
                  Verantwortlicher für die Verarbeitung personenbezogener Daten
                  im Rahmen von StraightMonitor und Public Monitor ist:
                </p>

                <p>
                  <strong>H. & P. Straightforward GmbH</strong><br>
                  Straßmannstraße 6<br>
                  10249 Berlin<br>
                  Deutschland
                </p>

                <p>
                  Telefon: +49 30 702 39 333<br>
                  E-Mail: it@straightforward.email
                </p>
              </section>

              <section>
                <h3>2. Datenschutzbeauftragte</h3>

                <p>
                  Als Datenschutzbeauftragte haben wir bestellt:
                </p>

                <p>
                  <strong>Alexandra Gridneva</strong><br>
                  E-Mail: ag@straightforward.email
                </p>

                <p>
                  Postalisch erreichbar unter:
                </p>

                <p>
                  H. & P. Straightforward GmbH<br>
                  – Datenschutz –<br>
                  Straßmannstraße 6<br>
                  10249 Berlin
                </p>
              </section>

              <section>
                <h3>3. Zweck von StraightMonitor und Public Monitor</h3>

                <p>
                  StraightMonitor ist ein internes System zur Organisation,
                  Verwaltung und Durchführung von Beschäftigungs-, Personal-,
                  Einsatz- und Verwaltungsprozessen der
                  H. & P. Straightforward GmbH.
                </p>

                <p>
                  Public Monitor ist die mit StraightMonitor verbundene
                  Mitarbeiteroberfläche. Sie kann insbesondere innerhalb der
                  Flip-App bereitgestellt werden und ermöglicht Beschäftigten
                  und Teamleitungen den Zugriff auf für sie bestimmte
                  Funktionen und Informationen.
                </p>

                <p>
                  Personenbezogene Daten werden insbesondere verarbeitet, um
                  Beschäftigungsverhältnisse zu verwalten, Einsätze zu planen
                  und durchzuführen, Arbeitszeiten zu dokumentieren,
                  Personalunterlagen zu verwalten sowie Lohnabrechnung,
                  Abrechnungsvorbereitung und betriebliche Verwaltungsprozesse
                  durchzuführen.
                </p>
              </section>

              <section>
                <h3>4. Verarbeitete Daten</h3>

                <p>
                  Je nach Beschäftigungsverhältnis, Rolle und Nutzung des
                  Systems können insbesondere folgende Daten verarbeitet werden:
                </p>

                <h4>Stamm- und Kontaktdaten</h4>
                <ul>
                  <li>Name, Vorname</li>
                  <li>E-Mail-Adresse und Telefonnummer</li>
                  <li>Personalnummer und interne Identifikationsnummern</li>
                  <li>Standort und organisatorische Zuordnung</li>
                  <li>Benutzer- und Systemkennungen</li>
                </ul>

                <h4>Beschäftigungs- und Vertragsdaten</h4>
                <ul>
                  <li>Eintritts- und Austrittsdaten</li>
                  <li>Beschäftigungsart und Vertragsinformationen</li>
                  <li>Tätigkeiten, Rollen und Qualifikationen</li>
                  <li>Entgelt- und Tarifzuordnungen, soweit erforderlich</li>
                  <li>arbeitsbezogene Zuordnungen und Statusinformationen</li>
                </ul>

                <h4>Einsatz- und Veranstaltungsdaten</h4>
                <ul>
                  <li>zugewiesene Aufträge, Veranstaltungen und Einsätze</li>
                  <li>Datum, Einsatzort und Einsatzbetrieb</li>
                  <li>geplante Arbeits- und Schichtzeiten</li>
                  <li>Tätigkeit und Funktion im jeweiligen Einsatz</li>
                  <li>Treffpunkte und einsatzbezogene Ansprechpartner</li>
                  <li>Team- und Teamleitungszuordnungen</li>
                </ul>

                <h4>Arbeitszeit- und Anwesenheitsdaten</h4>
                <ul>
                  <li>Arbeitsbeginn und Arbeitsende</li>
                  <li>Check-In- und Check-Out-Zeitpunkte</li>
                  <li>Pausenzeiten</li>
                  <li>Ist-Arbeitszeiten</li>
                  <li>Abweichungen von geplanten Arbeitszeiten</li>
                  <li>Zeitkorrekturen und Korrekturanträge</li>
                  <li>Freigaben und Änderungen durch berechtigte Personen</li>
                  <li>Anwesenheits- und No-Show-Status</li>
                </ul>

                <h4>Job-, Bewerbungs- und Verfügbarkeitsdaten</h4>
                <ul>
                  <li>Bewerbungen auf interne Job- und Einsatzangebote</li>
                  <li>Bewerbungsstatus</li>
                  <li>Verfügbarkeiten und Nichtverfügbarkeiten</li>
                  <li>Zu- und Absagen sowie Einsatzbestätigungen</li>
                </ul>

                <h4>Personal- und Beschäftigtendokumente</h4>
                <ul>
                  <li>Arbeits- und Vertragsdokumente</li>
                  <li>Bescheinigungen und Nachweise</li>
                  <li>Qualifikationsnachweise</li>
                  <li>Dokumentstatus und Gültigkeitszeiträume</li>
                  <li>von Beschäftigten hochgeladene Unterlagen</li>
                </ul>

                <h4>Abwesenheitsdaten</h4>
                <ul>
                  <li>Urlaub</li>
                  <li>Krankheitszeiträume</li>
                  <li>sonstige abrechnungs- oder beschäftigungsrelevante Abwesenheiten</li>
                </ul>

                <p>
                  Gesundheitsdaten, insbesondere Informationen über
                  Krankheitszeiträume, werden nur verarbeitet, soweit dies für
                  die Durchführung des Beschäftigungsverhältnisses oder zur
                  Erfüllung arbeits-, sozialversicherungs- oder
                  abrechnungsrechtlicher Pflichten erforderlich ist.
                  Diagnosen werden grundsätzlich nicht für Zwecke der
                  Einsatzplanung gespeichert.
                </p>

                <h4>Lohn- und Abrechnungsdaten</h4>
                <ul>
                  <li>abrechnungsrelevante Arbeitszeiten</li>
                  <li>Entgelt- und Tarifinformationen</li>
                  <li>Zuschlags- und Abrechnungsinformationen</li>
                  <li>abrechnungsrelevante Abwesenheiten</li>
                  <li>Lohnabrechnungs- und Ergebnisdaten</li>
                  <li>Abrechnungsdokumente</li>
                </ul>

                <h4>Teamleitungs- und Veranstaltungsdaten</h4>
                <ul>
                  <li>Laufzettel</li>
                  <li>Evaluierungen</li>
                  <li>Event Reports</li>
                  <li>einsatzbezogene Rückmeldungen</li>
                  <li>operative Statusinformationen</li>
                </ul>

                <h4>Technische Nutzungs- und Sicherheitsdaten</h4>
                <ul>
                  <li>Login- und Authentifizierungsereignisse</li>
                  <li>Zugriffszeitpunkte</li>
                  <li>IP-Adressen, soweit technisch protokolliert</li>
                  <li>Browser- und Geräteinformationen</li>
                  <li>System-, Fehler- und Sicherheitsprotokolle</li>
                </ul>
              </section>

              <section>
                <h3>5. Herkunft der Daten</h3>

                <p>
                  Personenbezogene Daten können insbesondere aus folgenden
                  Quellen stammen:
                </p>

                <ul>
                  <li>direkt von Ihnen</li>
                  <li>von berechtigten Mitarbeitern der Personalabteilung oder Disposition</li>
                  <li>von Teamleitungen im Rahmen eines konkreten Einsatzes</li>
                  <li>aus bestehenden Personal- und Verwaltungssystemen</li>
                  <li>aus angebundenen Mitarbeiter- und Kommunikationsplattformen</li>
                  <li>aus angebundenen Lohn- und Abrechnungssystemen</li>
                  <li>aus technischen Authentifizierungs- und Systemdiensten</li>
                </ul>

                <p>
                  Soweit Daten aus anderen betrieblichen Systemen übernommen
                  werden, erfolgt dies ausschließlich für die jeweils
                  erforderlichen Beschäftigungs- und Verwaltungszwecke.
                </p>
              </section>

              <section>
                <h3>6. Zwecke der Verarbeitung</h3>

                <p>
                  Die Verarbeitung erfolgt insbesondere für folgende Zwecke:
                </p>

                <ul>
                  <li>Durchführung und Verwaltung des Beschäftigungsverhältnisses</li>
                  <li>Personalverwaltung</li>
                  <li>Einsatz-, Auftrags- und Veranstaltungsplanung</li>
                  <li>Disposition und Besetzung von Einsätzen</li>
                  <li>Verwaltung von Verfügbarkeiten</li>
                  <li>Bereitstellung und Verwaltung interner Jobangebote</li>
                  <li>Dokumentation und Prüfung von Arbeitszeiten</li>
                  <li>Check-In- und Anwesenheitsmanagement</li>
                  <li>Bearbeitung von Arbeitszeitkorrekturen</li>
                  <li>Urlaubs- und Abwesenheitsverwaltung</li>
                  <li>Verwaltung und Prüfung von Beschäftigtendokumenten</li>
                  <li>Erfüllung tariflicher und arbeitsrechtlicher Pflichten</li>
                  <li>Vorbereitung und Durchführung der Lohnabrechnung</li>
                  <li>Erstellung abrechnungs- und buchhaltungsrelevanter Daten</li>
                  <li>interne Qualitätssicherung und Dokumentation von Einsätzen</li>
                  <li>IT-Sicherheit, Fehleranalyse und Missbrauchsprävention</li>
                </ul>
              </section>

              <section>
                <h3>7. Rechtsgrundlagen</h3>

                <p>
                  Die Verarbeitung personenbezogener Beschäftigtendaten erfolgt
                  insbesondere auf Grundlage von
                  <strong>§ 26 BDSG</strong> in Verbindung mit
                  <strong>Art. 6 Abs. 1 DSGVO</strong>, soweit die Verarbeitung
                  für die Begründung, Durchführung oder Beendigung des
                  Beschäftigungsverhältnisses erforderlich ist.
                </p>

                <p>
                  Soweit gesetzliche Verpflichtungen bestehen, erfolgt die
                  Verarbeitung insbesondere auf Grundlage von
                  <strong>Art. 6 Abs. 1 lit. c DSGVO</strong>.
                </p>

                <p>
                  Soweit eine Verarbeitung zur Wahrung berechtigter betrieblicher
                  Interessen erforderlich ist und keine überwiegenden Interessen
                  der betroffenen Person entgegenstehen, kann die Verarbeitung
                  auf <strong>Art. 6 Abs. 1 lit. f DSGVO</strong> gestützt werden.
                  Dies kann insbesondere Maßnahmen zur IT- und Systemsicherheit
                  betreffen.
                </p>

                <p>
                  Besondere Kategorien personenbezogener Daten, insbesondere
                  Gesundheitsdaten, werden nur verarbeitet, wenn hierfür eine
                  besondere Rechtsgrundlage besteht. Im Beschäftigungskontext
                  erfolgt dies insbesondere nach
                  <strong>Art. 9 Abs. 2 DSGVO</strong> in Verbindung mit
                  <strong>§ 26 Abs. 3 BDSG</strong>.
                </p>
              </section>

              <section>
                <h3>8. Empfänger und Zugriff auf Daten</h3>

                <p>
                  Innerhalb der H. & P. Straightforward GmbH erhalten nur
                  diejenigen Personen Zugriff auf personenbezogene Daten, die
                  diese zur Erfüllung ihrer jeweiligen Aufgaben benötigen.
                </p>

                <p>
                  Dies können insbesondere sein:
                </p>

                <ul>
                  <li>Personalabteilung</li>
                  <li>Disposition</li>
                  <li>Lohn- und Finanzbuchhaltung</li>
                  <li>berechtigte Führungskräfte</li>
                  <li>Teamleitungen, beschränkt auf erforderliche Einsatzdaten</li>
                  <li>IT-Administration, soweit dies technisch erforderlich ist</li>
                </ul>

                <p>
                  Je nach Prozess können Daten außerdem an folgende Kategorien
                  von Empfängern übermittelt oder durch diese verarbeitet werden:
                </p>

                <ul>
                  <li>Lohn- und Abrechnungsdienstleister</li>
                  <li>Hosting- und Cloud-Infrastrukturanbieter</li>
                  <li>Datenbank- und Speicheranbieter</li>
                  <li>Authentifizierungs- und Mitarbeiterplattformen</li>
                  <li>E-Mail- und Kommunikationsdienstleister</li>
                  <li>Dokumenten- und Signaturdienstleister</li>
                  <li>betriebliche Integrations- und Projektmanagementsysteme</li>
                  <li>Kunden oder Einsatzbetriebe, soweit dies für einen konkreten Einsatz erforderlich ist</li>
                  <li>Sozialversicherungsträger</li>
                  <li>Finanzbehörden</li>
                  <li>Bundesagentur für Arbeit und andere zuständige Behörden</li>
                  <li>sonstige gesetzlich berechtigte Empfänger</li>
                </ul>

                <p>
                  Externe Dienstleister werden, soweit erforderlich, auf Grundlage
                  entsprechender datenschutzrechtlicher Verträge eingesetzt und
                  dürfen personenbezogene Daten nur im Rahmen des vereinbarten
                  Zwecks verarbeiten.
                </p>
              </section>

              <section>
                <h3>9. Cloud-Dienste und Datenübermittlungen</h3>

                <p>
                  StraightMonitor nutzt zur Bereitstellung des Systems
                  verschiedene Cloud-, Datenbank-, Speicher- und
                  Integrationsdienste.
                </p>

                <p>
                  Soweit externe Dienstleister personenbezogene Daten im Auftrag
                  verarbeiten, werden diese als Auftragsverarbeiter entsprechend
                  den datenschutzrechtlichen Anforderungen eingebunden.
                </p>

                <p>
                  Wir achten bei der Auswahl und Konfiguration unserer
                  Infrastruktur auf einen angemessenen Schutz personenbezogener
                  Daten und nutzen, soweit technisch und organisatorisch
                  vorgesehen, europäische Datenstandorte.
                </p>

                <p>
                  Soweit im Rahmen einzelner Dienste eine Verarbeitung außerhalb
                  der Europäischen Union oder des Europäischen Wirtschaftsraums
                  stattfindet, erfolgt eine solche Übermittlung nur, wenn die
                  gesetzlichen Voraussetzungen für internationale
                  Datenübermittlungen erfüllt sind.
                </p>
              </section>

              <section>
                <h3>10. Authentifizierung und Public Monitor</h3>

                <p>
                  Public Monitor kann innerhalb der Flip-App bereitgestellt
                  werden. Die Anmeldung erfolgt dabei über eine technische
                  Authentifizierung, sodass Beschäftigte für den Zugriff auf
                  Public Monitor grundsätzlich kein zusätzliches
                  StraightMonitor-Passwort eingeben müssen.
                </p>

                <p>
                  Die aus der Authentifizierung gewonnenen Identitätsmerkmale
                  werden verwendet, um den jeweiligen Benutzer eindeutig
                  zuzuordnen und sicherzustellen, dass ausschließlich die für
                  ihn vorgesehenen Daten und Funktionen bereitgestellt werden.
                </p>
              </section>

              <section>
                <h3>11. Arbeitszeit- und Anwesenheitserfassung</h3>

                <p>
                  StraightMonitor und Public Monitor können zur Dokumentation
                  von Arbeitszeiten und Anwesenheiten eingesetzt werden.
                </p>

                <p>
                  Hierbei können insbesondere Check-In, Check-Out,
                  Arbeitsbeginn, Arbeitsende, Pausen sowie nachträgliche
                  Zeitkorrekturen erfasst werden.
                </p>

                <p>
                  Zeitdaten können durch berechtigte Teamleitungen oder
                  Verwaltungsmitarbeiter geprüft und freigegeben werden.
                  Änderungen und Freigaben können zur Nachvollziehbarkeit
                  protokolliert werden.
                </p>

                <p>
                  Eine dauerhafte Überwachung oder Erstellung von
                  Bewegungsprofilen ist nicht Zweck der Arbeitszeiterfassung.
                </p>
              </section>

              <section>
                <h3>12. Dokumentenmanagement</h3>

                <p>
                  Beschäftigte können über StraightMonitor oder Public Monitor
                  Dokumente bereitgestellt bekommen oder selbst Dokumente
                  hochladen.
                </p>

                <p>
                  Dokumente werden nur für die jeweils erforderlichen Personal-,
                  Beschäftigungs-, Nachweis- oder Abrechnungszwecke verarbeitet.
                  Der Zugriff wird auf berechtigte Personen und den jeweiligen
                  Beschäftigten beschränkt.
                </p>
              </section>

              <section>
                <h3>13. Lohn- und Gehaltsabrechnung</h3>

                <p>
                  Für die Vorbereitung und Durchführung der Lohn- und
                  Gehaltsabrechnung können abrechnungsrelevante Daten aus
                  StraightMonitor an ein angebundenes Lohnabrechnungssystem oder
                  einen beauftragten Abrechnungsdienstleister übermittelt werden.
                </p>

                <p>
                  Dies betrifft insbesondere Mitarbeiterstammdaten,
                  Beschäftigungsdaten, freigegebene Arbeitszeiten,
                  Abwesenheiten, Entgeltinformationen und sonstige für die
                  Abrechnung erforderliche Angaben.
                </p>

                <p>
                  Ergebnisse und Dokumente aus der Lohnabrechnung können
                  anschließend wieder in StraightMonitor übernommen und dem
                  jeweils berechtigten Beschäftigten zur Verfügung gestellt
                  werden.
                </p>
              </section>

              <section>
                <h3>14. Speicherdauer und Löschung</h3>

                <p>
                  Personenbezogene Daten werden nur so lange gespeichert, wie
                  dies für den jeweiligen Verarbeitungszweck erforderlich ist
                  oder gesetzliche, tarifliche, vertragliche beziehungsweise
                  sonstige rechtliche Aufbewahrungspflichten bestehen.
                </p>

                <p>
                  Die Speicherdauer kann daher je nach Datenkategorie
                  unterschiedlich sein. Dies betrifft insbesondere:
                </p>

                <ul>
                  <li>Personal- und Beschäftigungsstammdaten</li>
                  <li>Arbeitszeitnachweise</li>
                  <li>Lohn- und Abrechnungsdaten</li>
                  <li>steuer- und sozialversicherungsrechtliche Unterlagen</li>
                  <li>Einsatz- und Vertragsunterlagen</li>
                  <li>Bewerbungs- und Verfügbarkeitsdaten</li>
                  <li>technische Sicherheitsprotokolle</li>
                </ul>

                <p>
                  Nach Wegfall des Verarbeitungszwecks und Ablauf der
                  einschlägigen Aufbewahrungsfristen werden personenbezogene
                  Daten gelöscht oder, soweit erforderlich, für die weitere
                  Verarbeitung gesperrt.
                </p>
              </section>

              <section>
                <h3>15. Datensicherheit</h3>

                <p>
                  Zum Schutz personenbezogener Daten setzen wir angemessene
                  technische und organisatorische Maßnahmen ein.
                </p>

                <p>
                  Hierzu gehören insbesondere:
                </p>

                <ul>
                  <li>verschlüsselte Datenübertragung mittels TLS</li>
                  <li>rollen- und berechtigungsbasierte Zugriffskontrollen</li>
                  <li>individuelle Benutzeridentitäten</li>
                  <li>Beschränkung des Zugriffs auf erforderliche Daten</li>
                  <li>Protokollierung sicherheits- und systemrelevanter Vorgänge</li>
                  <li>regelmäßige Software- und Sicherheitsupdates</li>
                  <li>technische Maßnahmen zur Sicherung von Daten und Systemverfügbarkeit</li>
                  <li>Schutz von Datenbanken und Dokumentenspeichern vor unberechtigtem Zugriff</li>
                </ul>
              </section>

              <section>
                <h3>16. Automatisierte Entscheidungen</h3>

                <p>
                  StraightMonitor trifft derzeit keine ausschließlich auf einer
                  automatisierten Verarbeitung beruhenden Entscheidungen mit
                  rechtlicher oder vergleichbar erheblicher Wirkung gegenüber
                  Beschäftigten.
                </p>

                <p>
                  Automatisierte Prüfungen und Hinweise können eingesetzt werden,
                  um Mitarbeiter bei Verwaltungs-, Einsatz- oder
                  Abrechnungsprozessen zu unterstützen. Entscheidungen mit
                  wesentlicher Auswirkung werden durch berechtigte Personen
                  getroffen oder überprüft.
                </p>
              </section>

              <section>
                <h3>17. Ihre Datenschutzrechte</h3>

                <p>
                  Im Rahmen der gesetzlichen Voraussetzungen haben Sie
                  insbesondere folgende Rechte:
                </p>

                <ul>
                  <li>
                    <strong>Art. 15 DSGVO:</strong>
                    Recht auf Auskunft
                  </li>

                  <li>
                    <strong>Art. 16 DSGVO:</strong>
                    Recht auf Berichtigung unrichtiger Daten
                  </li>

                  <li>
                    <strong>Art. 17 DSGVO:</strong>
                    Recht auf Löschung, soweit keine vorrangigen gesetzlichen
                    oder sonstigen Gründe für eine weitere Verarbeitung bestehen
                  </li>

                  <li>
                    <strong>Art. 18 DSGVO:</strong>
                    Recht auf Einschränkung der Verarbeitung
                  </li>

                  <li>
                    <strong>Art. 20 DSGVO:</strong>
                    Recht auf Datenübertragbarkeit, soweit die gesetzlichen
                    Voraussetzungen erfüllt sind
                  </li>

                  <li>
                    <strong>Art. 21 DSGVO:</strong>
                    Widerspruchsrecht, soweit eine Verarbeitung auf einer
                    entsprechenden Rechtsgrundlage erfolgt
                  </li>

                  <li>
                    <strong>Art. 77 DSGVO:</strong>
                    Recht auf Beschwerde bei einer Datenschutzaufsichtsbehörde
                  </li>
                </ul>

                <p>
                  Zur Ausübung Ihrer Datenschutzrechte können Sie sich wenden an:
                </p>

                <p>
                  <strong>ag@straightforward.email</strong>
                </p>
              </section>

              <section>
                <h3>18. Beschwerderecht</h3>

                <p>
                  Sie haben das Recht, sich bei einer zuständigen
                  Datenschutzaufsichtsbehörde über die Verarbeitung Ihrer
                  personenbezogenen Daten zu beschweren.
                </p>
              </section>

              <section>
                <h3>19. Änderungen dieser Datenschutzhinweise</h3>

                <p>
                  Diese Datenschutzhinweise werden angepasst, wenn sich
                  Funktionen von StraightMonitor oder Public Monitor,
                  Verarbeitungsvorgänge, eingesetzte Dienstleister oder
                  rechtliche Anforderungen wesentlich ändern.
                </p>

                <p>
                  Das nachfolgend angegebene Datum bezeichnet den Stand der
                  inhaltlichen Fassung und wird nicht automatisch täglich
                  aktualisiert.
                </p>
              </section>

              <p class="last-updated">
                Stand: 14. August 2026
              </p>
            </div>

            <!-- =========================================================
                 IMPRESSUM
            ========================================================== -->
            <div
              v-else-if="type === 'imprint'"
              class="legal-content"
            >
              <section>
                <h3>Angaben gemäß § 5 DDG</h3>

                <p>
                  <strong>H. & P. Straightforward GmbH</strong><br>
                  Straßmannstraße 6<br>
                  10249 Berlin<br>
                  Deutschland
                </p>
              </section>

              <section>
                <h3>Vertretungsberechtigte Geschäftsführer</h3>

                <p>
                  Daniel Hansen<br>
                  Christian Peßler
                </p>
              </section>

              <section>
                <h3>Kontakt</h3>

                <p>
                  Telefon: +49 30 702 39 333<br>
                  E-Mail: info@straightforward.email
                </p>
              </section>

              <section>
                <h3>Handelsregister</h3>

                <p>
                  Registergericht: Amtsgericht Charlottenburg<br>
                  Handelsregisternummer: HRB 180342 B
                </p>
              </section>

              <section>
                <h3>Umsatzsteuer-Identifikationsnummer</h3>

                <p>
                  Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:<br>
                  DE308384616
                </p>
              </section>

              <section>
                <h3>Zuständige Aufsichtsbehörde</h3>

                <p>
                  Agentur für Arbeit Kiel<br>
                  24131 Kiel
                </p>

                <p>
                  <a
                    href="https://www.arbeitsagentur.de"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    www.arbeitsagentur.de
                  </a>
                </p>
              </section>

              <section>
                <h3>Berufshaftpflichtversicherung</h3>

                <p>
                  Allianz Versicherungs-AG<br>
                  10900 Berlin
                </p>
              </section>

              <section>
                <h3>Standorte</h3>

                <div class="locations">
                  <div class="location">
                    <h4>Berlin – Hauptsitz</h4>

                    <p>
                      Straßmannstraße 6<br>
                      10249 Berlin<br>
                      Telefon: +49 30 702 393 33<br>
                      E-Mail: teamberlin@straightforward.email
                    </p>
                  </div>

                  <div class="location">
                    <h4>Hamburg</h4>

                    <p>
                      Gaußstraße 124<br>
                      22765 Hamburg<br>
                      Telefon: +49 40 700 101 90<br>
                      E-Mail: teamhamburg@straightforward.email
                    </p>
                  </div>

                  <div class="location">
                    <h4>Köln</h4>

                    <p>
                      Zülpicher Str. 85<br>
                      50937 Köln<br>
                      Telefon: +49 221 777 100 22<br>
                      E-Mail: teamkoeln@straightforward.email
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3>Hinweis zu StraightMonitor</h3>

                <p>
                  StraightMonitor ist ein internes Verwaltungs- und
                  Mitarbeitersystem der H. & P. Straightforward GmbH.
                </p>

                <p>
                  Teile des Systems können Beschäftigten über angebundene
                  Mitarbeiterplattformen als Public Monitor zur Verfügung
                  gestellt werden. Das System richtet sich nicht als öffentliches
                  Leistungsangebot an Verbraucher.
                </p>
              </section>

              <section>
                <h3>Urheberrecht</h3>

                <p>
                  Die innerhalb von StraightMonitor bereitgestellten Inhalte,
                  Softwarebestandteile und Werke unterliegen, soweit anwendbar,
                  dem deutschen Urheberrecht.
                </p>

                <p>
                  Eine Nutzung außerhalb der vorgesehenen betrieblichen Zwecke
                  bedarf der vorherigen Zustimmung der
                  H. & P. Straightforward GmbH, soweit keine gesetzliche
                  Berechtigung besteht.
                </p>
              </section>

              <p class="last-updated">
                Stand: 14. August 2026
              </p>
            </div>
          </div>

          <div class="modal-footer">
            <button
              class="btn btn-primary"
              type="button"
              @click="$emit('close')"
            >
              Verstanden
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

export default {
  name: 'LegalModal',
  components: { FontAwesomeIcon },
  props: {
    show: {
      type: Boolean,
      required: true
    },
    type: {
      type: String,
      required: true,
      validator: (value) => ['privacy', 'imprint'].includes(value)
    }
  },
  emits: ['close'],
  computed: {
    title() {
      return this.type === 'privacy' ? 'Datenschutzerklärung' : 'Impressum';
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        document.addEventListener('keydown', this.handleEscapeKey);
      } else {
        document.removeEventListener('keydown', this.handleEscapeKey);
      }
    }
  },
  methods: {
    handleEscapeKey(event) {
      if (event.key === 'Escape' && this.show) {
        this.$emit('close');
      }
    }
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscapeKey);
  }
};
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  overflow-y: auto;
}

.modal-container {
  background: var(--surface, #ffffff);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border, #e0e0e0);
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  margin: auto;
  position: relative;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
  border-bottom: 2px solid var(--border, #e0e0e0);
  background: var(--surface, #ffffff);
  border-radius: 16px 16px 0 0;

  h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--text, #1a1a1a);
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: var(--soft, #f5f5f5);
    color: var(--text, #1a1a1a);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: var(--border, #e0e0e0);
      color: var(--text, #1a1a1a);
      transform: scale(1.05);
    }

    svg {
      font-size: 16px;
    }
  }
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
  background: var(--surface, #ffffff);

  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: var(--soft, #f5f5f5);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border, #d0d0d0);
    border-radius: 4px;
  }

  &:hover::-webkit-scrollbar-thumb {
    background: var(--muted, #999999);
  }
}

.legal-content {
  color: var(--text, #1a1a1a);
  line-height: 1.7;

  section {
    margin-bottom: 32px;

    &:last-of-type {
      margin-bottom: 0;
    }
  }

  h3 {
    font-size: 18px;
    font-weight: 700;
    color: var(--text, #1a1a1a);
    margin: 0 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--primary, #ff6b35);
  }

  h4 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text, #1a1a1a);
    margin: 20px 0 12px 0;
  }

  p {
    margin: 0 0 12px 0;
    color: var(--text, #1a1a1a);
    font-size: 14px;
  }

  ul {
    margin: 12px 0;
    padding-left: 24px;

    li {
      margin-bottom: 8px;
      color: var(--text, #1a1a1a);
      font-size: 14px;

      strong {
        color: var(--primary, #ff6b35);
        font-weight: 600;
      }
    }
  }

  strong {
    font-weight: 600;
    color: var(--text, #1a1a1a);
  }

  a {
    color: var(--primary, #ff6b35);
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      text-decoration: underline;
    }
  }

  .locations {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 16px;

    .location {
      padding: 16px;
      background: var(--soft, #f9f9f9);
      border-radius: 8px;
      border: 1px solid var(--border, #e0e0e0);

      h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--primary, #ff6b35);
      }

      p {
        margin: 0;
        font-size: 13px;
        line-height: 1.6;
      }
    }
  }

  .last-updated {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid var(--border, #e0e0e0);
    font-size: 12px;
    color: var(--muted, #666666);
    font-style: italic;
  }
}

.modal-footer {
  padding: 20px 28px;
  border-top: 2px solid var(--border, #e0e0e0);
  display: flex;
  justify-content: flex-end;
  background: var(--surface, #ffffff);
  border-radius: 0 0 16px 16px;

  .btn {
    padding: 12px 24px;
    border-radius: 10px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;

    &.btn-primary {
      background: var(--primary, #ff6b35);
      color: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

      &:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
    }
  }
}

/* Modal Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;

  .modal-container {
    transition: transform 0.3s ease, opacity 0.3s ease;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal-container {
    transform: scale(0.95) translateY(20px);
    opacity: 0;
  }
}

/* Mobile Optimierungen */
@media (max-width: 640px) {
  .modal-overlay {
    padding: 0;
  }

  .modal-container {
    max-height: 100vh;
    border-radius: 0;
    height: 100%;
  }

  .modal-header {
    padding: 20px;

    h2 {
      font-size: 20px;
    }
  }

  .modal-body {
    padding: 20px;
  }

  .legal-content {
    h3 {
      font-size: 16px;
    }

    h4 {
      font-size: 14px;
    }

    p, li {
      font-size: 13px;
    }
  }

  .modal-footer {
    padding: 16px 20px;
  }
}
</style>
