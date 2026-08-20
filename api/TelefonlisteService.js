const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const Auftrag = require('./models/Event/Auftrag');
const Einsatz = require('./models/Event/Einsatz');
const Schicht = require('./models/Event/Schicht');
const Mitarbeiter = require('./models/Employee/Mitarbeiter');
const Beruf = require('./models/Event/Beruf');
const CheckIn = require('./models/CheckIn');

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 20;

class TelefonlisteService {
  async buildTelefonliste(auftragNr) {
    const data = await this._loadData(auftragNr);
    return {
      buffer: await this._renderPdf(data),
      auftragNr: data.auftrag.auftragNr,
    };
  }

  async _loadData(auftragNr) {
    const nr = Number.parseInt(auftragNr, 10);
    if (!Number.isFinite(nr)) {
      const error = new Error('Ungültige Auftragsnummer');
      error.statusCode = 400;
      throw error;
    }

    const auftrag = await Auftrag.findOne({ auftragNr: nr }).lean();
    if (!auftrag) {
      const error = new Error(`Auftrag ${auftragNr} nicht gefunden`);
      error.statusCode = 404;
      throw error;
    }

    const [einsaetze, schichten, checkIn] = await Promise.all([
      Einsatz.find({ auftragNr: nr }).sort({ idAuftragArbeitsschichten: 1, personalNr: 1 }).lean(),
      Schicht.find({ auftragNr: nr }).sort({ idAuftragArbeitsschichten: 1, datumVon: 1 }).lean(),
      CheckIn.findOne({ auftragNr: nr }).lean(),
    ]);

    const personalNrs = [...new Set(einsaetze.map((einsatz) => String(einsatz.personalNr || '')).filter(Boolean))];
    const berufKeys = [...new Set(einsaetze
      .map((einsatz) => Number.parseInt(einsatz.berufSchl, 10))
      .filter(Number.isFinite))];
    const [mitarbeiter, berufe] = await Promise.all([
      personalNrs.length
        ? Mitarbeiter.find({
            $or: [
              { personalnr: { $in: personalNrs } },
              { personalnummern: { $in: personalNrs } },
            ],
          }).select('personalnr personalnummern vorname nachname telefon').lean()
        : [],
      berufKeys.length ? Beruf.find({ jobKey: { $in: berufKeys } }).select('jobKey designation').lean() : [],
    ]);

    const mitarbeiterByPersonalNr = new Map();
    mitarbeiter.forEach((person) => {
      [person.personalnr, ...(person.personalnummern || [])]
        .filter(Boolean)
        .forEach((personalNr) => mitarbeiterByPersonalNr.set(String(personalNr), person));
    });
    const berufByKey = new Map(berufe.map((beruf) => [Number(beruf.jobKey), beruf]));
    const schichtById = new Map(schichten.map((schicht) => [String(schicht.idAuftragArbeitsschichten), schicht]));
    const checkedInPersonalNrs = new Set((checkIn?.checkedIn || []).map(String));
    const noShowPersonalNrs = new Set((checkIn?.noShow || []).map(String));
    const groups = new Map();

    einsaetze.forEach((einsatz) => {
      const key = einsatz.idAuftragArbeitsschichten == null
        ? 'ohne-schicht'
        : String(einsatz.idAuftragArbeitsschichten);
      const schicht = schichtById.get(key);
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          bezeichnung: schicht?.bezeichnung || einsatz.schichtBezeichnung || 'Ohne Schicht',
          uhrzeitVon: schicht?.uhrzeitVon || einsatz.uhrzeitVon || null,
          uhrzeitBis: schicht?.uhrzeitBis || einsatz.uhrzeitBis || null,
          treffpunkt: schicht?.treffpunkt || einsatz.treffpunkt || null,
          treffpunktOrt: schicht?.treffpunktOrt || einsatz.treffpunktOrt || null,
          mitarbeiter: [],
        });
      }

