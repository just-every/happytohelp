import { lazyPageCode } from './lazy-page-code';

const conversation = lazyPageCode(() => import('../dashboard/components/Conversation'));
export const Conversation = conversation.Component;
export const preloadConversation = conversation.preload;
