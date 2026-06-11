# Repro: `nuxt-schema-org@6.0.4` `translationOfWork.@id` dangles under i18n `strategy: 'prefix'` (verified unchanged in 6.2.1)

Minimal Nuxt 4 project showing that the schema-org and `@nuxtjs/i18n`
auto-integration emits a `translationOfWork.@id` for every non-default
locale that references the unprefixed `<host>/#website`. Under
`strategy: 'prefix'` every locale (including the default) lives at
`<host>/<locale>/`, so the unprefixed `@id` is a node that never appears
in the graph.

## Steps to reproduce

```bash
npm install
npm run generate
npm run inspect:jsonld
```

1. `nuxi generate` prerenders `/de/` and `/en/`.
2. `inspect:jsonld` prints the `application/ld+json` block from each
   prerendered page.
3. The English page's `WebSite` node looks like:

   ```jsonc
   {
     "@id": "https://example.com/en#website",
     "@type": "WebSite",
     "inLanguage": "en-US",
     "translationOfWork": {
       "@id": "https://example.com/#website"   // dangling
     }
   }
   ```

4. The German page's `WebSite` `@id` is
   `https://example.com/de#website`. Its `workTranslation` array
   contains `https://example.com/en#website` (correct) plus
   `https://example.com/de#website` (a self-reference, a separate bug).

The asymmetry is the core issue. `workTranslation` on the default
locale page uses the prefixed `/de#website` form, but the corresponding
`translationOfWork.@id` on the non-default locale page uses the
unprefixed `/#website` form, so the cross-locale references never
resolve.

## Expected behaviour

Under `strategy: 'prefix'`, the default locale's `WebSite` `@id` is
prefixed (`<host>/<defaultLocale>/#website`).
`translationOfWork.@id` on every other locale must reference that same
prefixed `@id`, so cross-locale links form a complete graph.

## Actual behaviour

`translationOfWork.@id` on non-default locales resolves to the
unprefixed `<host>/#website`, which is never declared. The
`workTranslation` array on the default locale also includes the default
locale itself. Both symptoms share the same root cause, see below.

## Root cause

`node_modules/nuxt-schema-org/dist/runtime/app/plugins/i18n/defaults.js`:

```js
const resolveIdForLocale = (locale) => {
  if (locale.domain) {
    return resolveSitePath(localePath('index', locale.code), { /* ... */ })
  }
  return pathResolver(localePath('index', locale.code)).value
}

if (siteConfig.defaultLocale) {
  if (siteConfig.currentLocale && siteConfig.currentLocale !== siteConfig.defaultLocale) {
    website.translationOfWork = {
      '@type': 'WebSite',
      '@id': () => `${resolveIdForLocale({ code: toValue(siteConfig.defaultLocale) })}#website`,
    }
  } else {
    website.workTranslation = locales
      .filter(locale => locale.code !== siteConfig.defaultLocale)
      .map(locale => /* prefixed @id */)
  }
}
```

The plugin treats `siteConfig.defaultLocale` as an i18n locale CODE,
but nuxt-site-config's i18n integration populates it with the locale's
LANGUAGE TAG whenever locales declare `language` (see
`resolveDefaultLocale` in
`nuxt-site-config/dist/runtime/app/plugins/i18n.js`, which returns
`locale.language || locale.iso || i18n.defaultLocale`). With the
locales in this repro, `siteConfig.defaultLocale` is `'de-DE'`, not
`'de'`. Two comparisons break as a result:

1. `resolveIdForLocale({ code: 'de-DE' })` calls
   `localePath('index', 'de-DE')` with an unknown locale code, so
   vue-i18n routing falls back to the unprefixed path. Note that
   `localePath('index', 'de')` WOULD correctly return `/de/` under
   `strategy: 'prefix'`, so the strategy is only what makes the
   fallback visible, not the cause.
2. The `workTranslation` filter
   `locale.code !== siteConfig.defaultLocale` compares the code `'de'`
   against the tag `'de-DE'` and never matches, which is why the
   default locale lists itself as its own translation.

The branch selection above these lines
(`siteConfig.currentLocale !== siteConfig.defaultLocale`) happens to
work because both sides are tags there.

Suggested fix: resolve the default locale's CODE from the i18n
instance (`nuxtApp.$i18n.defaultLocale`) instead of
`siteConfig.defaultLocale`, and use it for both `resolveIdForLocale`
and the `workTranslation` filter. Alternatively look the locale object
up by `language === siteConfig.defaultLocale` and use its `code`.

A config-side workaround does not exist: nuxt-site-config's i18n
plugin pushes `defaultLocale` at `SiteConfigPriority.i18n` (-2), which
outranks `nuxt.config` site config (-3), so a user-provided
`site.defaultLocale` value cannot change the runtime value while i18n
is active.

## Failed user-side workaround

```ts
useSchemaOrg([
  defineWebSite({ inLanguage: () => /* current locale */ }),
])
```

This collapses every locale's `WebSite` `@id` to the unprefixed form,
breaking `@id` uniqueness and turning every `workTranslation`
reference into a dangling one as well. Net regression.

## Repro setup notes

This repro requires both `experimental.strictSeo: true` (so i18n owns
the SEO surface that schema-org reads) and a `pages/` directory (so
`localePath` resolves through the file-based router during prerender).
Without `pages/`, schema-org collapses every locale into a single
`/index#website` node and the bug surface looks different (no
`translationOfWork` field appears at all).

## Related upstream activity

- PR [`harlan-zw/nuxt-schema-org#77`](https://github.com/harlan-zw/nuxt-schema-org/pull/77),
  *"fix: correct translationOfWork reference"* (merged 2025-02-20).
  Added the auto-emitted `workTranslation` and `translationOfWork`
  linkage. The implementation assumes the default locale is served
  unprefixed (the `prefix_except_default` model), which is correct for
  that strategy but wrong for `strategy: 'prefix'`. The bug reproduced
  here is the residual gap left by #77.

No follow-up issue or PR addresses `strategy: 'prefix'` at the time of
writing.

## Environment

- `nuxt@4.4.6`
- `nuxt-schema-org@6.0.4`
- `@nuxtjs/i18n@10.4.0`
- `typescript@6.0.3`
- Node.js v24.16.0
