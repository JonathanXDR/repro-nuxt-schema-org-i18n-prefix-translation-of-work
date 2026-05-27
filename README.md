# Repro: `nuxt-schema-org@6.0.4` `translationOfWork.@id` dangles under i18n `strategy: 'prefix'`

Minimal Nuxt 4 project showing that non-default locales emit a `translationOfWork.@id` that points at the *unprefixed* `WebSite` `@id` — a node that does not exist when every locale (including the default) is prefixed.

## What you should see

1. `npm run generate`
2. Open `.output/public/en/index.html` and find the embedded `application/ld+json` block.
3. The English `WebSite` node looks like:

```json
{
  "@id": "https://example.com/en/#website",
  "@type": "WebSite",
  "translationOfWork": { "@id": "https://example.com/#website" }
}
```

But `https://example.com/#website` is never declared — the German `WebSite` node has `@id: "https://example.com/de/#website"`, because `strategy: 'prefix'` prefixes the default locale too. Every non-default locale's `translationOfWork.@id` is a dangling reference.

## Why it fails

`node_modules/nuxt-schema-org/dist/runtime/app/plugins/i18n/defaults.js` — `resolveIdForLocale` builds the *target* `@id` for `translationOfWork` from `<host>#website` (no prefix), assuming the default locale is served at the bare host. Under `strategy: 'prefix'`, the default locale lives at `<host>/<defaultLocale>/`, so the constructed `@id` doesn't match the German node.

The reverse direction is also affected: the default locale's `workTranslation` array references the non-default locales correctly, but its own `@id` is `<host>/de/#website` (prefixed), so each non-default locale's `translationOfWork` should point at that — not at the bare host.

## Failed workaround

Setting `defineWebSite({ inLanguage: ... })` per-locale collapses every locale's `WebSite` `@id` to the unprefixed form, breaking `@id` uniqueness and turning the four valid `workTranslation` references into four dangling ones. Net regression.

## Ask

In `resolveIdForLocale`, honour `i18n.strategy: 'prefix'` for the default locale — prefix the default locale's `@id` the same way every other locale is prefixed.

## Versions

- `nuxt@4.4.6`
- `nuxt-schema-org@6.0.4`
- `@nuxtjs/i18n@10.4.0`
