import { withVisualEdits } from '../editor/VisualEditBoundary';
import { createFileRoute } from '@tanstack/react-router';
import Register from '../ui/identity/Register';
export const Route=createFileRoute('/register')({component:withVisualEdits(Register)});
