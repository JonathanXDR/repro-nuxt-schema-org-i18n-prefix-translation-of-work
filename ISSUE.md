# `translationOfWork.@id` dangles and the default locale self-lists under `@nuxtjs/i18n` `strategy: 'prefix'`

## 🐛 The bug

With `@nuxtjs/i18n` `strategy: 'prefix'` every locale, including the default, is served under `<host>/<locale>/`, so each `WebSite` node has a prefixed `@id`. The automatic i18n integration in nuxt-schema-org instead links non-default locales to the unprefixed `<host>/#website`, which is never declared, and lists the default locale as one of its own translations.

Generating the repro and inspecting the prerendered JSON-LD produces:

`/en/index.html` (non-default locale):

```json
{
  "@id": "https://example.com/en#website",
  "@type": "WebSite",
  "inLanguage": "en-US",
  "translationOfWork": { "@id": "https://example.com/#website" }
}
```

`translationOfWork.@id` is `https://example.com/#website`. No node with that `@id` exists in any prerendered graph, so the reference dangles.

`/de/index.html` (default locale):

```json
{
  "@id": "https://example.com/de#website",
  "@type": "WebSite",
  "inLanguage": "de-DE",
  "workTranslation": [
    { "@id": "https://example.com/de#website" },
    { "@id": "https://example.com/en#website" }
  ]
}
```

`workTranslation` includes `https://example.com/de#website`, the page's own `@id`, so the default locale is listed as a translation of itself.

The two symptoms are asymmetric. `workTranslation` on the default page uses the prefixed `/de#website` form, but `translationOfWork.@id` on the non-default page uses the unprefixed `/#website` form, so the cross-locale links never resolve into a complete graph.

## 🛠️ To reproduce

https://stackblitz.com/github/JonathanXDR/repro-nuxt-schema-org-i18n-prefix-translation-of-work

## 🌈 Expected behavior

Under `strategy: 'prefix'` the default locale's `WebSite` `@id` is prefixed (`<host>/<defaultLocale>/#website`). Every non-default locale's `translationOfWork.@id` should reference that same prefixed `@id`, and the default locale's `workTranslation` should exclude the default locale itself, so the cross-locale references form a complete graph.

## ℹ️ Additional context

Root cause is that the integration treats `siteConfig.defaultLocale` as an i18n locale code when it is actually a language tag.

`node_modules/nuxt-schema-org/dist/runtime/app/plugins/i18n/defaults.js:56` builds `translationOfWork.@id` with `resolveIdForLocale({ code: toValue(siteConfig.defaultLocale) })`, and line `:59` filters `workTranslation` with `locale.code !== siteConfig.defaultLocale`. Both assume `siteConfig.defaultLocale` is a locale code such as `de`.

`nuxt-site-config/dist/runtime/app/plugins/i18n.js:7-9` (`resolveDefaultLocale`) populates it with `locale.language || locale.iso || i18n.defaultLocale`, so when locales declare `language` it becomes the tag `de-DE`, not the code `de`.

Two comparisons break as a result:

1. `resolveIdForLocale({ code: 'de-DE' })` calls `localePath('index', 'de-DE')` with an unknown locale code, so vue-i18n routing falls back to the unprefixed path. `localePath('index', 'de')` would return `/de/` under `strategy: 'prefix'`, so the strategy only makes the fallback visible, it is not the cause.
2. The `workTranslation` filter compares the code `de` against the tag `de-DE`, never matches, and the default locale lists itself.

The branch selection above (`siteConfig.currentLocale !== siteConfig.defaultLocale`) works because both sides are tags there.

Suggested fix: resolve the default locale code from the i18n instance (for example `nuxtApp.$i18n.defaultLocale`) and use it for both `resolveIdForLocale` and the `workTranslation` filter, or look the locale object up by `language === siteConfig.defaultLocale` and use its `code`.

The repro needs `experimental.strictSeo: true` (so i18n owns the SEO surface schema-org reads) and a `pages/` directory (so `localePath` resolves through the file-based router during prerender). A config-side workaround does not exist, because nuxt-site-config's i18n plugin pushes `defaultLocale` at a higher priority than `nuxt.config` site config, so a user-provided `site.defaultLocale` cannot change the runtime value while i18n is active.

Environment: `nuxt@4.4.6`, `nuxt-schema-org@6.2.1`, `nuxt-site-config@4.1.0`, `@nuxtjs/i18n@10.4.0`, Node.js v24.
