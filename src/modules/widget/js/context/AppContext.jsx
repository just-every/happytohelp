import React from 'react';
import {defaultSettings, defaultTheme, defaultText} from './defaults';

let defaultAppContext = {
    apiOrigin: '',
    widgetKey: '',
    apiUrl: '',
    proxy: false,
    page: {},
    contact: {},
    theme: defaultTheme,
    settings: defaultSettings,
    text: defaultText,
};


const AppContext = React.createContext({});

export {AppContext as default, defaultAppContext};
