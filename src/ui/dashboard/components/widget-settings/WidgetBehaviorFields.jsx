import React from 'react';
import { Form } from 'react-bootstrap';
import WidgetFieldSection from './WidgetFieldSection';

const groups = [
    { title: 'Glow effects', fields: [
        ['settings[show_glow][on_insight]', 'On insight'],
        ['settings[show_glow][on_insight_reply]', 'On insight reply'],
        ['settings[show_glow][on_ai_typing]', 'While AI is typing'],
        ['settings[show_glow][on_human_typing]', 'While a teammate is typing'],
    ] },
    { title: 'Message capture', fields: [
        ['settings[message][collect_screenshot]', 'Collect screenshots'],
        ['settings[message][collect_attachments]', 'Collect attachments'],
    ] },
    { title: 'Required contact details', fields: [
        ['settings[collect][require_name]', 'Require name'],
        ['settings[collect][require_email]', 'Require email'],
    ] },
];

export default function WidgetBehaviorFields({ register }) {
    return groups.map(({ title, fields }) => (
        <WidgetFieldSection key={title} title={title}>
            {fields.map(([name, label]) => (
                <div key={name}>
                    <input type="hidden" name={name} value="0" />
                    <Form.Check type="switch" id={`widget-${name.replace(/[^a-z0-9]+/gi, '-')}`}
                        label={label} value="1" {...register(name)} />
                </div>
            ))}
        </WidgetFieldSection>
    ));
}
