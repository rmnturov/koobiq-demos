import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KbqThemeService, kbqThemeProvider } from '@koobiq/components/core';

import { ShadowTunerDemo } from './shadow-tuner.demo';

interface Rendered {
    fixture: ComponentFixture<ShadowTunerDemo>;
    root: HTMLElement;
}

/** Шесть переменных набора, которые тюнер пишет инлайн на `body`. */
const BODY_VARIABLES = [
    '--kbq-shadow-outline',
    '--kbq-shadow-key',
    '--kbq-shadow-ambient',
    '--kbq-shadow-card',
    '--kbq-shadow-popup',
    '--kbq-shadow-overlay'
];

/** Поднятые фикстуры: без `destroy` инлайн-переменные доживают до соседнего теста. */
const mounted: Array<ComponentFixture<unknown>> = [];

/**
 * Вся демка целиком: `ShadowStore` приходит из провайдеров компонента, поэтому адрес надо
 * выставить до `createComponent` — хранилище читает его в конструкторе.
 */
async function render(search = ''): Promise<Rendered> {
    history.replaceState(null, '', `/demo/shadow-tuner${search}`);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
        imports: [ShadowTunerDemo],
        providers: [kbqThemeProvider({ mode: 'light', storageKey: 'shadow-tuner-spec-theme' })]
    }).compileComponents();

    const fixture = TestBed.createComponent(ShadowTunerDemo);

    mounted.push(fixture as ComponentFixture<unknown>);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, root: fixture.nativeElement as HTMLElement };
}

/**
 * jsdom не считает computed styles Кубика: разбор его CSS падает на `Specificity.max`, а детектор
 * высокой контрастности в CDK зовёт `getComputedStyle` прямо во время change detection — рендер
 * демки падает вместе с ним. Обёртка отдаёт пустой расчёт вместо исключения: тени в тестах
 * читаются из инлайновых переменных на `body`, так что проверки она не ослабляет.
 */
function shieldComputedStyle(): () => void {
    const native = window.getComputedStyle;
    const shield = (element: Element, pseudoElement?: string | null): CSSStyleDeclaration => {
        try {
            return native.call(window, element, pseudoElement ?? undefined);
        } catch {
            return document.body.style;
        }
    };

    window.getComputedStyle = shield as typeof window.getComputedStyle;

    return () => {
        window.getComputedStyle = native;
    };
}

/** Переменные набора, которые реально стоят на `body`: в «Было» их нет. */
function bodyShadows(): Array<[string, string]> {
    const pairs = BODY_VARIABLES.map(
        (name): [string, string] => [name, document.body.style.getPropertyValue(name)]
    );

    return pairs.filter(([, value]) => value !== '');
}

