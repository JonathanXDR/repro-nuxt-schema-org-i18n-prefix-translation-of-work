# Repro: `nuxt-schema-org@6.0.4` `translationOfWork.@id` dangles under i18n `strategy: 'prefix'`

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
locale itself, which is a related but distinct bug.

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

Under `@nuxtjs/i18n` `strategy: 'prefix'`,
`localePath('index', '<defaultLocale>')` returns `/`, not
`/<defaultLocale>/`. The resolver therefore produces the bare-host form
for the default locale, even though the `WebSite` node the same module
emits for the default locale is correctly built at the prefixed URL.

The fix needs to override the resolver for the default locale under
`strategy: 'prefix'`, either by branching on the active i18n strategy
or by reading the actual prefixed URL the module already emits for the
default locale's `WebSite` node.

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
