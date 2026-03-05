/**
 * Widget Registry – Central definition of all available dashboard widgets.
 *
 * Each entry describes one widget. The Dashboard renders only those the user
 * has enabled (via the dashboardPrefs store). Add new widgets here and they
 * will automatically appear in the configurator for every user.
 */
import { defineAsyncComponent } from 'vue'

export const WIDGET_DEFINITIONS = [
  {
    id: 'changelog',
    title: "What's New",
    icon: ['fas', 'bullhorn'],
    component: defineAsyncComponent(() => import('./WidgetChangelog.vue')),
    description: 'Features an denen gearbeitet wird',
    defaultVisible: true,
  },
  {
    id: 'personal',
    title: 'Personal',
    icon: ['fas', 'people-line'],
    component: defineAsyncComponent(() => import('./WidgetPersonal.vue')),
    description: 'Zeigt die letzten 3 erstellten Mitarbeiter an',
    defaultVisible: true,
  },
  {
    id: 'auftraege',
    title: 'Aufträge',
    icon: ['fas', 'calendar-days'],
    component: defineAsyncComponent(() => import('./WidgetAuftraege.vue')),
    description: 'Auflistung der nächsten Aufträge',
    defaultVisible: true,
  },
  {
    id: 'dokumente',
    title: 'Dokumente',
    icon: ['fas', 'file-alt'],
    component: defineAsyncComponent(() => import('./WidgetDokumente.vue')),
    description: 'Die letzten 3 Event Reports/Laufzettel',
    defaultVisible: true,
  },
  {
    id: 'bestand',
    title: 'Bestand',
    icon: ['fas', 'warehouse'],
    component: defineAsyncComponent(() => import('./WidgetBestand.vue')),
    description: 'Gibt ein Live-Bestands Update',
    defaultVisible: true,
  },
  {
    id: 'monitoring',
    title: 'Bestand-Logs',
    icon: ['fas', 'timeline'],
    component: defineAsyncComponent(() => import('./WidgetMonitoring.vue')),
    description: 'Zeigt die letzten 3 Monitoring Logs (Bestandsveränderungen) an',
    defaultVisible: true,
  },
  {
    id: 'imports',
    title: 'Letzte Imports',
    icon: ['fas', 'file-import'],
    component: defineAsyncComponent(() => import('./WidgetImports.vue')),
    description: 'Zeigt die letzten drei Daten Imports an',
    defaultVisible: true,
  },
  {
    id: 'teamleiter',
    title: 'Teamleiter',
    icon: ['fas', 'user-tie'],
    component: defineAsyncComponent(() => import('./WidgetTeamleiter.vue')),
    description: 'Preview der aktuellen Teamleiter Auswertung',
    defaultVisible: true,
  },
  {
    id: 'sinnlos',
    title: 'Sinnloser Knopf',
    icon: ['fas', 'circle-exclamation'],
    component: defineAsyncComponent(() => import('./WidgetSinnlos.vue')),
    description: 'Dieser Knopf tut nichts',
    defaultVisible: false,
  },
]

/** Lookup helper */
export const getWidgetById = (id) => WIDGET_DEFINITIONS.find((w) => w.id === id)
