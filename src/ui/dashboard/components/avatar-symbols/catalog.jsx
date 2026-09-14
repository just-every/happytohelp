import { natureSymbols } from './natureSymbols';
import { joySymbols } from './joySymbols';
import { connectionSymbols } from './connectionSymbols';

export const PROFILE_SYMBOL_CATALOG = Object.freeze([
    ...natureSymbols,
    ...joySymbols,
    ...connectionSymbols,
]);

export const PROFILE_SYMBOL_ALIASES = Object.freeze({
    sprout: 'sprout', leaf: 'leaf', flower: 'flower', sun: 'sun', moon: 'moon', cloud: 'cloud',
    rainbow: 'rainbow', wave: 'wave', star: 'star', heart: 'heart', smile: 'smile', chat: 'chat',
    message: 'message', check: 'check', bookmark: 'bookmark', camera: 'camera', compass: 'compass',
    shield: 'shield', music: 'music', gift: 'gift', bolt: 'bolt', paw: 'paw',
});

export const profileSymbolsByName = Object.freeze(PROFILE_SYMBOL_CATALOG.reduce((symbols, symbol) => {
    symbols[symbol.name] = symbol;
    return symbols;
}, {}));
