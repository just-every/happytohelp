import { Drawing } from './Drawing';

/** An empty tray: no conversation matches the view. */
export function InboxTray() {
  return <Drawing name="inbox-tray" blob="left" sparksAt={[150, 22]}>
    <path className="h2h-drawing-fill" pathLength={1} d="M62 76 77 46C78 44 80 43 82 43H138C140 43 142 44 143 46L158 76V101C158 106 155 109 150 109H70C65 109 62 106 62 101Z" />
    <path pathLength={1} d="M62 76H89C91 86 97 91 110 91 123 91 129 86 131 76H158" />
  </Drawing>;
}
