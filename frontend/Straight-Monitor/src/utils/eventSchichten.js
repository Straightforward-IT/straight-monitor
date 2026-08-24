export function buildEventSchichten(event) {
  if (!event?.einsaetze && !event?.schichten) return [];

  const grouped = {};
  (event.schichten || []).forEach(schicht => {
    const key = schicht.idAuftragArbeitsschichten || 'none';
    if (grouped[key]) return;
    grouped[key] = {
      einsaetze: [],
      meta: {
        schichtBezeichnung: schicht.bezeichnung || null,
        schichtId: schicht._id || null,
        idAuftragArbeitsschichten: schicht.idAuftragArbeitsschichten || null,
        datumVon: schicht.datumVon || null,
        treffpunkt: schicht.treffpunkt || null,
        treffpunktOrt: schicht.treffpunktOrt || null,
        ansprechpartnerName: schicht.ansprechpartnerName || null,
        ansprechpartnerTelefon: schicht.ansprechpartnerTelefon || null,
        ansprechpartnerEmail: schicht.ansprechpartnerEmail || null,
        uhrzeitVon: schicht.uhrzeitVon || null,
        uhrzeitBis: schicht.uhrzeitBis || null,
        bedarf: schicht.bedarf ?? null,
        bedarfMet: false,
      },
    };
  });

  (event.einsaetze || []).forEach(einsatz => {
    const key = einsatz.idAuftragArbeitsschichten || 'none';
    if (!grouped[key]) {
      grouped[key] = {
        einsaetze: [],
        meta: {
          schichtBezeichnung: einsatz.schichtBezeichnung || null,
          schichtId: null,
          idAuftragArbeitsschichten: einsatz.idAuftragArbeitsschichten || null,
          datumVon: einsatz.datumVon || null,
          treffpunkt: einsatz.treffpunkt || null,
          treffpunktOrt: einsatz.treffpunktOrt || null,
          ansprechpartnerName: einsatz.ansprechpartnerName || null,
          ansprechpartnerTelefon: einsatz.ansprechpartnerTelefon || null,
          ansprechpartnerEmail: einsatz.ansprechpartnerEmail || null,
          uhrzeitVon: einsatz.uhrzeitVon || null,
          uhrzeitBis: einsatz.uhrzeitBis || null,
          bedarf: einsatz.bedarf ?? null,
          bedarfMet: false,
        },
      };
    }
    grouped[key].einsaetze.push(einsatz);
  });

  Object.values(grouped).forEach(schicht => {
    const bedarf = schicht.meta.bedarf;
    schicht.meta.bedarfMet = bedarf ? schicht.einsaetze.length >= bedarf : true;
    schicht.einsaetze.sort((left, right) => {
      const leftName = (left.mitarbeiterData?.nachname || '').toLocaleLowerCase('de');
      const rightName = (right.mitarbeiterData?.nachname || '').toLocaleLowerCase('de');
      return leftName.localeCompare(rightName, 'de');
    });
  });

  return Object.entries(grouped)
    .sort(([, left], [, right]) => {
      const leftJobKey = left.einsaetze[0]?.berufData?.jobKey ?? Infinity;
      const rightJobKey = right.einsaetze[0]?.berufData?.jobKey ?? Infinity;
      if (leftJobKey !== rightJobKey) return leftJobKey - rightJobKey;
      return (left.meta.uhrzeitVon || '').localeCompare(right.meta.uhrzeitVon || '');
    })
    .map(([key, schicht]) => ({ key, ...schicht }));
}