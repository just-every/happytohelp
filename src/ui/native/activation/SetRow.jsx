import React from 'react';
import {Link} from '@tanstack/react-router';

/** One thing we have set: label, its value, how sure we are, and the way to change it. */
export default function SetRow({row,projectId}) {
 const [page,pageName,hash]=row.change;
 return <li data-set={row.id} data-state={row.state}>
  <span className="sl-label" data-field="label">{row.label}</span>
  <span className="sl-value" data-field="value">{row.swatch&&<i className="sl-swatch" style={{background:row.swatch}} aria-hidden="true"/>}{row.value}</span>
  <span className={`h2h-chip${row.state==='confirmed'?'':' h2h-chip--muted'}`} data-field="state">{row.state==='confirmed'&&<i className="fe fe-check" aria-hidden="true"/>}{row.stateLabel}</span>
  <Link className="h2h-link" to={`/projects/${projectId}/${page}`} hash={hash} data-field="change" aria-label={`Change ${row.label}, in ${pageName}`}>Change</Link>
 </li>;
}
