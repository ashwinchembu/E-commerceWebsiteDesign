const DISMISSED_AT_KEY = 'manoir:newsletter-dismissed-at';
const SUBSCRIBED_KEY = 'manoir:newsletter-subscribed';
const LEGACY_SHOWN_KEY = 'newsletterShown';

export const NEWSLETTER_SUBSCRIBED_EVENT = 'manoir:newsletter-subscribed';
export const NEWSLETTER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function getStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function shouldShowNewsletterOffer(now = Date.now()) {
  const storage = getStorage();
  if (!storage) return true;

  // The previous implementation treated one dismissal as permanent. Remove
  // that legacy flag so existing visitors move onto the new seven-day snooze.
  storage.removeItem(LEGACY_SHOWN_KEY);

  if (storage.getItem(SUBSCRIBED_KEY) === 'true') return false;

  const dismissedAtValue = storage.getItem(DISMISSED_AT_KEY);
  if (!dismissedAtValue) return true;

  const dismissedAt = Number(dismissedAtValue);
  const elapsed = now - dismissedAt;
  if (Number.isFinite(dismissedAt) && elapsed >= 0 && elapsed < NEWSLETTER_SNOOZE_MS) {
    return false;
  }

  storage.removeItem(DISMISSED_AT_KEY);
  return true;
}

export function snoozeNewsletterOffer(now = Date.now()) {
  getStorage()?.setItem(DISMISSED_AT_KEY, String(now));
}

export function markNewsletterSubscribed(notify = false) {
  const storage = getStorage();
  storage?.setItem(SUBSCRIBED_KEY, 'true');
  storage?.removeItem(DISMISSED_AT_KEY);

  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NEWSLETTER_SUBSCRIBED_EVENT));
  }
}
