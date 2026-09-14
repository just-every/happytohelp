import { createFileRoute } from '@tanstack/react-router';
import IdentityPage from '../ui/native/IdentityPage';
export const Route=createFileRoute('/verify-email')({component:IdentityPage});
