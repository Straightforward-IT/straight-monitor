// § 4 ArbZG: Ruhepausenregelung — rein frontend-seitige Validierung
export function pruefeArbeitszeit({ start, end, pausen = [] }) {
  const fehler = [];

  function toMin(hhmm) {
    if (!hhmm) return 0;
    const [h, m] = String(hhmm).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  const startMin = toMin(start);
  let endMin = toMin(end);
  if (endMin <= startMin) endMin += 24 * 60;

  const gesamtMinuten = endMin - startMin;

  let pausenMinutenGesamt = 0;
  let validePausenMin = 0;

  for (const p of pausen) {
    const dauer = Number(p.minuten) || 0;
    if (dauer <= 0) continue;
    pausenMinutenGesamt += dauer;

    if (dauer < 15) {
      fehler.push(`Pausenblock mit ${dauer} Min. muss mindestens 15 Min. dauern (§ 4 ArbZG).`);
    } else {
      validePausenMin += dauer;
    }
  }

  const nettoMinuten = gesamtMinuten - pausenMinutenGesamt;
  const nettoStunden = nettoMinuten / 60;

  // Grenzwerte: > 6 h → 30 Min., > 9 h → 45 Min.
  let pflichtpauseMinuten = 0;
  if (nettoStunden > 9) pflichtpauseMinuten = 45;
  else if (nettoStunden > 6) pflichtpauseMinuten = 30;

  if (pflichtpauseMinuten > 0 && validePausenMin < pflichtpauseMinuten) {
    const stundStr = nettoStunden.toFixed(2).replace('.', ',');
    fehler.push(
      `Bei ${stundStr} h Arbeitszeit: mind. ${pflichtpauseMinuten} Min. anrechenbare Pause erforderlich (eingetragen: ${Math.round(validePausenMin)} Min.).`
    );
  }

  // Ohne Pausenlage: nur prüfen ob bei >6 h überhaupt eine anrechenbare Pause vorhanden ist
  if (gesamtMinuten > 360 && validePausenMin === 0) {
    fehler.push('Kein Arbeitsblock darf 6 Stunden ohne anrechenbare Pause (≥ 15 Min.) überschreiten.');
  }

  return {
    gueltig: fehler.length === 0,
    gesamtMinuten,
    nettoMinuten,
    pflichtpauseMinuten,
    tatsaechlichePauseMinuten: pausenMinutenGesamt,
    validePausenMinuten: validePausenMin,
    fehler,
  };
}
