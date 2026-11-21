import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { kbqThemeProvider } from '@koobiq/components/core';
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
});
