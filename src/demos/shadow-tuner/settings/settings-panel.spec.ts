import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { kbqThemeProvider } from '@koobiq/components/core';
import { KbqTooltipTrigger } from '@koobiq/components/tooltip';

import { ELEVATIONS, GEOMETRY, LAYERS, baseElevation, baseShadows } from '../model/shadow-model';
import { ShadowStore } from '../model/shadow-store';
import { SettingsPanel } from './settings-panel';

interface Rendered {
    fixture: ComponentFixture<SettingsPanel>;
    store: ShadowStore;
    root: HTMLElement;
}

/**
 * Панель поднимается как есть: провайдеры те же, что у демо, а адресная строка — её хранилище,
 * поэтому перед каждым рендером строка очищается.
 */
async function render(search = ''): Promise<Rendered> {
    history.replaceState(null, '', `/demo/shadow-tuner${search ? `?${search}` : ''}`);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
        imports: [SettingsPanel],
        providers: [kbqThemeProvider({ mode: 'light', storageKey: 'shadow-tuner-spec-theme' }), ShadowStore]
    }).compileComponents();

    const fixture = TestBed.createComponent(SettingsPanel);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, store: TestBed.inject(ShadowStore), root: fixture.nativeElement as HTMLElement };
}

/** Правка состояния видна на следующей проверке: сигналы панели обновляются только в ней. */
async function settle({ fixture }: Rendered): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

function numberField(root: HTMLElement, target: string): HTMLInputElement {
    return root.querySelector<HTMLInputElement>(`[data-target="${target}"] input`)!;
}

/**
 * Кнопка Коубика — нативный `button`, у группы переключателей он вложен. Клик идёт по кнопке,
 * а не по хосту: обработчик висит на ней.
 */
function button(root: HTMLElement, target: string, text?: string): HTMLButtonElement {
    const host = root.querySelector<HTMLElement>(`[data-target="${target}"]`)!;
    const buttons = host.matches('button')
        ? [host as HTMLButtonElement]
        : [...host.querySelectorAll<HTMLButtonElement>('button')];

    return (text ? buttons.find((item) => item.textContent?.trim() === text) : buttons[0])!;
}

/**
 * Набор в поле: директива числа пересчитывает значение в `setTimeout`, поэтому после `input`
 * нужна макрозадача, иначе модель формы не обновится и панель ничего не запишет.
 */
