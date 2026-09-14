import React from 'react';
import moment from 'moment-timezone';
/** Date renderer for retained dashboard markup; avoids the old UMD duration plug-in bootstrap. */
export default function Moment({date,children,format,unix=false,tz,className}) {
    let value=unix?moment.unix(Number(date??children)):moment(date??children);
    if(tz)value=value.tz(tz);
    return <time className={className} dateTime={value.isValid()?value.toISOString():undefined}>{value.isValid()?value.format(format):''}</time>;
}
