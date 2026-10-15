import {createRuntime} from './emitted-runtime.mjs';

// Email-collection journeys need configured delivery, rather than rer dev's
// suppressed local mail. Only the provider HTTP boundary is replaced.
export function createConfiguredMailRuntime() {
    return createRuntime({
        inspectorPort: 0,
        vars: {
            EMAIL_PROVIDER: 'resend',
            EMAIL_API_KEY: 'fixture-mail-provider',
            EMAIL_FROM: 'support@example.test',
        },
        outboundFixture: new URL('./mail-provider-network.mjs', import.meta.url).href,
    });
}
