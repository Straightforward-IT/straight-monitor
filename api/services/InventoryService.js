const mongoose = require('mongoose');
const XLSX = require('xlsx');
const InventoryItem = require('../models/Item_New');
const Location = require('../models/Location');

function optionLabel(options, key, fallback) {
  if (!key) return null;
  return options.find((option) => option.key === key)?.label || fallback || key;
}

function toFlatStock(item, stock) {
  const location = stock.location;
  const locationId = location?._id || location;
  const locationName = location?.nameFull || '';
  const variationOrder = item.variationen.findIndex((option) => option.key === stock.variationKey);
  const groesseOrder = item.groessen.findIndex((option) => option.key === stock.groesseKey);

  return {
    _id: stock._id,
    itemId: item._id,
    bezeichnung: item.bezeichnung,
    itemCreatedAt: item.createdAt,
    itemCreatedBy: item.createdBy ? {
      name: item.createdBy.name || '',
      email: item.createdBy.email || '',
    } : null,
    locationId,
    standort: locationName,
    standortKurz: location?.shortName || '',
    standortColor: location?.color || '#6b7280',
    variationKey: stock.variationKey || null,
    variation: optionLabel(item.variationen, stock.variationKey, stock.variationKey),
    variationOrder: variationOrder < 0 ? Number.MAX_SAFE_INTEGER : variationOrder,
    groesseKey: stock.groesseKey || 'onesize',
    groesse: optionLabel(item.groessen, stock.groesseKey, stock.groesseKey || 'onesize') || 'onesize',
    groesseOrder: groesseOrder < 0 ? Number.MAX_SAFE_INTEGER : groesseOrder,
    anzahl: stock.bestand,
    bestand: stock.bestand,
    soll: stock.soll,
    shopUrl: stock.shopUrl || item.shopUrl || '',
    isActive: item.isActive && stock.isActive,
    updatedAt: stock.updatedAt || item.updatedAt,
  };
}

async function listFlatStocks({ since = null, locationId = null, includeInactive = false } = {}) {
  const query = includeInactive ? {} : { isActive: true };
  if (since) query.updatedAt = { $gt: since };

  const items = await InventoryItem.find(query)
    .populate('bestaende.location', 'nameFull shortName color isActive')
    .populate('createdBy', 'name email')
    .lean();

  return items.flatMap((item) => item.bestaende
    .filter((stock) => {
      if (!includeInactive && !stock.isActive) return false;
      if (locationId && String(stock.location?._id || stock.location) !== String(locationId)) return false;
      return true;
    })
    .map((stock) => toFlatStock(item, stock)));
}

async function findInventoryStock(stockId, session = null) {
  if (!mongoose.isValidObjectId(stockId)) return null;

  let query = InventoryItem.findOne({ 'bestaende._id': stockId, isActive: true })
    .populate('bestaende.location', 'nameFull shortName color isActive');
  if (session) query = query.session(session);

  const item = await query;
  if (!item) return null;
  const stock = item.bestaende.id(stockId);
  if (!stock?.isActive || !stock.location?.isActive) return null;
  return { item, stock };
}

function normalizeStockInput(input, defaultShopUrl = '') {
  return {
    location: input.location,
    variationKey: input.variationKey || null,
    groesseKey: input.groesseKey || 'onesize',
    bestand: Number(input.bestand ?? input.anzahl ?? 0),
    soll: Number(input.soll ?? 0),
    shopUrl: input.shopUrl?.trim() || defaultShopUrl,
    isActive: input.isActive !== false,
  };
}

