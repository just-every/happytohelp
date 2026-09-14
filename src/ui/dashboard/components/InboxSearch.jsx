import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

export default function InboxSearch({ query, viewLabel, onSearch }) {
    const [ value, setValue ] = useState(query);
    const searchPhrase = viewLabel
        .split(' ')
        .map(word => word === 'AI' ? word : word.toLowerCase())
        .join(' ');

    useEffect(() => {
        setValue(query);
    }, [ query ]);

    const submit = event => {
        event.preventDefault();
        onSearch(value);
    };

    return (
        <form className="search-query" onSubmit={ submit }>
            <div className="input-group">
                <input
                    type="search"
                    value={ value }
                    onChange={ event => setValue(event.target.value) }
                    className="form-control form-control-lg bg-white"
                    placeholder={ `Search ${ searchPhrase }...` }
                    aria-label={ `Search ${ searchPhrase }` } />
                <div className="input-group-append">
                    <button className="btn btn-lg btn-ico btn-secondary btn-minimal bg-white" type="submit" aria-label="Search conversations">
                        <i className="fe fe-search" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        </form>
    );
}

InboxSearch.propTypes = {
    query: PropTypes.string,
    viewLabel: PropTypes.string.isRequired,
    onSearch: PropTypes.func.isRequired,
};

InboxSearch.defaultProps = {
    query: '',
};
