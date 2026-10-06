import { Icon } from './Icons';
import { Drawing, SketchMarks, SketchWindow } from './Sketch';

// The article import page (ArticleImport) once the import has finished.
export function ImportDrawing() {
  return <Drawing className="import-art" label="Drawing of the help-centre import from Zendesk, complete with 128 articles and 9 categories.">
    <SketchMarks variant="spark" />
    <SketchWindow>
      <div className="import-page">
        <b className="import-title">Import articles from Zendesk</b>
        <div className="import-progress">
          <b>Import progress</b>
          <p className="import-status"><span className="d-check"><Icon name="check" /></span>complete</p>
          <p>Articles: 128 · Categories: 9</p>
        </div>
      </div>
    </SketchWindow>
  </Drawing>;
}
