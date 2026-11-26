// A fresh quote each time the app goes idle. Free, key-less APIs are tried in
// order; if the device is offline or they fail, a built-in quote is used.
// Only a plain GET is sent: no user data ever leaves the device.
import { QUOTES } from './stats.js';

const SOURCES = [
  {
    url: 'https://quoteslate.vercel.app/api/quotes/random?maxLength=140&tags=motivation,productivity,wisdom,success,inspiration',
    parse: (j) => ({ text: j.quote, author: j.author }),
  },
  { url: 'https://dummyjson.com/quotes/random', parse: (j) => ({ text: j.quote, author: j.author }) },
];

export function localQuote() {
  const [text, author] = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  return { text, author, source: 'local' };
}

export async function fetchQuote({ timeoutMs = 4000, fetchImpl = globalThis.fetch } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return localQuote();
  for (const src of SOURCES) {
    try {
      const res = await fetchImpl(src.url, { signal: AbortSignal.timeout(timeoutMs), referrerPolicy: 'no-referrer', credentials: 'omit' });
      if (!res.ok) continue;
      const q = src.parse(await res.json());
      if (q.text && q.text.length <= 200) return { text: q.text.trim(), author: (q.author || 'Unknown').trim(), source: 'api' };
    } catch { /* try the next source */ }
  }
  return localQuote();
}
