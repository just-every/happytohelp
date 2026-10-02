// The canonical public repository is declared once, in package.json "repository".
import { repository } from '../../../package.json';

export const sourceUrl = repository.url;
export const docsUrl = `${sourceUrl}/blob/main/README.md`;
export const installerUrl = `${sourceUrl}/blob/main/docs/INSTALLER.md`;
export const costsUrl = `${sourceUrl}#before-you-start`;
export const licenseUrl = `${sourceUrl}/blob/main/LICENSE`;
export const hostedUrl = 'https://runeditrun.com';
