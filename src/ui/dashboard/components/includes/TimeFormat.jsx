import React from 'react';
import Moment from '../../../native/Moment';
import moment from "moment";
import TimeAgo from "react-timeago";

/*
 * Displays a formatted time in the users local timezone which changes depending how recent the date is
 */
export default function TimeFormat({ date, endDate = false, long = false, className = "" }) {
    const now = moment();
    date = moment(date);
    if(endDate) endDate = moment(endDate);

    let diff = now.diff(date);
    if(now.diff(date) < 0 && now.diff(date, 'seconds') > -20) {
        // If dates are in the near future this is often an issue with server time vs local time. We can resolve this by moving the date to now.
        date = now;
    }

    if(now.diff(date, 'days') < 1) {
        return <TimeAgo date={ date } className={ className } />;
    }

    if(now.diff(date, 'days') < 7 && long) {
        return <Moment format={"MMMM Do (["+date.fromNow()+"])"} className={ className }>{ date }</Moment>;
    }

    if(date.format('YY') === now.format('YY')) {
        if(endDate && endDate.format("MMMM Do") !== date.format("MMMM Do")) {
            return <span className={ className }><Moment format="MMMM Do">{ date }</Moment> - <Moment format="MMMM Do">{ endDate }</Moment></span>;
        }
        return <Moment format="MMMM Do" className={ className }>{ date }</Moment>;
    }

    return <Moment format="MMMM Do, YYYY" className={ className }>{ date }</Moment>;
}
