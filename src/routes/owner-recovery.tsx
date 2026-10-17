import { createFileRoute } from '@tanstack/react-router';
import OwnerRecovery from '../ui/identity/OwnerRecovery';
export const Route = createFileRoute('/owner-recovery')({ component: OwnerRecovery });
