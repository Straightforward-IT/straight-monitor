const assert = require('node:assert/strict');
const { sha256 } = require('../payroll-core/hash');
const StundenlisteService = require('../services/operations/StundenlisteService');

function createData() {
  return {
    auftrag: {
      _id: 'auftrag-id', updatedAt: new Date('2026-09-07T12:00:00.000Z'),
      eventTitel: 'Sommerfest', vonDatum: new Date('2026-09-10T08:00:00.000Z'),
      bisDatum: new Date('2026-09-10T18:00:00.000Z'), eventLocation: 'Hafen',
      eventStrasse: 'Kai 1', eventPlz: '20095', eventOrt: 'Hamburg', referenz: 'SF-01',
    },
    kunde: {
      _id: 'kunde-id', updatedAt: new Date('2026-09-07T12:00:00.000Z'), kundName: 'Kunde GmbH',
      adressen: [{ strasse: 'Kundenweg 2', plz: '20095', ort: 'Hamburg' }],
    },
    niederlassung: { name: 'Hamburg', betriebsNr: '123', telefone: ['040 123'], email: 'hamburg@example.test' },
    schichten: [{
      _id: 'schicht-id', updatedAt: new Date('2026-09-07T12:00:00.000Z'), idAuftragArbeitsschichten: 10,
      bezeichnung: 'Service', datumVon: new Date('2026-09-10T00:00:00.000Z'), uhrzeitVon: '10:00', uhrzeitBis: '18:00', endeOffen: 0,
    }],
    einsaetze: [{
      _id: 'einsatz-id', updatedAt: new Date('2026-09-07T12:00:00.000Z'), idAuftragArbeitsschichten: 10,
      personalNr: 1234, bezeichnung: 'Servicekraft', datumVon: new Date('2026-09-10T10:00:00.000Z'), berufSchl: '2', qualSchl: '7',
      mitarbeiterData: { _id: 'mitarbeiter-id', updatedAt: new Date('2026-09-07T12:00:00.000Z'), vorname: 'Max', nachname: 'Mustermann', geburtsdatum: new Date('1990-01-01T00:00:00.000Z') },
      berufData: { _id: 'beruf-id', jobKey: 2, designation: 'Service' },
      qualifikationData: { _id: 'quali-id', qualificationKey: 7, designation: 'Barista' },
    }],
  };
}

function contentHash(data) {
  return sha256(StundenlisteService._getRenderedDataSnapshot(data));
}

describe('Stundenliste content hash', () => {
  it('renders employee names outside WinAnsi', async () => {
    const data = createData();
    data.einsaetze[0].mitarbeiterData.vorname = 'Nuri';
    data.einsaetze[0].mitarbeiterData.nachname = 'Softić';

    const pdf = await StundenlisteService._renderPdf(data);

    assert.ok(Buffer.isBuffer(pdf));
    assert.ok(pdf.length > 0);
  });

  it('ignores technical metadata changed by an otherwise identical import', () => {
    const original = createData();
    const reimported = createData();
    reimported.auftrag._id = 'new-auftrag-id';
    reimported.auftrag.updatedAt = new Date('2026-09-08T12:00:00.000Z');
    reimported.einsaetze[0]._id = 'new-einsatz-id';
    reimported.einsaetze[0].updatedAt = new Date('2026-09-08T12:00:00.000Z');
    reimported.einsaetze[0].mitarbeiterData.updatedAt = new Date('2026-09-08T12:00:00.000Z');

    assert.equal(contentHash(reimported), contentHash(original));
  });

  it('changes when a shift time slot or assignment personnel number changes', () => {
    const originalHash = contentHash(createData());
    const changedShift = createData();
    changedShift.schichten[0].uhrzeitVon = '11:00';
    const changedAssignment = createData();
    changedAssignment.einsaetze[0].personalNr = 5678;

    assert.notEqual(contentHash(changedShift), originalHash);
    assert.notEqual(contentHash(changedAssignment), originalHash);
  });

  it('ignores changes outside assignment personnel numbers and shift time slots', () => {
    const originalHash = contentHash(createData());
    const changed = createData();
    changed.auftrag.eventTitel = 'Anderes Event';
    changed.einsaetze[0].mitarbeiterData.nachname = 'Beispiel';
    changed.schichten[0].bezeichnung = 'Bar';

    assert.equal(contentHash(changed), originalHash);
  });
});