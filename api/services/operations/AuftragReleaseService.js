function validateAuftragRelease(auftrag = {}, schichten = []) {
  const errors = [];
  if (!auftrag.eventTitel || !auftrag.locationV2 || !auftrag.vonDatum || !auftrag.bisDatum) {
    errors.push({ step: 0, field: 'auftrag', message: 'Die allgemeinen Auftragsdaten sind unvollständig' });
  }
  if (!auftrag.isPseudo && !auftrag.kundenNr) {
    errors.push({ step: 0, field: 'kundenNr', message: 'Ein Kunde ist erforderlich' });
  }
  if (!auftrag.isPseudo && !auftrag.einsatzort && !(auftrag.eventStrasse && auftrag.eventPlz && auftrag.eventOrt)) {
    errors.push({ step: 1, field: 'einsatzort', message: 'Einsatzort oder vollständige Auftragsadresse fehlt' });
  }
  if (!schichten.length) {
    errors.push({ step: 2, field: 'schichten', message: 'Mindestens eine Schicht ist erforderlich' });
  }
  if (!auftrag.isPseudo) {
    schichten.forEach((shift, index) => {
      const info = shift.einsatzinformation || {};
      if (!info.sourceHtml || !info.renderedHtml) {
        errors.push({ step: 2, field: `schicht-${shift._id}`, message: `Schicht ${index + 1}: Einsatzinformationen fehlen` });
      } else if (info.unresolvedPlaceholders?.length) {
        errors.push({
          step: 2,
          field: `schicht-${shift._id}`,
          message: `Schicht ${index + 1}: Textmarken ohne Wert (${info.unresolvedPlaceholders.join(', ')})`,
        });
      }
    });
  }
  return errors;
}

module.exports = { validateAuftragRelease };
