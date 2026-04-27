import type { LayoutGuidelines } from '../types/architecture';

export const layoutGuidelines: LayoutGuidelines = {
  generalRules: [
    'Menschen zuerst, Software danach.',
    'Der Monitor steht immer in der Mitte als Zentrale der Firma.',
    'Externe Partner erscheinen nur mit ihrer Geschäftsrolle, nicht mit technischen Interna.',
    'Jede Ansicht soll in wenigen Sekunden verständlich sein.',
  ],
  readingModes: [
    {
      id: 'quick',
      label: 'Schnell Erklärt',
      summary: 'Für alle, die die Firma in zwei Minuten verstehen wollen.',
    },
    {
      id: 'partner',
      label: 'Partner Erklärt',
      summary: 'Für Gespräche mit Kunden, Bewerbern oder Kolleginnen und Kollegen.',
    },
  ],
  viewRules: {
    'company-overview': [
      'Erkläre zuerst die Menschen und erst danach die eingesetzten Werkzeuge.',
      'Wenn eine Linie nicht hilft, die Firma schneller zu verstehen, gehört sie nicht in diese Sicht.',
    ],
    'work-cycle': [
      'Diese Sicht soll wie eine kleine Geschichte funktionieren: Bedarf, Planung, Einsatz, Rückmeldung.',
      'Der Public Monitor bleibt hier als einfacher Zugang für das Einsatzteam sichtbar.',
    ],
    'partner-map': [
      'Partner stehen nur für ihren Nutzen: Kommunikation, Aufgaben, Daten, App oder Signatur.',
      'Der Monitor bleibt im Zentrum, damit klar ist, dass die Firma kein Flickenteppich aus Einzeltools ist.',
    ],
  },
};
