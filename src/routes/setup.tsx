import { withVisualEdits } from '../editor/VisualEditBoundary';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { loadSetup } from '../ui/identity/loaders';
import Setup from '../ui/native/Setup';

const SetupPage = withVisualEdits(() => <Setup initial={Route.useLoaderData()} />);
export const Route = createFileRoute('/setup')({
    headers: () => ({ 'Cache-Control': 'no-store' }),
    loader: async () => {
        const initial = await loadSetup();
        if (initial.signedIn) throw redirect({ href: '/projects?onboarding=setup', reloadDocument: true, headers: { 'Cache-Control': 'no-store' } });
        return initial;
    },
    component: SetupPage,
});
