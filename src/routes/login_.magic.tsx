import { createFileRoute } from '@tanstack/react-router';
import MagicLogin from '../ui/identity/MagicLogin';
export const Route = createFileRoute('/login_/magic')({ component: MagicLogin });
