const fs = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const dateText = value => value ? new Date(value).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) : '—';

// Render data as PDF text, never as HTML. Uses the same Noto fonts as Stundenliste.
async function renderReportPdf(kind, report, order) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await fs.readFile(path.join(__dirname, '../../assets/fonts/NotoSans-Regular.ttf')), { subset: true });
  const bold = await pdf.embedFont(await fs.readFile(path.join(__dirname, '../../assets/fonts/NotoSans-Bold.ttf')), { subset: true });
  const title = kind === 'eventreport' ? 'EventReport' : 'Laufzettel / Evaluierung';
  pdf.setTitle(`${title} · Auftrag ${order.auftragNr}`);
  let page, y;
  function newPage() {
    page = pdf.addPage([595, 842]); y = 788;
    page.drawText(title, { x: 44, y, font: bold, size: 19, color: rgb(.13, .18, .23) }); y -= 24;
    page.drawText(`Auftrag ${order.auftragNr} · ${dateText(report.datum || report.date)}`, { x: 44, y, font, size: 10 }); y -= 30;
  }
  newPage();
  function text(value, selectedFont = font, size = 10) {
    // Wrap long tokens as well as paragraphs; paginate without truncating reports.
    const paragraphs = String(value || '—').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').split(/\r?\n/);
    for (const paragraph of paragraphs) {
      let line = '';
      const draw = () => {
        if (y < 60) newPage();
        page.drawText(line, { x: 44, y, font: selectedFont, size, color: rgb(.16, .19, .23) }); y -= size + 5;
      };
      for (const character of paragraph) {
        if (selectedFont.widthOfTextAtSize(line + character, size) > 507) { draw(); line = ''; }
        line += character;
      }
      draw();
    }
  }
  const fields = [['Veranstaltung', order.eventTitel], ['Kunde', report.kunde], ['Einsatzort', order.eventLocation || order.eventOrt],
    ['Teamleitung', report.name_teamleiter], ...(kind === 'eventreport' ? [
      ['Mitarbeiteranzahl', report.mitarbeiter_anzahl], ['Pünktlichkeit', report.puenktlichkeit], ['Erscheinungsbild', report.erscheinungsbild],
      ['Team', report.team], ['Mitarbeiter im Job', report.mitarbeiter_job], ['Feedback Auftraggeber', report.feedback_auftraggeber],
      ['Fehlende Ausrüstung', report.ausruestung_fehlt], ['Sonstiges', report.sonstiges],
      ...(report.mitarbeiter_feedback || []).map(item => [`Feedback · ${[item.mitarbeiter?.vorname, item.mitarbeiter?.nachname].filter(Boolean).join(' ') || 'Mitarbeiter'}`, item.text]),
      ...(report.comments || []).map(item => [`Kommentar · ${item.authorName || 'Büro'} · ${dateText(item.date)}`, item.text]),
    ] : [['Mitarbeiter', report.name_mitarbeiter], ['Pünktlichkeit', report.puenktlichkeit], ['Erscheinungsbild', report.grooming],
      ['Motivation', report.motivation], ['Technische Fertigkeiten', report.technische_fertigkeiten], ['Lernbereitschaft', report.lernbereitschaft], ['Sonstiges', report.sonstiges]])];
  for (const [label, value] of fields) {
    if (y < 105) newPage();
    text(label, bold, 9); text(value); y -= 10;
  }
  const pages = pdf.getPages();
  pages.forEach((sheet, index) => sheet.drawText(`${index + 1} / ${pages.length} · Vorschau des gespeicherten Berichts`, { x: 44, y: 30, font, size: 8, color: rgb(.4, .44, .48) }));
  return Buffer.from(await pdf.save());
}
module.exports = { renderReportPdf };
