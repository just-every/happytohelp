import { withVisualEdits } from '../editor/VisualEditBoundary';
import { createFileRoute } from '@tanstack/react-router';
import IdentityPage from '../ui/native/IdentityPage';
export const Route=createFileRoute('/accept-invitation')({component:withVisualEdits(IdentityPage)});
