import React from 'react';
import {PageHeaderTabs} from '../PageHeader';
import {Field} from './forms';
import './project-parity.css';
export function TimezoneField({value,onChange}) {
 const zones=['UTC',...Intl.supportedValuesOf('timeZone')];
 if(value&&!zones.includes(value))zones.unshift(value);
 return <Field name="timezone" label="Timezone" value={value||'UTC'} onChange={onChange} options={zones.map(zone=>({value:zone,label:zone==='UTC'?'(GMT/UTC + 00:00)     GMT':zone.replaceAll('_',' ')}))}/>;
}
export function SettingsTabs({tab,onChange,tabs}) {return <PageHeaderTabs><nav className="project-parity-tabs" aria-label="Settings sections">{tabs.map(([id,label])=><button type="button" key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>onChange(id)}>{label}</button>)}</nav></PageHeaderTabs>;}
export function SettingsIcon({kind='settings'}) {return <span className={`fe fe-${kind} project-settings-icon`} aria-hidden="true"/>;}
