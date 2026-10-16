import React, { useEffect, useState } from 'react';
import { Field, Section } from './forms';
import { availability } from '../../../modules/management/availability';
import { backAt } from '../../../modules/widget/availability-text.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// What visitors see right now with these settings, saved or not, as the widget will show it.
function AvailabilityNow({ data }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
    const state = availability(data, new Date(now)), zone = state.timezone.replaceAll('_', ' ');
    const away = state.opensAt ? `Away. Back ${backAt(state.opensAt, { timeZone: state.timezone, now, withZone: true })}.` : state.scheduled ? 'Away. Choose days and an opening time before the closing time.' : 'Away until you turn “Accept new conversations” back on.';
    return <p className={`availability-now${state.available ? ' availability-now--open' : ' availability-now--away'}`} role="status">
        <strong>Right now:</strong> {state.available ? 'Available.' : away}{state.scheduled && <> Hours are in {zone}; change the timezone on the General tab.</>}
    </p>;
}

export default function AvailabilitySettings({ data, change, field }) {
    const schedule = data.availability_schedule || {}, scheduleChange = (key, value) => change('availability_schedule', { ...schedule, [key]: value });
    return <>
        <Section title="When your team is away" description="Outside your hours, or with “Accept new conversations” off, the chat widget says your team is away, shows when you are back, and asks for the visitor’s email so your reply reaches them. Their conversation still reaches your inbox, and the away message below is posted once in it. An AI assistant that answers visitors keeps answering.">
            <AvailabilityNow data={data} />
        </Section>
        <Section title="Schedule">
            {field('is_availability_schedule_enabled', 'Use opening hours', 'checkbox')}
            <label className="form-label">Days</label>
            <div className="project-days">{DAYS.map((day, i) => <label key={day}><input type="checkbox" checked={(schedule.days || []).includes(i + 1)} onChange={e => scheduleChange('days', e.target.checked ? [...(schedule.days || []), i + 1] : (schedule.days || []).filter(v => v !== i + 1))} />{day}</label>)}</div>
            <label className="form-label" htmlFor="schedule-from">Hours</label>
            <div className="project-hours"><input id="schedule-from" aria-label="Opening time" className="form-control" type="time" value={schedule.time_from || ''} onChange={e => scheduleChange('time_from', e.target.value)} /><span>to</span><input aria-label="Closing time" className="form-control" type="time" value={schedule.time_to || ''} onChange={e => scheduleChange('time_to', e.target.value)} /></div>
            <Field name="schedule-message" label="Away message outside hours" type="textarea" rows={3} value={schedule.message || ''} onChange={(_, value) => scheduleChange('message', value)} hint="Posted once in a conversation that starts outside your hours. Leave it empty to say you are away, when you are back, and that you will reply by email." />
        </Section>
        <details><summary>Without opening hours</summary>
            <Field name="is_available" label="Accept new conversations" type="checkbox" value={data.is_available !== false} onChange={change} hint="Turn this off when nobody can answer for a while. Visitors are told your team is away; conversations still arrive." />
            <Field name="unavailable_message" label="Away message while new conversations are off" type="textarea" rows={3} value={data.unavailable_message || ''} onChange={change} hint="Posted once in a conversation that starts while new conversations are off. Leave it empty for a standard message." />
        </details>
    </>;
}
