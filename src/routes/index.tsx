import { createFileRoute } from '@tanstack/react-router';
import { withVisualEdits } from '../editor/VisualEditBoundary';
import Homepage from '../ui/homepage/Homepage';
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'HappyToHelp — Customer Support, Solved.' },
      { name: 'description', content: 'Free, open-source customer support. Hand a conversation to Codex or Claude on your own computer: it finds the cause, fixes it, confirms it works and writes the reply for your team to send. Chat widget, shared inbox, help centre and AI-suggested replies. MIT licensed, and it runs in your own Cloudflare account.' },
    ],
    links: [{ rel: 'preload', href: '/fonts/outfit/outfit-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' }],
  }),
  component: withVisualEdits(Homepage),
});
