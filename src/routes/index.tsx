import { createFileRoute } from '@tanstack/react-router';
import { withVisualEdits } from '../editor/VisualEditBoundary';
import Homepage from '../ui/homepage/Homepage';
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'HappyToHelp — Customer Support, Solved.' },
      { name: 'description', content: 'Free and open source customer support: chat widget, shared inbox, help centre and AI-suggested replies with sources. MIT licensed, and it runs in your own Cloudflare account.' },
    ],
    links: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap' }],
  }),
  component: withVisualEdits(Homepage),
});
