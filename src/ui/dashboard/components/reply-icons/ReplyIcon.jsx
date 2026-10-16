import React from 'react';
import PropTypes from 'prop-types';
import iconNames from './catalog.json';
import {controlGlyphs, spriteUrl} from 'virtual:happytohelp-reply-icons';

const replyIconNames = new Set(iconNames);

export const hasReplyIcon = name => typeof name === 'string' && replyIconNames.has(name);

export default function ReplyIcon({ className, name, title }) {
    if (!hasReplyIcon(name)) return null;

    return <svg
        className={ className }
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={ title ? undefined : true }
        focusable="false"
        role={ title ? 'img' : undefined }
    >
        { title && <title>{ title }</title> }
        { controlGlyphs[name]
            ? <g dangerouslySetInnerHTML={{ __html: controlGlyphs[name] }} />
            : <use href={ `${spriteUrl}#${name}` } /> }
    </svg>;
}

ReplyIcon.propTypes = {
    className: PropTypes.string,
    name: PropTypes.string.isRequired,
    title: PropTypes.string,
};
