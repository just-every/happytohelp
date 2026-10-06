import { Icon } from './Icons';
import { Drawing, SketchMarks } from './Sketch';

// The real LICENSE file, drawn as a paper card: its title, the grant of permission "free of charge" and the rights it gives.
export function LicenceDrawing() {
  return <Drawing className="licence-art" label="Drawing of the MIT licence: permission is granted, free of charge, to use, copy, modify, merge, publish and distribute HappyToHelp.">
    <SketchMarks variant="sparkle" />
    <div className="d-window licence-card">
      <b className="licence-title">MIT License</b>
      <p className="licence-line">Permission is hereby granted, <span className="licence-mark">free of charge</span>,</p>
      <i className="sk-line w90" /><i className="sk-line w70" /><i className="sk-line w60" />
      <p className="licence-line licence-rights">use, copy, modify, merge, publish, distribute<Icon name="check" /></p>
      <i className="sk-line w90" /><i className="sk-line w50" />
    </div>
  </Drawing>;
}
