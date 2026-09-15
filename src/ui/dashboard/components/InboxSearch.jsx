import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from '@tanstack/react-router';

export default function InboxSearch({ query, viewLabel, onSearch }) {
    const [ value, setValue ] = useState(query);
    const router = useRouter();
    const searchPhrase = viewLabel
        .split(' ')
        .map(word => word === 'AI' ? word : word.toLowerCase())
        .join(' ');

    useEffect(() => {
        setValue(query);
    }, [ query ]);

    useEffect(() => {
        let observedKey = router.state.location.state.__TSR_key;
        let navigationPending = false;
        const stopBefore = router.subscribe('onBeforeNavigate', ({ toLocation }) => {
            const key = toLocation.state.__TSR_key;
            if (key !== observedKey) navigationPending = true;
            observedKey = key;
        });
        const stopResolved = router.subscribe('onResolved', ({ toLocation }) => {
            if (!navigationPending) return;
            navigationPending = false;
            // A quick Back can cancel a search before its query prop commits.
            // Synchronize the form on settled history navigation even when the
            // committed query is unchanged; background reloads retain typing.
            setValue(toLocation.search.q == null ? '' : String(toLocation.search.q));
        });
        return () => { stopBefore(); stopResolved(); };
    }, [router]);

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
