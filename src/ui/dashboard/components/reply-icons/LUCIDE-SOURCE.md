# Lucide reply icons

The reply-icon sprite and both catalogues are generated from the official Lucide repository at commit [`2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860`](https://github.com/lucide-icons/lucide/commit/2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860).

Run `node scripts/generate-lucide-reply-icons.mjs` from this repository to regenerate the public sprite, frontend catalogue and glyphs, backend catalogue, and bundled license. The generator validates the source commit before it writes output.

The UI bundles the trusted SVG glyphs with JavaScript so icons render even when
scripts and images are hosted on a separate CDN origin. Model output only selects
an allowed icon name; it never supplies SVG markup.
