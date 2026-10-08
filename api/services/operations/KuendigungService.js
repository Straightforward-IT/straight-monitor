const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb } = require('pdf-lib');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Location = require('../../models/System/Location');
const r2Service = require('../integrations/R2Service');
const { buildEmployeeR2Path } = require('../../utils/employeeR2Path');
const logger = require('../../utils/logger');

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FONT_REGULAR_PATH = path.join(__dirname, '../../assets/fonts/NotoSans-Regular.ttf');
const FONT_BOLD_PATH = path.join(__dirname, '../../assets/fonts/NotoSans-Bold.ttf');
const LOGO_PATH = path.join(__dirname, '../../assets/straightforward-logo-black.png');
const COMPANY_ADDRESS = 'H. & P. Straightforward GmbH, Straßmannstraße 6, 10249 Berlin';
const RELEASE_TYPES = new Set(['none', 'arbeitszeitkonto', 'resturlaub', 'beides']);

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function dateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((result, part) => {
    if (['year', 'month', 'day'].includes(part.type)) result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseDate(value, label, { required = true } = {}) {
  if (!value && !required) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    throw httpError(400, `${label} muss im Format JJJJ-MM-TT angegeben werden.`);
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw httpError(400, `${label} ist ungültig.`);
  }
  return date;
}

function formatDate(date) {
  const normalizedDate = typeof date === 'string'
    ? new Date(`${date}T12:00:00.000Z`)
    : date;
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(normalizedDate);
}

function numberValue(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw httpError(400, `${label} muss eine nicht negative Zahl sein.`);
  }
  return parsed;
}

function formatNumber(value) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value);
}

