import { withVisualEdits } from '../editor/VisualEditBoundary';
import { createFileRoute } from '@tanstack/react-router';
import VerifyEmail from '../ui/identity/VerifyEmail';
export const Route=createFileRoute('/verify-email')({component:withVisualEdits(VerifyEmail)});
