import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

export default function InboxSearch({ query, viewPhrase, onSearch }) {
    const [ value, setValue ] = useState(query);

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
                    placeholder="Search messages or customers…"
                    aria-label="Search conversations by message, name or email" />
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
    viewPhrase: PropTypes.string.isRequired,
    onSearch: PropTypes.func.isRequired,
};

InboxSearch.defaultProps = {
    query: '',
};
