import React from 'react';
import PropTypes from 'prop-types';
import iconNames from './catalog.json';
import glyphs from './glyphs.json';

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
        <g dangerouslySetInnerHTML={{ __html: glyphs[name] }} />
    </svg>;
}

ReplyIcon.propTypes = {
    className: PropTypes.string,
    name: PropTypes.string.isRequired,
    title: PropTypes.string,
};
