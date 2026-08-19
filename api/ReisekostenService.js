/**
 * ReisekostenService
 *
 * Generiert für einen Mitarbeiter (im Kontext eines Auftrags/Einsatzes) das PDF
 * "Reisekostenabrechnung".
 *
 * Der Vorgang ist bewusst App-zentriert: Die Nutzer:innen füllen im Monitor eine
 * editierbare Maske aus (Kopfdaten + Kostentabelle), das Backend rendert daraus das
 * PDF. Optional wird ein einzelnes DocuSeal-Signaturfeld (Mitarbeiter) eingebettet.
 *
 * Singleton-Export analog zu StundenlisteService / R2Service.
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const Auftrag = require('./models/Auftrag');
const Einsatz = require('./models/Einsatz');
const Mitarbeiter = require('./models/Mitarbeiter');
const Location = require('./models/Location');
const logger = require('./utils/logger');
const {
  KM_SATZ_DEFAULT_CENT,
  computeSummen,
  kmGesamtCent,
  pauschalGesamtCent,
  rowVorsteuerCent,
} = require('./utils/reisekostenCalc');

const FIRMA = 'H. & P. Straightforward GmbH';

// Seiten- und Layout-Konstanten (A4 in pt)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLOR_TEXT = rgb(0.1, 0.1, 0.1);
const COLOR_MUTED = rgb(0.45, 0.45, 0.45);
const COLOR_LINE = rgb(0.6, 0.6, 0.6);
const COLOR_LINE_LIGHT = rgb(0.8, 0.8, 0.8);
const COLOR_GREEN_BG = rgb(0.87, 0.95, 0.87);
const COLOR_GREEN_TITLE = rgb(0.78, 0.92, 0.78);
const COLOR_RED = rgb(0.75, 0.12, 0.12);

// Spaltenbreiten der Kostentabelle (Summe = CONTENT_W = 515.28)
const COL = {
  desc: 263.28,
  bemEur: 50,
  bemCt: 22,
  betEur: 50,
  betCt: 22,
  proz: 36,
  vsEur: 50,
  vsCt: 22,
};

class ReisekostenService {
  /**
   * Baut das Reisekosten-PDF aus einem (bereits berechneten) Formular-Dokument.
   * @param {object} doc - Reisekosten-Formulardaten (siehe buildDefaults).
   * @param {object} [options]
   * @param {boolean} [options.signatureTags=false] - Bettet ein unsichtbares DocuSeal-Signaturfeld
   *   (Rolle "Mitarbeiter") über der Unterschriftslinie ein.
   * @returns {Promise<{ buffer: Buffer }>}
   */
  async buildPdf(doc, options = {}) {
    const buffer = await this._renderPdf(doc || {}, { signatureTags: !!options.signatureTags });
    return { buffer };
  }

  /**
   * Hängt Belege (Screenshots/PDFs) als zusätzliche Seiten an ein bestehendes PDF an.
   * @param {Buffer} mainBuffer - Basis-PDF.
   * @param {Array<{buffer: Buffer, contentType?: string, filename?: string}>} attachments
   * @returns {Promise<Buffer>}
   */
  async mergeAttachments(mainBuffer, attachments = []) {
    if (!attachments.length) return mainBuffer;
    const pdf = await PDFDocument.load(mainBuffer);

    for (const att of attachments) {
      if (!att || !att.buffer || !att.buffer.length) continue;
      const type = (att.contentType || '').toLowerCase();
      const name = (att.filename || '').toLowerCase();
      try {
        if (type.includes('pdf') || name.endsWith('.pdf')) {
          const src = await PDFDocument.load(att.buffer);
          const pages = await pdf.copyPages(src, src.getPageIndices());
          pages.forEach((p) => pdf.addPage(p));
        } else if (type.includes('png') || name.endsWith('.png') || type.includes('jpeg') || type.includes('jpg') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
          const img = (type.includes('png') || name.endsWith('.png'))
            ? await pdf.embedPng(att.buffer)
            : await pdf.embedJpg(att.buffer);
          const page = pdf.addPage([PAGE_W, PAGE_H]);
          const maxW = PAGE_W - MARGIN * 2;
          const maxH = PAGE_H - MARGIN * 2;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, width: w, height: h });
        } else {
          logger.warn(`ReisekostenService.mergeAttachments: nicht unterstützter Typ übersprungen (${att.filename})`);
        }
      } catch (e) {
        logger.warn(`ReisekostenService.mergeAttachments: Anhang übersprungen (${att.filename}): ${e.message}`);
      }
    }
    return Buffer.from(await pdf.save());
  }

  /**
   * Erzeugt ein vorbefülltes Reisekosten-Formular aus Auftrags-, Einsatz- und
   * Mitarbeiterdaten. Beträge sind leer; die Nutzer:innen ergänzen sie in der Maske.
   * @param {object} params
   * @param {number|string} params.auftragNr
   * @param {number|string} params.personalNr
   * @returns {Promise<object>} Formular-Skelett.
   */
  async buildDefaults({ auftragNr, personalNr }) {
    const nr = parseInt(auftragNr, 10);
    const auftrag = Number.isFinite(nr) ? await Auftrag.findOne({ auftragNr: nr }).lean() : null;

    let mitarbeiter = null;
    if (personalNr != null && String(personalNr).trim() !== '') {
      const pnr = String(personalNr).trim();
      mitarbeiter = await Mitarbeiter.findOne({
        $or: [{ personalnr: pnr }, { personalnummern: pnr }],
      })
        .select('vorname nachname personalnr locationV2 adresse adresse2')
        .lean();
    }

    // Einsatz-Zeitraum des konkreten Mitarbeiters, sonst Auftragszeitraum.
    let von = auftrag?.vonDatum || null;
    let bis = auftrag?.bisDatum || null;
    if (Number.isFinite(nr) && personalNr != null) {
      const einsaetze = await Einsatz.find({ auftragNr: nr, personalNr: Number(personalNr) })
        .select('datumVon datumBis')
        .sort({ datumVon: 1 })
        .lean();
      if (einsaetze.length) {
        von = einsaetze[0].datumVon || von;
        bis = einsaetze[einsaetze.length - 1].datumBis || einsaetze[einsaetze.length - 1].datumVon || bis;
      }
    }

    const tage = this._reisetage(von, bis);
    const eventTitel = auftrag?.eventTitel || '';

    const locationId = mitarbeiter?.locationV2 || auftrag?.locationV2 || null;
    // Ort (Unterschrift) = Stadt der Location, an der der Auftrag stattfand.
    const ortLocationId = auftrag?.locationV2 || mitarbeiter?.locationV2 || null;
    let kostenstelle = '';
    let ort = '';
    const addressSuggestions = [];
    const pushAddr = (a) => { const s = String(a || '').trim(); if (s && !addressSuggestions.includes(s)) addressSuggestions.push(s); };
    const fmtLocAddr = (adr) => {
      if (!adr) return '';
      const line1 = [adr.street, adr.houseNumber].filter(Boolean).join(' ');
      const line2 = [adr.postalCode, adr.city].filter(Boolean).join(' ');
      return [line1, line2].filter(Boolean).join(', ');
    };
    const locIds = [...new Set([locationId, ortLocationId].filter(Boolean).map(String))];
    if (locIds.length) {
      const locs = await Location.find({ _id: { $in: locIds } }).select('kostenstelle externalId address').lean();
      const map = new Map(locs.map((l) => [String(l._id), l]));
      const kl = locationId ? map.get(String(locationId)) : null;
      const ol = ortLocationId ? map.get(String(ortLocationId)) : null;
      kostenstelle = kl ? (kl.kostenstelle || kl.externalId || '') : '';
      ort = ol ? (ol.address?.city || '') : '';
      for (const l of locs) pushAddr(fmtLocAddr(l.address));
    }
    // Event-Adresse des Auftrags als Vorschlag.
    if (auftrag) {
      pushAddr([auftrag.eventLocation, auftrag.eventStrasse, [auftrag.eventPlz, auftrag.eventOrt].filter(Boolean).join(' ')].filter(Boolean).join(', '));
    }
    // Mitarbeiter-Adressen (Haupt- + Zweitadresse) als Vorschlag.
    if (mitarbeiter) {
      const fmtMaAddr = (a) => a ? [a.strasse, [a.plz, a.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
      pushAddr(fmtMaAddr(mitarbeiter.adresse));
      pushAddr(fmtMaAddr(mitarbeiter.adresse2));
    }

    return {
      auftragNr: Number.isFinite(nr) ? nr : null,
      personalNr: personalNr != null ? Number(personalNr) : null,
      mitarbeiterId: mitarbeiter?._id || null,
      locationV2: locationId,
      kopf: {
        titel: '',
        name: mitarbeiter?.nachname || '',
        vorname: mitarbeiter?.vorname || '',
        firma: FIRMA,
        zweck: eventTitel ? `Hin- & Rückfahrt Einsatz – ${eventTitel}` : 'Hin- & Rückfahrt Einsatz',
        reiseziel: '',
        start: '',
        ziel: '',
        reisebeginn: von ? new Date(von).toISOString() : null,
        reiseende: bis ? new Date(bis).toISOString() : null,
        transportmittel: 'privatpkw',
        tage: tage,
        stunden: '',
        nummernschild: '',
        kostenstelle,
      },
      fahrtkosten: [],
      kilometerpauschale: [{ bezeichnung: 'Kilometerpauschale', kilometer: 0, satzCent: KM_SATZ_DEFAULT_CENT }],
      uebernachtung: [],
      pauschalen: {
        uebernachtungen: [],
        tage24: { tage: 0, satzCent: 0 },
        tage14: { tage: 0, satzCent: 0 },
        tage8: { tage: 0, satzCent: 0 },
      },
      nebenkosten: [],
      reisedaten: [],
      vorschussCent: 0,
      ort,
      addressSuggestions,
    };
  }

  // ── PDF-Rendering ─────────────────────────────────────────────────────────
  async _renderPdf(doc, options = {}) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let logoImg = null;
    try {
      const logoPath = path.join(__dirname, 'assets', 'straightforward-logo-black.png');
      if (fs.existsSync(logoPath)) {
        logoImg = await pdf.embedPng(fs.readFileSync(logoPath));
      }
    } catch (e) {
      logger.warn(`ReisekostenService: Logo nicht eingebettet: ${e.message}`);
    }

    let docusealLogoImg = null;
    if (options.signatureTags) {
      try {
        const dsPath = path.join(__dirname, 'assets', 'docuseal-logo.png');
        if (fs.existsSync(dsPath)) {
          docusealLogoImg = await pdf.embedPng(fs.readFileSync(dsPath));
        }
      } catch (e) {
        logger.warn(`ReisekostenService: DocuSeal-Logo nicht eingebettet: ${e.message}`);
      }
    }

    const ctx = {
      doc: pdf,
      font,
      fontBold,
      page: pdf.addPage([PAGE_W, PAGE_H]),
      y: PAGE_H - MARGIN,
      signatureTags: !!options.signatureTags,
      docusealLogoImg,
      logoImg,
    };

    const summen = computeSummen(doc);

    this._kopfBlock(ctx, doc);
    ctx.y -= 14;
    this._kostenTabelle(ctx, doc, summen);
    ctx.y -= 10;
    this._abschlussBlock(ctx, doc, summen);
    this._hinweisText(ctx);
    this._reisedatenSeite(ctx, doc);

    this._drawPageFooters(pdf, fontBold);

    return Buffer.from(await pdf.save());
  }

  // ── Kopf ────────────────────────────────────────────────────────────────
  _kopfBlock(ctx, doc) {
    const kopf = doc.kopf || {};
    const top = ctx.y;

    // Logo oben links.
    let logoBottom = top;
    if (ctx.logoImg) {
      const logoW = 150;
      const logoH = (ctx.logoImg.height / ctx.logoImg.width) * logoW;
      ctx.page.drawImage(ctx.logoImg, { x: MARGIN, y: top - logoH, width: logoW, height: logoH });
      logoBottom = top - logoH;
    }

    // KST-Kasten oben rechts.
    const kst = kopf.kostenstelle || '';
    const kstW = 96;
    const kstH = 34;
    const kstX = MARGIN + CONTENT_W - kstW;
    ctx.page.drawRectangle({ x: kstX, y: top - kstH, width: kstW, height: kstH, borderColor: COLOR_LINE, borderWidth: 0.8 });
    ctx.page.drawText('Kostenstelle', { x: kstX + 6, y: top - 11, size: 7, font: ctx.font, color: COLOR_MUTED });
    this._centerText(ctx, `KST. ${kst || '—'}`, kstX, kstX + kstW, top - 27, 13, ctx.fontBold);

    // Titel links, klein, ohne Rahmen.
    const titleY = logoBottom - 14;
    ctx.page.drawText('Reisekostenabrechnung', { x: MARGIN, y: titleY, size: 13, font: ctx.fontBold, color: COLOR_TEXT });
    if (kopf.titel) {
      ctx.page.drawText(String(kopf.titel), { x: MARGIN, y: titleY - 14, size: 9, font: ctx.font, color: COLOR_MUTED });
    }

    ctx.y = titleY - (kopf.titel ? 26 : 16);

    // Zweispaltiger Kopf: links Personendaten, rechts Reisedaten.
    const colGap = 24;
    const colW = (CONTENT_W - colGap) / 2;
    const leftX = MARGIN;
    const rightX = MARGIN + colW + colGap;
    const startY = ctx.y;

    // Links: Name/Vorname, Firma, Zweck, Start, Ziel.
    let ly = startY;
    ly = this._labeledField(ctx, leftX, colW, ly, `${kopf.name || ''}${kopf.vorname ? ', ' + kopf.vorname : ''}`, 'Name, Vorname');
    ly = this._labeledField(ctx, leftX, colW, ly, kopf.firma || FIRMA, 'Firma');
    ly = this._labeledField(ctx, leftX, colW, ly, kopf.zweck || '', 'Zweck der Reise');
    ly = this._labeledField(ctx, leftX, colW, ly, kopf.start || kopf.reiseziel || '', 'Start');
    ly = this._labeledField(ctx, leftX, colW, ly, kopf.ziel || '', 'Ziel');

    // Rechts: Reisebeginn/Reiseende, Transportmittel + Nummernschild, Gesamtdauer.
    const halfW = (colW - 10) / 2;
    this._labeledField(ctx, rightX, halfW, startY, this._date(kopf.reisebeginn), 'Reisebeginn (Datum)', 1, false);
    this._labeledField(ctx, rightX + halfW + 10, halfW, startY, this._date(kopf.reiseende), 'Reiseende (Datum)', 1, false);

    let ry = startY - 32;
    ctx.page.drawText('Die Fahrt erfolgte mit:', { x: rightX, y: ry - 10, size: 8.5, font: ctx.fontBold, color: COLOR_TEXT });
    ry -= 18;
    const tm = String(kopf.transportmittel || '').toLowerCase();
    const options = [
      ['dienstwagen', 'Dienstwagen'],
      ['privatpkw', 'Privat-PKW'],
      ['mietwagen', 'Mietwagen'],
      ['bahn', 'Bahn'],
      ['flugzeug', 'Flugzeug'],
    ];
    options.forEach(([key, label], idx) => {
      this._checkbox(ctx, rightX, ry - idx * 14, tm === key, label);
    });
    // Nummernschild als Feld rechts neben den Checkboxen.
    this._labeledField(ctx, rightX + halfW + 10, halfW, ry, kopf.nummernschild || '', 'Nummernschild', 1, false);
    ry -= options.length * 14 + 6;

    // Gesamtdauer.
    ctx.page.drawText('Gesamtdauer:', { x: rightX, y: ry - 10, size: 8.5, font: ctx.fontBold, color: COLOR_TEXT });
    ry -= 16;
    this._labeledField(ctx, rightX, halfW, ry, kopf.tage != null ? String(kopf.tage) : '', 'Tage', 1, false);
    this._labeledField(ctx, rightX + halfW + 10, halfW, ry, kopf.stunden || '', 'Stunden', 1, false);
    ry -= 30;

    ctx.y = Math.min(ly, ry) - 6;
  }

  /**
   * Zeichnet ein beschriftetes Unterschrift-Feld: Wert auf einer Linie, Label darunter.
   * @returns {number} neue Y-Position nach dem Feld.
   */
  _labeledField(ctx, x, w, topY, value, label, lines = 1, advance = true) {
    const lineY = topY - 12 - (lines - 1) * 12;
    if (value) {
      const wrapped = this._wrap(value, ctx.font, 9, w - 4);
      wrapped.slice(0, lines).forEach((ln, i) => {
        ctx.page.drawText(ln, { x: x + 2, y: topY - 10 - i * 12, size: 9, font: ctx.font, color: COLOR_TEXT });
      });
    }
    ctx.page.drawLine({ start: { x, y: lineY }, end: { x: x + w, y: lineY }, thickness: 0.6, color: COLOR_LINE });
    ctx.page.drawText(label, { x, y: lineY - 9, size: 7, font: ctx.font, color: COLOR_MUTED });
    return advance ? lineY - 20 : topY;
  }

  _checkbox(ctx, x, y, checked, label) {
    const box = 9;
    ctx.page.drawRectangle({ x, y: y - box, width: box, height: box, borderColor: COLOR_LINE, borderWidth: 0.8 });
    if (checked) {
      ctx.page.drawText('X', { x: x + 1.5, y: y - box + 1.5, size: 8, font: ctx.fontBold, color: COLOR_TEXT });
    }
    ctx.page.drawText(label, { x: x + box + 4, y: y - box + 1, size: 8.5, font: ctx.font, color: COLOR_TEXT });
  }

  // ── Kostentabelle ─────────────────────────────────────────────────────────
  _kostenTabelle(ctx, doc, summen) {
    this._ensureSpace(ctx, 60, () => this._tabellenKopf(ctx));
    this._tabellenKopf(ctx);

    // Fahrtkosten (Einzelnachweis).
    this._sectionHeader(ctx, 'Fahrtkosten');
    this._subHeader(ctx, 'Einzelnachweis mit Anlagen');
    const fahrt = doc.fahrtkosten && doc.fahrtkosten.length ? doc.fahrtkosten : [{}, {}];
    for (const r of fahrt) this._betragRow(ctx, r);

    // Kilometerpauschale (km | €/km | Gesamt).
    this._sectionHeader(ctx, 'Kilometerpauschale');
    this._kmSubHeader(ctx);
    const km = doc.kilometerpauschale && doc.kilometerpauschale.length ? doc.kilometerpauschale : [{}];
    for (const r of km) this._kmRow(ctx, r);

    // Übernachtungskosten (Einzelnachweis) mit Zwischensumme.
    this._sectionHeader(ctx, 'Übernachtungskosten ( ohne Frühstück )');
    this._subHeader(ctx, 'Einzelnachweis mit Anlagen');
    const uebern = doc.uebernachtung && doc.uebernachtung.length ? doc.uebernachtung : [{}, {}];
    for (const r of uebern) this._betragRow(ctx, r);
    this._subtotalRow(ctx, summen.fahrtSum + summen.kmSum + summen.uebernSum);

    // Pauschalbeträge für Arbeitnehmer.
    this._sectionHeader(ctx, 'Pauschalbeträge für Arbeitnehmer');
    this._pauschUeberHeader(ctx);
    const pausch = doc.pauschalen || {};
    const pUeber = pausch.uebernachtungen && pausch.uebernachtungen.length ? pausch.uebernachtungen : [{}];
    for (const r of pUeber) this._pauschUeberRow(ctx, r);
    this._pauschTagRow(ctx, 'Bei Abwesenheit von mindestens 24 Std', pausch.tage24 || {});
    this._pauschTagRow(ctx, 'Bei Abwesenheit von mindestens 14 Std', pausch.tage14 || {});
    this._pauschTagRow(ctx, 'Bei Abwesenheit von mindestens 8 Std', pausch.tage8 || {}, true, summen.pauschSum);

    // Nebenkosten.
    this._sectionHeader(ctx, 'Nebenkosten');
    const neben = doc.nebenkosten && doc.nebenkosten.length ? doc.nebenkosten : [{}, {}];
    for (const r of neben) this._betragRow(ctx, r);
  }

  _colX() {
    const x0 = MARGIN;
    const bemEur = x0 + COL.desc;
    const bemCt = bemEur + COL.bemEur;
    const betEur = bemCt + COL.bemCt;
    const betCt = betEur + COL.betEur;
    const proz = betCt + COL.betCt;
    const vsEur = proz + COL.proz;
    const vsCt = vsEur + COL.vsEur;
    const end = vsCt + COL.vsCt;
    return { x0, bemEur, bemCt, betEur, betCt, proz, vsEur, vsCt, end };
  }

  _tabellenKopf(ctx) {
    const X = this._colX();
    const h = 24;
    this._ensureSpace(ctx, h);
    const top = ctx.y;
    ctx.page.drawRectangle({ x: X.x0, y: top - h, width: CONTENT_W, height: h, color: COLOR_GREEN_BG });

    // Gruppen-Titel (obere Zeile).
    this._centerText(ctx, 'Bemessungs-', X.bemEur, X.betEur, top - 9, 6.5, ctx.font);
    this._centerText(ctx, 'grundlage', X.bemEur, X.betEur, top - 16, 6.5, ctx.font);
    this._centerText(ctx, 'Betrag', X.betEur, X.proz, top - 9, 6.5, ctx.font);
    this._centerText(ctx, 'Rechnung / Pauschal', X.betEur, X.proz, top - 16, 6.5, ctx.font);
    this._centerText(ctx, '%', X.proz, X.vsEur, top - 12, 7, ctx.font);
    this._centerText(ctx, 'Enthaltene', X.vsEur, X.end, top - 9, 6.5, ctx.font);
    this._centerText(ctx, 'Vorsteuer', X.vsEur, X.end, top - 16, 6.5, ctx.font);

    // EUR/CT-Unterspalten (untere Zeile).
    this._centerText(ctx, 'EUR', X.bemEur, X.bemCt, top - 22, 6, ctx.font);
    this._centerText(ctx, 'CT', X.bemCt, X.betEur, top - 22, 6, ctx.font);
    this._centerText(ctx, 'EUR', X.betEur, X.betCt, top - 22, 6, ctx.font);
    this._centerText(ctx, 'CT', X.betCt, X.proz, top - 22, 6, ctx.font);
    this._centerText(ctx, 'EUR', X.vsEur, X.vsCt, top - 22, 6, ctx.font);
    this._centerText(ctx, 'CT', X.vsCt, X.end, top - 22, 6, ctx.font);

    this._rowBorders(ctx, top, h);
    ctx.y -= h;
  }

  _sectionHeader(ctx, label) {
    const X = this._colX();
    const h = 14;
    this._ensureSpace(ctx, h + 30, () => this._tabellenKopf(ctx));
    const top = ctx.y;
    ctx.page.drawRectangle({ x: X.x0, y: top - h, width: CONTENT_W, height: h, color: COLOR_GREEN_BG });
    ctx.page.drawText(label, { x: X.x0 + 4, y: top - 10, size: 8, font: ctx.fontBold, color: COLOR_TEXT });
    this._rowBorders(ctx, top, h);
    ctx.y -= h;
  }

  _subHeader(ctx, label) {
    const X = this._colX();
    const h = 13;
    this._ensureSpace(ctx, h);
    const top = ctx.y;
    ctx.page.drawText(label, { x: X.x0 + 4, y: top - 9, size: 7.5, font: ctx.font, color: COLOR_MUTED });
    this._rowBorders(ctx, top, h);
    ctx.y -= h;
  }

  /** Generische Einzelnachweis-Zeile mit Bemessung/Betrag/%/Vorsteuer. */
  _betragRow(ctx, row = {}) {
    const X = this._colX();
    const h = 15;
    this._ensureSpace(ctx, h, () => this._tabellenKopf(ctx));
    const top = ctx.y;

    if (row.bezeichnung) {
      ctx.page.drawText(String(row.bezeichnung), { x: X.x0 + 4, y: top - 10, size: 8, font: ctx.font, color: COLOR_TEXT });
    }
    this._eurCt(ctx, row.bemessungCent, X.bemEur, X.bemCt, X.betEur, top);
    this._eurCt(ctx, row.betragCent, X.betEur, X.betCt, X.proz, top);
    if (row.prozent) this._centerText(ctx, String(row.prozent), X.proz, X.vsEur, top - 10, 8, ctx.font);
    this._eurCt(ctx, rowVorsteuerCent(row), X.vsEur, X.vsCt, X.end, top);

    this._rowBorders(ctx, top, h);
    ctx.y -= h;
  }

  _kmSubHeader(ctx) {
    const X = this._colX();
    const h = 13;
    this._ensureSpace(ctx, h);
    const top = ctx.y;
    ctx.page.drawText('Wenn das eigene Auto ohne Einzelnachweis benutzt wird', {
      x: X.x0 + 4, y: top - 9, size: 7, font: ctx.font, color: COLOR_MUTED,
    });
    this._centerText(ctx, 'Kilometer', X.bemEur, X.betEur, top - 9, 6.5, ctx.fontBold);
    this._centerText(ctx, 'EUR / km', X.betEur, X.proz, top - 9, 6.5, ctx.fontBold);
    this._centerText(ctx, 'Gesamt', X.vsEur, X.end, top - 9, 6.5, ctx.fontBold);
    this._rowBorders(ctx, top, h);
    ctx.y -= h;
  }

  _kmRow(ctx, row = {}) {
    const X = this._colX();
    const h = 15;
    this._ensureSpace(ctx, h, () => this._tabellenKopf(ctx));
    const top = ctx.y;
    if (row.bezeichnung) {
      ctx.page.drawText(String(row.bezeichnung), { x: X.x0 + 4, y: top - 10, size: 8, font: ctx.font, color: COLOR_TEXT });
    }
    if (row.kilometer) this._centerText(ctx, String(row.kilometer), X.bemEur, X.betEur, top - 10, 8, ctx.font);
    if (row.satzCent) this._centerText(ctx, this._eurStr(row.satzCent), X.betEur, X.proz, top - 10, 8, ctx.font);
    const gesamt = kmGesamtCent(row);
    if (gesamt) this._rightText(ctx, this._eurStr(gesamt), X.end - 4, top - 10, 8, ctx.font);
    this._rowBorders(ctx, top, h);
    ctx.y -= h;
  }

  _pauschUeberHeader(ctx) {
    const X = this._colX();
    const h = 13;
    this._ensureSpace(ctx, h);
    const top = ctx.y;
    this._centerText(ctx, 'Übernachtungen', X.bemEur, X.betEur, top - 9, 6.5, ctx.fontBold);
    this._centerText(ctx, 'EUR / Übernacht.', X.betEur, X.proz, top - 9, 6.5, ctx.fontBold);
    this._centerText(ctx, 'Gesamt', X.vsEur, X.end, top - 9, 6.5, ctx.fontBold);
    this._rowBorders(ctx, top, h);
    ctx.y -= h;
  }

  _pauschUeberRow(ctx, row = {}) {
    const X = this._colX();
    const h = 15;
    this._ensureSpace(ctx, h, () => this._tabellenKopf(ctx));
    const top = ctx.y;
    if (row.anzahl) this._centerText(ctx, String(row.anzahl), X.bemEur, X.betEur, top - 10, 8, ctx.font);
    if (row.satzCent) this._centerText(ctx, this._eurStr(row.satzCent), X.betEur, X.proz, top - 10, 8, ctx.font);
    const gesamt = pauschalGesamtCent(row);
    if (gesamt) this._rightText(ctx, this._eurStr(gesamt), X.end - 4, top - 10, 8, ctx.font);
    this._rowBorders(ctx, top, h);
    ctx.y -= h;
  }

  _pauschTagRow(ctx, label, row = {}, withSubtotal = false, subtotalCent = 0) {
    const X = this._colX();
    const h = 16;
    this._ensureSpace(ctx, h, () => this._tabellenKopf(ctx));
    const top = ctx.y;
    ctx.page.drawText(label, { x: X.x0 + 4, y: top - 8, size: 7, font: ctx.font, color: COLOR_MUTED });
    this._centerText(ctx, 'Tag', X.bemEur, X.betEur, top - 6, 6, ctx.font);
    this._centerText(ctx, 'EUR / Tag', X.betEur, X.proz, top - 6, 6, ctx.font);
    this._centerText(ctx, 'Gesamt', X.vsEur, X.end, top - 6, 6, ctx.font);
    if (row.tage) this._centerText(ctx, String(row.tage), X.bemEur, X.betEur, top - 14, 8, ctx.font);
    if (row.satzCent) this._centerText(ctx, this._eurStr(row.satzCent), X.betEur, X.proz, top - 14, 8, ctx.font);
    const gesamt = pauschalGesamtCent(row);
    if (gesamt) this._rightText(ctx, this._eurStr(gesamt), X.end - 4, top - 14, 8, ctx.font);
    this._rowBorders(ctx, top, h);
    ctx.y -= h;
    if (withSubtotal) this._subtotalRow(ctx, subtotalCent);
  }

  /** Zeile mit ▶ und rechtsbündiger EUR/CT-Zwischensumme in der Betrag-Spalte. */
  _subtotalRow(ctx, cent) {
    const X = this._colX();
    const h = 15;
    this._ensureSpace(ctx, h);
    const top = ctx.y;
    // gefülltes Dreieck (▶) als SVG-Pfad — WinAnsi kann das Unicode-Zeichen nicht kodieren
    ctx.page.drawSvgPath('M 0 0 L 7 3.5 L 0 7 Z', { x: X.betEur - 13, y: top - 7, color: COLOR_TEXT, borderWidth: 0 });
    this._eurCt(ctx, cent, X.betEur, X.betCt, X.proz, top, ctx.fontBold);
    this._rowBorders(ctx, top, h);
    ctx.y -= h;
  }

  // ── Abschluss (Summen + Unterschrift) ──────────────────────────────────────
  _abschlussBlock(ctx, doc, summen) {
    this._ensureSpace(ctx, ctx.signatureTags ? 200 : 170);
    const top = ctx.y;

    // ── Summenblock (rechtsbündig, gestapelt) ──
    const amtRightX = MARGIN + CONTENT_W;         // rechte Kante der Beträge
    const amtColW = 90;
    const labelRightX = amtRightX - amtColW - 8;  // Label endet hier
    const sumRows = [
      ['Reisekosten brutto', summen.bruttoCent, true],
      ['enthaltene Vorsteuer', summen.vorsteuerGesamtCent, false],
      ['Vorschuss', summen.vorschussCent, false],
      ['Auszuzahlender Betrag', summen.auszuzahlenCent, true],
      ['Reisekosten netto', summen.nettoCent, false],
    ];
    let sy = top;
    for (const [label, cent, bold] of sumRows) {
      const f = bold ? ctx.fontBold : ctx.font;
      const col = bold ? COLOR_RED : COLOR_TEXT;
      this._rightText(ctx, `${label}:`, labelRightX, sy - 11, 8.5, ctx.font, COLOR_TEXT);
      ctx.page.drawRectangle({ x: amtRightX - amtColW, y: sy - 15, width: amtColW, height: 15, borderColor: COLOR_LINE_LIGHT, borderWidth: 0.5 });
      this._rightText(ctx, `${this._eurStr(cent)} €`, amtRightX - 4, sy - 11, 8.5, f, col);
      sy -= 16;
    }

    // ── Unterschriftsblock (unterhalb der Summen, keine Überlappung) ──
    const sigW = 200;
    const dateW = 140;
    const lineY = sy - 26;

    // Ort/Datum: im Signaturmodus nur der Ort (DocuSeal füllt das Datum), sonst Ort + Datum.
    if (ctx.signatureTags) {
      if (doc.ort) ctx.page.drawText(`${doc.ort},`, { x: MARGIN + 2, y: lineY + 2, size: 9, font: ctx.font, color: COLOR_TEXT });
    } else {
      const ortDatum = [doc.ort, this._date(new Date())].filter(Boolean).join(', ');
      if (ortDatum) ctx.page.drawText(ortDatum, { x: MARGIN + 2, y: lineY + 2, size: 9, font: ctx.font, color: COLOR_TEXT });
    }
    ctx.page.drawLine({ start: { x: MARGIN, y: lineY }, end: { x: MARGIN + dateW, y: lineY }, thickness: 0.6, color: COLOR_TEXT });
    ctx.page.drawText('Ort, Datum', { x: MARGIN, y: lineY - 10, size: 8, font: ctx.font, color: COLOR_MUTED });

    const sigX = MARGIN + dateW + 20;
    ctx.page.drawLine({ start: { x: sigX, y: lineY }, end: { x: sigX + sigW, y: lineY }, thickness: 0.6, color: COLOR_TEXT });
    ctx.page.drawText('Unterschrift', { x: sigX, y: lineY - 10, size: 8, font: ctx.font, color: COLOR_MUTED });
    if (!ctx.signatureTags) {
      const kopf = doc.kopf || {};
      const signerName = [kopf.vorname, kopf.name].filter(Boolean).join(' ');
      if (signerName) ctx.page.drawText(signerName, { x: sigX, y: lineY - 20, size: 8, font: ctx.fontBold, color: COLOR_TEXT });
    }

    // Prüfvermerke-Box.
    ctx.page.drawRectangle({ x: MARGIN, y: lineY - 58, width: dateW, height: 28, borderColor: COLOR_LINE, borderWidth: 0.6 });
    ctx.page.drawText('Prüfvermerke', { x: MARGIN + 4, y: lineY - 40, size: 8, font: ctx.font, color: COLOR_MUTED });

    if (ctx.signatureTags) {
      // Datumsfeld direkt hinter dem Ort auf derselben Linie, Signaturfeld rechts.
      const ortW = doc.ort ? ctx.font.widthOfTextAtSize(`${doc.ort}, `, 9) : 0;
      this._drawDateTag(ctx, MARGIN + 2 + ortW, lineY, 'Mitarbeiter', dateW - ortW - 4);
      this._drawSignatureTag(ctx, sigX, lineY, 'Mitarbeiter', sigW);
      this._docusealBadge(ctx, sigX, lineY - 58, sigW);
    }

    ctx.y = lineY - (ctx.signatureTags ? 86 : 64);
  }

  _hinweisText(ctx) {
    this._ensureSpace(ctx, 40);
    ctx.y -= 6;
    this._text(ctx, 'Hinweis: Als Nachweis muss ein Ausdruck aus Google Maps angehangen werden. -> Druck mit Text, ohne Karte. Der Tankbeleg muss kopiert werden -> Thermopapier.', {
      size: 7.5, color: COLOR_MUTED, lineGap: 3,
    });
  }

  // ── Reisedaten-Seite (Fahrtstrecke in km) ────────────────────────────────
  _reisedatenSeite(ctx, doc) {
    const rows = (Array.isArray(doc.reisedaten) ? doc.reisedaten : [])
      .filter((r) => r && (r.start || r.ziel || r.kilometer || r.datum));
    if (!rows.length) return;

    // Immer eigene Seite hinter der Signaturseite.
    ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
    ctx.y = PAGE_H - MARGIN;

    ctx.page.drawText('Fahrtstrecke in km', { x: MARGIN, y: ctx.y - 14, size: 13, font: ctx.fontBold, color: COLOR_TEXT });
    const name = [doc.kopf?.vorname, doc.kopf?.name].filter(Boolean).join(' ');
    if (name) ctx.page.drawText(name, { x: MARGIN, y: ctx.y - 28, size: 9, font: ctx.font, color: COLOR_MUTED });
    ctx.y -= 42;

    const cols = [
      { key: 'datum', label: 'Datum', w: 90 },
      { key: 'start', label: 'Start', w: 190 },
      { key: 'ziel', label: 'Ziel', w: 175 },
      { key: 'km', label: 'km', w: CONTENT_W - (90 + 190 + 175) },
    ];

    const drawRow = (cells, opts = {}) => {
      const h = opts.h || 18;
      this._ensureSpace(ctx, h);
      const top = ctx.y;
      const font = opts.bold ? ctx.fontBold : ctx.font;
      if (opts.bg) ctx.page.drawRectangle({ x: MARGIN, y: top - h, width: CONTENT_W, height: h, color: COLOR_GREEN_BG });
      let x = MARGIN;
      cols.forEach((c) => {
        const val = cells[c.key] != null ? String(cells[c.key]) : '';
        if (c.key === 'km') {
          this._rightText(ctx, val, x + c.w - 4, top - 13, 8.5, font);
        } else {
          const line = this._wrap(val, font, 8.5, c.w - 6)[0] || '';
          ctx.page.drawText(line, { x: x + 3, y: top - 13, size: 8.5, font, color: COLOR_TEXT });
        }
        ctx.page.drawLine({ start: { x, y: top }, end: { x, y: top - h }, thickness: 0.4, color: COLOR_LINE });
        x += c.w;
      });
      ctx.page.drawLine({ start: { x: MARGIN + CONTENT_W, y: top }, end: { x: MARGIN + CONTENT_W, y: top - h }, thickness: 0.4, color: COLOR_LINE });
      ctx.page.drawLine({ start: { x: MARGIN, y: top - h }, end: { x: MARGIN + CONTENT_W, y: top - h }, thickness: 0.4, color: COLOR_LINE });
      ctx.y -= h;
    };

    drawRow({ datum: 'Datum', start: 'Start', ziel: 'Ziel', km: 'km' }, { bold: true, bg: true });
    let totalKm = 0;
    for (const r of rows) {
      const km = Number(r.kilometer) || 0;
      totalKm += km;
      drawRow({ datum: this._date(r.datum), start: r.start || '', ziel: r.ziel || '', km: km ? this._kmStr(km) : '' });
    }
    drawRow({ datum: '', start: '', ziel: 'Gesamt', km: this._kmStr(totalKm) }, { bold: true });
  }

  _docusealBadge(ctx, x, y, w) {
    const badgeW = 130;
    const badgeH = 20;
    const badgeX = x + (w - badgeW) / 2;
    const COLOR_DS_RED = rgb(0.94, 0.27, 0.35);
    const COLOR_DS_LIGHT = rgb(1.0, 0.96, 0.96);
    ctx.page.drawRectangle({ x: badgeX, y, width: badgeW, height: badgeH, color: COLOR_DS_LIGHT, borderColor: COLOR_DS_RED, borderWidth: 0.9 });
    if (ctx.docusealLogoImg) {
      ctx.page.drawImage(ctx.docusealLogoImg, { x: badgeX + 6, y: y + 2, width: 16, height: 16 });
    }
    ctx.page.drawText('Verified by DocuSeal', { x: badgeX + 28, y: y + 6, size: 8, font: ctx.fontBold, color: COLOR_DS_RED });
  }

  // ── DocuSeal-Tags (analog StundenlisteService) ─────────────────────────────
  _drawSignatureTag(ctx, x, lineY, role, colW) {
    const w = Math.round(Math.min(colW, 180));
    const h = 26;
    const tag = `{{${role};role=${role};type=signature;required=true;width=${w};height=${h}}}`;
    ctx.page.drawText(tag, { x, y: lineY + h, size: 5, font: ctx.font, color: rgb(1, 1, 1) });
  }

  _drawDateTag(ctx, x, lineY, role, fieldW) {
    const w = Math.round(Math.min(fieldW, 90));
    const h = 18;
    const tag = `{{${role} Datum;role=${role};type=date;required=true;readonly=true;format=DD.MM.YYYY;width=${w};height=${h}}}`;
    ctx.page.drawText(tag, { x, y: lineY + h, size: 5, font: ctx.font, color: rgb(1, 1, 1) });
  }

  // ── Zeichen-Hilfen ─────────────────────────────────────────────────────────

  /** Vertikale Trenner + Rahmen einer Tabellenzeile. */
  _rowBorders(ctx, top, h) {
    const X = this._colX();
    const bottom = top - h;
    // Äußerer Rahmen links/rechts + untere Linie.
    for (const gx of [X.x0, X.bemEur, X.betEur, X.proz, X.vsEur, X.end]) {
      ctx.page.drawLine({ start: { x: gx, y: top }, end: { x: gx, y: bottom }, thickness: 0.5, color: COLOR_LINE });
    }
    // Innere EUR/CT-Trenner (dünn).
    for (const gx of [X.bemCt, X.betCt, X.vsCt]) {
      ctx.page.drawLine({ start: { x: gx, y: top }, end: { x: gx, y: bottom }, thickness: 0.3, color: COLOR_LINE_LIGHT });
    }
    ctx.page.drawLine({ start: { x: X.x0, y: bottom }, end: { x: X.end, y: bottom }, thickness: 0.4, color: COLOR_LINE });
  }

  /** Betrag als EUR/CT gesplittet, rechtsbündig in den jeweiligen Zellen. */
  _eurCt(ctx, cent, eurLeft, eurRight, ctRight, top, font, color) {
    const c = Math.round(Number(cent) || 0);
    if (!c) return;
    const eur = Math.floor(Math.abs(c) / 100) * Math.sign(c);
    const ct = String(Math.abs(c) % 100).padStart(2, '0');
    const f = font || ctx.font;
    const col = color || COLOR_TEXT;
    this._rightText(ctx, String(eur), eurRight - 3, top - 11, 8, f, col);
    this._rightText(ctx, ct, ctRight - 3, top - 11, 8, f, col);
  }

  _centerText(ctx, text, xLeft, xRight, y, size, font) {
    const f = font || ctx.font;
    const w = f.widthOfTextAtSize(text, size);
    ctx.page.drawText(text, { x: xLeft + (xRight - xLeft - w) / 2, y, size, font: f, color: COLOR_TEXT });
  }

  _rightText(ctx, text, xRight, y, size, font, color) {
    const f = font || ctx.font;
    const w = f.widthOfTextAtSize(text, size);
    ctx.page.drawText(text, { x: xRight - w, y, size, font: f, color: color || COLOR_TEXT });
  }

  _text(ctx, text, opts = {}) {
    const font = opts.font || ctx.font;
    const size = opts.size || 10;
    const color = opts.color || COLOR_TEXT;
    const lineGap = opts.lineGap != null ? opts.lineGap : 2;
    const lineH = size + lineGap;
    const lines = this._wrap(text, font, size, CONTENT_W);
    for (const line of lines) {
      this._ensureSpace(ctx, lineH);
      ctx.page.drawText(line, { x: MARGIN, y: ctx.y - size, size, font, color });
      ctx.y -= lineH;
    }
  }

  _drawPageFooters(pdf, fontBold) {
    const url = 'www.Straightforward.services';
    const size = 9;
    for (const page of pdf.getPages()) {
      const w = fontBold.widthOfTextAtSize(url, size);
      page.drawLine({ start: { x: MARGIN, y: MARGIN + 14 }, end: { x: PAGE_W - MARGIN, y: MARGIN + 14 }, thickness: 0.8, color: COLOR_LINE_LIGHT });
      page.drawText(url, { x: PAGE_W - MARGIN - w, y: MARGIN, size, font: fontBold, color: COLOR_TEXT });
    }
  }

  _ensureSpace(ctx, needed, onNewPage) {
    if (ctx.y - needed < MARGIN + 26) {
      ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
      ctx.y = PAGE_H - MARGIN;
      if (typeof onNewPage === 'function') onNewPage();
    }
  }

  _wrap(text, font, size, maxWidth) {
    const str = text == null ? '' : String(text);
    if (!str) return [''];
    const words = str.split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth || !current) {
        current = test;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // ── Daten-Hilfen ──────────────────────────────────────────────────────────
  _reisetage(von, bis) {
    if (!von) return 1;
    const v = new Date(von);
    const b = bis ? new Date(bis) : v;
    if (isNaN(v.getTime()) || isNaN(b.getTime())) return 1;
    const days = Math.round((b.setHours(0, 0, 0, 0) - v.setHours(0, 0, 0, 0)) / 86400000) + 1;
    return days > 0 ? days : 1;
  }

  _date(d) {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  _eurStr(cent) {
    const c = Math.round(Number(cent) || 0);
    return (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  _kmStr(km) {
    const n = Number(km) || 0;
    return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  }
}

module.exports = new ReisekostenService();
