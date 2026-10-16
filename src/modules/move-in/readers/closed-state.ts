import {time} from './common'
/** A conversation solved or closed in its source lands closed. Its closing time is the source's own
 * when the export records one; otherwise the source's last update, and the review says so. */
export function closedAt(recorded:unknown[],lastUpdate:unknown,omissions:string[],format:'iso'|'unix'='iso'):number{
 for(const value of recorded)if(value!=null)try{return time(value,format)}catch{}
 omissions.push('closed_in_source_closing_time_is_last_update')
 return time(lastUpdate,format)
}
