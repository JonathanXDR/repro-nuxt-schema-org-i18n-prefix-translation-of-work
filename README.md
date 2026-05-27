# Repro: `nuxt-schema-org@6.0.4` `translationOfWork.@id` dangles under i18n `strategy: 'prefix'`

Minimal Nuxt 4 project showing that the schema-org / `@nuxtjs/i18n`
auto-integration emits a `translationOfWork.@id` for every non-default
locale that references the unprefixed `<host>#website` — a node that
does not exist when every locale (including the default) is served at a
prefixed URL under `strategy: 'prefix'`.

## Steps to reproduce

```bash
npm install
npm run generate
npm run inspect:jsonld
```

1. `nuxi generate` prerenders `/de/` and `/en/`.
2. `inspect:jsonld` prints the `application/ld+json` block from each
   prerendered page. The English page's `WebSite` node looks like:

   ```jsonc
   {
     "@id": "https://example.com/en/#website",
     "@type": "WebSite",
     "translationOfWork": {
       "@type": "WebSite",
       "@id": "https://example.com/#website"   // ← dangling
     }
   }
   ```

3. The German page's `WebSite` `@id` is `https://example.com/de/#website`
   and its `workTranslation[0].@id` correctly references
   `https://example.com/en/#website`. The asymmetry — `workTranslation`
   on the default locale uses prefixed `@id`s; `translationOfWork` on
   non-default locales uses the unprefixed default — leaves every
   non-default locale's `translationOfWork` pointing at a node that
   never appears in the graph.

## Expected behaviour

Under `strategy: 'prefix'`, the default locale's `WebSite` `@id` is
prefixed (`<host>/<defaultLocale>/#website`).
`translationOfWork.@id` on every other locale must reference that same
prefixed `@id` so the cross-locale links form a complete graph.

## Actual behaviour

Non-default locales reference `<host>#website` (no prefix), which is
never declared.

## Root cause

`node_modules/nuxt-schema-org/dist/runtime/app/plugins/i18n/defaults.js`:

```js
const resolveIdForLocale = (locale) => {
  if (locale.domain) {
    return resolveSitePath(localePath('index', locale.code), {
      absolute: true,
      siteUrl: hasProtocol(locale.domain, { acceptRelative: false })
        ? locale.domain
        : withHttps(locale.domain),
      trailingSlash: siteConfig.trailingSlash,
      base: nuxtBase,
    })
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
      .map(locale => /* … prefixed @id … */)
  }
}
```

Under `@nuxtjs/i18n` `strategy: 'prefix'`, `localePath('index', '<defaultLocale>')`
returns `/`, *not* `/<defaultLocale>/`, because `@nuxtjs/i18n` treats the
default locale specially in `localePath`. `resolveIdForLocale` therefore
produces the bare-host form for the default locale, and
`translationOfWork.@id` is built from that.

The fix needs to override the resolver for the default locale under
`strategy: 'prefix'` — either by branching on the active i18n strategy
or by reading the actual prefixed URL the module already emits for the
default locale's `WebSite` node.

## Failed user-side workaround

```ts
useSchemaOrg([
  defineWebSite({ inLanguage: () => /* current locale */ }),
])
```

This collapses every locale's `WebSite` `@id` to the unprefixed form,
breaking `@id` uniqueness across locales and turning every
`workTranslation` reference into a dangling one as well. Net regression.

## Related upstream activity

- PR [`harlan-zw/nuxt-schema-org#77`](https://github.com/harlan-zw/nuxt-schema-org/pull/77) —
  *"fix: correct translationOfWork reference"* (merged 2025-02-20).
  Added the auto-emitted `workTranslation` / `translationOfWork` linkage.
  It assumes the default locale is served unprefixed (the
  `prefix_except_default` model), which is correct for that strategy
  but wrong for `strategy: 'prefix'`. The bug reproduced here is the
  residual gap left by #77.

No follow-up issue or PR addresses `strategy: 'prefix'` at the time of
writing.

## Environment

- `nuxt@4.4.6`
- `nuxt-schema-org@6.0.4`
- `@nuxtjs/i18n@10.4.0`
- `typescript@6.0.3`
- Node.js ≥ 20.19
