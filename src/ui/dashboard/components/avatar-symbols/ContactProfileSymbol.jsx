import React from 'react';
import PropTypes from 'prop-types';
import { profileSymbolsByName } from './catalog';

export default function ContactProfileSymbol({ name }) {
    const symbol = profileSymbolsByName[name];
    if (!symbol) {
        throw new Error(`Unknown contact profile symbol: ${ name }`);
    }

    return (
        <svg className="contact-profile-symbol" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            { symbol.paths.map((path, index) => <path key={ index } d={ path } />) }
        </svg>
    );
}

ContactProfileSymbol.propTypes = {
    name: PropTypes.string.isRequired,
};
