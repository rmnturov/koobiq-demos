import { capsOf } from './keys';

describe('keycaps', () => {
    it.each([
        ['cmd+c', ['⌘', 'C']],
        ['cmd+v', ['⌘', 'V']],
        ['tab', ['Tab']]
    ])('%s → %j', (combo, caps) => {
        expect(capsOf(combo)).toEqual(caps);
    });

    it('keeps modifier glyphs and upgrades the rest', () => {
        expect(capsOf('cmd+shift+z')).toEqual(['⌘', '⇧', 'Z']);
        expect(capsOf('alt+ctrl+tab')).toEqual(['⌥', '⌃', 'Tab']);
    });
});
