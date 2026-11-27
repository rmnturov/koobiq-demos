import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KbqThemeService, kbqThemeProvider } from '@koobiq/components/core';
import { vi } from 'vitest';
import { App } from './app';

describe('App', () => {
    let systemTheme: EventTarget & { matches: boolean };

    beforeEach(() => {
        localStorage.clear();
        document.body.className = 'kbq-app-background kbq-light';
        systemTheme = Object.assign(new EventTarget(), { matches: false });
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(systemTheme));
    });

    afterEach(() => vi.unstubAllGlobals());

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

    it.each([false, true])('follows OS theme independently of app theme (initial dark: %s)', async (initialDark) => {
        systemTheme.matches = initialDark;
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
            expect(icons.map((icon) => icon.getAttribute('href'))).toEqual(initialDark
                ? ['favicon-dark.svg?v=2', 'favicon-dark.ico?v=2']
                : ['favicon.svg?v=2', 'favicon.ico?v=2']);

            systemTheme.matches = false;
            systemTheme.dispatchEvent(Object.assign(new Event('change'), { matches: false }));
            expect(icons.map((icon) => icon.getAttribute('href'))).toEqual(['favicon.svg?v=2', 'favicon.ico?v=2']);

            TestBed.inject(KbqThemeService).setMode('dark');
            await fixture.whenStable();
            expect(icons.map((icon) => icon.getAttribute('href'))).toEqual(['favicon.svg?v=2', 'favicon.ico?v=2']);

            systemTheme.matches = true;
            systemTheme.dispatchEvent(Object.assign(new Event('change'), { matches: systemTheme.matches }));
            expect(icons.map((icon) => icon.getAttribute('href'))).toEqual(['favicon-dark.svg?v=2', 'favicon-dark.ico?v=2']);

            TestBed.inject(KbqThemeService).setMode('light');
            await fixture.whenStable();
            expect(icons.map((icon) => icon.getAttribute('href'))).toEqual(['favicon-dark.svg?v=2', 'favicon-dark.ico?v=2']);

            systemTheme.matches = false;
            systemTheme.dispatchEvent(Object.assign(new Event('change'), { matches: systemTheme.matches }));
            expect(icons.map((icon) => icon.getAttribute('href'))).toEqual(['favicon.svg?v=2', 'favicon.ico?v=2']);

            fixture.destroy();
            systemTheme.matches = true;
            systemTheme.dispatchEvent(Object.assign(new Event('change'), { matches: systemTheme.matches }));
            expect(icons.map((icon) => icon.getAttribute('href'))).toEqual(['favicon.svg?v=2', 'favicon.ico?v=2']);
        } finally {
            icons.forEach((icon) => icon.remove());
        }
    });
});
