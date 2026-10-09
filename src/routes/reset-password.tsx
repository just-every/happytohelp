import { withVisualEdits } from '../editor/VisualEditBoundary';
import { createFileRoute } from '@tanstack/react-router';
import ResetPassword from '../ui/identity/ResetPassword';
export const Route=createFileRoute('/reset-password')({component:withVisualEdits(ResetPassword)});
