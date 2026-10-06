import { withVisualEdits } from '../editor/VisualEditBoundary';
import { createFileRoute } from '@tanstack/react-router';
import ForgotPassword from '../ui/identity/ForgotPassword';
export const Route=createFileRoute('/forgot-password')({component:withVisualEdits(ForgotPassword)});
