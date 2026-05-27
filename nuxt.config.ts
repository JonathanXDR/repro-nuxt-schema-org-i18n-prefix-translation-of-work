export default defineNuxtConfig({
  compatibilityDate: '2026-03-21',
  modules: ['@nuxtjs/i18n', 'nuxt-schema-org'],

  site: {
    url: 'https://example.com',
  },

  // `strategy: 'prefix'` is the trigger: every locale (including the
  // default) gets a URL prefix. nuxt-schema-org's `resolveIdForLocale`
  // assumes the default locale is unprefixed and emits a dangling
  // translationOfWork.@id.
  i18n: {
    baseUrl: 'https://example.com',
    defaultLocale: 'de',
    strategy: 'prefix',
    locales: [
      { code: 'de', language: 'de-DE' },
      { code: 'en', language: 'en-US' },
    ],
  },
})
