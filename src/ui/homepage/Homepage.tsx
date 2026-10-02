import { Free } from './Free';
import { Hero } from './Hero';
import { HelpBeforeTheyAsk } from './HelpBeforeTheyAsk';
import { MoveIn } from './MoveIn';
import { Product } from './Product';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { YoursToRun } from './YoursToRun';
import './outfit.css';
import './homepage.css';
import './drawings.css';

export default function Homepage() {
  return <div className="h2h-home">
    <a className="skip-link" href="#product">Skip to the product</a>
    <SiteHeader />
    <main><Hero /><Free /><HelpBeforeTheyAsk /><Product /><MoveIn /><YoursToRun /></main>
    <SiteFooter />
  </div>;
}
