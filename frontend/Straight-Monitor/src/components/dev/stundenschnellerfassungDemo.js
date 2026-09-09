// Fictional fixtures only. The IDs and model field names mirror the API records.
export function createStundenschnellerfassungDemo() {
  const auftragNr = 260908;
  const auftrag = { auftragNr, eventTitel: 'Deck10-Menü', eventLocation: 'Deck 10', eventOrt: 'Hamburg', vonDatum: '2026-09-08', bisDatum: '2026-09-09' };
  const schichten = [
    { _id: 'demo-service', auftragNr, idAuftragArbeitsschichten: 8101, bezeichnung: 'Service', datumVon: '2026-09-08', datumBis: '2026-09-09', uhrzeitVon: '17:00', uhrzeitBis: '04:00' },
    { _id: 'demo-kueche', auftragNr, idAuftragArbeitsschichten: 8102, bezeichnung: 'Küche', datumVon: '2026-09-08', datumBis: '2026-09-08', uhrzeitVon: '16:00', uhrzeitBis: '23:00' },
  ];
  const people = [
    ['Bakri-Heger', 'Alalivi'], ['Bumke', 'Jim'], ['Drögemüller', 'Leonie'], ['Memming', 'Julius'], ['Peters', 'Mia'], ['Yilmaz', 'Deniz'],
  ];
  const einsaetze = people.map(([nachname, vorname], index) => {
    const shift = schichten[index < 4 ? 0 : 1];
    return {
      _id: `demo-einsatz-${index + 1}`, auftragNr, personalNr: 10421 + index,
      schicht: shift._id, idAuftragArbeitsschichten: shift.idAuftragArbeitsschichten,
      datumVon: shift.datumVon, datumBis: shift.datumBis, uhrzeitVon: shift.uhrzeitVon, uhrzeitBis: shift.uhrzeitBis,
      mitarbeiterData: { nachname, vorname },
    };
  });
  const zeiten = einsaetze.slice(0, 4).map((einsatz, index) => ({
    einsatzId: einsatz._id, start: index === 0 ? '10:00' : '16:00', end: index === 0 ? '16:00' : '22:00', breakMinutes: 0, paidBreakMinutes: 0,
  }));
  return { auftrag, schichten, einsaetze, zeiten };
}
