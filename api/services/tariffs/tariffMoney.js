// Exact fractions retain minute-based hours until the final money rounding.
const { decimalString } = require('./tariffDomain');
function decimalParts(value) {
  const decimal = decimalString(value);
  if (decimal === null) throw new Error('Dezimalwert fehlt.');
  const [whole, fraction = ''] = decimal.split('.');
  return { numerator: BigInt(whole + fraction), denominator: 10n ** BigInt(fraction.length), scale: fraction.length };
}
function add(left, right) {
  // Decimal denominators and the common minute denominator divide one another
  // after their GCD, preventing denominator growth across many assignments.
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const common = gcd(left.denominator, right.denominator);
  const denominator = left.denominator / common * right.denominator;
  return { numerator: left.numerator * (denominator / left.denominator) + right.numerator * (denominator / right.denominator), denominator };
}
function addDecimals(left, right) {
  const a = decimalParts(left), b = decimalParts(right);
  const scale = Math.max(a.scale, b.scale);
  const sum = a.numerator * 10n ** BigInt(scale - a.scale) + b.numerator * 10n ** BigInt(scale - b.scale);
  const sign = sum < 0n ? '-' : '';
  const digits = (sum < 0n ? -sum : sum).toString().padStart(scale + 1, '0');
  return decimalString(scale ? `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}` : `${sign}${digits}`);
}
function multiply(left, right) { return { numerator: left.numerator * right.numerator, denominator: left.denominator * right.denominator }; }
function money(value) {
  const negative = value.numerator < 0n;
  const scaled = (negative ? -value.numerator : value.numerator) * 100n;
  const cents = scaled / value.denominator + (scaled % value.denominator * 2n >= value.denominator ? 1n : 0n);
  return `${negative && cents ? '-' : ''}${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
const zero = () => ({ numerator: 0n, denominator: 1n });
module.exports = { decimalParts, addDecimals, add, multiply, money, zero };
