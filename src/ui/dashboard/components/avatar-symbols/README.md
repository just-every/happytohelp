# Profile symbols

24 original outline SVGs for contact avatars. Path definitions live in the three
symbol group modules; `catalog.js` combines them for the React UI.

Use `<ContactAvatar presentation="conversation-profile" contact={contact} />`
inside the conversation workspace. Real photos take precedence. Named contacts
receive a deterministic symbol based on their contact ID. Anonymous visitors
retain their nickname shape, using the new SVG when an exact match exists.

The shared geometry is a 24 × 24 viewBox with rounded 1.8-unit strokes. Tile
colors and sizing live in `_conversation-profile-symbols.scss`.

After editing the definitions, regenerate downloadable assets and the gallery:

```sh
node scripts/export-profile-symbols.mjs
python3 scripts/build-profile-symbol-gallery.py
```

The gallery is served at `/design-assets/profile-symbols/`. Its ZIP contains all
24 SVGs and the JSON catalog. Exported SVGs can be used independently of React.

Keep catalog ordering stable: changing the order or number of entries changes
the deterministic selection for existing contacts.
