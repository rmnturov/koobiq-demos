/**
 * Node 24 ships a disabled `localStorage` global that hides jsdom's own, so
 * `localStorage` reads as undefined in specs. jsdom keeps the working storage
 * on the window as `_localStorage`; put it back on the global.
 */
const jsdomWindow = window as unknown as { _localStorage?: Storage };

if (typeof globalThis.localStorage === 'undefined' && jsdomWindow._localStorage) {
    Object.defineProperty(globalThis, 'localStorage', {
        value: jsdomWindow._localStorage,
        configurable: true
    });
}

/**
 * jsdom lays nothing out and implements no `scrollTo` on elements, so a Koobiq scrollbar inside an
 * overlay panel (a select, for one) throws as soon as the panel opens and highlights an option.
 */
if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
}
