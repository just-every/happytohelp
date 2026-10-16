import {createRuntime} from './emitted-runtime.mjs';

// Email-collection journeys need configured delivery, rather than rer dev's
// suppressed local mail. Only the provider HTTP boundary is replaced.
export function createConfiguredMailRuntime(options = {}) {
    return createRuntime({
        ...options,
        inspectorPort: 0,
        vars: {
            EMAIL_PROVIDER: 'resend',
            EMAIL_API_KEY: 'synthetic-fixture-mail-provider',
            EMAIL_FROM: 'support@example.test',
            ...options.vars,
        },
        outboundFixture: new URL('./mail-provider-network.mjs', import.meta.url).href,
    });
}
