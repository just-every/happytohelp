import { withVisualEdits } from '../editor/VisualEditBoundary';
import { createFileRoute } from '@tanstack/react-router';
import Login from '../ui/native/Login';
export const Route=createFileRoute('/login')({component:withVisualEdits(Login)});
