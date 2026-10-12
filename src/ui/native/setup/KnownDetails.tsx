import { Sparks } from '../../homepage/drawings/Sparks';
import type { SetupDraft } from './draft';

// The pale aqua plate the card floats on, from the owner-chosen design E: a wobbly rounded slab that swells past the card on
// every side. It is stretched to the card's box, so one shape fits every width.
const plate = 'M20 47C35 5 98 14 152 14C233 10 302 -9 408 4C482 7 493 21 563 15C619 11 651 19 658 62L678 174C686 220 668 243 672 286C671 332 665 388 623 393C576 401 561 399 497 407C405 421 346 407 281 410C228 410 192 397 145 400C79 404 34 415 20 377C-4 317 4 263 1 225C-4 181 4 77 20 47Z';

/** What setup already knows, as the draft stands. Edit goes to the workspace step. */
export default function KnownDetails({ draft, onEdit }: { draft: SetupDraft; onEdit: () => void }) {
    return <section className="setup-known" aria-label="Known details">
        <svg className="setup-known-plate" viewBox="0 0 680 409" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d={plate} /></svg>
        <Sparks />
        <header><h2>Known details</h2><button type="button" onClick={onEdit}>Edit</button></header>
        <dl>
            <div><dt>Product</dt><dd>HappyToHelp</dd></div><div><dt>Workspace</dt><dd>{draft.name || 'Not set yet'}</dd></div>
            <div><dt>Your website</dt><dd>{draft.allowedOrigin || 'Not set yet'}</dd></div><div><dt>Workspace address</dt><dd>{typeof location === 'undefined' ? 'Loading…' : location.origin}</dd></div>
        </dl>
        <small>This is where your team signs in. Your customers use the chat widget on your website.</small>
    </section>;
}
