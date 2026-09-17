import { Hero } from './Hero';
import { HomepageIcons } from './HomepageIcons';
import { FeaturesSection } from './FeaturesSection';
import { WatchSection } from './WatchSection';
import { AgentsSection } from './AgentsSection';
import { OpenSourceSection } from './OpenSourceSection';
import { HomepageFooter } from './HomepageFooter';
import './landing.css';
import './home.css';
import './home-components.css';
import './home-agents.css';
import './home-maps.css';
import './native.css';

export default function Homepage() {
  return <div className="h2h-homepage"><HomepageIcons /><a className="skip-link" href="#features">Skip to features</a><Hero /><FeaturesSection /><WatchSection /><AgentsSection /><OpenSourceSection /><HomepageFooter /></div>;
}