function filenameSegment(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

class KuendigungService {
  async _loadEmployee(mitarbeiterId) {
    if (!mongoose.isObjectIdOrHexString(mitarbeiterId)) {
      throw Object.assign(new Error('Ungültige Mitarbeiter-ID.'), { statusCode: 400 });
    }
    const employee = await Mitarbeiter.findById(mitarbeiterId).lean();
    if (!employee) {
      throw Object.assign(new Error('Mitarbeiter nicht gefunden.'), { statusCode: 404 });
    }
    return employee;
  }

  async getDefaults(mitarbeiterId) {
    const [employee, locations] = await Promise.all([
      this._loadEmployee(mitarbeiterId),
      Location.find({ isActive: true })
        .select('nameFull shortName address.city')
        .sort({ nameFull: 1 })
        .lean(),
    ]);
    const employeeLocationId = String(employee.locationV2?._id || employee.locationV2 || '');
    const preferredLocation = locations.find(location => String(location._id) === employeeLocationId) || locations[0];
    return {
      ready: true,
      parameters: {
        anrede: 'herr',
        locationId: preferredLocation ? String(preferredLocation._id) : '',
        briefdatum: dateString(),
        beendigungsdatum: '',
        freistellung: 'none',
        freistellungAb: '',
        arbeitszeitkontoStunden: '',
        resturlaubTage: '',
      },
      locations: locations.map(location => ({
        _id: String(location._id),
        name: location.nameFull,
        ort: location.address?.city || location.nameFull,
      })),
      documents: (employee.generierteDokumente || []).filter(document => document.typ === 'kuendigung'),
    };
  }

  async buildKuendigung(employee, parameters) {
    const prepared = await this._validateParameters(employee, parameters);
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const [font, fontBold] = await Promise.all([
      doc.embedFont(fs.readFileSync(FONT_REGULAR_PATH)),
      doc.embedFont(fs.readFileSync(FONT_BOLD_PATH)),
    ]);
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const ctx = { page, font, fontBold, y: PAGE_H - MARGIN };

    if (!fs.existsSync(LOGO_PATH)) {
      throw new Error('Das Straightforward-Logo für die Kündigungsvorlage wurde nicht gefunden.');
    }
    const logo = await doc.embedPng(fs.readFileSync(LOGO_PATH));
    const logoWidth = CONTENT_W * 0.86;
    const logoHeight = (logo.height / logo.width) * logoWidth;
    page.drawImage(logo, { x: MARGIN, y: ctx.y - logoHeight, width: logoWidth, height: logoHeight });
    ctx.y -= logoHeight + 20;

    this._text(ctx, COMPANY_ADDRESS, { size: 8, underline: true });
    ctx.y -= 15;
    this._text(ctx, prepared.recipient, { size: 10, lineGap: 3 });
    ctx.y -= 24;
    this._rightText(ctx, `${prepared.ort}, ${formatDate(prepared.briefdatum)}`, { size: 10 });
    ctx.y -= 35;
    this._text(ctx, 'Betreff: Kündigung', { font: fontBold, size: 11 });
    ctx.y -= 25;
    this._text(ctx, prepared.anrede === 'frau'
      ? `Sehr geehrte Frau ${prepared.nachname},`
      : `Sehr geehrter Herr ${prepared.nachname},`, { size: 10 });
    ctx.y -= 19;
    this._text(ctx, `hiermit kündigen wir das mit Ihnen bestehende Arbeitsverhältnis fristgerecht zum ${formatDate(prepared.beendigungsdatum)} unter Wahrung der gesetzlichen Kündigungsfrist, hilfsweise zum nächsten zulässigen Zeitpunkt.`, { size: 10, lineGap: 4 });
    if (prepared.freistellungText) {
      ctx.y -= 16;
      this._text(ctx, prepared.freistellungText, { size: 10, lineGap: 4 });
    }
    ctx.y -= 16;
    this._text(ctx, 'Wir weisen Sie darauf hin, dass Sie verpflichtet sind, selbst aktiv nach einer anderen Beschäftigung zu suchen und sich spätestens drei Monate vor Beendigung des Arbeitsverhältnisses persönlich bei der Agentur für Arbeit arbeitssuchend zu melden gemäß § 38 SGB III.', { size: 10, lineGap: 4 });
    ctx.y -= 16;
    this._text(ctx, 'Liegen zwischen der Kenntnis des Beendigungszeitpunktes und der Beendigung weniger als drei Monate, haben Sie sich innerhalb von 3 Tagen nach Kenntnis des Beendigungszeitpunktes zu melden. Zur Wahrung der Frist reicht eine Anzeige unter Angabe der persönlichen Daten und des Beendigungszeitpunktes aus, wenn die persönliche Meldung nach terminlicher Vereinbarung nachgeholt wird.', { size: 10, lineGap: 4 });
    ctx.y -= 16;
    this._text(ctx, 'Wir weisen Sie darauf hin, dass die von Straightforward ausgehändigten Pfandgegenstände bis spätestens zum letzten Werktag des Monats, in welchem Ihre Kündigung greift, bei Straightforward eingegangen sein müssen. Andernfalls ist eine Rückvergütung des Pfands nicht mehr möglich.', { size: 10, lineGap: 4 });
    ctx.y -= 30;
    this._ensureSpace(ctx, 90);
    this._text(ctx, `${prepared.ort}, ${formatDate(prepared.briefdatum)}`, { size: 10 });
    ctx.y -= 50;
    page.drawLine({
      start: { x: MARGIN, y: ctx.y },
      end: { x: MARGIN + 210, y: ctx.y },
      thickness: 0.7,
      color: rgb(0, 0, 0),
    });
    ctx.y -= 13;
    this._text(ctx, 'Stempel und Unterschrift Arbeitgeber', { size: 8 });

    return Buffer.from(await doc.save());
  }

  async createAndStore(mitarbeiterId, parameters, createdBy) {
    const employee = await this._loadEmployee(mitarbeiterId);
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
      throw Object.assign(new Error('Dokumentparameter müssen ein Objekt sein.'), { statusCode: 400 });
    }

    const preparedParameters = await this._validateParameters(employee, parameters);
    const buffer = await this.buildKuendigung(employee, preparedParameters);
    const pdf = await PDFDocument.load(buffer);
    if (!pdf.getPageCount()) {
      throw new Error('Das Kündigungsdokument enthält keine PDF-Seiten.');
    }

    const createdAt = new Date();
    const filename = [
      'Kuendigung',
      filenameSegment(employee.vorname, 'Vorname'),
      filenameSegment(employee.nachname, 'Nachname'),
      preparedParameters.briefdatum,
    ].join('_') + '.pdf';
    const document = {
      _id: new mongoose.Types.ObjectId(),
      typ: 'kuendigung',
      filename,
      r2Key: buildEmployeeR2Path(employee, 'documents', filename),
      parameters: preparedParameters,
      createdAt,
      createdBy,
    };

    await r2Service.uploadFile(document.r2Key, buffer, 'application/pdf');
    try {
      const updated = await Mitarbeiter.findByIdAndUpdate(
        employee._id,
        { $push: { generierteDokumente: document } },
        { new: true, runValidators: true },
      );
      if (!updated) {
        throw Object.assign(new Error('Mitarbeiter nicht mehr vorhanden.'), { statusCode: 404 });
      }
    } catch (error) {
      // Ohne Mitarbeiter-Verknüpfung darf keine verwaiste Kündigung zurückbleiben.
      try {
        await r2Service.deleteFile(document.r2Key);
      } catch (cleanupError) {
        logger.error(`Kündigungsdatei konnte nach Speicherfehler nicht entfernt werden: ${document.r2Key}`, cleanupError);
      }
      throw error;
    }

    logger.info(`Kündigungsdokument für Mitarbeiter ${employee._id} gespeichert: ${document.r2Key}`);
    return document;
  }

  async _validateParameters(employee, parameters) {
    const anrede = String(parameters.anrede || '').trim().toLowerCase();
    if (!['frau', 'herr'].includes(anrede)) {
      throw httpError(400, 'Bitte wählen Sie eine Anrede.');
    }
    if (!mongoose.isObjectIdOrHexString(parameters.locationId)) {
      throw httpError(400, 'Bitte wählen Sie einen Standort.');
    }
    const location = await Location.findOne({ _id: parameters.locationId, isActive: true })
      .select('nameFull address.city')
      .lean();
    if (!location) {
      throw httpError(400, 'Der gewählte Standort ist nicht aktiv oder existiert nicht.');
    }
    const briefdatum = parseDate(parameters.briefdatum, 'Briefdatum');
    const beendigungsdatum = parseDate(parameters.beendigungsdatum, 'Beendigungsdatum');
    const freistellung = String(parameters.freistellung || 'none');
    if (!RELEASE_TYPES.has(freistellung)) {
      throw httpError(400, 'Die Freistellungsart ist ungültig.');
    }
    const needsArbeitszeitkonto = freistellung === 'arbeitszeitkonto' || freistellung === 'beides';
    const needsResturlaub = freistellung === 'resturlaub' || freistellung === 'beides';
    const freistellungAb = freistellung === 'none'
      ? null
      : parseDate(parameters.freistellungAb, 'Freistellung ab');
    const arbeitszeitkontoStunden = needsArbeitszeitkonto
      ? numberValue(parameters.arbeitszeitkontoStunden, 'Arbeitszeitkonto')
      : null;
    const resturlaubTage = needsResturlaub
      ? numberValue(parameters.resturlaubTage, 'Resturlaub')
      : null;
    const releaseParts = [
      needsArbeitszeitkonto && `Unter Anrechnung Ihres Arbeitszeitkontos in Höhe von ${formatNumber(arbeitszeitkontoStunden)} Stunden`,
      needsResturlaub && `${needsArbeitszeitkonto ? 'sowie Ihres' : 'Unter Anrechnung Ihres'} verbleibenden Resturlaubes in Höhe von ${formatNumber(resturlaubTage)} Tagen`,
    ].filter(Boolean);
    const freistellungText = releaseParts.length
      ? `${releaseParts.join(' ')} stellen wir Sie unwiderruflich ab dem ${formatDate(freistellungAb)} frei.`
      : '';
    const nachname = String(employee.nachname || '').trim();
    if (!nachname) throw httpError(400, 'Der Mitarbeiter benötigt einen Nachnamen.');
    const recipient = [
      [employee.vorname, nachname].filter(Boolean).join(' '),
      employee.adresse?.strasse,
      [employee.adresse?.plz, employee.adresse?.ort].filter(Boolean).join(' '),
    ].filter(Boolean).join('\n');
    if (!employee.adresse?.strasse || !employee.adresse?.plz || !employee.adresse?.ort) {
      throw httpError(400, 'Für die Kündigung werden Straße, PLZ und Ort des Mitarbeiters benötigt.');
    }
    return {
      anrede,
      locationId: String(location._id),
      ort: location.address?.city || location.nameFull,
      briefdatum: dateString(briefdatum),
      beendigungsdatum: dateString(beendigungsdatum),
      freistellung,
      freistellungAb: freistellungAb ? dateString(freistellungAb) : '',
      arbeitszeitkontoStunden,
      resturlaubTage,
      nachname,
      recipient,
      freistellungText,
    };
  }

  _ensureSpace(ctx, requiredHeight) {
    if (ctx.y - requiredHeight >= MARGIN) return;
    throw httpError(400, 'Das Kündigungsschreiben passt nicht auf eine Seite.');
  }

  _text(ctx, text, { font = ctx.font, size, lineGap = 2, underline = false }) {
    const lines = this._wrap(text, font, size, CONTENT_W);
    const lineHeight = size + lineGap;
    this._ensureSpace(ctx, lines.length * lineHeight);
    lines.forEach((line, index) => {
      const y = ctx.y - size - index * lineHeight;
      ctx.page.drawText(line, { x: MARGIN, y, font, size, color: rgb(0, 0, 0) });
      if (underline) {
        ctx.page.drawLine({
          start: { x: MARGIN, y: y - 1.5 },
          end: { x: MARGIN + font.widthOfTextAtSize(line, size), y: y - 1.5 },
          thickness: 0.35,
          color: rgb(0, 0, 0),
        });
      }
    });
    ctx.y -= lines.length * lineHeight;
  }

  _rightText(ctx, text, { font = ctx.font, size }) {
    this._ensureSpace(ctx, size);
    ctx.page.drawText(text, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(text, size),
      y: ctx.y - size,
      font,
      size,
      color: rgb(0, 0, 0),
    });
    ctx.y -= size;
  }

  _wrap(text, font, size, width) {
    return String(text).split('\n').flatMap(paragraph => {
      if (!paragraph) return [''];
      const lines = [];
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(candidate, size) > width) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
      return lines;
    });
  }
}

module.exports = new KuendigungService();
