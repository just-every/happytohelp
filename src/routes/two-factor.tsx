import { createFileRoute } from '@tanstack/react-router';
import TwoFactor from '../ui/identity/TwoFactor';
export const Route = createFileRoute('/two-factor')({ component: TwoFactor });
