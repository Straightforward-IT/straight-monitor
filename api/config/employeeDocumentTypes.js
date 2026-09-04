const EMPLOYEE_DOCUMENT_TYPES = Object.freeze({
  IMMATRICULATION_CERTIFICATE: { label: 'Immatrikulationsbescheinigung', supportsValidity: true },
  SCHOOL_CERTIFICATE: { label: 'Schulbescheinigung', supportsValidity: true },
  PROOF_OF_ACHIEVEMENT: { label: 'Leistungsnachweis', supportsValidity: false },
  RESIDENCE_PERMIT: { label: 'Aufenthaltstitel', supportsValidity: true },
  IDENTITY_CARD: { label: 'Personalausweis', supportsValidity: true },
  HEALTH_INSURANCE_CARD: { label: 'Gesundheitskarte', supportsValidity: true },
  TAX_ID_DOCUMENT: { label: 'SteuerID-Dokument', supportsValidity: false },
  SOCIAL_INSURANCE_NUMBER: { label: 'Sozialversicherungsnummer', supportsValidity: false },
  EMPLOYMENT_CONTRACT: { label: 'Arbeitsvertrag', supportsValidity: false },
  DRIVER_LICENSE: { label: 'Führerschein', supportsValidity: true },
  HEALTH_INSTRUCTION_CERTIFICATE: { label: 'Gesundheitszeugnis-/Belehrung', supportsValidity: true },
});

function isEmployeeDocumentType(value) {
  return Object.prototype.hasOwnProperty.call(EMPLOYEE_DOCUMENT_TYPES, value);
}

module.exports = { EMPLOYEE_DOCUMENT_TYPES, isEmployeeDocumentType };