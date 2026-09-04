const { expect } = require('chai');
const mongoose = require('mongoose');
const Einsatz = require('../models/Event/Einsatz');
const EinsatzinformationTemplate = require('../models/Event/EinsatzinformationTemplate');
const Schicht = require('../models/Event/Schicht');
const { validateAuftragRelease } = require('../services/operations/AuftragReleaseService');
const {
  PLACEHOLDERS,
  buildPlaceholderValues,
  prepareTemplate,
  renderTemplate,
  resolveTemplate,
  sanitizeTemplate,
} = require('../services/operations/EinsatzinformationService');
const { shiftWindow } = require('../services/operations/StaffingSuggestionService');

describe('Einsatzinformationen', () => {
  it('enforces unique template scopes and canonical assignments', () => {
    const templateIndex = EinsatzinformationTemplate.schema.indexes().find(([, options]) => options.name === 'unique_einsatzinformation_scope');
    expect(templateIndex[0]).to.deep.equal({ kunde: 1, einsatzort: 1, beruf: 1, qualifikation: 1 });
    expect(templateIndex[1].unique).to.equal(true);
    const assignmentIndex = Einsatz.schema.indexes().find(([, options]) => options.name === 'unique_monitor_assignment');
    expect(assignmentIndex[1].unique).to.equal(true);
  });

  it('rejects unknown or malformed placeholders and sanitizes unsafe HTML', () => {
    expect(() => prepareTemplate('<p>{{mitarbeiter.name}}</p>')).to.throw('Unbekannte Textmarken');
    expect(() => prepareTemplate('<p>{{kunde-name}}</p>')).to.throw('Unbekannte Textmarken');
    expect(() => prepareTemplate('<p>{{kunde.name</p>')).to.throw('unvollständig');
    expect(PLACEHOLDERS).to.have.property('schicht.zeitraum');
    expect(PLACEHOLDERS).to.not.have.property('mitarbeiter.name');
    const sanitized = sanitizeTemplate('<script>alert(1)</script><p><strong>Info</strong> <a href="javascript:alert(2)" onclick="x()">Link</a></p>');
    expect(sanitized).to.not.include('<script');
    expect(sanitized).to.not.include('javascript:');
    expect(sanitized).to.not.include('onclick');
  });

  it('renders escaped values and reports placeholders without data', () => {
    const values = buildPlaceholderValues({
      kunde: { kundName: 'Muster & <Partner>' },
      auftrag: { auftragNr: 4711, eventTitel: 'Gala' },
      schicht: { bezeichnung: 'Service', datumVon: '2026-09-04', uhrzeitVon: '18:00', uhrzeitBis: '02:00' },
    });
    const result = renderTemplate('<p>{{kunde.name}} · {{schicht.zeitraum}} · {{ansprechpartner.telefon}}</p>', values);
    expect(result.renderedHtml).to.include('Muster &amp; &lt;Partner&gt;');
    expect(result.renderedHtml).to.include('18:00 – 02:00');
    expect(result.unresolvedPlaceholders).to.deep.equal(['ansprechpartner.telefon']);
  });

  it('resolves every hierarchy level in priority order', async () => {
    const [kunde, site, job, qualification] = Array.from({ length: 4 }, () => new mongoose.Types.ObjectId());
    const templates = [
      { kunde, einsatzort: null, beruf: null, qualifikation: null, htmlTemplate: '<p>Customer</p>' },
      { kunde, einsatzort: site, beruf: null, qualifikation: null, htmlTemplate: '<p>Site</p>' },
      { kunde, einsatzort: site, beruf: job, qualifikation: null, htmlTemplate: '<p>Job</p>' },
      { kunde, einsatzort: site, beruf: null, qualifikation: qualification, htmlTemplate: '<p>Qualification</p>' },
      { kunde, einsatzort: site, beruf: job, qualifikation: qualification, htmlTemplate: '<p>Specific</p>' },
    ];
    const originalFind = EinsatzinformationTemplate.find;
    EinsatzinformationTemplate.find = () => ({ sort: () => ({ lean: async () => templates }) });
    try {
      expect((await resolveTemplate({ kundeId: kunde, einsatzortId: site, berufId: job, qualifikationId: qualification })).template.htmlTemplate).to.equal('<p>Specific</p>');
      expect((await resolveTemplate({ kundeId: kunde, einsatzortId: site, berufId: job })).template.htmlTemplate).to.equal('<p>Job</p>');
      expect((await resolveTemplate({ kundeId: kunde, einsatzortId: site, qualifikationId: qualification })).template.htmlTemplate).to.equal('<p>Qualification</p>');
      expect((await resolveTemplate({ kundeId: kunde, einsatzortId: site })).template.htmlTemplate).to.equal('<p>Site</p>');
      expect((await resolveTemplate({ kundeId: kunde, einsatzortId: new mongoose.Types.ObjectId() })).template.htmlTemplate).to.equal('<p>Customer</p>');
    } finally {
      EinsatzinformationTemplate.find = originalFind;
    }
  });

  it('supports canonical shifts, overnight windows, and the regular/pseudo release boundary', () => {
    const shift = new Schicht({ auftragNr: 4711, source: 'monitor', bezeichnung: 'Service' });
    expect(shift.validateSync()).to.equal(undefined);
    expect(shift.idAuftragArbeitsschichten).to.equal(null);
    const window = shiftWindow({ datumVon: '2026-09-04', datumBis: '2026-09-04', uhrzeitVon: '18:00', uhrzeitBis: '02:00' });
    expect(window.end.getTime()).to.be.greaterThan(window.start.getTime());

    const order = {
      eventTitel: 'Gala', locationV2: new mongoose.Types.ObjectId(), kundenNr: 4711,
      vonDatum: new Date('2026-09-04'), bisDatum: new Date('2026-09-05'),
      eventStrasse: 'Musterweg 1', eventPlz: '20095', eventOrt: 'Hamburg',
    };
    const incomplete = [{ _id: new mongoose.Types.ObjectId(), einsatzinformation: {} }];
    expect(validateAuftragRelease({ ...order, isPseudo: false }, incomplete).some(error => error.message.includes('Einsatzinformationen fehlen'))).to.equal(true);
    expect(validateAuftragRelease({ ...order, isPseudo: true }, incomplete)).to.deep.equal([]);
  });
});
