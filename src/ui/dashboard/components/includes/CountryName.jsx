import countryLocale from 'i18n-iso-countries/langs/en.json';
import React from 'react';

import * as countries from "i18n-iso-countries";
countries.registerLocale(countryLocale);

const prefixWithThe = [
    "CK",
    "MV",
    "NL",
    "PH",
    "SC",
    "SB",
    "BS",
    "KM",
    "MH",
    "US",
    "DO",
    "AE",
    "GB",
];

/*
 * Displays a formatted country name for a given country code
 */
export default function CountryName({ code, prefix = false }) {
    let name = code == "US" ? "United States" : countries.getName(code, 'en', {select: "official"});
    return <span>{ prefix && prefixWithThe.includes(code) && 'the ' }{ name }</span>;
}
