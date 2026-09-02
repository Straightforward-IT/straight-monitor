function idString(value) {
  return value == null ? '' : String(value?._id || value);
}

function optionLabel(options, key, fallback) {
  if (!key) return fallback || '';
  return options?.find((option) => option.key === key)?.label || fallback || key;
}

function lineMatchesItem(line, itemId) {
  const inventoryItemId = idString(line?.inventoryItemId);
  if (inventoryItemId) return inventoryItemId === idString(itemId);
  return idString(line?.itemId) === idString(itemId);
}

function cleanAnnotation(value) {
  return String(value || '').replace(/\[Paketvorlage: [a-f\d]{24}\]\s*/i, '').trim();
}

function buildInventoryHistoryFilter(item) {
  const itemId = item._id;
  const createdAt = item.createdAt || item._id?.getTimestamp?.() || new Date(0);
  return {
    timestamp: { $gte: createdAt },
    $or: [
      { 'items.inventoryItemId': itemId },
      {
        items: {
          $elemMatch: {
            itemId,
            $or: [
              { inventoryItemId: { $exists: false } },
              { inventoryItemId: null },
            ],
          },
        },
      },
    ],
  };
}

function buildInventoryHistoryEvents(item, logs) {
  const itemId = idString(item?._id);

  return (logs || [])
    .map((log) => {
      const lines = (log.items || [])
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => lineMatchesItem(line, itemId))
        .map(({ line, index }) => {
          const quantity = Number(line.anzahl || 0);
          const cancelled = Boolean(log.storniert || line.storniert);
          const groesseKey = line.groesse || 'onesize';

          return {
            index,
            itemId: idString(line.itemId) || null,
            inventoryItemId: idString(line.inventoryItemId) || null,
            stockId: idString(line.stockId) || null,
            locationId: idString(line.locationId) || null,
            bezeichnung: line.bezeichnung || item.bezeichnung,
            variationKey: line.variationKey || null,
            variation: optionLabel(item.variationen, line.variationKey, line.variationKey ? null : 'Standard'),
            groesseKey,
            groesse: optionLabel(item.groessen, groesseKey, groesseKey),
            quantity,
            soll: line.soll == null ? null : Number(line.soll),
            cancelled,
          };
        });

      if (!lines.length) return null;

      const cancelledLineCount = lines.filter((line) => line.cancelled).length;
      return {
        id: idString(log._id),
        timestamp: log.timestamp,
        art: log.art,
        quantity: lines.reduce((total, line) => total + (line.cancelled ? 0 : line.quantity), 0),
        recordedQuantity: lines.reduce((total, line) => total + line.quantity, 0),
        standort: log.standort || '',
        locationId: idString(log.locationV2 || log.locationId) || null,
        benutzer: {
          id: idString(log.benutzer) || null,
          name: log.benutzerName || '',
          email: log.benutzerMail || '',
        },
        mitarbeiter: log.mitarbeiter ? {
          id: idString(log.mitarbeiter),
          name: log.mitarbeiterName || '',
          personalnr: log.mitarbeiterPersonalnr || '',
        } : null,
        packageTemplateName: log.packageTemplateName || '',
        anmerkung: cleanAnnotation(log.anmerkung),
        cancelled: cancelledLineCount === lines.length,
        partiallyCancelled: cancelledLineCount > 0 && cancelledLineCount < lines.length,
        lines,
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
}

module.exports = {
  buildInventoryHistoryFilter,
  buildInventoryHistoryEvents,
  cleanAnnotation,
  lineMatchesItem,
};
