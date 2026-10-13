import React from 'react';
import {needContent} from './need-content';

/** Something the owner chose to leave for now: what it is, a muted chip that is never "Confirmed", and the way back. */
export default function SkippedRow({data,item,projectId,onUndo,skipBusy}) {
 const content=needContent({data,item,projectId,local:data.environment==='local'});
 if(!content)return null;
 return <li data-skipped={item.id}>
  <span className="sl-label" data-field="label">{content.title}</span>
  <span className="h2h-chip h2h-chip--muted" data-field="state">Skipped</span>
  <button type="button" className="activation-text-action sl-undo" data-undo disabled={skipBusy} aria-label={`Undo skip: ${content.title}`} onClick={()=>onUndo(item.id,false)}>Undo</button>
 </li>;
}
