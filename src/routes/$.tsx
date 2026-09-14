import { createFileRoute, notFound } from '@tanstack/react-router';
import Dashboard from '../ui/native/Dashboard';
const dashboardPath = /^\/(?:conversations(?:\/[^/]+)?|projects(?:\/create|\/[^/]+(?:\/(?:conversations(?:\/[^/]+)?|edit|settings|billing|email-settings|widget-settings|github-settings|local-agent|training-runs(?:\/[^/]+)?|insights(?:\/[^/]+)?|(?:ais|macros|contacts|plugins|agents|datasets|articles|categories)(?:\/[^/]+)?))?)?|local-agent\/authorize|users\/[^/]+|admin(?:\/[^/]+(?:\/[^/]+)?)?)\/?$/;
export const Route = createFileRoute('/$')({ beforeLoad: ({ location }) => { if (!dashboardPath.test(location.pathname)) throw notFound(); }, component: Dashboard });
