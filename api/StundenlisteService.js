/**
 * StundenlisteService
 *
 * Generiert für einen Auftrag (Event) das PDF
 * "Arbeitnehmerüberlassungsvertrag und zugleich Konkretisierung zum bestehenden
 *  Rahmenvertrag zur Arbeitnehmerüberlassung".
 *
 * Das PDF dient als Stundennachweis: Die Tabelle wird mit den eingeplanten
 * Mitarbeitern (gruppiert nach Schicht) vorbefüllt, die Stunden-Spalten bleiben
 * leer und werden vor Ort handschriftlich ausgefüllt.
 *
 * Singleton-Export analog zu R2Service.
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const Auftrag = require('./models/Auftrag');
const Einsatz = require('./models/Einsatz');
const Schicht = require('./models/Schicht');
const Kunde = require('./models/Kunde');
const Mitarbeiter = require('./models/Mitarbeiter');
const Beruf = require('./models/Beruf');
const Qualifikation = require('./models/Qualifikation');
const registry = require('./config/registry');
const logger = require('./utils/logger');

// Verleiher ist immer die Straightforward GmbH (Hauptsitz Berlin).
const VERLEIHER = {
  name: 'H. & P. Straightforward GmbH',
  strasse: 'Straßmannstraße 6',
  plzOrt: '10249 Berlin',
};

// GESCHST → Team-Key (für die betreuende Niederlassung aus teams.json)
const GESCHST_TO_TEAM = {
  '1': 'berlin',
  '2': 'hamburg',
  '3': 'koeln',
};

// Seiten- und Layout-Konstanten (A4 in pt)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const COLOR_TEXT = rgb(0.1, 0.1, 0.1);
const COLOR_MUTED = rgb(0.45, 0.45, 0.45);
const COLOR_LINE = rgb(0.75, 0.75, 0.75);
const COLOR_HEADER_BG = rgb(0.93, 0.93, 0.93);

class StundenlisteService {
  /**
   * Baut die Stundenliste für einen Auftrag und gibt das PDF als Buffer zurück.
   * @param {number|string} auftragNr
   * @returns {Promise<{ buffer: Buffer, auftragNr: number }>}
   */
  async buildStundenliste(auftragNr) {
    const data = await this._loadData(auftragNr);
    const buffer = await this._renderPdf(data);
    return { buffer, auftragNr: data.auftrag.auftragNr };
  }

  // ── Datenbeschaffung ──────────────────────────────────────────────────────
  async _loadData(auftragNr) {
    const nr = parseInt(auftragNr, 10);
    const auftrag = await Auftrag.findOne({ auftragNr: nr }).lean();
    if (!auftrag) {
      const err = new Error(`Auftrag ${auftragNr} nicht gefunden`);
      err.statusCode = 404;
      throw err;
    }

    const kunde = auftrag.kundenNr
      ? await Kunde.findOne({ kundenNr: auftrag.kundenNr }).lean()
      : null;

    const einsaetze = await Einsatz.find({ auftragNr: nr })
      .sort({ idAuftragArbeitsschichten: 1, datumVon: 1 })
      .lean();

    const schichten = await Schicht.find({ auftragNr: nr })
      .sort({ idAuftragArbeitsschichten: 1, datumVon: 1 })
      .lean();

    // Verknüpfte Stammdaten in Batches laden
    const personalNrs = [...new Set(einsaetze.map(e => e.personalNr).filter(Boolean).map(String))];
    const berufKeys = [...new Set(einsaetze.map(e => parseInt(e.berufSchl, 10)).filter(k => !isNaN(k)))];
    const qualiKeys = [...new Set(einsaetze.map(e => parseInt(e.qualSchl, 10)).filter(k => !isNaN(k)))];

    const [mitarbeiterList, berufList, qualiList] = await Promise.all([
      personalNrs.length
        ? Mitarbeiter.find({ personalnr: { $in: personalNrs } })
            .select('vorname nachname personalnr geburtsdatum')
            .lean()
        : [],
      berufKeys.length ? Beruf.find({ jobKey: { $in: berufKeys } }).lean() : [],
      qualiKeys.length ? Qualifikation.find({ qualificationKey: { $in: qualiKeys } }).lean() : [],
    ]);

    const mitarbeiterMap = new Map(mitarbeiterList.map(m => [String(m.personalnr), m]));
    const berufMap = new Map(berufList.map(b => [b.jobKey, b]));
    const qualiMap = new Map(qualiList.map(q => [q.qualificationKey, q]));

    const einsaetzeEnriched = einsaetze.map(e => ({
      ...e,
      mitarbeiterData: e.personalNr ? mitarbeiterMap.get(String(e.personalNr)) || null : null,
      berufData: e.berufSchl ? berufMap.get(parseInt(e.berufSchl, 10)) || null : null,
      qualifikationData: e.qualSchl ? qualiMap.get(parseInt(e.qualSchl, 10)) || null : null,
    }));

    // Betreuende Niederlassung aus teams.json
    let niederlassung = null;
    const teamKey = GESCHST_TO_TEAM[String(auftrag.geschSt)];
    if (teamKey) {
      try {
        const team = registry.getTeam(teamKey);
        niederlassung = {
          ...(team.niederlassung || { name: team.displayName }),
          email: team.email?.address || null,
        };
      } catch (e) {
        logger.warn(`StundenlisteService: Niederlassung für geschSt=${auftrag.geschSt} nicht gefunden: ${e.message}`);
      }
    }

    return { auftrag, kunde, einsaetze: einsaetzeEnriched, schichten, niederlassung };
  }

  // ── PDF-Rendering ─────────────────────────────────────────────────────────
  async _renderPdf({ auftrag, kunde, einsaetze, schichten, niederlassung }) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // Logo einbetten (optional)
    let logoImg = null;
    try {
      const logoPath = path.join(__dirname, 'assets', 'straightforward-logo-black.png');
      if (fs.existsSync(logoPath)) {
        logoImg = await doc.embedPng(fs.readFileSync(logoPath));
      }
    } catch (e) {
      logger.warn(`StundenlisteService: Logo konnte nicht eingebettet werden: ${e.message}`);
    }

    const ctx = {
      doc,
      font,
      fontBold,
      page: doc.addPage([PAGE_W, PAGE_H]),
      y: PAGE_H - MARGIN,
    };

    // ── Kopf: Logo ──
    if (logoImg) {
      const logoW = 130;
      const logoH = (logoImg.height / logoImg.width) * logoW;
      ctx.page.drawImage(logoImg, { x: MARGIN, y: ctx.y - logoH, width: logoW, height: logoH });
      ctx.y -= logoH + 16;
    }

    // ── Überschrift ──
    this._text(ctx, 'Arbeitnehmerüberlassungsvertrag und zugleich Konkretisierung zum bestehenden Rahmenvertrag zur Arbeitnehmerüberlassung zwischen nachfolgend genanntem Verleiher und Entleiher.', {
      font: fontBold, size: 12, lineGap: 3,
    });
    ctx.y -= 8;

    // ── Einleitungstext ──
    const zeitraum = this._dateRange(auftrag.vonDatum, auftrag.bisDatum);
    this._text(ctx, `Der Verleiher überlässt dem Entleiher am ${zeitraum} im Rahmen der Eventnummer ${auftrag.auftragNr} die untenstehend aufgeführten Arbeitnehmer.`, { size: 10 });
    ctx.y -= 4;
    this._text(ctx, 'Die unbefristete Erlaubnis zur Arbeitnehmerüberlassung liegt vor. (Urkunde der Bundesagentur für Arbeit, Agentur für Arbeit Kiel, in Kiel, zuletzt erteilt am 08.11.2021)', { size: 9, color: COLOR_MUTED });
    ctx.y -= 12;

    // ── Entleiher / Verleiher (zwei Spalten) ──
    this._twoColumnBlocks(ctx, kunde);
    ctx.y -= 12;

    // ── Betreuende Niederlassung ──
    this._niederlassungBlock(ctx, niederlassung);
    ctx.y -= 12;

    // ── Event-Block ──
    this._eventBlock(ctx, auftrag);
    ctx.y -= 14;

    // ── Tabelle (gruppiert nach Schicht) ──
    this._renderTable(ctx, einsaetze, schichten);
    ctx.y -= 14;

    // ── Pausen-Hinweis ──
    this._ensureSpace(ctx, 60);
    this._text(ctx, 'Pausenzeiten sind, wenn extra aufgeführt, in den Arbeitsstunden nach § 4 Arbeitszeit inbegriffen. Bitte gesetzliche Pausenzeiten beachten. Mehr als 6 Stunden = 30 Minuten | Mehr als 9 Stunden = 45 Minuten. Bitte beachten Sie, dass die gesetzliche Regelarbeitszeit 10 Stunden nicht überschreiten darf. Kommt es hier zu Unregelmäßigkeiten, müssen wir von zukünftigen Überlassungen absehen.', { size: 8, color: COLOR_MUTED, lineGap: 2 });
    ctx.y -= 16;

    // ── Unterschriften ──
    this._signatureBlock(ctx, kunde);
    ctx.y -= 14;

    // ── Bemerkungsbox ──
    this._bemerkungBox(ctx);
    ctx.y -= 14;

    // ── Footer ──
    this._ensureSpace(ctx, 50);
    this._text(ctx, 'Es gelten die allgemeinen Geschäftsbedingungen des Verleihers und die Rahmenabsprachen bzgl. Vergütung, Anforderungs- und Tätigkeitsprofil zwischen Entleiher und Verleiher. Sofern kein Rahmenvertrag vorhanden ist, gelten die AGB der H. & P. Straightforward GmbH und die aktuellen Konditionen für den jeweiligen Überlassungszeitraum. Dieser Nachweis gilt als abgeschlossener Einsatz.', { size: 7, color: COLOR_MUTED, lineGap: 2 });

    return Buffer.from(await doc.save());
  }

  // ── Layout-Bausteine ──────────────────────────────────────────────────────

  _twoColumnBlocks(ctx, kunde) {
    const colGap = 20;
    const colW = (CONTENT_W - colGap) / 2;
    const startY = ctx.y;

    // Entleiher (links)
    const entleiherAdr = this._entleiherAdresse(kunde);
    const leftLines = [
      { text: 'Entleiher', font: ctx.fontBold, size: 10 },
      { text: (kunde && kunde.kundName) || '—', size: 9 },
    ];
    if (entleiherAdr.strasse) leftLines.push({ text: entleiherAdr.strasse, size: 9 });
    if (entleiherAdr.plzOrt) leftLines.push({ text: entleiherAdr.plzOrt, size: 9 });

    // Verleiher (rechts)
    const rightLines = [
      { text: 'Verleiher', font: ctx.fontBold, size: 10 },
      { text: VERLEIHER.name, size: 9 },
      { text: VERLEIHER.strasse, size: 9 },
      { text: VERLEIHER.plzOrt, size: 9 },
    ];

    const leftH = this._columnHeight(leftLines);
    const rightH = this._columnHeight(rightLines);
    const blockH = Math.max(leftH, rightH);
    this._ensureSpace(ctx, blockH);

    this._drawColumn(ctx, MARGIN, startY, colW, leftLines);
    this._drawColumn(ctx, MARGIN + colW + colGap, startY, colW, rightLines);
    ctx.y = startY - blockH;
  }

  _niederlassungBlock(ctx, niederlassung) {
    this._ensureSpace(ctx, 40);
    this._text(ctx, 'Betreuende Niederlassung', { font: ctx.fontBold, size: 10 });
    if (!niederlassung) {
      this._text(ctx, '—', { size: 9 });
      return;
    }
    const parts = [];
    if (niederlassung.name) parts.push(`Niederlassung ${niederlassung.name}`);
    if (niederlassung.betriebsNr) parts.push(`Betriebs-Nr. ${niederlassung.betriebsNr}`);
    this._text(ctx, parts.join('  ·  ') || '—', { size: 9 });
    const tel = Array.isArray(niederlassung.telefone) ? niederlassung.telefone.filter(Boolean) : [];
    if (tel.length) this._text(ctx, `Tel.: ${tel.join('  /  ')}`, { size: 9 });
    if (niederlassung.email) this._text(ctx, `E-Mail: ${niederlassung.email}`, { size: 9 });
  }

  _eventBlock(ctx, auftrag) {
    this._ensureSpace(ctx, 60);
    this._text(ctx, 'Event', { font: ctx.fontBold, size: 10 });
    const ort = [auftrag.eventLocation, auftrag.eventStrasse, [auftrag.eventPlz, auftrag.eventOrt].filter(Boolean).join(' ')]
      .filter(Boolean).join(', ');
    const rows = [
      ['Event-Nr.', String(auftrag.auftragNr)],
      ['Event-Titel', auftrag.eventTitel || '—'],
      ['Event-Ort', ort || '—'],
      ['Überlassungszeitraum', this._dateRange(auftrag.vonDatum, auftrag.bisDatum)],
    ];
    for (const [label, value] of rows) {
      const labelW = 120;
      const lineH = 13;
      this._ensureSpace(ctx, lineH);
      ctx.page.drawText(`${label}:`, { x: MARGIN, y: ctx.y - 9, size: 9, font: ctx.fontBold, color: COLOR_TEXT });
      const lines = this._wrap(value, ctx.font, 9, CONTENT_W - labelW);
      lines.forEach((ln, idx) => {
        ctx.page.drawText(ln, { x: MARGIN + labelW, y: ctx.y - 9 - idx * 11, size: 9, font: ctx.font, color: COLOR_TEXT });
      });
      ctx.y -= Math.max(lineH, lines.length * 11 + 2);
    }
  }

  _renderTable(ctx, einsaetze, schichten) {
    // Gruppierung nach idAuftragArbeitsschichten
    const groups = new Map();
    for (const e of einsaetze) {
      const key = e.idAuftragArbeitsschichten != null ? String(e.idAuftragArbeitsschichten) : 'sonstige';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const schichtMap = new Map(
      schichten.map(s => [String(s.idAuftragArbeitsschichten), s])
    );

    // Spaltenbreiten (Summe = CONTENT_W = 515.28)
    const cols = [
      { key: 'name', label: 'Nachname, Vorname (Geb.)', w: 150 },
      { key: 'datum', label: 'Datum', w: 62 },
      { key: 'beginn', label: 'Beginn', w: 48 },
      { key: 'ende', label: 'Ende', w: 48 },
      { key: 'pause', label: 'Pause', w: 42 },
      { key: 'stunden', label: 'Stunden', w: 50 },
      { key: 'unterschrift', label: 'Unterschrift', w: CONTENT_W - (150 + 62 + 48 + 48 + 42 + 50) },
    ];

    for (const [key, list] of groups) {
      const schicht = schichtMap.get(key);
      const first = list[0] || {};
      const beruf = first.berufData?.designation || schicht?.bezeichnung || '';
      const quali = first.qualifikationData?.designation || '';
      const headerText = `Beruf, Tätigkeit: ${[beruf, quali].filter(Boolean).join(' – ') || '—'}`;

      // Schicht-Überschrift
      this._ensureSpace(ctx, 18 + 20 + 26);
      ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 16, width: CONTENT_W, height: 16, color: COLOR_HEADER_BG });
      ctx.page.drawText(headerText, { x: MARGIN + 4, y: ctx.y - 12, size: 9, font: ctx.fontBold, color: COLOR_TEXT });
      ctx.y -= 18;

      // Tabellenkopf
      this._drawTableHeader(ctx, cols);

      // Zeilen (eine pro Mitarbeiter, Stunden-Spalten bleiben leer)
      for (const e of list) {
        this._drawTableRow(ctx, cols, e);
      }
      ctx.y -= 10;
    }

    if (groups.size === 0) {
      this._text(ctx, 'Keine eingeplanten Mitarbeiter vorhanden.', { size: 9, color: COLOR_MUTED });
    }
  }

  _drawTableHeader(ctx, cols) {
    const rowH = 18;
    this._ensureSpace(ctx, rowH);
    const top = ctx.y;
    let x = MARGIN;
    for (const c of cols) {
      ctx.page.drawText(c.label, { x: x + 3, y: top - 12, size: 7.5, font: ctx.fontBold, color: COLOR_TEXT });
      x += c.w;
    }
    // untere Linie
    ctx.page.drawLine({ start: { x: MARGIN, y: top - rowH }, end: { x: MARGIN + CONTENT_W, y: top - rowH }, thickness: 0.8, color: COLOR_LINE });
    ctx.y -= rowH;
  }

  _drawTableRow(ctx, cols, einsatz) {
    const rowH = 26;
    this._ensureSpace(ctx, rowH, () => this._drawTableHeader(ctx, cols));
    const top = ctx.y;

    const ma = einsatz.mitarbeiterData;
    const name = ma ? `${ma.nachname || ''}, ${ma.vorname || ''}`.replace(/^,\s*|,\s*$/g, '').trim() : (einsatz.bezeichnung || '—');
    const geb = ma && ma.geburtsdatum ? `geb. ${this._date(ma.geburtsdatum)}` : '';

    // vertikale Spaltentrenner + Werte
    let x = MARGIN;
    for (const c of cols) {
      // Spaltentrenner
      ctx.page.drawLine({ start: { x, y: top }, end: { x, y: top - rowH }, thickness: 0.4, color: COLOR_LINE });
      if (c.key === 'name') {
        const nameLines = this._wrap(name, ctx.font, 8.5, c.w - 6);
        ctx.page.drawText(nameLines[0] || '', { x: x + 3, y: top - 11, size: 8.5, font: ctx.font, color: COLOR_TEXT });
        if (geb) {
          ctx.page.drawText(geb, { x: x + 3, y: top - 21, size: 7, font: ctx.font, color: COLOR_MUTED });
        }
      } else if (c.key === 'datum') {
        const datum = einsatz.datumVon ? this._date(einsatz.datumVon) : '';
        if (datum) ctx.page.drawText(datum, { x: x + 3, y: top - 14, size: 8, font: ctx.font, color: COLOR_TEXT });
      }
      // Beginn/Ende/Pause/Stunden/Unterschrift bleiben leer (handschriftlich)
      x += c.w;
    }
    // rechte Außenlinie
    ctx.page.drawLine({ start: { x: MARGIN + CONTENT_W, y: top }, end: { x: MARGIN + CONTENT_W, y: top - rowH }, thickness: 0.4, color: COLOR_LINE });
    // untere Zeilenlinie
    ctx.page.drawLine({ start: { x: MARGIN, y: top - rowH }, end: { x: MARGIN + CONTENT_W, y: top - rowH }, thickness: 0.4, color: COLOR_LINE });
    ctx.y -= rowH;
  }

  _signatureBlock(ctx, kunde) {
    const colGap = 30;
    const colW = (CONTENT_W - colGap) / 2;
    const lineY = ctx.y - 30;
    this._ensureSpace(ctx, 50);

    // Linien
    ctx.page.drawLine({ start: { x: MARGIN, y: lineY }, end: { x: MARGIN + colW, y: lineY }, thickness: 0.6, color: COLOR_TEXT });
    ctx.page.drawLine({ start: { x: MARGIN + colW + colGap, y: lineY }, end: { x: MARGIN + CONTENT_W, y: lineY }, thickness: 0.6, color: COLOR_TEXT });

    // Labels darunter
    ctx.page.drawText('Verleiher Unterschrift / Stempel', { x: MARGIN, y: lineY - 11, size: 8, font: ctx.font, color: COLOR_MUTED });
    ctx.page.drawText(VERLEIHER.name, { x: MARGIN, y: lineY - 21, size: 8, font: ctx.fontBold, color: COLOR_TEXT });

    ctx.page.drawText('Entleiher Unterschrift / Stempel', { x: MARGIN + colW + colGap, y: lineY - 11, size: 8, font: ctx.font, color: COLOR_MUTED });
    ctx.page.drawText((kunde && kunde.kundName) || '—', { x: MARGIN + colW + colGap, y: lineY - 21, size: 8, font: ctx.fontBold, color: COLOR_TEXT });

    ctx.y = lineY - 28;
  }

  _bemerkungBox(ctx) {
    const boxH = 60;
    this._ensureSpace(ctx, boxH);
    const top = ctx.y;
    ctx.page.drawRectangle({ x: MARGIN, y: top - boxH, width: CONTENT_W, height: boxH, borderColor: COLOR_LINE, borderWidth: 0.8 });
    ctx.page.drawText('Bemerkung / Lob / Kritik', { x: MARGIN + 4, y: top - 12, size: 8, font: ctx.fontBold, color: COLOR_TEXT });
    ctx.y = top - boxH;
  }

  // ── Hilfsfunktionen Rendering ─────────────────────────────────────────────

  /** Mehrzeiliger Fließtext mit automatischem Seitenumbruch. */
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

  _drawColumn(ctx, x, topY, w, lines) {
    let y = topY;
    for (const l of lines) {
      const font = l.font || ctx.font;
      const size = l.size || 9;
      const wrapped = this._wrap(l.text, font, size, w);
      for (const ln of wrapped) {
        ctx.page.drawText(ln, { x, y: y - size, size, font, color: COLOR_TEXT });
        y -= size + 3;
      }
    }
  }

  _columnHeight(lines) {
    let h = 0;
    for (const l of lines) {
      const size = l.size || 9;
      h += size + 3;
    }
    return h;
  }

  /** Stellt sicher, dass mind. `needed` pt Platz vorhanden ist, sonst neue Seite. */
  _ensureSpace(ctx, needed, onNewPage) {
    if (ctx.y - needed < MARGIN) {
      ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
      ctx.y = PAGE_H - MARGIN;
      if (typeof onNewPage === 'function') onNewPage();
    }
  }

  /** Wort-Umbruch anhand der echten Textbreite. */
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

  _entleiherAdresse(kunde) {
    if (!kunde || !Array.isArray(kunde.adressen) || kunde.adressen.length === 0) {
      return { strasse: '', plzOrt: '' };
    }
    const adr = kunde.adressen.find(a => a && a.strasse) || kunde.adressen[0];
    return {
      strasse: adr.strasse || '',
      plzOrt: [adr.plz, adr.ort].filter(Boolean).join(' '),
    };
  }

  _date(d) {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  _dateRange(von, bis) {
    const v = this._date(von);
    const b = this._date(bis);
    if (v && b && v !== b) return `${v} – ${b}`;
    return v || b || '—';
  }
}

module.exports = new StundenlisteService();
