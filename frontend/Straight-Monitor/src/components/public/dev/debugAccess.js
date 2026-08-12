export const PUBLIC_DEV_EMAILS = Object.freeze([
  'cedricbglx@gmail.com',
  'dh@straightforward.email',
]);

export function isPublicDevUser(email) {
  return PUBLIC_DEV_EMAILS.includes(String(email || '').trim().toLowerCase());
}