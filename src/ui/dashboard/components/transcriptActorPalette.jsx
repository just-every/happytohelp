import { resolveContactProfilePaletteForContact } from './avatar-symbols';

const TRANSCRIPT_AGENT_TILE = 'var(--d-cyan-tint)';
const TRANSCRIPT_CLAUDE_TILE = 'var(--avatar-blush)';
const TRANSCRIPT_PHOTO_TILE = 'var(--d-cyan-tint)';
const TRANSCRIPT_CODEX_TILE = 'var(--avatar-sage)';

export function resolveTranscriptActorTile(actor, contact) {
    if (actor?.kind === 'contact') {
        if (!contact) return null;
        return contact.avatar_url
            ? TRANSCRIPT_PHOTO_TILE
            : resolveContactProfilePaletteForContact(contact).tile;
    }

    if (actor?.kind === 'agent') return TRANSCRIPT_AGENT_TILE;
    if (actor?.kind === 'local_agent') {
        return actor.entity?.provider === 'claude' ? TRANSCRIPT_CLAUDE_TILE : TRANSCRIPT_CODEX_TILE;
    }

    return null;
}