async function validateLocationIds(stocks) {
  const ids = [...new Set(stocks.map((stock) => String(stock.location)).filter(Boolean))];
  const locations = await Location.find({ _id: { $in: ids }, isActive: true }).select('_id').lean();
  if (locations.length !== ids.length) {
    throw Object.assign(new Error('Mindestens ein Standort ist nicht aktiv oder nicht vorhanden.'), { statusCode: 400 });
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildInventoryMailHtml(location, rows) {
  const today = new Date().toLocaleDateString('de-DE');
  if (!rows.length) {
    return `<div style="font-family:Arial,sans-serif;color:#222"><h2>Bestandsupdate ${escapeHtml(location.nameFull)}</h2><p>Stand: ${today}</p><p><em>Keine Artikel gefunden.</em></p></div>`;
  }
  const tableRows = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.bezeichnung)}</td>
      <td>${escapeHtml(row.variation || 'Standard')}</td>
      <td>${escapeHtml(row.groesse || 'Onesize')}</td>
      <td style="text-align:right">${row.bestand}</td>
      <td style="text-align:right">${row.soll}</td>
      <td style="text-align:right">${row.percentage === null ? '-' : `${row.percentage}%`}</td>
    </tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;color:#222">
    <h2>Bestandsupdate ${escapeHtml(location.nameFull)}</h2>
    <p>Stand: ${today}</p>
    <table style="border-collapse:collapse;width:100%;margin:12px 0 20px">
      <thead><tr><th style="text-align:left">Artikel</th><th style="text-align:left">Variation</th><th style="text-align:left">Größe</th><th style="text-align:right">Bestand</th><th style="text-align:right">Soll</th><th style="text-align:right">Prozent</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>`;
}

function compareRoutineRows(left, right) {
  const leftPercentage = left.percentage ?? Number.POSITIVE_INFINITY;
  const rightPercentage = right.percentage ?? Number.POSITIVE_INFINITY;
  return leftPercentage - rightPercentage
    || left.bezeichnung.localeCompare(right.bezeichnung, 'de')
    || String(left.variation || '').localeCompare(String(right.variation || ''), 'de')
    || String(left.groesse || '').localeCompare(String(right.groesse || ''), 'de');
}

function shopLabel(shopUrl) {
  if (!shopUrl) return 'Ohne Shop';
  try {
    const url = new URL(shopUrl);
    return url.hostname ? url.hostname.replace(/^www\./, '') : shopUrl;
  } catch {
    return shopUrl;
  }
}

function sheetName(name, usedNames) {
  const base = String(name).replace(/[\\/?*\[\]:]/g, '-').slice(0, 31) || 'Bestand';
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) candidate = `${base.slice(0, 28)}-${suffix++}`;
  usedNames.add(candidate);
  return candidate;
}

function buildInventoryExcelAttachment(location, rows) {
  const workbook = XLSX.utils.book_new();
  const groups = [...rows.reduce((map, row) => {
    const key = shopLabel(row.shopUrl);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map()).entries()];
  const usedNames = new Set();

  for (const [shop, groupRows] of groups) {
    const worksheet = XLSX.utils.json_to_sheet(groupRows.map((row) => ({
      Standort: location.nameFull,
      Artikel: row.bezeichnung,
      Variation: row.variation || 'Standard',
      Größe: row.groesse || 'Onesize',
      Bestand: row.bestand,
      Soll: row.soll,
      Differenz: Number(row.bestand) - Number(row.soll),
      Shop: row.shopUrl || '',
    })));
    worksheet['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 34 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName(shop, usedNames));
  }

  return {
    name: `Bestandsliste_${location.nameFull.replace(/[\\/?*\[\]:]/g, '-')}_${new Date().toLocaleDateString('de-DE').replace(/\./g, '-')}.xlsx`,
    content: XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

async function buildInventoryRoutineContent(standort) {
  const location = await Location.findOne({ nameKey: Location.normalize(standort), isActive: true })
    .select('nameFull shortName')
    .lean();
  if (!location) return null;

  const locationId = String(location._id);
  const items = await InventoryItem.find({ isActive: true })
    .populate('bestaende.location', '_id')
    .lean();

  const rows = items.flatMap((item) =>
    item.bestaende
      .filter((stock) => stock.isActive && String(stock.location?._id || stock.location) === locationId)
      .map((stock) => ({
        bezeichnung: item.bezeichnung,
        variation: optionLabel(item.variationen, stock.variationKey, null),
        groesse: optionLabel(item.groessen, stock.groesseKey, stock.groesseKey || 'onesize') || 'onesize',
        bestand: stock.bestand,
        soll: stock.soll,
        percentage: stock.soll > 0 ? Math.round((stock.bestand / stock.soll) * 100) : null,
        shopUrl: stock.shopUrl || item.shopUrl || '',
      }))
  ).sort(compareRoutineRows);

  return {
    location,
    rows,
    html: buildInventoryMailHtml(location, rows),
    attachment: buildInventoryExcelAttachment(location, rows),
  };
}

module.exports = {
  findInventoryStock,
  listFlatStocks,
  normalizeStockInput,
  toFlatStock,
  validateLocationIds,
  buildInventoryRoutineContent,
  buildInventoryMailHtml,
  buildInventoryExcelAttachment,
};