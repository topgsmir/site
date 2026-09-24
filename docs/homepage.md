# Homepage and content editor

The storefront homepage keeps the reference site's main elements: stories, search, service shortcuts, promotional collections, selected tools, experts, reasons to choose Top GSM, latest products, and footer links. The layout supports Persian and Arabic RTL, English LTR, small screens, dark mode, keyboard navigation, and reduced motion.

## Editing

Open **Admin → Settings → Homepage** (`/fa/admin/settings/homepage`). Choose the content language, edit a section, and select **Save & publish**. Each language has independent content.

- Edit hero text, buttons, imagery, and accessible image description.
- Add, remove, reorder, and edit shortcut, collection, and offer cards.
- Show or hide collections, offers, experts, benefits, and latest products.
- Edit section headings, benefits, and footer links.
- Upload JPEG, PNG, or WebP images up to 5 MB, or choose bundled imagery.
- Restore defaults into the form; this only publishes after saving.

Stories retain their dedicated **Settings → Stories** editor. Product titles, prices, images, and publication status come from product management; expert details come from active seller profiles. The homepage editor changes those sections' headings and visibility. Global navigation and interface labels remain application translations.

The public route reads saved content without caching. Until a language is saved, it uses its localized defaults. Saves include an expected version, so concurrent edits return a conflict instead of overwriting another administrator's work. The editor warns before linked navigation and browser unload with unsaved edits.

## Storage and deployment

`20260924160000_homepage_content` creates the per-language document, version, and editor reference. Deploy this migration with the matching API. Review other pending migrations before running the repository-wide migration command; catalog changes have their own [maintenance deployment instructions](catalog-migration.md).

Uploaded images live in `MEDIA_ROOT/homepage` and need the same persistent storage and backup coverage as product media. Uploads are decoded, dimension-limited, stripped of metadata, and re-encoded as immutable WebP assets. They are public site content, so do not upload confidential files. Replaced and abandoned images are retained; no automatic garbage collection is installed.

Administrative reads, writes, and uploads require platform administrator access. Mutations use the existing browser-origin/CSRF controls and rate limits. Content permits same-origin relative links, page anchors, or HTTPS destinations, with a restricted local image namespace.

## Verification

Run with the repository's pinned Node and pnpm versions:

```powershell
pnpm run doctor
pnpm --filter topgsm-api run build
pnpm --filter topgsm-api exec node --test dist/modules/homepage/homepage.spec.js
node scripts/test-homepage-database.mjs
pnpm --filter topgsm-api exec eslint src/modules/homepage --max-warnings=0
pnpm --filter topgsm-web run type-check
```

The database runner creates a disposable database on local PostgreSQL, applies migrations, checks persistence, concurrent updates and database constraints, then drops only that test database. It does not migrate the application database. Browser verification covered the public page at 320, 375, 414, 768 and 1440 pixels, search navigation, administrator editing and uploads, per-language persistence, section visibility, and unauthorized mutation rejection.

## Image provenance

New generated artwork is stored in `apps/web/public/images/home/`: `firmware.webp`, `hardware.webp`, and `remote.webp`. Direction: premium editorial product photography on an off-white studio surface, restrained shadows, no text or logos. Subjects respectively depict a smartphone with a precision screwdriver; a phone motherboard, memory chips and tweezers; and a modem beside a smartphone. These are illustrative images, not photographs of inventory. The editor can replace each one.
