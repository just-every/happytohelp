import type { Actor, Env } from '../../platform/env';
import type { Generation } from './repository';

/** Edition delivery effects; durable generation/admission decisions stay in the engine. */
export interface GenerationEffects {
  emit(env: Env, generation: Generation, event: Record<string, unknown>): Promise<unknown>;
  publishSuggestions(env: Env, projectId: string, conversationId: string): Promise<unknown>;
  messageCommitted(env: Env, generation: Generation, message: Record<string, unknown>, actor: Actor, duplicate: boolean): Promise<void>;
}

export function requireGenerationEffects(effects: GenerationEffects): void {
  if (!effects || ['emit', 'publishSuggestions', 'messageCommitted'].some(key => typeof effects[key as keyof GenerationEffects] !== 'function')) {
    throw new TypeError('AI generation requires an explicit effects adapter');
  }
}
