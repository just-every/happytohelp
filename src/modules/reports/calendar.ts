import {HTTPException} from 'hono/http-exception'
export function validTimezone(value:unknown):value is string {if(typeof value!=='string'||!value||value.length>100||!/^([A-Za-z_]+)(\/[A-Za-z0-9_+.-]+)*$/.test(value))return false;try{new Intl.DateTimeFormat('en',{timeZone:value});return true}catch{return false}}
const formatter=(timezone:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'})
function dateWith(timestamp:number,format:Intl.DateTimeFormat){const parts=format.formatToParts(timestamp);return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-')}
export function calendarDate(timestamp:number,timezone:string){return dateWith(timestamp,formatter(timezone))}
function checkedDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new HTTPException(400,{message:'Use a valid YYYY-MM-DD calendar date'});return value}
export function addDays(date:string,days:number){return new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10)}
/** First instant on or after a local calendar date. Binary search avoids assuming
 * a 24-hour local day or a representable midnight at daylight-saving changes. */
export function calendarBoundary(date:string,timezone:string){checkedDate(date);const target=Date.parse(date),format=formatter(timezone);let low=target-2*86400000,high=target+2*86400000;while(low<high){const mid=low+Math.floor((high-low)/2);if(dateWith(mid,format)<date)low=mid+1;else high=mid}return low}
export function reportRange(query:Record<string,string>,timezone:string,now=Date.now()){
 const period=query.period||'30';let start:string,end:string
 if(period==='custom'){start=checkedDate(query.start||'');end=checkedDate(query.end||'')}else{if(!['7','30','90'].includes(period))throw new HTTPException(400,{message:'Choose 7, 30, 90 days or a custom range'});end=addDays(calendarDate(now,timezone),1);start=addDays(end,-Number(period))}
 const days=(Date.parse(end)-Date.parse(start))/86400000;if(days<1||days>366)throw new HTTPException(400,{message:'Choose a range of 1 to 366 days; the end date is exclusive'})
 return {period,start,end,timezone,startAt:calendarBoundary(start,timezone),endAt:calendarBoundary(end,timezone),days}
}
export type ReportRange=ReturnType<typeof reportRange>
