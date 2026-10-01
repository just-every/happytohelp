import React from 'react';
import { Form } from 'react-bootstrap';
import WidgetFieldSection from './WidgetFieldSection';

const groups = [
    { title: 'Avatar and insights', fields: [
        ['theme[avatar][background]', 'Avatar background'],
        ['theme[insight][background]', 'Insight background'],
        ['theme[insight][color]', 'Insight text'],
    ] },
    { title: 'Launcher button', fields: [
        ['theme[button][open][color]', 'Open icon'],
        ['theme[button][open][background]', 'Open background'],
        ['theme[button][closed][color]', 'Closed icon'],
        ['theme[button][closed][background]', 'Closed background'],
    ] },
    { title: 'Conversation', fields: [
        ['theme[window][background]', 'Chat background'],
        ['theme[window][color]', 'Chat text'],
        ['theme[chat][agent][background]', 'Agent message background'],
        ['theme[chat][agent][color]', 'Agent message text'],
        ['theme[chat][user][background]', 'Visitor message background'],
        ['theme[chat][user][color]', 'Visitor message text'],
    ] },
    { title: 'Reply composer', fields: [
        ['theme[input][message][background]', 'Input background'],
        ['theme[input][message][color]', 'Input text'],
        ['theme[input][send][background]', 'Send button background'],
        ['theme[input][send][color]', 'Send button icon'],
        ['theme[input][button][color]', 'Other button icons'],
    ] },
];

export const appearanceFieldNames = groups.flatMap(({ fields }) => fields.map(([name]) => name));

export default function WidgetAppearanceFields({ register }) {
    return groups.map(({ title, fields }) => (
        <WidgetFieldSection key={title} title={title}>
            {fields.map(([name, label]) => (
                <Form.Group key={name} controlId={`widget-${name.replace(/[^a-z0-9]+/gi, '-')}`} className="widget-color-field">
                    <Form.Label>{label}</Form.Label>
                    <Form.Control type="color" className="form-control-color" {...register(name)} />
                </Form.Group>
            ))}
        </WidgetFieldSection>
    ));
}
