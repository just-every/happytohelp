/** Whether the team is taking conversations now, from the workspace's settings. With the schedule on, the team is
 * available inside its weekly hours in the workspace timezone; with it off, the "Accept new conversations" switch
 * decides. `opensAt` is when a scheduled team is next back (the visitor's expected reply time) and `changesAt` when
 * this answer next changes, so a widget left open can ask again. Times are epoch milliseconds. */
export interface Availability {available:boolean;message:string;scheduled:boolean;timezone:string;opensAt:number|null;changesAt:number|null}

const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
function zone(value:unknown){try{const name=String(value||'UTC');new Intl.DateTimeFormat('en-US',{timeZone:name});return name}catch{return 'UTC'}}
function wall(at:number,timeZone:string){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(at)
 const get=(type:string)=>parts.find(part=>part.type===type)?.value||''
 return {year:Number(get('year')),month:Number(get('month')),day:Number(get('day')),hour:Number(get('hour')),minute:Number(get('minute')),second:Number(get('second')),weekday:weekdays.indexOf(get('weekday'))+1}
}
// The instant a wall-clock time happens in a timezone. A time skipped by a DST change resolves to the hour after it.
function instant(year:number,month:number,day:number,hour:number,minute:number,timeZone:string){
 const target=Date.UTC(year,month-1,day,hour,minute)
 let at=target
 for(let pass=0;pass<2;pass++){const seen=wall(at,timeZone);at+=target-Date.UTC(seen.year,seen.month-1,seen.day,seen.hour,seen.minute,seen.second)}
 return at
}

export function availability(settings:any,now=new Date()):Availability{
 const timezone=zone(settings.timezone),at=now.getTime()
 if(!settings.is_availability_schedule_enabled)return {available:settings.is_available!==false,message:settings.unavailable_message||'',scheduled:false,timezone,opensAt:null,changesAt:null}
 // Days are 1 (Monday) to 7 (Sunday); an imported legacy schedule may name Sunday 0.
 const schedule=settings.availability_schedule||{},days:number[]=Array.isArray(schedule.days)?schedule.days.map((day:unknown)=>Number(day)===0?7:Number(day)):[]
 const message=schedule.message||''
 const valid=/^\d{2}:\d{2}$/.test(schedule.time_from)&&/^\d{2}:\d{2}$/.test(schedule.time_to)&&schedule.time_to>schedule.time_from&&days.length>0
 if(!valid)return {available:false,message,scheduled:true,timezone,opensAt:null,changesAt:null}
 const [fromHour,fromMinute]=schedule.time_from.split(':').map(Number),[toHour,toMinute]=schedule.time_to.split(':').map(Number)
 const today=wall(at,timezone)
 // Today and the next seven days cover every weekly schedule's next opening and closing.
 for(let offset=0;offset<=7;offset++){
  const date=new Date(Date.UTC(today.year,today.month-1,today.day+offset)),weekday=(date.getUTCDay()+6)%7+1
  if(!days.includes(weekday))continue
  const [year,month,day]=[date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate()]
  const opens=instant(year,month,day,fromHour,fromMinute,timezone),closes=instant(year,month,day,toHour,toMinute,timezone)
  if(at<opens)return {available:false,message,scheduled:true,timezone,opensAt:opens,changesAt:opens}
  if(at<closes)return {available:true,message,scheduled:true,timezone,opensAt:null,changesAt:closes}
 }
 return {available:false,message,scheduled:true,timezone,opensAt:null,changesAt:null}
}
