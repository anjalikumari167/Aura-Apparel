// Small shared helpers used across controllers, middleware and views.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wrap async route handlers so rejected promises reach the Express error handler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** True when the caller is our fetch() code (so we reply with JSON instead of HTML). */
const wantsJson = (req) =>
  Boolean(req.xhr) ||
  req.originalUrl.includes('/api/') ||
  (req.headers.accept || '').includes('application/json');

/** Only allow redirects to paths on THIS site (prevents open-redirect attacks). */
function safeRedirect(target, fallback = '/') {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\')
    ? target
    : fallback;
}

/** "a,b" | ["a","b"] | undefined  ->  ["a","b"] */
const asArray = (v) =>
  []
    .concat(v === undefined || v === null ? [] : v)
    .flatMap((x) => String(x).split(','))
    .map((s) => s.trim())
    .filter(Boolean);

/** Currency formatter. Change CURRENCY / LOCALE in .env (e.g. INR + en-IN). */
function makeMoney() {
  const fmt = new Intl.NumberFormat(process.env.LOCALE || 'en-US', {
    style: 'currency',
    currency: process.env.CURRENCY || 'USD',
  });
  return (n) => fmt.format(Number(n) || 0);
}

const STATUS_CLASS = {
  Processing: 'bg-amber-100 text-amber-800',
  Shipped: 'bg-blue-100 text-blue-800',
  Delivered: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

module.exports = { HttpError, asyncHandler, wantsJson, safeRedirect, asArray, makeMoney, STATUS_CLASS };
