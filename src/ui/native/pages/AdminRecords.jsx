import { Link } from '@tanstack/react-router';
import React from 'react';
export const adminTitles={users:'Users',projects:'Projects',datasets:'Datasets',connections:'Connections',ai_logs:'AI Logs',ai_defaults:'AI Defaults',leads:'Leads'};
const columns={
 users:[['Name','name'],['Email','email'],['Timezone','timezone'],['Last Login','last_login_at'],['Created','created_at']],
 projects:[['Name','name'],['AI Cost','ai_cost'],['AI Balance','ai_balance'],['Connections','connections_count'],['Contacts','contacts_count'],['Insights','insights_count'],['Proxy Requests','proxy_requests_count'],['Created','created_at']],
 datasets:[['URL','url'],['External ID','external_id'],['Project','project_id'],['Status','status'],['Pages','pages_count'],['Created','created_at']],
 connections:[['Name','name'],['Project','project_id'],['Status','status'],['Created','created_at'],['Updated','updated_at']],
 ai_logs:[['Project','project_id'],['Model','model'],['Response','status'],['Tokens','tokens'],['Cost','cost'],['Created','created_at']],
 ai_defaults:[['Role','role'],['Name','name']],
 leads:[['Website','website'],['Email','email'],['Name','name'],['Status','status'],['Created','created_at']],
};
function display(value,key){if(value===null||value===undefined||value==='')return '—';if(key.endsWith('_at')){const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString();}return String(value);}
export function AdminRecords({section,items}){
 return <div className="table-responsive"><table className="table table-sm table-hover card-table"><thead><tr>{columns[section]?.map(([label,key])=><th key={key}>{label}</th>)}</tr></thead><tbody className="list fs-base">{items?.map(item=><tr key={item.id}>{columns[section]?.map(([label,key],index)=><td key={key}>{index===0?<><Link to={`/admin/${section}/${item.id}`}>{display(item[key],key)}</Link>{section==='projects'&&item.website&&<><br/><small>{item.website}</small></>}</>:display(item[key],key)}</td>)}</tr>)}</tbody></table></div>;
}
const detailFields=[['ID','id'],['Name','name'],['Email','email'],['Timezone','timezone'],['Website','website'],['URL','url'],['External ID','external_id'],['Project ID','project_id'],['Status','status'],['Model','model'],['Created','created_at'],['Updated','updated_at'],['Last Login','last_login_at']];
export function AdminRecordDetails({record}){
 return <dl className="row mb-0">{detailFields.filter(([,key])=>record[key]!==undefined).map(([label,key])=><React.Fragment key={key}><dt className="col-sm-3">{label}</dt><dd className="col-sm-9 text-break">{display(record[key],key)}</dd></React.Fragment>)}</dl>;
}
