<template>
  <OrderDocuments
    :auftrag-nr="auftragNr"
    :items="items"
    title="Auftragsdokumente · Demo"
  />
</template>
<script setup>
import { computed } from 'vue';
import OrderDocuments from '@/components/ui-elements/OrderDocuments.vue';
const props = defineProps({ auftragNr: { type: [Number, String], default: null } });
async function previewBlob(title, order) {
  const [maker, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  const pdf = maker.default || maker;
  pdf.addVirtualFileSystem(fonts.default || fonts);
  const content = [
    { text: 'STRAIGHT MONITOR · DEMODOKUMENT', color: '#718096', fontSize: 9, margin: [0, 0, 0, 16] },
    { text: title, bold: true, fontSize: 24, color: '#243746', margin: [0, 0, 0, 8] },
    { text: `Auftrag #${order} · September 2026`, margin: [0, 0, 0, 24] },
    ...(title === 'EventReport' ? [
      { text: 'Teamleitung', bold: true }, { text: 'Alex Beispiel', margin: [0, 4, 0, 20] },
      { text: 'Ablauf & Rückmeldung', bold: true }, { text: 'Das Team war vollständig und pünktlich vor Ort. Service und Übergabe liefen planmäßig.', margin: [0, 4, 0, 20] },
      { text: 'Hinweis zur Stundenerfassung', bold: true }, { text: 'Die ausgefüllte Stundenliste liegt vor. Pausen wurden mit der Teamleitung abgestimmt.', margin: [0, 4, 0, 20] },
    ] : [{ table: { headerRows: 1, widths: ['*', 55, 55, 55, 55], body: [
      [{ text: 'Mitarbeiter', bold: true }, 'Beginn', 'Ende', 'Pause', 'Stunden'],
      ['Max Mustermann', '10:00', '18:30', '30 Min.', '8:00'],
      ['Alex Beispiel', '12:00', '18:30', '30 Min.', '6:00'],
    ] }, layout: 'lightHorizontalLines' }, { text: 'Ausgefüllte Beispieldaten · keine echte Unterschrift.', color: '#718096', margin: [0, 20, 0, 0] }]),
    { text: 'Diese Vorschau enthält ausschließlich fiktive Daten.', color: '#718096', fontSize: 9, margin: [0, 35, 0, 0] },
  ];
  return new Promise(resolve => pdf.createPdf({ content, defaultStyle: { fontSize: 11, lineHeight: 1.3 }, pageMargins: [42, 42, 42, 42] }).getBlob(resolve));
}
const items = computed(() => ['Stundenliste', 'EventReport'].map(title => {
  const order = props.auftragNr;
  return { id: `demo-${order}-${title}`, title, category: title, completed: title === 'Stundenliste', status: title === 'Stundenliste' ? 'Ausgefüllt · Demo' : 'Eingereicht · Demo', date: '2026-09-08',
    previewSource: { id: `demo-${order}-${title}`, filename: `${title}-Demo-${order}.pdf`, mimeType: 'application/pdf', loadBlob: () => previewBlob(title, order) } };
}));
</script>
