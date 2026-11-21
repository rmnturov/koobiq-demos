import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { kbqThemeProvider } from '@koobiq/components/core';
import { DemoEntry } from '../../demos/demo.types';
import { findDemo } from '../../demos/demos.registry';
import { CatalogComponent } from './catalog.component';

const demo = (slug: string, title = `Title ${slug}`, description = `Description ${slug}`): DemoEntry => ({
    slug,
    title,
    description,
    loadComponent: async () => class {}
});

async function render(demos?: readonly DemoEntry[]): Promise<ComponentFixture<CatalogComponent>> {
    localStorage.clear();
    await TestBed.configureTestingModule({
        imports: [CatalogComponent],
        providers: [provideRouter([]), kbqThemeProvider({ mode: 'auto', storageKey: 'catalog-spec-theme' })]
    }).compileComponents();
    const fixture = TestBed.createComponent(CatalogComponent);
    if (demos) fixture.componentRef.setInput('demos', demos);
    await fixture.whenStable();
    return fixture;
}

describe('CatalogComponent', () => {
    it('renders a card link per demo with title and description', async () => {
        const fixture = await render([demo('a'), demo('b')]);
        const cards = Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('a.card'));
        expect(cards.map((c) => c.getAttribute('href'))).toEqual(['/demo/a', '/demo/b']);
        expect(cards[0].textContent).toContain('Title a');
        expect(cards[0].textContent).toContain('Description a');
    });

    it('shows an empty state for an empty registry', async () => {
        const fixture = await render([]);
        expect(fixture.nativeElement.textContent).toContain('Демо пока нет');
        expect(fixture.nativeElement.querySelectorAll('a.card').length).toBe(0);
    });

    it('wraps very long titles and descriptions', async () => {
        const fixture = await render([demo('long', 'W'.repeat(200), 'd'.repeat(1000))]);
        const title: HTMLElement = fixture.nativeElement.querySelector('.card__title');
        const description: HTMLElement = fixture.nativeElement.querySelector('.card__description');
        expect(getComputedStyle(title).overflowWrap).toBe('anywhere');
        expect(getComputedStyle(description).overflowWrap).toBe('anywhere');
    });

    it('leaves the header to the shell', async () => {
        const fixture = await render([demo('a')]);
        expect(fixture.nativeElement.querySelector('app-theme-toggle')).toBeNull();
        expect(fixture.nativeElement.querySelector('header')).toBeNull();
    });

    it('lists the real registry by default', async () => {
        const fixture = await render();
        expect(fixture.nativeElement.querySelector('a.card[href="/demo/hello"]')).not.toBeNull();
    });

    /*
     * Скрытая демка остается маршрутом, но карточки не получает: на нее ссылаются статьи
     * и другие демки, а в оглавлении она читается как второй вход в тот же пример.
     */
    it('leaves a hidden demo out of the catalog', async () => {
        const fixture = await render([demo('shown'), { ...demo('hidden'), hidden: true }]);
        const hrefs = Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('a.card')).map((c) =>
            c.getAttribute('href')
        );
        expect(hrefs).toEqual(['/demo/shown']);
    });

    it('keeps the hidden demo route reachable', () => {
        expect(findDemo('time-input')?.hidden).toBe(true);
    });
});
