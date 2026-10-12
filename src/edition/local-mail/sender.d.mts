import type {DevelopmentMessage, DevelopmentOutbox} from '../../vendor/base/modules/mail/src/development/index.mjs';
export function createMailSender(config: {provider: 'development'; mode: 'development'}, dependencies: {outbox: DevelopmentOutbox}): {
 send(message: DevelopmentMessage): Promise<{provider: 'development'; status: 'development'; providerMessageId: null}>;
};
