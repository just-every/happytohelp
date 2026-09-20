import { createFileRoute } from '@tanstack/react-router';
import { withVisualEdits } from '../editor/VisualEditBoundary';
import Homepage from '../ui/homepage/Homepage';
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'HappyToHelp — Support is here.' },
      { name: 'description', content: 'AI customer support that puts your knowledge to work. Explore HappyToHelp, open software for your team.' },
    ],
    links: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Geist:wght@700;900&family=Inter:wght@400;500;600;700;900&display=swap' }],
  }),
  component: withVisualEdits(Homepage),
});
