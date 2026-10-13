import React,{useId} from 'react';
import {Link} from '@tanstack/react-router';
import useSetup from './useSetup';
import NeedItem from './NeedItem';
import SkippedRow from './SkippedRow';
import SetRow from './SetRow';
import {lastLooked,needs as needsOf,setRows,skipped as skippedOf,utc} from './setup-model';
import './setup-list.css';

const numberWords=['No','One','Two','Three','Four','Five','Six','Seven','Eight'];
const lede=(count,left)=>count===0?left?'We’ve set up what we can. What you skipped waits below until you want it, and everything we’ve set is listed too, so you can change any of it.':'We’ve set up what we can. Everything is listed below, and you can change any of it.'
 :count===1?'We’ve set up what we can. One thing needs you, because it lives in another service or on your website. Everything else is listed below, and you can change any of it.'
 :`We’ve set up what we can. ${numberWords[count]||count} things need you, because they live in other services or on your website. Everything else is listed below, and you can change any of it.`;

/** The setup list: what only the owner can do, what they left for now, then everything we have set. */
export default function SetupList({projectId,role}) {
 const {data,error,checkAgain,busy,skip,skipBusy}=useSetup(projectId),needsId=useId(),skippedId=useId(),setId=useId();
 if(!data)return <section className="setup-list" data-testid="setup-list" aria-busy={!error}>{error?<p role="alert">{error}</p>:<p className="sl-quiet" role="status">Looking at your setup…</p>}</section>;
 const needs=needsOf(data),left=skippedOf(data),rows=setRows(data),looked=lastLooked(data),local=data.environment==='local';
 const confirmed=data.done,applicable=data.applicableTotal;
 return <section className="setup-list" data-testid="setup-list" data-confirmed={confirmed} data-applicable={applicable} data-environment={data.environment}>
  <header className="sl-head">
   <p className="sl-lede">{lede(needs.length,left.length>0)}</p>
   <p className="sl-quiet" role="status"><span className="sl-dots" aria-hidden="true">{Array.from({length:applicable},(_,index)=><i key={index} className={index<confirmed?'on':undefined}/>)}</span><span>{confirmed} of {applicable} confirmed. We check on our own, so there’s nothing to press.{looked&&<> Last looked at <time dateTime={looked}>{utc(looked)}</time>.</>}</span></p>
   {local&&<p className="sl-local" data-local-only>This is a local trial. Emails land in your local outbox, and AI is optional.</p>}
   {error&&<p role="alert" className="sl-error">{error}</p>}
  </header>
  <section className="sl-section" data-section="needs-you" aria-labelledby={needsId}>
   <div className="sl-title"><h2 id={needsId}>Needs you</h2>{needs.length>0&&<span className="h2h-count" data-count aria-label={`${needs.length} ${needs.length===1?'item':'items'}`}>{needs.length}</span>}</div>
   {needs.length>0?<ol className="sl-needs">{needs.map(item=><NeedItem key={item.id} {...{data,item,projectId}} onSkip={skip} skipBusy={skipBusy}/>)}</ol>
    :<div className="sl-empty"><p data-empty>Nothing needs you right now.</p><p>We’ll tell you here if anything changes.</p></div>}
  </section>
  {left.length>0&&<section className="sl-section" data-section="skipped" aria-labelledby={skippedId}>
    <div className="sl-title"><h2 id={skippedId}>Skipped</h2></div>
    <ul className="sl-skipped">{left.map(item=><SkippedRow key={item.id} {...{data,item,projectId}} onUndo={skip} skipBusy={skipBusy}/>)}</ul>
   </section>}
   <section className="sl-section" data-section="set" aria-labelledby={setId}>
    <div className="sl-title"><h2 id={setId}>What we’ve set</h2></div>
    <ul className="sl-set">{rows.map(row=><SetRow key={row.id} {...{row,projectId}}/>)}</ul>
   </section>
   <footer className="sl-foot">
    {['owner','admin'].includes(role)&&<p><Link className="h2h-link" to={`/projects/${projectId}/move-in`}>Move in your existing support history</Link> <span>(optional)</span></p>}
    <button type="button" className="activation-text-action" data-again disabled={busy} onClick={checkAgain}>Check again</button>
   </footer>
 </section>;
}
