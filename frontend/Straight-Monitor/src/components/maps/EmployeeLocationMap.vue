<template>
  <div class="employee-map">
    <div ref="container" class="employee-map__canvas" aria-label="Karte mit Mitarbeiteradressen und Einsatzorten" />
    <div v-if="mapError || tileError" class="employee-map__notice" role="status">
      {{ mapError || 'Die Hintergrundkarte konnte nicht vollständig geladen werden.' }}
      <button v-if="tileError && !mapError" type="button" @click="retryTiles">Erneut laden</button>
    </div>
    <button class="employee-map__fit" type="button" aria-label="Alle Kartenpunkte anzeigen" @click="fit(true)">Alle Punkte</button>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const props = defineProps({
  entries: { type: Array, default: () => [] },
  origin: { type: Object, default: null },
  nearest: { type: Array, default: () => [] },
  center: { type: Object, default: null },
  selectedId: { type: String, default: '' },
  viewKey: { type: String, default: '' },
});
const emit = defineEmits(['select', 'choose-site']);
const container = ref(null);
const tileError = ref(false);
const mapError = ref('');
let map, clusters, originLayer, tiles, observer;
let destroyed = false;
let userMoved = false;
let moving = false;
const markers = new Map();
const valid = entry => Number.isFinite(entry?.coordinates?.latitude) && Number.isFinite(entry?.coordinates?.longitude);
const latLng = entry => [entry.coordinates.latitude, entry.coordinates.longitude];
const safeColor = color => /^#[\da-f]{3,8}$/i.test(color || '') ? color : '#64748b';

function icon(entry, rank) {
  const element = document.createElement('span');
  element.className = ['employee-map-pin', entry.entityType === 'einsatzort' ? 'employee-map-pin--site' : '',
    entry.addressKind === 'secondary' ? 'employee-map-pin--secondary' : '',
    rank ? 'employee-map-pin--nearest' : '', entry.id === props.selectedId ? 'employee-map-pin--selected' : '',
  ].filter(Boolean).join(' ');
  element.style.setProperty('--pin-color', safeColor(entry.location?.color));
  element.textContent = rank ? String(rank) : entry.entityType === 'einsatzort' ? 'E' : entry.addressKind === 'secondary' ? '2' : '1';
  return L.divIcon({ className: 'employee-map-icon', html: element, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -18] });
}

function popup(entry) {
  const root = document.createElement('div');
  root.className = 'employee-map-popup';
  const title = document.createElement('strong');
  title.textContent = entry.name;
  root.append(title);
  if (entry.customerLabel) {
    const customer = document.createElement('p');
    customer.textContent = entry.customerLabel;
    root.append(customer);
  }
  const addresses = entry.mitarbeiterId ? props.entries.filter(item => item.mitarbeiterId === entry.mitarbeiterId) : [entry];
  addresses.forEach(address => {
    const paragraph = document.createElement('p');
    paragraph.textContent = `${address.addressKind === 'secondary' ? 'Zweitadresse: ' : address.addressKind === 'main' ? 'Hauptadresse: ' : ''}${address.address}`;
    root.append(paragraph);
  });
  if (entry.entityType === 'einsatzort') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Mitarbeiter nach Fahrzeit anzeigen';
    button.addEventListener('click', () => emit('choose-site', entry));
    root.append(button);
  }
  return root;
}

function syncMarkers() {
  if (!map || !clusters) return;
  const entries = [...props.entries, ...(props.origin ? [props.origin] : [])].filter(valid);
  const nextIds = new Set(entries.map(entry => entry.id));
  for (const [id, marker] of markers) {
    if (!nextIds.has(id)) { clusters.removeLayer(marker); originLayer.removeLayer(marker); markers.delete(id); }
  }
  const ranks = new Map(props.nearest.flatMap((entry, index) => entry.addressEntryIds.map(id => [id, index + 1])));
  for (const entry of entries) {
    let marker = markers.get(entry.id);
    const rank = ranks.get(entry.id);
    if (!marker) {
      marker = L.marker(latLng(entry), { title: entry.name, keyboard: true, icon: icon(entry, rank) });
      marker.bindPopup(() => popup(marker.mapEntry));
      marker.on('click', () => emit('select', marker.mapEntry.id));
      markers.set(entry.id, marker);
    } else {
      marker.setLatLng(latLng(entry));
      marker.setIcon(icon(entry, rank));
    }
    marker.mapEntry = entry;
    marker.mapHighlighted = Boolean(rank);
    if (entry.id === props.origin?.id) {
      clusters.removeLayer(marker);
      if (!originLayer.hasLayer(marker)) originLayer.addLayer(marker);
      marker.setZIndexOffset(1000);
    } else if (!clusters.hasLayer(marker)) {
      originLayer.removeLayer(marker);
      clusters.addLayer(marker);
    }
  }
  clusters.refreshClusters();
  const attribution = entries.some(entry => entry.attribution);
  const mapboxAttribution = 'Geocoding © <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">Mapbox</a>';
  if (attribution && !map.hasMapboxAttribution) map.attributionControl.addAttribution(mapboxAttribution);
  if (!attribution && map.hasMapboxAttribution) map.attributionControl.removeAttribution(mapboxAttribution);
  map.hasMapboxAttribution = attribution;
  if (!userMoved) fit();
}

