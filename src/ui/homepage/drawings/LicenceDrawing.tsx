import type { CSSProperties } from 'react';

import { Blob } from './Blob';
import { Icon } from './Icons';
import { Drawing, SketchWindow } from './Sketch';
import { Sparks } from './Sparks';

// The code behind the licence, as an editor of wordless lines: each row is a line-number stub and a few runs of code, the
// odd runs in aqua. Widths are percentages of the row.
const code = [[18, 9, 30], [6, 26, 14], [6, 12, 34], [12, 20, 10, 16], [6, 30], [18, 14, 22], [6, 10]];

// The real LICENSE file, drawn as an ink card over the code it licenses: its title, the grant of permission "free of
// charge" and the rights it gives, both picked out in aqua.
export function LicenceDrawing() {
  return <Drawing className="licence-art" reveal label="Drawing of the MIT licence: permission is granted, free of charge, to use, copy, modify, merge, publish and distribute HappyToHelp.">
    <Blob shape="left" />
    <SketchWindow className="licence-editor">
      <div className="code-lines">{code.map((runs, row) => <span className="code-line" key={row} style={{ '--row': row } as CSSProperties}>
        <i className="code-number" />{runs.map((width, run) => <i key={run} className={run % 2 ? 'code-run is-aqua' : 'code-run'} style={{ width: `${width}%` }} />)}
      </span>)}</div>
    </SketchWindow>
    <div className="d-card licence-card">
      <b className="licence-title"><Icon name="doc" />MIT License</b>
      <p className="licence-line">Permission is hereby granted, <span className="licence-mark d-sweep">free of charge</span>,</p>
      <i className="sk-line w90" /><i className="sk-line w60" />
      <p className="licence-line licence-rights"><span className="licence-grant d-sweep">use, copy, modify, merge, publish, distribute</span><span className="d-check"><Icon name="check" /></span></p>
      <Sparks />
    </div>
  </Drawing>;
}
