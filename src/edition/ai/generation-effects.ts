import type { GenerationEffects } from '../../modules/ai-support/generation-effects';
import { publishSuggestions } from '../../modules/ai-support/presentation';
import { notifyMessage } from '../../modules/integrations';

export const generationEffects: GenerationEffects = {
  publishSuggestions,
  async emit(env, generation, event) {
    return env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(generation.conversation_id)).fetch('https://conversation.internal/event', {
      method: 'POST',
      body: JSON.stringify({ ...event, conversationId: generation.conversation_id }),
    });
  },
  async messageCommitted(env, generation, message, actor, duplicate) {
    await Promise.all([generation.conversation_id, `project:${generation.project_id}`].map(key =>
      env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName(key)).fetch('https://conversation.internal/broadcast', { method: 'POST' }),
    ));
    if (!duplicate) await notifyMessage(env, message, actor);
  },
};