      const person = mitarbeiterByPersonalNr.get(String(einsatz.personalNr)) || null;
      const beruf = berufByKey.get(Number.parseInt(einsatz.berufSchl, 10)) || null;
      groups.get(key).mitarbeiter.push({
        personalNr: einsatz.personalNr,
        vorname: person?.vorname || '',
        nachname: person?.nachname || '',
        telefon: person?.telefon || '',
        bezeichnung: einsatz.bezeichnung || beruf?.designation || '',
        bereich: this._roleLabel(beruf?.designation || einsatz.bezeichnung),
        uhrzeitVon: schicht?.uhrzeitVon || einsatz.uhrzeitVon || null,
        uhrzeitBis: schicht?.uhrzeitBis || einsatz.uhrzeitBis || null,
        checkedIn: checkedInPersonalNrs.has(String(einsatz.personalNr)),
        noShow: noShowPersonalNrs.has(String(einsatz.personalNr)),
      });
    });

    return { auftrag, groups: [...groups.values()] };
  }

  async _renderPdf({ auftrag, groups }) {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
    const context = { document, font, boldFont, page: null, y: 0 };

    this._newPage(context, 'Telefonliste');
    this._text(context, auftrag.eventTitel || `Auftrag ${auftrag.auftragNr}`, MARGIN, context.y, 15, boldFont);
    context.y -= 20;
    this._text(context, `Auftrag ${auftrag.auftragNr} | ${this._dateRange(auftrag.vonDatum, auftrag.bisDatum)}`, MARGIN, context.y, 9, font, rgb(0.32, 0.38, 0.45));
    context.y -= 14;
    const location = [auftrag.eventLocation, auftrag.eventStrasse, [auftrag.eventPlz, auftrag.eventOrt].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (location) {
      this._text(context, location, MARGIN, context.y, 9, font, rgb(0.32, 0.38, 0.45));
      context.y -= 18;
    }

    if (!groups.length) {
      this._text(context, 'Keine Mitarbeiter eingeplant.', MARGIN, context.y, 10, font);
    }

    groups.forEach((group) => this._group(context, group));
    this._footer(document, font);
    return Buffer.from(await document.save());
  }

  _group(context, group) {
    this._ensureSpace(context, 80);
    const shiftTime = group.uhrzeitVon
      ? `${this._time(group.uhrzeitVon)}${group.uhrzeitBis ? ` - ${this._time(group.uhrzeitBis)}` : ''}`
      : '';
    this._text(context, group.bezeichnung, MARGIN, context.y, 11, context.boldFont);
    if (shiftTime) this._text(context, `${group.mitarbeiter.length} MA | ${shiftTime}`, 420, context.y, 8.5, context.boldFont, rgb(0.32, 0.38, 0.45));
    context.y -= 15;
    const meetingPoint = [group.treffpunkt ? this._time(group.treffpunkt) : '', group.treffpunktOrt || ''].filter(Boolean).join(' | ');
    if (meetingPoint) {
      this._text(context, `Treffpunkt: ${meetingPoint}`, MARGIN, context.y, 8.5, context.font, rgb(0.32, 0.38, 0.45));
      context.y -= 13;
    }

    this._drawTableHeader(context);

    group.mitarbeiter.forEach((person, index) => {
      if (context.y - ROW_HEIGHT < MARGIN + 24) {
        this._newPage(context, 'Telefonliste (Fortsetzung)');
        this._drawTableHeader(context);
      }
      this._drawTableRow(context, person, index);
    });
    context.y -= 13;
  }

  _newPage(context, title) {
    context.page = context.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    context.y = PAGE_HEIGHT - MARGIN;
    this._text(context, title, MARGIN, context.y, 8, context.font, rgb(0.45, 0.5, 0.56));
    context.y -= 18;
  }

  _ensureSpace(context, height) {
    if (context.y - height >= MARGIN + 24) return;
    this._newPage(context, 'Telefonliste (Fortsetzung)');
  }

  _drawTableHeader(context) {
    const columns = this._columns();
    const y = context.y;
    context.page.drawRectangle({ x: MARGIN, y: y - ROW_HEIGHT + 5, width: CONTENT_WIDTH, height: ROW_HEIGHT, color: rgb(0.94, 0.95, 0.97) });
    ['', '#', 'Mitarbeiter', 'Bereich', 'Funktion', 'Geplant', 'Telefon'].forEach((label, index) => {
      this._text(context, label, columns[index] + 5, y - 8, 7.5, context.boldFont, rgb(0.1, 0.13, 0.17));
    });
    this._horizontalLine(context, y - ROW_HEIGHT + 5);
    context.y -= ROW_HEIGHT;
  }

  _drawTableRow(context, person, index) {
    const columns = this._columns();
    const y = context.y;
    if (index % 2 === 1) {
      context.page.drawRectangle({ x: MARGIN, y: y - ROW_HEIGHT + 5, width: CONTENT_WIDTH, height: ROW_HEIGHT, color: rgb(0.98, 0.985, 0.99) });
    }
    this._drawCheckbox(context, columns[0] + 7, y - 14, person);
    const name = `${person.vorname} ${person.nachname}`.trim() || `PNR ${person.personalNr || '—'}`;
    const planned = person.uhrzeitVon
      ? `${this._time(person.uhrzeitVon)}${person.uhrzeitBis ? ` - ${this._time(person.uhrzeitBis)}` : ''}`
      : '—';
    const values = [String(index + 1), name, person.bereich || 'Sonstiges', person.bezeichnung || '—', planned, person.telefon || '—'];
    const widths = [14, 118, 70, 128, 70, 95];
    values.forEach((value, valueIndex) => {
      const x = columns[valueIndex + 1] + 5;
      this._text(context, this._truncate(value, Math.floor(widths[valueIndex] / 4.7)), x, y - 9, 7.6, valueIndex === 1 ? context.boldFont : context.font);
    });
    this._horizontalLine(context, y - ROW_HEIGHT + 5);
    context.y -= ROW_HEIGHT;
  }

  _drawCheckbox(context, x, y, person) {
    const border = person.noShow ? rgb(0.75, 0.22, 0.17) : person.checkedIn ? rgb(0.15, 0.62, 0.38) : rgb(0.66, 0.66, 0.66);
    const fill = person.noShow ? rgb(0.99, 0.92, 0.91) : person.checkedIn ? rgb(0.92, 0.98, 0.94) : undefined;
    context.page.drawRectangle({ x, y, width: 12, height: 12, borderColor: border, borderWidth: 1, color: fill });
    if (person.noShow) {
      context.page.drawLine({ start: { x: x + 3, y: y + 3 }, end: { x: x + 9, y: y + 9 }, thickness: 1.4, color: border });
      context.page.drawLine({ start: { x: x + 9, y: y + 3 }, end: { x: x + 3, y: y + 9 }, thickness: 1.4, color: border });
    } else if (person.checkedIn) {
      context.page.drawLine({ start: { x: x + 2, y: y + 6 }, end: { x: x + 5, y: y + 2.5 }, thickness: 1.6, color: border });
      context.page.drawLine({ start: { x: x + 5, y: y + 2.5 }, end: { x: x + 10, y: y + 10 }, thickness: 1.6, color: border });
    }
  }

  _columns() {
    const widths = [22, 14, 120, 75, 137, 65, 90];
    const columns = [MARGIN];
    widths.slice(0, -1).forEach((width) => columns.push(columns[columns.length - 1] + width));
    return columns;
  }

  _horizontalLine(context, y) {
    context.page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.84, 0.87, 0.9) });
  }

  _roleLabel(value) {
    const text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/office|dispo|disponent|assistenz|admin|backoffice/.test(text)) return 'Office';
    if (/service|kellner|chef de rang|commis de rang|runner|host|hostess|bar|theke|bankett|gastr|catering/.test(text)) return 'Service';
    if (/logistik|logi|aufbau|abbau|lager|fahrer|stagehand|technik|techniker|hands|crew/.test(text)) return 'Logistik';
    return String(value || 'Sonstiges');
  }

  _text(context, value, x, y, size, font, color = rgb(0.1, 0.13, 0.17)) {
    context.page.drawText(String(value), { x, y, size, font, color });
  }

  _truncate(value, maxLength) {
    const text = String(value || '—');
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
  }

  _time(value) {
    const match = String(value || '').match(/\d{1,2}:\d{2}/);
    return match ? match[0].padStart(5, '0') : String(value || '');
  }

  _dateRange(start, end) {
    const format = (value) => value ? new Date(value).toLocaleDateString('de-DE') : '—';
    const from = format(start);
    const to = format(end);
    return from === to ? from : `${from} - ${to}`;
  }

  _footer(document, font) {
    document.getPages().forEach((page, index) => {
      page.drawText(`Erstellt am ${new Date().toLocaleString('de-DE')} | Seite ${index + 1}/${document.getPageCount()}`, {
        x: MARGIN,
        y: 20,
        size: 7,
        font,
        color: rgb(0.45, 0.5, 0.56),
      });
    });
  }
}

module.exports = new TelefonlisteService();