async function click(fixture: ComponentFixture<unknown>, element: HTMLElement): Promise<void> {
    element.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

/** Числовое поле формы по его `data-target`: `popup-key-blur` и т. п. */
function numberField(root: HTMLElement, target: string): HTMLInputElement {
    const input = root.querySelector<HTMLInputElement>(`[data-target="${target}"] input`);

    if (!input) throw new Error(`нет числового поля ${target}`);

    return input;
}

/** Кнопка переключателя Кубика: группа рендерит обычные `button`, подпись — единственный ориентир. */
function toggle(root: HTMLElement, target: string, label: string): HTMLButtonElement {
    const buttons = [...root.querySelectorAll<HTMLButtonElement>(`[data-target="${target}"] button`)];
    const button = buttons.find((item) => item.textContent?.trim() === label);

    if (!button) throw new Error(`в переключателе ${target} нет кнопки «${label}»`);

    return button;
}

/**
 * Правка поля рукой: значение уходит в контрол через настоящее событие ввода. Кубик переформатирует
 * ввод отложенно (`setTimeout(0)`), поэтому значение ждёт следующей макрозадачи.
 */
async function type(
    fixture: ComponentFixture<unknown>,
    input: HTMLInputElement,
    value: string
): Promise<void> {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

describe('shadow tuner', () => {
    let restoreComputedStyle: () => void = () => undefined;

    beforeEach(() => {
        localStorage.clear();
        restoreComputedStyle = shieldComputedStyle();
    });

    afterEach(() => {
        restoreComputedStyle();

        for (const fixture of mounted.splice(0)) {
            if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
        }

        document.body.removeAttribute('style');
        history.replaceState(null, '', '/');
    });

    it('restores the set from the address and leaves the shadows to the theme in «before»', async () => {
        const { root } = await render('?light.popup.key=0,2,20,0&view=before&panel=popup');

        const panel = root.querySelector<HTMLElement>('.workspace__panel');

        expect(numberField(root, 'popup-key-blur').value).toBe('20');
        // «Было» — значит инлайн-переменных нет и в силу вступают токены самой темы.
        expect(bodyShadows()).toEqual([]);
        // Уровень из «Стало» на стоковую панель не переносится: у неё нет тени, край рисует обводка.
        expect(panel?.style.getPropertyValue('box-shadow')).toBe('');
    });

    it('rewrites the address and the body variables when a number changes', async () => {
        const { fixture, root } = await render();

        await type(fixture, numberField(root, 'popup-key-blur'), '20');

        expect(window.location.search).toContain('light.popup.key=0,2,20,0');
        expect(bodyShadows().map(([name]) => name)).toEqual(BODY_VARIABLES);
        expect(document.body.style.getPropertyValue('--kbq-shadow-popup')).toContain('0px 2px 20px 0px');
    });

    it('lays the preview scenes out in the design order', async () => {
        const { root } = await render();

        expect(
            [...root.querySelectorAll<HTMLElement>('.scene__title')].map((title) => title.textContent?.trim())
        ).toEqual(['Уровни', 'Плитка и карточки', 'Выпадашка селекта', 'Контент-панель и грид', 'Модалка']);
    });

    it('scrolls the preview column with the Koobiq overlay scrollbar', async () => {
        const { root } = await render();
        const preview = root.querySelector<HTMLElement>('.tuner__preview')!;

        // Прокручивает по-прежнему сама колонка, но полосу рисует Кубик, а нативная спрятана.
        expect(preview.classList).toContain('kbq-scrollbar-viewport');
        expect(preview.classList).toContain('kbq-scrollbar-viewport_native-scrollbar-hidden');
        expect(preview.querySelector('.kbq-scrollbar-track')).not.toBeNull();
    });

    it('shows the dark stock set in the dark theme and keeps the light values in the address', async () => {
        const { fixture, root } = await render('?light.popup.key=0,2,20,0');
        const theme = TestBed.inject(KbqThemeService);

        theme.setMode('dark');
        await fixture.whenStable();
        fixture.detectChanges();
        await fixture.whenStable();

        // Набор тёмной темы не правили: поле показывает сток, а ссылка по-прежнему несёт светлый.
        expect(numberField(root, 'popup-key-blur').value).toBe('8');
        expect(window.location.search).toContain('light.popup.key=0,2,20,0');
        expect(window.location.search).not.toContain('dark.popup');
        // В тёмной теме слои ссылаются на её палитру, светлых значений на `body` не остаётся.
        expect(document.body.style.getPropertyValue('--kbq-shadow-outline')).toBe('var(--kbq-semantic-dark-contrast-a6)');

        const light = bodyShadows().filter(([, value]) => value.includes('var(--kbq-semantic-contrast'));

        expect(light).toEqual([]);
    });

    it('takes every variable off the body on destroy', async () => {
        const { fixture } = await render();

        expect(bodyShadows().length).toBe(BODY_VARIABLES.length);

        fixture.destroy();

        expect(bodyShadows()).toEqual([]);
    });

    it('compares against the theme: the switch to «before» takes the variables off', async () => {
        const { fixture, root } = await render();

        expect(bodyShadows().length).toBe(BODY_VARIABLES.length);

        await click(fixture, toggle(root, 'compare', 'Было'));

        expect(bodyShadows()).toEqual([]);
        expect(window.location.search).toContain('view=before');
    });
});
