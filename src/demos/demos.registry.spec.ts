import { DEMOS, findDemo } from './demos.registry';

describe('demos registry', () => {
    it('has unique slugs', () => {
        const slugs = DEMOS.map((d) => d.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('has kebab-case slugs', () => {
        for (const { slug } of DEMOS) {
            expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        }
    });

    it('has non-empty title and description', () => {
        for (const { title, description } of DEMOS) {
            expect(title.trim()).not.toBe('');
            expect(description.trim()).not.toBe('');
        }
    });

    it('contains the hello demo', () => {
        expect(findDemo('hello')?.title).toBe('Hello');
    });

    it('lists the Markdown playground in the catalog', () => {
        const demo = findDemo('markdown-playground');
        expect(demo?.title).toBe('Полигон Markdown');
        expect(demo?.hidden).toBeFalsy();
    });

    it('findDemo returns undefined for an unknown slug', () => {
        expect(findDemo('nope')).toBeUndefined();
    });

    it('every loadComponent resolves to a component class', async () => {
        for (const demo of DEMOS) {
            expect(typeof (await demo.loadComponent())).toBe('function');
        }
    });
});
