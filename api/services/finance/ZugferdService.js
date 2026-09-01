const { InvoiceService } = require('@e-invoice-eu/core');
const logger = require('../../utils/logger');

class ZugferdValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ZugferdValidationError';
    this.statusCode = 400;
  }
}

function requireValue(value, field) {
  if (value == null || value === '') {
    throw new ZugferdValidationError(`Pflichtfeld fehlt: ${field}.`);
  }
}

function validateInvoice(invoice) {
  const document = invoice?.['ubl:Invoice'];
  if (!document || typeof document !== 'object') {
    throw new ZugferdValidationError('invoice muss eine EN-16931-Invoice im e-invoice-eu-Format enthalten.');
  }

  requireValue(document['cbc:ID'], 'cbc:ID');
  requireValue(document['cbc:IssueDate'], 'cbc:IssueDate');
  requireValue(document['cbc:DocumentCurrencyCode'], 'cbc:DocumentCurrencyCode');
  requireValue(document['cac:AccountingSupplierParty'], 'cac:AccountingSupplierParty');
  requireValue(document['cac:AccountingCustomerParty'], 'cac:AccountingCustomerParty');
  requireValue(document['cac:InvoiceLine'], 'cac:InvoiceLine');
  requireValue(document['cac:TaxTotal'], 'cac:TaxTotal');
  requireValue(document['cac:LegalMonetaryTotal'], 'cac:LegalMonetaryTotal');
}

function toFileInfo(pdf) {
  if (!pdf?.buffer?.length) {
    throw new ZugferdValidationError('Eine visuelle Rechnungs-PDF ist für ZUGFeRD erforderlich.');
  }
  if (pdf.mimetype !== 'application/pdf') {
    throw new ZugferdValidationError('Die Datei im Feld pdf muss eine PDF sein.');
  }

  return {
    buffer: pdf.buffer,
    filename: pdf.originalname || 'rechnung.pdf',
    mimetype: pdf.mimetype,
  };
}

async function generateZugferd(invoice, pdf) {
  validateInvoice(invoice);
  const invoiceService = new InvoiceService(logger);
  const generated = await invoiceService.generate(invoice, {
    format: 'Factur-X-EN16931',
    lang: 'de-de',
    pdf: toFileInfo(pdf),
  });

  if (typeof generated === 'string') {
    throw new Error('Die ZUGFeRD-Generierung lieferte XML statt einer Hybrid-PDF.');
  }

  return Buffer.from(generated);
}

module.exports = { generateZugferd, ZugferdValidationError };