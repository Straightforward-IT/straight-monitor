import { computed } from 'vue';
import { useAuth } from '@/stores/auth';

export const EMPLOYEE_NAME_FORMATS = Object.freeze({
  FIRST_LAST: 'first-last',
  LAST_FIRST: 'last-first',
});

export function formatMitarbeiterName(employee, format = EMPLOYEE_NAME_FORMATS.FIRST_LAST) {
  const vorname = String(employee?.vorname || '').trim();
  const nachname = String(employee?.nachname || '').trim();

  if (format === EMPLOYEE_NAME_FORMATS.LAST_FIRST) {
    return [nachname, vorname].filter(Boolean).join(', ');
  }

  return [vorname, nachname].filter(Boolean).join(' ');
}

export function useMitarbeiterNameFormatter() {
  const auth = useAuth();
  const employeeNameFormat = computed(() => auth.employeeNameFormat);
  const formatName = (employee) => formatMitarbeiterName(employee, employeeNameFormat.value);

  return { employeeNameFormat, formatName };
}