async function type({ fixture, root }: Rendered, target: string, text: string): Promise<void> {
    const input = numberField(root, target);

    input.value = text;
    input.dispatchEvent(new Event('input'));

    await new Promise((resolve) => setTimeout(resolve));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

describe('shadow settings', () => {
    let nativeGetComputedStyle: typeof window.getComputedStyle;

    /*
     * jsdom не разбирает стили Кубика: `getComputedStyle` падает на `Specificity.max(...)`, а CDK
     * спрашивает его у `body`, поднимая a11y-модуль. Панель проверяется по разметке и состоянию
     * хранилища, поэтому на время спек стили отдаются инлайновые.
     */
    beforeEach(() => {
        nativeGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = ((element: Element) => (element as HTMLElement).style) as typeof window.getComputedStyle;
    });

    afterEach(() => {
        window.getComputedStyle = nativeGetComputedStyle;
        // Меню сплит-кнопки живёт в оверлее на `body`: без уборки пункт виден соседнему тесту.
        document.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
    });

    it('renders three elevation sections and three shared colors', async () => {
        const { root } = await render();

        for (const elevation of ELEVATIONS) {
            const section = root.querySelector<HTMLElement>(`[data-target="elevation-${elevation}"]`);

            expect(section).not.toBeNull();
            expect(section?.querySelector('.settings__title')?.textContent?.trim()).toBe(
                elevation.charAt(0).toUpperCase() + elevation.slice(1)
            );
        }

        for (const layer of LAYERS) {
            const shared = root.querySelector<HTMLElement>(`[data-target="color-${layer}"]`);

            expect(shared?.tagName.toLowerCase()).toBe('app-palette-select');
            expect(shared?.querySelector('kbq-label')?.textContent?.trim()).toBe(
                layer.charAt(0).toUpperCase() + layer.slice(1)
            );
        }
    });

    it('keeps the elevation token in the tooltip of the question mark', async () => {
        const { fixture, root } = await render();

        for (const elevation of ELEVATIONS) {
            const heading = root.querySelector<HTMLElement>(`[data-target="elevation-${elevation}"] .settings__heading`)!;
            const trigger = heading.querySelector('i')!;
            const tooltip = fixture.debugElement
                .query(By.css(`[data-target="elevation-${elevation}"] .settings__heading i`))
                .injector.get(KbqTooltipTrigger);

            // Токен с экрана ушёл: он живёт только в подсказке кнопки.
            expect(heading.querySelector('code')).toBeNull();
            expect(trigger.classList).toContain('kbq-circle-question_16');
            expect(trigger.getAttribute('aria-label')).toBe(
                `Что за токен у уровня ${elevation.charAt(0).toUpperCase()}${elevation.slice(1)}`
            );
            expect(tooltip.content).toContain(`--kbq-shadow-${elevation}`);
        }
    });

    it('shows the reset hint on the left, away from the field group', async () => {
        const { fixture, root } = await render();
        const trigger = fixture.debugElement
            .query(By.css(`[data-target="reset-${ELEVATIONS[0]}"]`))
            .injector.get(KbqTooltipTrigger);

        // Сброс стоит у правого края панели: подсказка сверху наезжала бы на поля слоя.
        expect(trigger.tooltipPlacement).toBe('left');
        expect(trigger.arrowInput()).toBe(false);
        expect(root.querySelector(`[data-target="reset-${ELEVATIONS[0]}"]`)!.getAttribute('aria-label')).toBe('Сбросить');
    });

    it('gives every layer four numbers and its own color', async () => {
        const { root } = await render();

        for (const elevation of ELEVATIONS) {
            for (const layer of LAYERS) {
                const group = root.querySelector<HTMLElement>(`[data-target="${elevation}-${layer}"]`)!;

                expect(group.querySelectorAll('app-shadow-number-field').length).toBe(GEOMETRY.length);
                expect(group.querySelectorAll('app-palette-select').length).toBe(1);

                // Цвет слоя выбирается отдельным селектом: пункт общего токена у него первый.
                expect(
                    group.querySelector(`[data-target="${elevation}-${layer}-color"]`)?.tagName.toLowerCase()
                ).toBe('app-palette-select');

                for (const param of GEOMETRY) {
                    expect(group.querySelector(`[data-target="${elevation}-${layer}-${param}"]`)).not.toBeNull();
                }
            }
        }
    });

    it('shows a number written through the store and writes a typed one back', async () => {
        const rendered = await render();

        rendered.store.setGeometry('popup', 'key', 'blur', 12);
        await settle(rendered);

        expect(numberField(rendered.root, 'popup-key-blur').value).toBe('12');

        await type(rendered, 'card-key-blur', '20');

        expect(rendered.store.shadows().elevations.card.key.blur).toBe(20);
    });

    it('returns a level to the stock and drops its parameters from the address', async () => {
        const rendered = await render();

        rendered.store.setGeometry('card', 'key', 'blur', 20);
        rendered.store.setGeometry('popup', 'key', 'blur', 20);
        await settle(rendered);

        expect(window.location.search).toContain('light.card.key=0,1,20,0');

        button(rendered.root, 'reset-card').click();
        await settle(rendered);

        // Базовый card: обводка 1 px, key 0 1 4, ambient 0 1 6.
        expect(rendered.store.shadows().elevations.card).toEqual(baseElevation('light', 'card'));
        expect(rendered.store.shadows().elevations.card.key.blur).toBe(4);
        expect(window.location.search).not.toContain('light.card.');
        // Соседний уровень сброс не трогает: правка popup остаётся и в наборе, и в адресе.
        expect(rendered.store.shadows().elevations.popup.key.blur).toBe(20);
        expect(window.location.search).toContain('light.popup.key=0,2,20,0');

        button(rendered.root, 'reset-popup').click();
        await settle(rendered);

        // Базовый popup: key 0 2 8, ambient 0 3 8.
        expect(rendered.store.shadows().elevations.popup.key.blur).toBe(8);
        expect(window.location.search).not.toContain('light.popup.');
    });

    it('switches the compare view and back', async () => {
        const rendered = await render();

        expect(rendered.store.view()).toBe('after');

        button(rendered.root, 'compare', 'Было').click();
        await settle(rendered);

        expect(rendered.store.view()).toBe('before');

        button(rendered.root, 'compare', 'Стало').click();
        await settle(rendered);

        expect(rendered.store.view()).toBe('after');
    });

    it('resets the current theme from the split button and both themes from its menu', async () => {
        const rendered = await render();

        rendered.store.setGeometry('overlay', 'ambient', 'blur', 40);
        rendered.store.setColor('key', 'a12');
        await settle(rendered);

        button(rendered.root, 'reset-scheme').click();
        await settle(rendered);

        expect(rendered.store.shadows()).toEqual(baseShadows('light'));
        expect(window.location.search).toBe('');

        // Второстепенное действие живёт в меню сплит-кнопки: пункт появляется в оверлее на `body`.
        rendered.store.setGeometry('overlay', 'ambient', 'blur', 40);
        await settle(rendered);
        button(rendered.root, 'reset-more').click();
        await settle(rendered);

        const resetBoth = document.querySelector<HTMLButtonElement>('[data-target="reset-schemes"]')!;

        expect(resetBoth.textContent?.trim()).toBe('Сбросить обе темы');

        resetBoth.click();
        await settle(rendered);

        expect(rendered.store.shadows()).toEqual(baseShadows('light'));
        expect(window.location.search).toBe('');
    });

    it('makes the form read-only in the before view and editable again in after', async () => {
        const rendered = await render('view=before');
        const input = numberField(rendered.root, 'popup-key-blur');
        const select = rendered.root.querySelector<HTMLElement>('[data-target="popup-key-color"] kbq-select')!;

        expect(input.readOnly).toBe(true);
        // Степпер правит значение мимо клавиатуры, поэтому в «Было» его нет.
        expect(rendered.root.querySelector('[data-target="popup-key-blur"] kbq-stepper')).toBeNull();
        expect(select.classList.contains('kbq-disabled')).toBe(true);
        // Вид активного селекта без каретки — класс locked на самом выборе палитры.
        expect(rendered.root.querySelector('[data-target="popup-key-color"]')!.classList).toContain('locked');

        // Поле показывает прежний набор, а не сток темы.
        expect(input.value).toBe('8');

        button(rendered.root, 'compare', 'Стало').click();
        await settle(rendered);

        expect(numberField(rendered.root, 'popup-key-blur').readOnly).toBe(false);
        expect(rendered.root.querySelector('[data-target="popup-key-blur"] kbq-stepper')).not.toBeNull();
        expect(
            rendered.root.querySelector<HTMLElement>('[data-target="popup-key-color"] kbq-select')?.classList
        ).not.toContain('kbq-disabled');
        expect(rendered.root.querySelector('[data-target="popup-key-color"]')!.classList).not.toContain('locked');
    });

    it('copies the address and confirms it on the button', async () => {
        const writeText = vi.fn(() => Promise.resolve());

        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        try {
            const rendered = await render('?light.popup.key=0,2,20,0');

            expect(button(rendered.root, 'copy-url').textContent?.trim()).toBe('Скопировать URL');

            button(rendered.root, 'copy-url').click();
            await settle(rendered);
            // Подтверждение ставится после `await` буфера обмена — следующим тиком, а не в том же.
            await new Promise((resolve) => setTimeout(resolve));
            await settle(rendered);

            expect(writeText).toHaveBeenCalledWith(window.location.href);
            expect(button(rendered.root, 'copy-url').textContent?.trim()).toBe('Скопировано');
        } finally {
            Reflect.deleteProperty(navigator, 'clipboard');
        }
    });
});

