const { expect } = require('chai');
const CustomerEmailTemplate = require('../models/Customer/CustomerEmailTemplate');
const {
  PLACEHOLDERS,
  TEMPLATE_TYPES,
  buildValues,
  getDefault,
  prepareHtml,
  prepareSubject,
  renderTemplate,
  splitContactName,
} = require('../services/operations/CustomerEmailTemplateService');

describe('Kunden-E-Mail-Vorlagen', () => {
  it('erzwingt genau eine Vorlage je Kunde und E-Mail-Anlass', () => {
    const index = CustomerEmailTemplate.schema.indexes()
      .find(([, options]) => options.name === 'unique_customer_email_template_type');
    expect(index[0]).to.deep.equal({ kunde: 1, type: 1 });
    expect(index[1].unique).to.equal(true);
  });

  it('liefert für Stundenlisten eine vollständige Systemvorlage', () => {
    const template = getDefault(TEMPLATE_TYPES.STUNDENLISTE_SIGNATURE);
    expect(template.subjectTemplate).to.include('{{auftrag.von}}');
    expect(template.htmlTemplate).to.include('{{signatur.link}}');
    expect(PLACEHOLDERS).to.have.property('signaturkontakt.vorname');
    expect(PLACEHOLDERS).to.have.property('signatur.auslieferungsadressen');
    expect(PLACEHOLDERS).to.have.property('einsatzort.adresse');
  });

  it('weist unbekannte Textmarken und unsichere Inhalte zurück beziehungsweise bereinigt sie', () => {
    expect(() => prepareSubject('Hallo {{mitarbeiter.name}}')).to.throw('Unbekannte Textmarken');
    expect(() => prepareHtml('<p>{{auftrag.titel</p>')).to.throw('unvollständig');
    const html = prepareHtml('<script>alert(1)</script><p><a href="javascript:alert(2)" onclick="x()">Öffnen</a></p>');
    expect(html).to.not.include('<script');
    expect(html).to.not.include('javascript:');
    expect(html).to.not.include('onclick');
  });

  it('rendert Kontakt-, Kunden-, Auftrags- und Signaturdaten sicher', () => {
    const values = buildValues({
      kunde: { kundName: 'Muster & Partner', kuerzel: 'M&P', kundenNr: 42 },
      auftrag: {
        auftragNr: 4711,
        eventTitel: 'Sommerfest <Nord>',
        vonDatum: '2026-09-04',
        bisDatum: '2026-09-05',
        eventLocation: 'Hafen',
        eventStrasse: 'Kai 1',
        eventPlz: '20457',
        eventOrt: 'Hamburg',
      },
      signaturkontakt: { name: 'Alex Mustermann', email: 'alex@example.com' },
      signatur: {
        dokumentname: 'Stundenliste',
        link: 'https://docuseal.eu/s/abc',
        auslieferungsadressen: ['dispo@example.com'],
      },
      location: { nameFull: 'Hamburg', shortName: 'HH' },
    });
    const rendered = renderTemplate(getDefault(TEMPLATE_TYPES.STUNDENLISTE_SIGNATURE), values);
    expect(rendered.subject).to.equal('Einsatznachweis 04.09.2026 >Straightforward');
    expect(rendered.renderedHtml).to.include('Hallo Alex Mustermann');
    expect(rendered.renderedHtml).to.include('Guten Tag Alex Mustermann,');
    expect(rendered.renderedHtml).to.include('anbei finden Sie den Einsatznachweis');
    expect(rendered.renderedHtml).to.include('src="cid:straightforward-logo"');
    expect(rendered.renderedHtml).to.include('href="https://docuseal.eu/s/abc"');
    expect(rendered.renderedHtml).to.include('mailto:dispo@example.com');
    expect(rendered.unresolvedPlaceholders).to.deep.equal([]);
  });

  it('verwendet die Du-Anrede des Kunden mit dem Vornamen', () => {
    const values = buildValues({
      kunde: { stundenlisteSignaturDuAnrede: true },
      signaturkontakt: { name: 'Alex Maria Mustermann' },
    });

    expect(values['signaturkontakt.anrede']).to.equal('Hallo Alex Maria');
  });

  it('zerlegt übergebene Signaturkontaktnamen in Vor- und Nachname', () => {
    expect(splitContactName({ name: 'Alex Maria Mustermann' })).to.deep.equal({
      vorname: 'Alex Maria',
      nachname: 'Mustermann',
      name: 'Alex Maria Mustermann',
    });
  });
});
