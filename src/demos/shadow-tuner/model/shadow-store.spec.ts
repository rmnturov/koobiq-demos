import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KbqThemeService, kbqThemeProvider } from '@koobiq/components/core';

import { DEFAULT_PANEL, baseShadows } from './shadow-model';
import { ShadowStore } from './shadow-store';

/** Шесть переменных набора: три цвета слоёв и три уровня — их хранилище пишет на `body`. */
const BODY_VARS = [
    '--kbq-shadow-outline',
    '--kbq-shadow-key',
    '--kbq-shadow-ambient',
    '--kbq-shadow-card',
    '--kbq-shadow-popup',
    '--kbq-shadow-overlay'
];

/** Пустая оболочка: хранилище живёт в провайдерах компонента, как в самом демо. */
@Component({
    selector: 'shadow-store-host',
    template: '',
    providers: [ShadowStore]
})
class StoreHost {
    readonly store = inject(ShadowStore);
}

describe('shadow store', () => {
    let fixture: ComponentFixture<StoreHost>;
    let host: StoreHost;
    let theme: KbqThemeService;
    /** Оболочка уничтожается в `afterEach`, кроме теста, который гасит её сам. */
    let destroyed = false;

    const store = (): ShadowStore => host.store;
    const bodyVar = (name: string): string => document.body.style.getPropertyValue(name);

    /** Эффекты хранилища срабатывают в прогоне изменений: без него `body` и адрес отстают. */
    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
    };

    /** Отрисовка оболочки: адрес читается в конструкторе, поэтому он готов до `createComponent`. */
    const render = async (): Promise<void> => {
        destroyed = false;
        fixture = TestBed.createComponent(StoreHost);
        host = fixture.componentInstance;
        await settle();
    };

    beforeEach(async () => {
        window.history.replaceState(null, '', '/demo/shadow-tuner');

        for (const name of BODY_VARS) {
            document.body.style.removeProperty(name);
        }

        localStorage.clear();

        await TestBed.configureTestingModule({
            imports: [StoreHost],
            providers: [kbqThemeProvider({ mode: 'light', storageKey: 'shadow-tuner-spec-theme' })]
        }).compileComponents();

        theme = TestBed.inject(KbqThemeService);
    });

    afterEach(() => {
        if (!destroyed) fixture.destroy();
    });

    it('reads the address when the store is created', async () => {
        window.history.replaceState(null, '', '?light.popup.key=0,2,20,0');

        await render();

        expect(store().shadows().elevations.popup.key.blur).toBe(20);
        expect(store().scheme()).toBe('light');
    });

    it('starts from the preset set when the address has no parameters', async () => {
        await render();

        expect(store().shadows()).toEqual(baseShadows('light'));
        expect(store().view()).toBe('after');
        expect(window.location.search).toBe('');
    });

    it('applies the geometry, turns the view to after and writes the six variables to the body', async () => {
        // «Было» на старте: тогда переключение вида видно, а не совпадает с исходным.
        window.history.replaceState(null, '', '?view=before');

        await render();

        expect(store().view()).toBe('before');
        expect(bodyVar('--kbq-shadow-popup')).toBe('');

        store().setGeometry('popup', 'key', 'blur', 20);
        await settle();

        expect(store().shadows().elevations.popup.key.blur).toBe(20);
        expect(store().view()).toBe('after');
        // Новое значение уходит в свою переменную уровня, остальные пять тоже на месте.
        expect(bodyVar('--kbq-shadow-popup')).toContain('0px 2px 20px 0px');

        for (const name of BODY_VARS) {
            expect(bodyVar(name)).not.toBe('');
        }

        expect(window.location.search).toContain('light.popup.key=0,2,20,0');
    });

    it('takes the inline variables off the body in the before view and puts them back in after', async () => {
        await render();

        for (const name of BODY_VARS) {
            expect(bodyVar(name)).not.toBe('');
        }

        store().setView('before');
        await settle();

        for (const name of BODY_VARS) {
            expect(bodyVar(name)).toBe('');
        }

        store().setView('after');
        await settle();

        for (const name of BODY_VARS) {
            expect(bodyVar(name)).not.toBe('');
        }
    });

    it('drops one elevation and then the whole scheme back to the base and off the address', async () => {
        await render();

        store().setGeometry('popup', 'key', 'blur', 20);
        store().setGeometry('card', 'ambient', 'y', 4);
        await settle();

        expect(window.location.search).toContain('light.popup.key');
        expect(window.location.search).toContain('light.card.ambient');

        store().resetElevation('popup');
        await settle();

        expect(store().shadows().elevations.popup.key.blur).toBe(8);
        expect(window.location.search).not.toContain('light.popup.key');
        // Соседний уровень правку не теряет: сброс идёт по одному уровню.
        expect(window.location.search).toContain('light.card.ambient');

        store().setColor('key', 'a8');
        await settle();

        expect(window.location.search).toContain('light.colors.key=a8');

        store().setPanel('popup');
        await settle();

        expect(window.location.search).toContain('panel=popup');

        store().resetScheme();
        await settle();

        expect(store().shadows()).toEqual(baseShadows('light'));
        // Уровень панели запоминается до сброса: сброс темы возвращает его к стоку вида «Стало».
        expect(store().panel()).toBe(DEFAULT_PANEL);
        expect(window.location.search).toBe('');
    });

    it('drops both themes at once and returns the panel level to the stock', async () => {
        window.history.replaceState(null, '', '?panel=popup&backdrop=bg-secondary');

        await render();

        store().setGeometry('card', 'key', 'blur', 24);
        await settle();
        theme.setMode('dark');
        await settle();
        store().setGeometry('card', 'key', 'blur', 32);
        await settle();

        expect(window.location.search).toContain('light.card.key');
        expect(window.location.search).toContain('dark.card.key');

        store().resetSchemes();
        await settle();

        // Обе темы вернулись к стоку, уровень панели — к стоку вида «Стало».
        expect(store().shadows()).toEqual(baseShadows('dark'));
        expect(window.location.search).not.toContain('card.key');
        expect(store().panel()).toBe(DEFAULT_PANEL);
        expect(window.location.search).not.toContain('panel=');
        // Переключатель фона — принадлежность просмотра, а не настройки: его сброс не трогает.
        expect(window.location.search).toContain('backdrop=bg-secondary');
        expect(store().backdrop()).toBe('bg-secondary');

        theme.setMode('light');
        await settle();

        expect(store().shadows()).toEqual(baseShadows('light'));
    });

    it('follows the theme and paints the dark palette', async () => {
        await render();

        theme.setMode('dark');
        await settle();

        expect(store().scheme()).toBe('dark');
        expect(store().shadows()).toEqual(baseShadows('dark'));
        expect(bodyVar('--kbq-shadow-outline')).toBe('var(--kbq-semantic-dark-contrast-a6)');
        expect(bodyVar('--kbq-shadow-key')).toBe('transparent');
        // Уровень по-прежнему ссылается на общий токен слоя: тёмную палитру несут три цвета слоёв.
        expect(bodyVar('--kbq-shadow-popup')).toContain('var(--kbq-shadow-outline)');

        for (const name of BODY_VARS) {
            expect(bodyVar(name)).not.toBe('');
        }
    });

    it('removes every variable from the body when the demo is destroyed', async () => {
        await render();

        for (const name of BODY_VARS) {
            expect(bodyVar(name)).not.toBe('');
        }

        fixture.destroy();
        destroyed = true;

        for (const name of BODY_VARS) {
            expect(bodyVar(name)).toBe('');
        }
    });

    it('shows an edit made in the before view right away', async () => {
        window.history.replaceState(null, '', '?view=before');

        await render();

        expect(store().view()).toBe('before');
        expect(bodyVar('--kbq-shadow-card')).toBe('');

        store().setGeometry('card', 'key', 'blur', 24);
        await settle();

        expect(store().view()).toBe('after');
        expect(bodyVar('--kbq-shadow-card')).toContain('0px 1px 24px 0px');
    });
});
