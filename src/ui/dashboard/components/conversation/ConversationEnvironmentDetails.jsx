import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import Moment from '../../../native/Moment';
import { contactTimezone } from '../../utils/contactTimezone';
import { UAParser } from 'ua-parser-js';
import CountryName from '../includes/CountryName';
import ConversationDetailField from './ConversationDetailField';
import ConversationDetailSection from './ConversationDetailSection';

export default function ConversationEnvironmentDetails({ contact }) {
    const timezone = contactTimezone(contact);
    const userAgent = useMemo(() => contact.user_agent ? new UAParser(contact.user_agent).getResult() : null, [contact.user_agent]);

    return <>
        <ConversationDetailSection className="conversation-details-location" title="Location">
            <div className="conversation-detail-grid">
                { contact.country_code && <ConversationDetailField className="conversation-detail-field--compact" icon="map-pin" label="Country" value={ <CountryName code={ contact.country_code } /> } /> }
                { contact.language && <ConversationDetailField className="conversation-detail-field--compact" icon="globe" label="Language" value={ contact.language } /> }
                { timezone
                    ? <ConversationDetailField className="conversation-detail-field--compact" icon="clock" label="Local time">
                        <Moment tz={ timezone } format="LT">{ new Date() }</Moment>
                        <Moment className="conversation-detail-field__timezone" tz={ timezone } format="[UTC]Z">{ new Date() }</Moment>
                    </ConversationDetailField>
                    : <ConversationDetailField className="conversation-detail-field--compact" icon="clock" label="Local time" value="Unknown" /> }
                <ConversationDetailField className="conversation-detail-field--compact" icon="wifi" label="IP address" value={ contact.ip_address || '—' } />
            </div>
        </ConversationDetailSection>

        { contact.user_agent && userAgent && <ConversationDetailSection className="conversation-details-device" title="Device">
            <div className="conversation-detail-grid">
                <ConversationDetailField className="conversation-detail-field--compact" icon="monitor" label="Browser" value={ [userAgent.browser.name, userAgent.browser.version].filter(Boolean).join(' ') || 'Unknown' } />
                <ConversationDetailField className="conversation-detail-field--compact" icon="laptop" label="OS" value={ [userAgent.os.name, userAgent.os.version].filter(Boolean).join(' ') || 'Unknown' } />
            </div>
        </ConversationDetailSection> }
    </>;
}

ConversationEnvironmentDetails.propTypes = {
    contact: PropTypes.object.isRequired,
};
