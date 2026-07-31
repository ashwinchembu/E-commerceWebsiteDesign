export type NewsletterSignupResult = {
  discountCode: string | null;
  ok: true;
};

export async function subscribeToNewsletter(email: string, website = '') {
  const firebase = await import('./firebase');
  if (
    !firebase.firebaseIsConfigured() ||
    !firebase.firebaseAppCheckIsConfigured()
  ) {
    throw new Error('Newsletter signup is temporarily unavailable');
  }
  return firebase.callFirebaseFunction<
    { email: string; website: string },
    NewsletterSignupResult
  >(
    'subscribeNewsletter',
    { email, website },
    { limitedUseAppCheckTokens: true },
  );
}
