# Figma to Contentful Sync

A Figma Design plugin that turns a selected page section into a draft Contentful entry tree. It reads nested component instances, maps them to Contentful content types, uploads detected image fills as assets, and preserves parent/child entry links.

## What it does

- Analyzes one selected Figma **frame** or **section**.
- Uses component and component-set names as Contentful content type IDs (for example, `Hero/Default` becomes `hero`).
- Extracts visible text layers and maps them to compatible `Symbol` and `Text` fields.
- Creates child entries first, then links them through entry-array fields.
- Exports image fills as PNGs and creates draft Contentful assets when the content type has an Asset field.
- Creates a draft page entry that links the top-level component entries.
- Lets you override unmatched component-to-content-type mappings before syncing.

All entries and assets remain drafts; the plugin does not publish Contentful content.

## Requirements

- Node.js 18 or later.
- A Figma Design file with a frame or section containing component instances.
- A Contentful space, environment, and Content Management API token with permission to create entries and assets.
- Content types whose IDs match your Figma component names, or mappings selected in the plugin UI.

## Install and run locally

```sh
npm install
npm run build
```

In Figma, open **Plugins → Development → Import plugin from manifest…** and select `manifest.json` from this project.

For active development, run:

```sh
npm run watch
```

Figma loads `code.js`, which the watcher rebuilds when `code.ts` or `ui.html` changes. Reload the plugin in Figma after a rebuild.

## UI preview

The Figma canvas API can only run inside Figma, but the plugin interface can be previewed with mocked selection and analysis data:

```sh
npm run preview
```

Open the localhost URL printed by the command. Contentful synchronization is intentionally unavailable in this preview.

## Contentful mapping notes

- Component text is matched to Contentful fields by layer/field name first, then by remaining text order.
- The Contentful display field receives the component instance name.
- A content type needs an `Array` of `Entry` links to receive child entries.
- A content type needs an `Asset` link field to receive a detected image fill.
- The configured page content type (default: `page`) receives top-level entries.

## Security

The Management API token is stored in Figma's per-user plugin storage. Use a least-privilege token and rotate it if it is exposed. Do not add credentials or `.env` files to this repository.

## Theme support

The plugin uses Figma's `themeColors` API and semantic CSS variables, so its UI automatically follows Figma Design’s light and dark themes.

## Validation

```sh
npm run check
npm run build
```
