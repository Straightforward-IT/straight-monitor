/**
 * reisekostenCalc.js
 *
 * Pure calculation helpers for the Reisekostenabrechnung (travel expense report).
 * All monetary values are handled as INTEGER CENTS to avoid floating-point drift.
 *
 * A mirrored copy exists in the frontend
 * (frontend/Straight-Monitor/src/utils/reisekostenCalc.js) for live totals — keep both in sync.
 */

/** Default mileage rate in cents per kilometer (0,30 €/km). */
const KM_SATZ_DEFAULT_CENT = 30;

function money(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
}

/** Gesamtbetrag einer Kilometerpauschalen-Zeile: km × Satz (Cent/km). */
function kmGesamtCent(row = {}) {
  return money((Number(row.kilometer) || 0) * (Number(row.satzCent) || 0));
}

/** Gesamtbetrag einer Pauschal-Zeile: Anzahl/Tage × Satz (Cent). */
function pauschalGesamtCent(row = {}) {
  const anzahl = Number(row.anzahl != null ? row.anzahl : row.tage) || 0;
  return money(anzahl * (Number(row.satzCent) || 0));
}

/**
 * Enthaltene Vorsteuer einer Einzelnachweis-Zeile.
 * Ist ein Prozentsatz gesetzt, wird die im Bruttobetrag enthaltene USt. herausgerechnet;
 * andernfalls wird ein manuell erfasster vorsteuerCent-Wert übernommen.
 */
function rowVorsteuerCent(row = {}) {
  const betrag = money(row.betragCent);
  const p = Number(row.prozent) || 0;
  if (p > 0) return Math.round((betrag * p) / (100 + p));
  return money(row.vorsteuerCent);
}

/**
 * Berechnet alle Zwischensummen und Endbeträge einer Reisekostenabrechnung.
 * @param {object} doc - Reisekosten-Formulardaten.
 * @returns {object} Alle Summen in Cent.
 */
function computeSummen(doc = {}) {
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
    fahrtSum,
    kmSum,
    uebernSum,
    pauschUeber,
    pausch24,
    pausch14,
    pausch8,
    pauschSum,
    nebenSum,
    bruttoCent,
    vorsteuerGesamtCent,
    nettoCent,
    vorschussCent,
    auszuzahlenCent,
  };
}

module.exports = {
  KM_SATZ_DEFAULT_CENT,
  computeSummen,
  kmGesamtCent,
  pauschalGesamtCent,
  rowVorsteuerCent,
};
