const { HttpError } = require('./helpers');

const LABELS = {
  name: 'full name',
  phone: 'phone',
  line1: 'address line 1',
  city: 'city',
  state: 'state',
  postalCode: 'postal code',
  country: 'country',
};
const REQUIRED = Object.keys(LABELS);

/** Validates + trims a shipping address object. Throws HttpError(400) with a friendly message. */
function cleanShipping(input = {}) {
  const out = {};
  for (const k of [...REQUIRED, 'line2']) out[k] = String(input[k] ?? '').trim().slice(0, 150);

  const missing = REQUIRED.filter((k) => !out[k]).map((k) => LABELS[k]);
  if (missing.length) throw new HttpError(400, `Please fill in: ${missing.join(', ')}`);
  if (!/^[0-9+\-\s()]{7,20}$/.test(out.phone)) throw new HttpError(400, 'Please enter a valid phone number');
  if (!/^[A-Za-z0-9\-\s]{3,10}$/.test(out.postalCode)) throw new HttpError(400, 'Please enter a valid postal code');
  return out;
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));

module.exports = { cleanShipping, isEmail };
