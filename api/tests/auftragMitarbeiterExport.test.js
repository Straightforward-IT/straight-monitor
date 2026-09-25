const { expect } = require('chai');
const { buildAuftragMitarbeiterExport } = require('../services/operations/AuftragMitarbeiterExportService');

describe('AuftragMitarbeiterExportService', () => {
  it('deduplicates employees and resolves their historical personnel numbers across shifts', () => {
    const result = buildAuftragMitarbeiterExport({
      auftrag: { auftragNr: 42, eventTitel: 'Testevent' },
      schichten: [
        { _id: 'shift-a', idAuftragArbeitsschichten: 7, bezeichnung: 'Frühschicht' },
        { _id: 'shift-b', idAuftragArbeitsschichten: 8, bezeichnung: 'Spätschicht' },
      ],
      einsaetze: [
        { personalNr: 7001, schicht: 'shift-a' },
        { personalNr: 6001, idAuftragArbeitsschichten: 8 },
      ],
      mitarbeiter: [{
        _id: 'employee-a',
        personalnr: '7001',
        personalnrHistory: [{ value: '6001' }],
        vorname: 'Anna',
        nachname: 'Beispiel',
        email: 'anna@example.test',
        telefon: '040 123456',
        einsatzCount: 12,
        konfektionsgroesse: 'M',
        schuhgroesse: '39',
      }],
    });

    expect(result.auftrag).to.deep.equal({ auftragNr: 42, eventTitel: 'Testevent' });
    expect(result.schichten).to.deep.equal([
      { id: 'schicht:shift-a', label: 'Frühschicht' },
      { id: 'legacy:8', label: 'Spätschicht' },
    ]);
    expect(result.mitarbeiter).to.deep.equal([{
      _id: 'employee-a',
      personalnr: '7001',
      email: 'anna@example.test',
      telefon: '040 123456',
      vorname: 'Anna',
      nachname: 'Beispiel',
      geburtsdatum: null,
      einsatzCount: 12,
      konfektionsgroesse: 'M',
      schuhgroesse: '39',
      shiftIds: ['schicht:shift-a', 'legacy:8'],
    }]);
  });

  it('uses a legacy shift when a stale canonical reference cannot be resolved', () => {
    const result = buildAuftragMitarbeiterExport({
      auftrag: { auftragNr: 7 },
      schichten: [{ _id: 'shift-a', idAuftragArbeitsschichten: 3, bezeichnung: 'Service' }],
      einsaetze: [{ personalNr: 300, schicht: 'missing-shift', idAuftragArbeitsschichten: 3 }],
      mitarbeiter: [{ _id: 'employee-a', personalnr: '300', vorname: 'Max', nachname: 'Mustermann' }],
    });

    expect(result.schichten).to.deep.equal([{ id: 'legacy:3', label: 'Service' }]);
    expect(result.mitarbeiter[0].shiftIds).to.deep.equal(['legacy:3']);
  });

  it('returns no employee properties outside the export allowlist', () => {
    const result = buildAuftragMitarbeiterExport({
      auftrag: { auftragNr: 7 },
      schichten: [],
      einsaetze: [{ personalNr: 300 }],
      mitarbeiter: [{
        _id: 'employee-a',
        personalnr: '300',
        vorname: 'Max',
        nachname: 'Mustermann',
        iban: 'DE89370400440532013000',
        steuerId: 'sensitive',
      }],
    });

    expect(result.mitarbeiter[0]).to.have.all.keys(
      '_id', 'personalnr', 'email', 'telefon', 'vorname', 'nachname',
      'geburtsdatum', 'einsatzCount', 'konfektionsgroesse', 'schuhgroesse', 'shiftIds'
    );
  });
});