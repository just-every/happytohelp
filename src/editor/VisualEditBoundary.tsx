import { useEffect, type ComponentType } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { setLiveEditsReady } from './live-edit-runtime';

/** Resume only after the actual leaf commits, including reused wildcard routes. */
export function withVisualEdits(Component: ComponentType) {
  return function VisualEditBoundary() {
    const href = useRouterState({ select: state => state.location.href });
    useEffect(() => { setLiveEditsReady(true); }, [href]);
    return <Component />;
  };
}
