import React from 'react';
import {PageHeaderTabs} from '../PageHeader';
import {Field} from './forms';
import './project-parity.css';
export function TimezoneField({value,onChange}) {
 const zones=['UTC',...Intl.supportedValuesOf('timeZone')];
 if(value&&!zones.includes(value))zones.unshift(value);
 return <Field name="timezone" label="Timezone" value={value||'UTC'} onChange={onChange} options={zones.map(zone=>({value:zone,label:zone==='UTC'?'(GMT/UTC + 00:00)     GMT':zone.replaceAll('_',' ')}))}/>;
}
// The tabs rail; `aside` is a text link at its right end (under the tabs on a phone).
export function SettingsTabs({tab,onChange,tabs,aside}) {return <PageHeaderTabs><div className="workspace-tabs-rail"><nav className="project-parity-tabs" aria-label="Settings sections">{tabs.map(([id,label])=><button type="button" key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>onChange(id)}>{label}</button>)}</nav>{aside}</div></PageHeaderTabs>;}
