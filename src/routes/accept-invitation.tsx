import { withVisualEdits } from '../editor/VisualEditBoundary';
import { createFileRoute } from '@tanstack/react-router';
import AcceptInvitation from '../ui/identity/AcceptInvitation';
export const Route=createFileRoute('/accept-invitation')({component:withVisualEdits(AcceptInvitation)});
