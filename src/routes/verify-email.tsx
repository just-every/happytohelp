import { withVisualEdits } from '../editor/VisualEditBoundary';
import { createFileRoute } from '@tanstack/react-router';
import IdentityPage from '../ui/native/IdentityPage';
export const Route=createFileRoute('/verify-email')({component:withVisualEdits(IdentityPage)});
