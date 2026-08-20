export function getDocumentTypeAbbreviation(docType) {
  const type = String(docType || '').trim();
  if (type.startsWith('Laufzettel')) return 'LZ';
  if (type === 'Event-Bericht') return 'ER';
  if (type === 'Evaluierung') return 'EV';
  return type || 'Dokument';
}

export function getDocumentModalTitle(doc, eventTitle = '') {
  const abbreviation = getDocumentTypeAbbreviation(doc?.docType);
  const title = String(eventTitle || doc?.bezeichnung || '').trim();
  return [abbreviation, title].filter(Boolean).join(' ');
}
