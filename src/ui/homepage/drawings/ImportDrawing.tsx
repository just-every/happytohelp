import { Icon } from './Icons';
import { Drawing, SketchMarks } from './Sketch';

const helpdesks = ['Zendesk', 'Intercom', 'Freshdesk'];

// The article import page (ArticleImport) in its two states: choosing a helpdesk, then the form and the finished
// import's progress. The back window is the choice step; the front window is the form after the import has run.
export function ImportDrawing() {
  return <Drawing className="import-art" label="Drawing of the help-centre import: Zendesk is chosen from Zendesk, Intercom and Freshdesk, the subdomain northwind is entered, and the import is complete with 128 articles and 9 categories.">
    <SketchMarks variant="spark" />
    <div className="import-stack">
      <div className="d-window import-back">
        <p>Please choose which helpdesk you would like to import help articles from.</p>
        <div className="import-choices">
          {helpdesks.map(name => <span key={name} className={name === 'Zendesk' ? 'd-btn d-btn--chosen' : 'd-btn'}>{name}{name === 'Zendesk' && <Icon name="check" />}</span>)}
        </div>
      </div>
      <div className="d-window import-front">
        <span className="import-back-link">‹ Choose another helpdesk</span>
        <b className="import-title">Import articles from Zendesk</b>
        <p className="import-note">Import uses this installation’s configured zendesk credentials. Account credentials cannot be entered here.</p>
        <div className="import-field"><span>Subdomain</span><span className="import-input">northwind</span></div>
        <span className="d-btn d-btn--off">Import</span>
        <div className="import-progress">
          <b>Import progress</b>
          <p>complete</p>
          <p>Articles: 128 · Categories: 9</p>
          <span className="d-btn">Refresh status</span>
        </div>
      </div>
    </div>
  </Drawing>;
}
