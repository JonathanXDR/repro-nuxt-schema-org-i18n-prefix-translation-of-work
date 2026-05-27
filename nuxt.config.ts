export default defineNuxtConfig({
  compatibilityDate: '2026-03-21',
  modules: ['@nuxtjs/i18n', 'nuxt-schema-org'],

  site: {
    url: 'https://example.com',
    defaultLocale: 'de-DE',
  },

  // `strategy: 'prefix'` is the trigger. Every locale — including the
  // default — is served under `<host>/<locale>/`. Each locale's WebSite
  // `@id` is therefore prefixed, but nuxt-schema-org's automatic i18n
  // integration emits `translationOfWork.@id` for non-default locales that
  // resolves to the unprefixed `<host>/#website`, which has no matching
  // node in the graph.
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
