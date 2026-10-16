import React from 'react';
import moment from 'moment';
/** Date renderer for retained dashboard markup; avoids the old UMD duration plug-in bootstrap. */
export default function Moment({date,children,format,unix=false,className}) {
    const value=unix?moment.unix(Number(date??children)):moment(date??children);
    return <time className={className} dateTime={value.isValid()?value.toISOString():undefined}>{value.isValid()?value.format(format):''}</time>;
}
