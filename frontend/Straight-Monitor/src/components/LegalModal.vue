<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-container" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h2>{{ title }}</h2>
            <button class="close-btn" @click="$emit('close')" aria-label="Schließen">
              <font-awesome-icon :icon="['fas', 'times']" />
            </button>
          </div>
          
          <div class="modal-body">
            <!-- Datenschutz Content -->
            <div v-if="type === 'privacy'" class="legal-content">
              <section>
                <h3>1. Verantwortlicher</h3>
                <p>
                  <strong>H. & P. Straightforward GmbH</strong><br>
                  Straßmannstraße 6<br>
                  10249 Berlin<br>
                  Deutschland
                </p>
                <p>
                  Telefon: +49 030 702 39 333<br>
                  E-Mail: it@straightforward.email
                </p>
              </section>

              <section>
                <h3>2. Datenschutzbeauftragter</h3>
                <p>
                  Als Datenschutzbeauftragten haben wir bestellt:<br>
                  <strong>Alexandra Gridneva</strong>
                </p>
                <p>
                  Bei Fragen zum Datenschutz erreichen Sie Frau Gridneva unter:<br>
                  E-Mail: ag@straightforward.email
                </p>
                <p>
                  Oder per Post:<br>
                  H. & P. Straightforward GmbH<br>
                  – Datenschutz –<br>
                  Straßmannstraße 6<br>
                  10249 Berlin
                </p>
              </section>

              <section>
                <h3>3. Art und Zweck der Datenverarbeitung</h3>
                <p>
                  Dieses System dient ausschließlich der internen Personalverwaltung und 
                  Bestandsüberwachung für Mitarbeiter der H. & P. Straightforward GmbH.
                </p>
                
                <h4>Verarbeitete Daten:</h4>
                <ul>
                  <li><strong>Stammdaten:</strong> Name, E-Mail-Adresse, Personalnummer</li>
                  <li><strong>Beschäftigungsdaten:</strong> Abteilung, Position, Standort (Berlin, Hamburg, Köln)</li>
                  <li><strong>Systemdaten:</strong> Login-Zeitpunkte, IP-Adressen (Server-Logfiles)</li>
                  <li><strong>Arbeitsdaten:</strong> Dokumentenverwaltung, Aufgabenzuordnungen</li>
                </ul>

                <h4>Rechtsgrundlage:</h4>
                <p>
                  Die Verarbeitung erfolgt gemäß <strong>Art. 6 Abs. 1 lit. b DSGVO</strong> 
                  (Vertragserfüllung) und <strong>Art. 88 DSGVO</strong> i.V.m. § 26 BDSG 
                  (Beschäftigtendatenschutz) im Rahmen Ihres Arbeitsverhältnisses.
                </p>
              </section>

              <section>
                <h3>4. Erfassung von Daten</h3>
                <p>
                  Während Sie auf dieses System zugreifen, erfassen wir automatisch Daten von 
                  allgemeiner Natur (Server-Logfiles). Diese umfassen:
                </p>
                <ul>
                  <li>IP-Adresse (anonymisiert)</li>
                  <li>Browser-Typ und -Version</li>
                  <li>Betriebssystem</li>
                  <li>Zugriffszeitpunkt</li>
                </ul>
                <p>
                  Diese Daten werden zur Sicherstellung der Systemstabilität und -sicherheit 
                  sowie zur technischen Administration benötigt.
                </p>
              </section>

              <section>
                <h3>5. Speicherdauer</h3>
                <p>
                  Ihre Daten werden für die Dauer Ihres Beschäftigungsverhältnisses gespeichert.
                  Nach Beendigung des Arbeitsverhältnisses werden die Daten gemäß den gesetzlichen 
                  Aufbewahrungsfristen (i.d.R. 10 Jahre für steuerrechtlich relevante Daten) archiviert 
                  und anschließend gelöscht.
                </p>
              </section>

              <section>
                <h3>6. Empfänger der Daten</h3>
                <p>
                  Zugriff auf Ihre Daten haben ausschließlich:
                </p>
                <ul>
                  <li>Berechtigte Mitarbeiter der Personalabteilung</li>
                  <li>Ihre direkten Vorgesetzten (soweit erforderlich)</li>
                  <li>IT-Administration (für technischen Support)</li>
                </ul>
                <p>
                  Eine Weitergabe an Dritte erfolgt nicht, außer zur Erfüllung gesetzlicher Pflichten 
                  (z.B. Sozialversicherungsträger, Finanzamt, Agentur für Arbeit).
                </p>
              </section>

              <section>
                <h3>7. Ihre Rechte</h3>
                <p>Sie haben folgende Rechte gemäß DSGVO:</p>
                <ul>
                  <li><strong>Art. 15 DSGVO:</strong> Auskunft über Ihre gespeicherten Daten</li>
                  <li><strong>Art. 16 DSGVO:</strong> Berichtigung unrichtiger Daten</li>
                  <li><strong>Art. 17 DSGVO:</strong> Löschung (soweit keine Aufbewahrungspflichten bestehen)</li>
                  <li><strong>Art. 18 DSGVO:</strong> Einschränkung der Verarbeitung / Sperrung</li>
                  <li><strong>Art. 21 DSGVO:</strong> Widerspruch gegen die Verarbeitung</li>
                  <li><strong>Art. 77 DSGVO:</strong> Beschwerde bei der Aufsichtsbehörde</li>
                </ul>
                <p>
                  Für die Ausübung Ihrer Rechte wenden Sie sich bitte an:<br>
                  <strong>ag@straightforward.email</strong> (Datenschutzbeauftragte)
                </p>
                <p>
                  Gesperrte Daten werden in einer speziellen Sperrdatei zu Kontrollzwecken verwahrt.
                  Wenn die gesetzliche Archivierungsverpflichtung abgelaufen ist, können Sie auch 
                  die Löschung der Daten verlangen.
                </p>
              </section>

              <section>
                <h3>8. Datensicherheit</h3>
                <p>
                  Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten 
                  gegen zufällige oder vorsätzliche Manipulationen, Verlust, Zerstörung oder den Zugriff 
                  unberechtigter Personen zu schützen:
                </p>
                <ul>
                  <li><strong>SSL/TLS-Verschlüsselung:</strong> Alle Datenübertragungen sind verschlüsselt</li>
                  <li><strong>Passwort-Sicherheit:</strong> Passwörter werden mittels bcrypt-Hashing (Salt + Hash) verschlüsselt gespeichert und sind nicht im Klartext einsehbar</li>
                  <li><strong>Zugriffskontrolle:</strong> Passwortgeschützte Zugänge mit individuellen Berechtigungen</li>
                  <li><strong>Sicherheitsaudits:</strong> Regelmäßige Überprüfungen und Updates</li>
                  <li><strong>Logging & Monitoring:</strong> Protokollierung aller Systemzugriffe zur Nachvollziehbarkeit</li>
                  <li><strong>Versicherungsschutz:</strong> Berufshaftpflichtversicherung bei Allianz Versicherungs-AG, 10900 Berlin</li>
                </ul>
              </section>

              <section>
                <h3>9. Änderung der Datenschutzbestimmungen</h3>
                <p>
                  Unsere Datenschutzerklärung kann in unregelmäßigen Abständen angepasst werden, 
                  damit sie den aktuellen rechtlichen Anforderungen entspricht oder um Änderungen 
                  unserer Dienstleistungen umzusetzen. Für Ihren nächsten Besuch gilt dann 
                  automatisch die neue Datenschutzerklärung.
                </p>
              </section>

              <p class="last-updated">Stand: {{ new Date().toLocaleDateString('de-DE') }}</p>
            </div>

            <!-- Impressum Content -->
            <div v-else-if="type === 'imprint'" class="legal-content">
              <section>
                <h3>Angaben gemäß § 5 TMG</h3>
                <p>
                  <strong>H. & P. Straightforward GmbH</strong><br>
                  Straßmannstraße 6<br>
                  10249 Berlin<br>
                  Deutschland
                </p>
              </section>

              <section>
                <h3>Vertreten durch</h3>
                <p>
                  Geschäftsführung: Daniel Hansen, Christian Peßler
                </p>
              </section>

              <section>
                <h3>Kontakt</h3>
                <p>
                  Telefon: +49 030 702 39 333<br>
                  E-Mail: info@straightforward.email
                </p>
              </section>

              <section>
                <h3>Registereintrag</h3>
                <p>
                  Eintragung im Handelsregister<br>
                  Registergericht: Amtsgericht Charlottenburg<br>
                  Registernummer: HRB 180342 B
                </p>
              </section>

              <section>
                <h3>Umsatzsteuer-ID</h3>
                <p>
                  Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:<br>
                  DE308384616
                </p>
              </section>

              <section>
                <h3>Zuständige Aufsichtsbehörde</h3>
                <p>
                  Agentur für Arbeit Kiel<br>
                  24131 Kiel<br>
                  <a href="https://www.arbeitsagentur.de" target="_blank" rel="noopener noreferrer">www.arbeitsagentur.de</a>
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
                    <h4>Berlin (Hauptsitz)</h4>
                    <p>
                      Straßmannstraße 6<br>
                      10249 Berlin<br>
                      Tel: +49 30 702 393 33<br>
                      E-Mail: teamberlin@straightforward.email
                    </p>
                  </div>
                  
                  <div class="location">
                    <h4>Hamburg</h4>
                    <p>
                      Gaußstraße 124<br>
                      22765 Hamburg<br>
                      Tel: +49 40 700 101 90<br>
                      E-Mail: teamhamburg@straightforward.email
                    </p>
                  </div>
                  
                  <div class="location">
                    <h4>Köln</h4>
                    <p>
                      Zülpicher Str. 85<br>
                      50937 Köln<br>
                      Tel: +49 221 777 100 22<br>
                      E-Mail: teamkoeln@straightforward.email
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3>Hinweis zum internen System</h3>
                <p>
                  Dieses System ist ein internes Werkzeug der H. & P. Straightforward GmbH 
                  ausschließlich für Mitarbeiter. Es erfolgt keine öffentliche Bereitstellung 
                  von Inhalten oder Dienstleistungen über dieses System.
                </p>
              </section>

              <section>
                <h3>Haftungsbeschränkung</h3>
                <p>
                  <strong>Haftung für Inhalte:</strong><br>
                  Die Inhalte dieses internen Systems werden mit größtmöglicher Sorgfalt erstellt. 
                  Der Anbieter übernimmt jedoch keine Gewähr für die Richtigkeit, Vollständigkeit 
                  und Aktualität der bereitgestellten Inhalte.
                </p>
                <p>
                  <strong>Haftung für Schäden:</strong><br>
                  Der Anbieter haftet für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung 
                  einer wesentlichen Vertragspflicht. Bei leicht fahrlässiger Verletzung von 
                  Nebenpflichten, die keine Kardinalpflichten sind, haftet der Anbieter nicht.
                </p>
              </section>

              <section>
                <h3>Urheberrecht</h3>
                <p>
                  Die in diesem System veröffentlichten Inhalte und Werke sind urheberrechtlich 
                  geschützt. Jede vom deutschen Urheberrecht nicht zugelassene Verwertung bedarf 
                  der vorherigen schriftlichen Zustimmung der H. & P. Straightforward GmbH.
                </p>
              </section>

              <p class="last-updated">Stand: {{ new Date().toLocaleDateString('de-DE') }}</p>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-primary" @click="$emit('close')">
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
