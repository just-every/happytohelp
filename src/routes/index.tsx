import { createFileRoute } from '@tanstack/react-router';
import { withVisualEdits } from '../editor/VisualEditBoundary';
import Homepage from '../ui/homepage/Homepage';
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'HappyToHelp — Support. Free. Yours.' },
      { name: 'description', content: 'Free, MIT-licensed customer support software with a shared inbox, published knowledge, AI assistance and local agents. Run it and make it yours.' },
    ],
    links: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap' }],
  }),
  component: withVisualEdits(Homepage),
});