function fit(force = false) {
  if (!map) return;
  if (force) userMoved = false;
  moving = true;
  const points = [...markers.values()].map(marker => marker.getLatLng());
  if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [45, 45], maxZoom: 14, animate: false });
  else if (props.center) map.setView([props.center.latitude, props.center.longitude], 11, { animate: false });
  else map.setView([51.1657, 10.4515], 6, { animate: false });
  moving = false;
}

function focus(entryId) {
  const marker = markers.get(entryId);
  if (!marker || !map) return;
  userMoved = true;
  if (originLayer.hasLayer(marker)) {
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 13));
    marker.openPopup();
  } else clusters.zoomToShowLayer(marker, () => { if (!destroyed) marker.openPopup(); });
}

function retryTiles() { tileError.value = false; tiles?.redraw(); }
defineExpose({ focus, fit });

watch(() => [props.entries, props.origin, props.nearest, props.center], syncMarkers);
watch(() => props.selectedId, () => { syncMarkers(); focus(props.selectedId); });
watch(() => props.viewKey, () => { userMoved = false; fit(); });

onMounted(async () => {
  try {
    // Markercluster extends Leaflet's shared object. Load it only after Leaflet
    // is available; both libraries stay in the lazily opened map chunk.
    window.L = L;
    await import('leaflet.markercluster');
    if (destroyed) return;
    map = L.map(container.value, { center: [51.1657, 10.4515], zoom: 6, maxZoom: 19 });
    tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(map);
    tiles.on('tileerror', () => { tileError.value = true; });
    clusters = L.markerClusterGroup({
      maxClusterRadius: 48, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
      iconCreateFunction(cluster) {
        const element = document.createElement('span');
        element.textContent = String(cluster.getChildCount());
        const highlighted = cluster.getAllChildMarkers().some(marker => marker.mapHighlighted);
        return L.divIcon({ html: element, className: `employee-map-cluster${highlighted ? ' employee-map-cluster--nearest' : ''}`, iconSize: [40, 40] });
      },
    }).addTo(map);
    originLayer = L.layerGroup().addTo(map);
    map.on('dragstart zoomstart', () => { if (!moving) userMoved = true; });
    observer = new ResizeObserver(() => { if (map) map.invalidateSize({ pan: false }); });
    observer.observe(container.value);
    syncMarkers();
    focus(props.selectedId);
  } catch { mapError.value = 'Die Karte konnte nicht gestartet werden. Bitte das Fenster erneut öffnen.'; }
});

onBeforeUnmount(() => {
  destroyed = true;
  observer?.disconnect();
  map?.remove();
  map = null;
  markers.clear();
});
</script>

<style scoped>
.employee-map { position: relative; min-height: 300px; height: 100%; isolation: isolate; }
.employee-map__canvas { height: 100%; width: 100%; min-height: 0; background: #e6e9e5; }
.employee-map__notice { position: absolute; top: 12px; left: 60px; right: 12px; z-index: 600; padding: 10px; border-radius: 8px; background: var(--tile-bg, #fff); color: var(--text); font-size: 12px; }
.employee-map__fit { position: absolute; top: 12px; right: 12px; z-index: 500; box-shadow: 0 2px 8px #0002; }
.employee-map button { border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: var(--text); background: var(--tile-bg, #fff); cursor: pointer; }
:deep(.employee-map-pin) { display: grid; place-items: center; width: 28px; height: 28px; box-sizing: border-box; background: var(--pin-color); border: 3px solid #fff; border-radius: 50%; color: #fff; font: 700 12px/1 system-ui; box-shadow: 0 2px 6px #0006; }
:deep(.employee-map-pin--secondary) { border-style: dashed; background: #fff; color: var(--pin-color); border-color: var(--pin-color); }
:deep(.employee-map-pin--site) { border-radius: 6px; }
:deep(.employee-map-pin--nearest) { outline: 3px solid #f59e0b; outline-offset: 2px; }
:deep(.employee-map-pin--selected) { outline: 4px solid #111827; outline-offset: 3px; }
:deep(.employee-map-cluster) { border-radius: 50%; border: 4px solid #ffffffb3; background: #334155; color: white; display: grid; place-items: center; font: 700 13px/1 system-ui; box-shadow: 0 2px 9px #0004; }
:deep(.employee-map-cluster--nearest) { background: #a16207; outline: 2px solid #f59e0b; }
:deep(.employee-map-popup) { min-width: 180px; max-width: 280px; font: 13px/1.5 system-ui; color: #18212f; }
:deep(.employee-map-popup p) { margin: 8px 0; white-space: normal; overflow-wrap: anywhere; }
:deep(.employee-map-popup button) { background: #eef2f6; color: #18212f; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font: inherit; }
</style>
