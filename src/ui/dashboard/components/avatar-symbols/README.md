# Profile symbols

24 original, first-party outline SVGs for contact avatars (MIT, like the rest of
the repository). Path definitions live in the three
symbol group modules; `catalog.jsx` combines them for the React UI.

Use `<ContactAvatar presentation="conversation-profile" contact={contact} />`
inside the conversation workspace. Real photos take precedence. Named contacts
receive a deterministic symbol based on their contact ID. Anonymous visitors
retain their nickname shape, using the new SVG when an exact match exists.

The shared geometry is a 24 × 24 viewBox with rounded 1.8-unit strokes. Tile
colors and sizing live in `_conversation-profile-symbols.scss`.

Keep catalog ordering stable: changing the order or number of entries changes
the deterministic selection for existing contacts.
