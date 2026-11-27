import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KbqThemeService, kbqThemeProvider } from '@koobiq/components/core';
import { App } from './app';

describe('App', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.className = 'kbq-app-background kbq-light';
    });

    it('renders a router outlet', async () => {
        await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] }).compileComponents();
        const fixture = TestBed.createComponent(App);
        await fixture.whenStable();
        expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
    });

    it('applies the theme class to body on startup', async () => {
        await TestBed.configureTestingModule({
            imports: [App],
            providers: [provideRouter([]), kbqThemeProvider({ mode: 'dark', storageKey: 'app-spec-theme' })]
        }).compileComponents();
        const fixture = TestBed.createComponent(App);
        await fixture.whenStable();
        expect(document.body.classList.contains('kbq-dark')).toBe(true);
        expect(document.body.classList.contains('kbq-light')).toBe(false);
    });

    it('switches SVG and ICO favicons with the resolved application theme', async () => {
        const icons = ['svg', 'ico'].map((format) => {
            const link = document.createElement('link');
            link.id = `favicon-${format}`;
            link.rel = 'icon';
            document.head.append(link);
            return link;
        });
        try {
            await TestBed.configureTestingModule({
                imports: [App],
                providers: [provideRouter([]), kbqThemeProvider({ mode: 'light', storageKey: 'app-spec-theme' })]
            }).compileComponents();
            const fixture = TestBed.createComponent(App);
            await fixture.whenStable();
            expect(icons.map((icon) => icon.getAttribute('href'))).toEqual(['favicon.svg?v=2', 'favicon.ico?v=2']);

            TestBed.inject(KbqThemeService).setMode('dark');
            await fixture.whenStable();
            expect(icons.map((icon) => icon.getAttribute('href'))).toEqual(['favicon-dark.svg?v=2', 'favicon-dark.ico?v=2']);

            TestBed.inject(KbqThemeService).setMode('light');
            await fixture.whenStable();
            expect(icons.map((icon) => icon.getAttribute('href'))).toEqual(['favicon.svg?v=2', 'favicon.ico?v=2']);
        } finally {
            icons.forEach((icon) => icon.remove());
        }
    });
});
