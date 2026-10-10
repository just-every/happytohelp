import type { CSSProperties } from 'react';

import { Blob } from './Blob';
import { Icon } from './Icons';
import { Drawing, SketchWindow } from './Sketch';
import { Sparks } from './Sparks';

const ticks = Array.from({ length: 10 }, (_, tick) => tick);

// The article import page (ArticleImport) once the import has finished: its progress ticks all filled, the check and
// "complete", and what came across.
export function ImportDrawing() {
  return <Drawing className="import-art" reveal label="Drawing of the help-centre import from Zendesk, complete with 128 articles and 9 categories.">
    <Blob shape="pebble" />
    <SketchWindow className="import-window">
      <div className="import-page">
        <b className="import-title">Import articles from Zendesk</b>
        <div className="import-progress">
          <b>Import progress</b>
          <span className="import-ticks">{ticks.map(tick => <i key={tick} style={{ '--tick': tick } as CSSProperties} />)}</span>
          <p className="import-status"><span className="d-check"><Icon name="check" /></span>complete</p>
          <p className="import-counts">Articles: 128 · Categories: 9</p>
        </div>
      </div>
      <Sparks />
    </SketchWindow>
  </Drawing>;
}
