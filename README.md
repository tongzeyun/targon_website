# Targon Website

Minimal Next.js structure for the redesigned Targon website. The Chinese and English pages are placeholders; Smart Eye currently has an empty, non-indexable page and no business code.

## Shared website UI

The common styles from the [Figma website frame](https://www.figma.com/design/xLiuFaodvsrCCzvlkHB7R0/%E5%AE%98%E7%BD%91--Copy-?node-id=527-225) live in `src/app/globals.css`: color, font, container, radius, section title, card, and button rules. Header and footer styles live beside their components in `src/components/`. Both use `public/image/logo.svg`; the language switch preserves the current page path. The bilingual website layout uses these components; the Smart Eye placeholder has its own layout. Page content remains a placeholder.

The design names Inter and Source Han Sans SC. The CSS uses system fallbacks until font assets and licensing are confirmed. The Figma frame is desktop-first; the shared components have basic narrow-screen behavior, while page-specific responsive designs remain to be implemented.

The global scrollbar matches the previous website. `site-fade-in` and `site-fade-out` are optional pure CSS classes for text and images. They animate when the class is applied, with a 600 ms default duration; set `--site-fade-duration` to override it. No animation package or page-level effect has been added. Scroll-triggered effects still need a trigger when specific pages are built.

## Local development

```bash
npm install
npm run dev
```

Open `/zh`, `/en`, or `/smart-eye`. The root URL temporarily redirects according to `SITE_DEFAULT_LOCALE` (`zh` by default).

## Regional deployment

Deploy the same build to both servers. Set `SITE_DEFAULT_LOCALE=zh` on the China server and `SITE_DEFAULT_LOCALE=en` on the Singapore server. The Aliyun DNS regional records select the server; every server serves both language paths. Keep `/zh` and `/en` directly accessible from either region.

Before publishing the redesigned pages, replace the placeholders and their temporary `noindex` metadata, then add page-specific metadata, reciprocal `hreflang`, sitemap, and legacy URL handling. Smart Eye remains `noindex` until its later migration.
