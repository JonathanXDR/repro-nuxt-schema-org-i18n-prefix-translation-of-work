export default defineNuxtConfig({
  compatibilityDate: '2026-03-21',
  modules: ['@nuxtjs/i18n', 'nuxt-schema-org'],

  site: {
    url: 'https://example.com',
  },

  // `strategy: 'prefix'` is the trigger. Every locale, including the
  // default, is served under `<host>/<locale>/`. Each locale's WebSite
  // `@id` is therefore prefixed, but nuxt-schema-org's automatic i18n
  // integration emits a `translationOfWork.@id` for non-default locales
  // that resolves to the unprefixed `<host>/#website`, which has no
  // matching node in the graph.
  //
  // `experimental.strictSeo: true` and `compactRoutes: true` mirror the
  // affected production setup, where i18n owns hreflang, canonical, og,
  // and where per-locale routes collapse to a single regex route.
  i18n: {
    baseUrl: 'https://example.com',
    trailingSlash: true,
    strategy: 'prefix',
    defaultLocale: 'de',
    experimental: {
      strictSeo: true,
      compactRoutes: true,
    },
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      fallbackLocale: 'de',
      redirectOn: 'root',
    },
    locales: [
      { code: 'de', language: 'de-DE', name: 'Deutsch' },
      { code: 'en', language: 'en-US', name: 'English' },
    ],
  },
})
