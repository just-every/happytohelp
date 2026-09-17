import { createFileRoute } from '@tanstack/react-router';
import { withVisualEdits } from '../editor/VisualEditBoundary';
import Homepage from '../ui/homepage/Homepage';
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'HappyToHelp — Help before they ask.' },
      { name: 'description', content: 'AI customer support that puts your knowledge to work. Explore HappyToHelp, open software for your team.' },
    ],
    links: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap' }],
  }),
  component: withVisualEdits(Homepage),
});
