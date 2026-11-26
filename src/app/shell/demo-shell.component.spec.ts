import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By, Title } from '@angular/platform-browser';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { kbqThemeProvider } from '@koobiq/components/core';
import { DemoEntry } from '../../demos/demo.types';
import { DemoShellComponent } from './demo-shell.component';
import { buildDemoRoutes } from '../demo-routes';
import { repoUrlFor } from '../config';

@Component({ selector: 'fake-demo', template: '<p class="fake">fake content</p>' })
class FakeDemo {}

@Component({ selector: 'fake-catalog', template: '<p class="fake-catalog">catalog</p>' })
class FakeCatalog {}

// Shell resolves titles through the real registry, so the spec uses the real "hello" slug.
const fakes: DemoEntry[] = [
    { slug: 'hello', title: 'Hello', description: 'd', loadComponent: async () => FakeDemo },
    { slug: 'broken', title: 'Broken', description: 'd', loadComponent: () => Promise.reject(new Error('chunk')) }
];

async function setup(url: string) {
    const routes: Routes = [
        {
            path: '',
            component: DemoShellComponent,
            children: [
                { path: '', pathMatch: 'full', component: FakeCatalog },
                { path: 'demo', children: buildDemoRoutes(fakes) }
            ]
        },
        { path: '**', redirectTo: '' }
    ];
    TestBed.configureTestingModule({
        providers: [provideRouter(routes), kbqThemeProvider({ mode: 'auto', storageKey: 'shell-spec-theme' })]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness;
}

const link = (root: HTMLElement, text: string) =>
    Array.from(root.querySelectorAll('a')).find((a) => a.textContent?.trim() === text) as HTMLAnchorElement | undefined;

const action = (root: HTMLElement, label: string) =>
    root.querySelector(`a[aria-label="${label}"]`) as HTMLAnchorElement | null;

describe('DemoShellComponent', () => {
    beforeEach(() => localStorage.clear());

    it('renders the page header as a top bar', async () => {
        await setup('/demo/hello');
        expect(document.querySelector('header kbq-top-bar')).not.toBeNull();
        expect(document.querySelector('[kbqTopBarContainer][placement="start"]')).not.toBeNull();
        expect(document.querySelector('[kbqTopBarContainer][placement="end"]')).not.toBeNull();
    });

    it('shows the header shadow only while the page is scrolled', async () => {
        const harness = await setup('/demo/hello');
        const scrollbar = document.querySelector('kbq-scrollbar.content') as HTMLElement;
        const scrollContainer = harness.routeDebugElement!.query(By.css('kbq-scrollbar.content'));
        const topBar = document.querySelector('header kbq-top-bar')!;
        const hasShadow = () => topBar.classList.contains('kbq-top-bar_with-shadow');

        expect(hasShadow()).toBe(false);

        // Scrolling inside a demo must not change the page header.
        document.querySelector('.fake')!.dispatchEvent(new Event('scroll'));
        harness.detectChanges();
        expect(hasShadow()).toBe(false);

        scrollbar.scrollTop = 120;
        scrollContainer.triggerEventHandler('scroll');
        harness.detectChanges();
        expect(hasShadow()).toBe(true);

        scrollbar.scrollTop = 0;
        scrollContainer.triggerEventHandler('scroll');
        harness.detectChanges();
        expect(hasShadow()).toBe(false);
    });

    it('shows the demo title as the current breadcrumb and renders the content', async () => {
        await setup('/demo/hello');
        expect(document.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('Hello');
        expect(document.querySelector('.fake')?.textContent).toBe('fake content');
    });

    it('puts the demo name in front of the site name in the tab title', async () => {
        await setup('/demo/hello');
        expect(TestBed.inject(Title).getTitle()).toBe('Hello · Демки Ромы Турова');
    });

    it('titles the catalog with the site name alone', async () => {
        await setup('/');
        expect(TestBed.inject(Title).getTitle()).toBe('Демки Ромы Турова');
    });

    it('restores the site name when the demo is left', async () => {
        const harness = await setup('/demo/hello');
        await harness.navigateByUrl('/');
        harness.detectChanges();
        expect(TestBed.inject(Title).getTitle()).toBe('Демки Ромы Турова');
    });

    it('links the first crumb to the catalog', async () => {
        await setup('/demo/hello');
        expect(link(document.body, 'Демки')?.getAttribute('href')).toBe('/');
    });

    it('opens the repository folder from an icon button in a new tab', async () => {
        await setup('/demo/hello');
        const a = action(document.body, 'Код в GitHub')!;
        expect(a.querySelector('.kbq-icon.kbq-github_16')).not.toBeNull();
        expect(a.href).toBe(repoUrlFor('hello'));
        expect(a.target).toBe('_blank');
        expect(a.rel).toContain('noopener');
    });

    it('downloads the zip from an icon button', async () => {
        await setup('/demo/hello');
        const a = action(document.body, 'Скачать ZIP')!;
        expect(a.querySelector('.kbq-icon.kbq-arrow-down-to-bracket_16')).not.toBeNull();
        expect(a.getAttribute('href')).toBe('downloads/hello.zip');
        expect(a.hasAttribute('download')).toBe(true);
    });

    it('contains the theme toggle', async () => {
        await setup('/demo/hello');
        expect(document.querySelector('app-theme-toggle')).not.toBeNull();
    });

    it('offers a reset of the demo in the bar', async () => {
        await setup('/demo/hello');
        const reset = document.querySelector('button[aria-label="Сброс примера"]') as HTMLButtonElement;

        expect(reset).not.toBeNull();
        expect(reset.querySelector('.kbq-icon')?.classList).toContain('kbq-arrow-rotate-right_16');
    });

    it('hides the reset on the catalog and reloads the page on a click', async () => {
        const harness = await setup('/demo/hello');
        const original = Object.getOwnPropertyDescriptor(window, 'location')!;
        let reloads = 0;

        // jsdom does not implement location.reload; the click is checked against a stub.
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {...original.value, reload: () => (reloads += 1)}
        });

        try {
            (document.querySelector('button[aria-label="Сброс примера"]') as HTMLButtonElement).click();
            harness.detectChanges();
            expect(reloads).toBe(1);
        } finally {
            Object.defineProperty(window, 'location', original);
        }
    });

    it('redirects an unknown slug to the catalog', async () => {
        await setup('/demo/nope');
        expect(TestBed.inject(Router).url).toBe('/');
    });

    it('frames the catalog with the same bar, without demo actions', async () => {
        await setup('/');
        expect(document.querySelector('.fake-catalog')).not.toBeNull();
        expect(document.querySelector('header kbq-top-bar')).not.toBeNull();
        expect(document.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('Демки');
        expect(action(document.body, 'Код в GitHub')).toBeNull();
        expect(action(document.body, 'Скачать ZIP')).toBeNull();
        expect(document.querySelector('app-theme-toggle')).not.toBeNull();
    });

    it('keeps the demo actions off the catalog when going back from a demo', async () => {
        const harness = await setup('/demo/hello');
        expect(action(document.body, 'Скачать ZIP')).not.toBeNull();
        await harness.navigateByUrl('/');
        harness.detectChanges();
        expect(action(document.body, 'Скачать ZIP')).toBeNull();
        expect(document.querySelector('.fake-catalog')).not.toBeNull();
    });

    it('shows an error with a back link when the demo fails to load', async () => {
        await setup('/demo/broken');
        expect(document.body.textContent).toContain('Не удалось загрузить демо');
        expect(document.querySelectorAll('a[href="/"]').length).toBeGreaterThan(1);
    });
});
