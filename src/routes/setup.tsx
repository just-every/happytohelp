import { withVisualEdits } from '../editor/VisualEditBoundary';
import { createFileRoute } from '@tanstack/react-router';
import Setup from '../ui/native/Setup';
export const Route=createFileRoute('/setup')({component:withVisualEdits(Setup)});
