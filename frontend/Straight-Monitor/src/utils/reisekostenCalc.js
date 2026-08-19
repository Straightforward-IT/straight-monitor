/**
 * reisekostenCalc.js (frontend mirror)
 *
 * Pure calculation helpers for the Reisekostenabrechnung. All monetary values are
 * INTEGER CENTS. Keep in sync with api/utils/reisekostenCalc.js (backend is authoritative).
 */

export const KM_SATZ_DEFAULT_CENT = 30;

function money(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
}

export function kmGesamtCent(row = {}) {
  return money((Number(row.kilometer) || 0) * (Number(row.satzCent) || 0));
}

export function pauschalGesamtCent(row = {}) {
  const anzahl = Number(row.anzahl != null ? row.anzahl : row.tage) || 0;
  return money(anzahl * (Number(row.satzCent) || 0));
}

export function rowVorsteuerCent(row = {}) {
  const betrag = money(row.betragCent);
  const p = Number(row.prozent) || 0;
  if (p > 0) return Math.round((betrag * p) / (100 + p));
  return money(row.vorsteuerCent);
}

export function computeSummen(doc = {}) {
  const fahrt = Array.isArray(doc.fahrtkosten) ? doc.fahrtkosten : [];
  const km = Array.isArray(doc.kilometerpauschale) ? doc.kilometerpauschale : [];
  const uebern = Array.isArray(doc.uebernachtung) ? doc.uebernachtung : [];
  const neben = Array.isArray(doc.nebenkosten) ? doc.nebenkosten : [];
  const pausch = doc.pauschalen || {};

  const fahrtSum = fahrt.reduce((s, r) => s + money(r.betragCent), 0);
  const kmSum = km.reduce((s, r) => s + kmGesamtCent(r), 0);
  const uebernSum = uebern.reduce((s, r) => s + money(r.betragCent), 0);

  const pauschUeber = (Array.isArray(pausch.uebernachtungen) ? pausch.uebernachtungen : [])
    .reduce((s, r) => s + pauschalGesamtCent(r), 0);
  const pausch24 = pauschalGesamtCent(pausch.tage24 || {});
  const pausch14 = pauschalGesamtCent(pausch.tage14 || {});
  const pausch8 = pauschalGesamtCent(pausch.tage8 || {});
  const pauschSum = pauschUeber + pausch24 + pausch14 + pausch8;

  const nebenSum = neben.reduce((s, r) => s + money(r.betragCent), 0);

  const bruttoCent = fahrtSum + kmSum + uebernSum + pauschSum + nebenSum;
  const vorsteuerGesamtCent = [...fahrt, ...uebern, ...neben]
    .reduce((s, r) => s + rowVorsteuerCent(r), 0);
  const nettoCent = bruttoCent - vorsteuerGesamtCent;
  const vorschussCent = money(doc.vorschussCent);
  const auszuzahlenCent = bruttoCent - vorschussCent;

  return {
    fahrtSum, kmSum, uebernSum, pauschUeber, pausch24, pausch14, pausch8, pauschSum,
    nebenSum, bruttoCent, vorsteuerGesamtCent, nettoCent, vorschussCent, auszuzahlenCent,
  };
}

/** cents → "1.234,56" */
export function centToStr(cent) {
  const c = Math.round(Number(cent) || 0);
  return (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1234,56" | 1234.56 | number → integer cents */
export function eurToCent(v) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** integer cents → editable EUR value (e.g. 1234) for number inputs, 2 decimals */
export function centToEur(cent) {
  const c = Math.round(Number(cent) || 0);
  return c / 100;
}
