import { resolveContactProfilePaletteForContact } from './avatar-symbols';

const TRANSCRIPT_AGENT_TILE = '#b2e2ff';
const TRANSCRIPT_CLAUDE_TILE = '#fff0e9';
const TRANSCRIPT_PHOTO_TILE = '#b2d6fd';
const TRANSCRIPT_CODEX_TILE = 'var(--local-agent-codex-color, #737aff)';

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
