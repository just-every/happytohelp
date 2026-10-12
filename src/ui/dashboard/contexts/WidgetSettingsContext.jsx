import React, { createContext } from 'react';
import PropTypes from 'prop-types';

export const WidgetSettingsContext = createContext({});

export const Provider = ({ settings, csrfToken, previewAgent, previewBrand, mailMode, installation, verificationSecret, children }) => {
    return (
        <WidgetSettingsContext.Provider value={{ settings, csrfToken, previewAgent, previewBrand, mailMode, installation, verificationSecret }}>
            {children}
        </WidgetSettingsContext.Provider>
    );
};

Provider.propTypes = {
    settings: PropTypes.object,
    csrfToken: PropTypes.string,
    previewAgent: PropTypes.object,
    previewBrand: PropTypes.object,
    installation: PropTypes.object,
    verificationSecret: PropTypes.string,
};

Provider.defaultProps = {
    csrfToken: window.csrfToken,
    settings: window.widgetSettings,
    previewAgent: window.widgetPreviewAgent,
    previewBrand: window.widgetPreviewBrand,
    installation: window.widgetInstallation,
    verificationSecret: window.widgetVerificationSecret,
};
