function queryTarget(path, tabId, defaultTab) {
  return (route) => {
    const query = { ...route.query };
    if (tabId === defaultTab) delete query.tab;
    else query.tab = tabId;
    return { path, query };
  };
}

function queryMatch(routeName, tabId, defaultTab) {
  return (route) => route.name === routeName
    && (tabId === defaultTab ? !route.query.tab || route.query.tab === defaultTab : route.query.tab === tabId);
}

export const dashboardTabs = [
  { id: 'widgets', label: 'Übersicht', icon: ['fas', 'table-cells-large'], to: queryTarget('/dashboard', 'widgets', 'widgets'), isActive: queryMatch('Dashboard', 'widgets', 'widgets') },
  { id: 'spaces', label: 'Spaces', icon: ['fas', 'folder-open'], to: queryTarget('/dashboard', 'spaces', 'widgets'), isActive: queryMatch('Dashboard', 'spaces', 'widgets') },
];

export const signatureTabs = [
  { id: 'signaturen', label: 'Signaturen', icon: ['fas', 'list-check'], to: queryTarget('/signaturen', 'signaturen', 'signaturen'), isActive: queryMatch('SignaturenPage', 'signaturen', 'signaturen') },
  { id: 'templates', label: 'Templates', icon: ['fas', 'file-lines'], to: queryTarget('/signaturen', 'templates', 'signaturen'), isActive: queryMatch('SignaturenPage', 'templates', 'signaturen') },
  { id: 'ablage', label: 'Ablage', icon: ['fas', 'folder-open'], to: queryTarget('/signaturen', 'ablage', 'signaturen'), isActive: queryMatch('SignaturenPage', 'ablage', 'signaturen') },
];

export const personalTabs = [
  { id: 'mitarbeiter', label: 'Mitarbeiter', icon: ['fas', 'users'], to: queryTarget('/personal', 'mitarbeiter', 'mitarbeiter'), isActive: queryMatch('Personal', 'mitarbeiter', 'mitarbeiter') },
  { id: 'bewerber', label: 'Bewerber', icon: ['fas', 'user-plus'], to: queryTarget('/personal', 'bewerber', 'mitarbeiter'), isActive: queryMatch('Personal', 'bewerber', 'mitarbeiter') },
];

export const reportTabs = [
  { id: 'dokumente', label: 'Dokumente', icon: ['fas', 'file-lines'], to: '/dokumente', isActive: (route) => route.name === 'Dokumente' },
  { id: 'auswertung', label: 'Auswertung', icon: ['fas', 'chart-column'], to: '/teamleiter-auswertung', isActive: (route) => route.name === 'TeamleiterAuswertung' },
  { id: 'nachpflege', label: 'Nachpflege', icon: ['fas', 'pen-clip'], to: '/dokumente-nachpflegen', isActive: (route) => route.name === 'DokumenteNachpflegen' },
];

export const documentMaintenanceTabs = [
  { id: 'laufzettel', label: 'Laufzettel', icon: ['fas', 'file-lines'], to: queryTarget('/dokumente-nachpflegen', 'laufzettel', 'laufzettel'), isActive: queryMatch('DokumenteNachpflegen', 'laufzettel', 'laufzettel') },
  { id: 'evaluierung', label: 'Evaluierung', icon: ['fas', 'star-half-stroke'], to: queryTarget('/dokumente-nachpflegen', 'evaluierung', 'laufzettel'), isActive: queryMatch('DokumenteNachpflegen', 'evaluierung', 'laufzettel') },
  { id: 'eventreport', label: 'Event Report', icon: ['fas', 'clipboard-list'], to: queryTarget('/dokumente-nachpflegen', 'eventreport', 'laufzettel'), isActive: queryMatch('DokumenteNachpflegen', 'eventreport', 'laufzettel') },
];

export const inventoryTabs = [
  { id: 'inventory', label: 'Bestand', icon: ['fas', 'warehouse'], to: '/bestand', isActive: (route) => route.name === 'Bestand' },
  { id: 'history', label: 'Verlauf', icon: ['fas', 'list'], to: (route) => ({ path: '/verlauf', query: Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'tab')) }), isActive: (route) => route.name === 'Verlauf' && route.query.tab !== 'graph' },
  { id: 'graph', label: 'Graph', icon: ['fas', 'chart-line'], to: (route) => ({ path: '/verlauf', query: { ...route.query, tab: 'graph' } }), isActive: (route) => route.name === 'Verlauf' && route.query.tab === 'graph' },
];

export const customerTabs = [
  { id: 'overview', label: 'Übersicht', icon: ['fas', 'list'], to: queryTarget('/kunden', 'overview', 'overview'), isActive: queryMatch('Kunden', 'overview', 'overview') },
  { id: 'analytics', label: 'Analytics', icon: ['fas', 'chart-bar'], to: queryTarget('/kunden', 'analytics', 'overview'), isActive: queryMatch('Kunden', 'analytics', 'overview') },
  { id: 'leads', label: 'Leads', icon: ['fas', 'bullseye'], to: queryTarget('/kunden', 'leads', 'overview'), isActive: queryMatch('Kunden', 'leads', 'overview') },
  { id: 'watchlist', label: 'Watchlist', icon: ['fas', 'binoculars'], to: queryTarget('/kunden', 'watchlist', 'overview'), isActive: queryMatch('Kunden', 'watchlist', 'overview') },
  { id: 'kontakte', label: 'Kontakte', icon: ['fas', 'address-book'], roles: ['ADMIN', 'VERTRIEB'], to: queryTarget('/kunden', 'kontakte', 'overview'), isActive: queryMatch('Kunden', 'kontakte', 'overview') },
];
