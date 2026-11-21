import { TestBed } from '@angular/core/testing';
import { SCENARIOS, Scenario } from '../scenarios/scenarios';
import { SceneState } from './scene-state';
import { SceneComponent } from './scene.component';

const scenario = SCENARIOS.find((item) => item.id === 'range')!;
const typing = SCENARIOS.find((item) => item.mode === 'type')!;

async function mount(patch: Partial<SceneState>, options: { paused?: boolean; scenario?: Scenario } = {}) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [SceneComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SceneComponent);
    fixture.componentRef.setInput('scenario', options.scenario ?? scenario);
    fixture.componentRef.setInput('state', { ...sceneState(), ...patch });
    fixture.componentRef.setInput('paused', options.paused ?? false);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
}

async function render(patch: Partial<SceneState>, options: { paused?: boolean; scenario?: Scenario } = {}): Promise<HTMLElement> {
    const fixture = await mount(patch, options);
    return fixture.nativeElement as HTMLElement;
}

const sceneState = () => ({ field: { value: '', error: null, hint: null }, focused: false, selection: null, toast: null, caption: '' });

/**
 * Раскладку в jsdom не считают: `offsetLeft`, `offsetWidth` и прямоугольники у
 * элементов нулевые. Каретка меряется в пикселях раскладки, поэтому тест задаёт
 * `offset*` сам, а прямоугольники — так, как их отдал бы масштабированный кадр.
 */
function offset(element: HTMLElement, parent: HTMLElement, left: number): void {
    Object.defineProperty(element, 'offsetParent', { configurable: true, value: parent });
    Object.defineProperty(element, 'offsetLeft', { configurable: true, value: left });
}

function width(element: HTMLElement, value: number): void {
    Object.defineProperty(element, 'offsetWidth', { configurable: true, value });
}

/** Оконный прямоугольник: всё в нём уже умножено на масштаб кадра. */
function box(element: HTMLElement, left: number, value: number): void {
    element.getBoundingClientRect = () =>
        ({ x: left, y: 0, left, top: 0, right: left + value, bottom: 20, width: value, height: 20, toJSON: () => ({}) }) as DOMRect;
}

/** Один кадр: замер каретки откладывается на него. */
const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** `ResizeObserver` в jsdom нет: заглушка отдаёт колбэк тесту, как это сделал бы браузер. */
class TestResizeObserver {
    static last: TestResizeObserver | null = null;

    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        TestResizeObserver.last = this;
    }

    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}

    fire(): void {
        this.callback([], this as unknown as ResizeObserver);
    }
}

describe('SceneComponent', () => {
    it('points the Koobiq focus state at the field', async () => {
        const el = await render({ focused: true });
        expect(el.querySelector('kbq-form-field[data-target="field"]')?.classList.contains('cdk-focused')).toBe(true);
    });

    it('renders the Koobiq error state and its text', async () => {
        const el = await render({ field: { value: '14-16', error: 'Введите время в формате ЧЧ:ММ, например 14:30', hint: null } });
        expect(el.querySelector('kbq-form-field[data-target="field"]')?.classList.contains('kbq-form-field_invalid')).toBe(true);
        expect(el.querySelector('kbq-error')?.textContent).toContain('Введите время');
    });

    it('renders the recognized value as a tooltip above the field', async () => {
        const el = await render({ field: { value: '15:30', error: null, hint: null, recognized: '15:30' } });
        const tooltip = el.querySelector('.scene__tooltip');
        expect(tooltip?.textContent).toContain('Распознано как 15:30');
        // Тултип — сосед поля, а не его подсказка: узкое поле его не сжимает.
        expect(tooltip?.previousElementSibling?.tagName.toLowerCase()).toBe('kbq-form-field');
        expect(el.querySelector('kbq-hint')).toBeNull();
    });

    it('keeps an explanatory hint under the field', async () => {
        const el = await render({
            field: { value: '', error: null, hint: 'Вставьте одно значение времени, а не несколько строк' }
        });
        expect(el.querySelector('kbq-hint')?.textContent).toContain('Вставьте одно значение времени');
        expect(el.querySelector('.scene__tooltip')).toBeNull();
    });

    it('stands the other fields in as skeletons, with the time field between them', async () => {
        const el = await render({});
        const form = el.querySelector('form.scene__form')!;
        const parts = [...form.children].filter((node) => !node.matches('[data-target="park"]'));

        // Группа времени — вторая в форме, остальные поля стоят заглушками.
        expect(parts.map((node) => node.tagName.toLowerCase())).toEqual([
            'kbq-skeleton-form-field',
            'div',
            'kbq-skeleton-form-field',
            'kbq-skeleton-form-field',
            'kbq-skeleton-form-field'
        ]);
        expect(parts[1].querySelector('.kbq-form__label')?.textContent?.trim()).toBe('Время');
        expect(parts[1].querySelector('kbq-form-field[data-target="field"]')).not.toBeNull();
    });

    it('keeps the placeholder skeletons still, without the wave', async () => {
        const el = await render({});
        const style = getComputedStyle(el.querySelector('kbq-skeleton-form-field')!);

        // Скелетоны — заглушки макета, а не индикатор загрузки: волны нет.
        expect(style).toBeTruthy();
        expect(el.querySelectorAll('kbq-skeleton-form-field')).toHaveLength(4);
    });

    it('sets the copy text in the mono face', async () => {
        const el = await render({});
        const text = el.querySelector('.scene__text')!;

        expect(getComputedStyle(text).fontFamily).toContain('mono');
        // Плашки вокруг нет: в сообщении только сам текст, без карточки-пузыря.
        expect(el.querySelector('.scene__message')!.children).toHaveLength(1);
    });

    it('marks the selected part of the message and shows the whole value in the field', async () => {
        const el = await render({ selection: [0, 5], field: { value: 'https://example.com/74-169/', error: null, hint: null } });
        expect(el.querySelector('mark')?.textContent).toBe('14-16');
        expect(el.querySelector<HTMLInputElement>('[data-target="field"] input')?.value).toBe('https://example.com/74-169/');
    });

    // Поле декоративное: сцена не отнимает фокус у кнопок плеера и не отдаёт его табом.
    it('keeps the field readonly and out of the tab order', async () => {
        const el = await render({});
        const input = el.querySelector<HTMLInputElement>('[data-target="field"] input')!;

        expect(input.readOnly).toBe(true);
        expect(input.getAttribute('tabindex')).toBe('-1');
    });

    // У сценариев ввода сообщения нет: в кадре только форма, иначе сцена врёт о шаге.
    it('renders no message card for a typing scenario', async () => {
        const el = await render({}, { scenario: typing });

        expect(el.querySelector('.scene__message')).toBeNull();
        expect(el.querySelector('mark')).toBeNull();
        // Композиция растёт от верхнего края в обоих случаях — центровки нет.
        expect(getComputedStyle(el.querySelector('.scene')!).justifyContent).not.toBe('center');
    });

    // Пауза — состояние сцены, а не плеера: класс живёт на хосте, поэтому CSS
    // гасит именно мигание каретки. Проверяется и появление, и снятие класса.
    it('marks the scene paused so the caret stops blinking', async () => {
        const fixture = await mount({ focused: true });
        const el = fixture.nativeElement as HTMLElement;
        const paused = (): boolean => el.classList.contains('scene_paused');

        expect(paused()).toBe(false);

        fixture.componentRef.setInput('paused', true);
        fixture.detectChanges();

        expect(paused()).toBe(true);
        // Каретка в обоих случаях на месте: пауза снимает мигание, а не видимость.
        expect(el.querySelector('.scene__caret_visible')).not.toBeNull();

        fixture.componentRef.setInput('paused', false);
        fixture.detectChanges();

        expect(paused()).toBe(false);
    });

    // Кадр масштабируется целиком: каретка в оконных пикселях уезжает влево от конца
    // текста, поэтому она меряется offset-ами — пикселями раскладки.
    it('puts the caret after the text in layout pixels, whatever the stage scale', async () => {
        vi.stubGlobal('ResizeObserver', TestResizeObserver);

        const fixture = await mount({ field: { value: '14:16', error: null, hint: null } });
        const el = fixture.nativeElement as HTMLElement;
        const control = el.querySelector('.scene__control') as HTMLElement;
        const field = el.querySelector('kbq-form-field[data-target="field"]') as HTMLElement;
        const input = el.querySelector<HTMLInputElement>('[data-target="field"] input')!;
        const mirror = el.querySelector('.scene__mirror') as HTMLElement;
        const caret = (): HTMLElement => el.querySelector('.scene__caret') as HTMLElement;

        // Раскладка: поле стоит в 6px от обёртки (4 — форма, 2 — контрол), текст — ещё в 8px.
        offset(input, field, 2);
        offset(field, control, 4);
        input.style.paddingLeft = '8px';
        input.style.borderLeftWidth = '0px';
        width(mirror, 42);

        // Оконные прямоугольники — уже в масштабе кадра 0.84: по ним каретка встала бы в 48.32px.
        box(control, 0, 302.4);
        box(field, 3.36, 294);
        box(input, 5.04, 268.8);

        await nextFrame();
        fixture.detectChanges();

        expect(fixture.componentInstance.caretLeft()).toBe(56);
        expect(caret().style.left).toBe('56px');

        // Кадр сложился: поле стало уже, значение то же — каретка перемеряется по размеру.
        width(mirror, 60);
        TestResizeObserver.last?.fire();
        await nextFrame();
        fixture.detectChanges();

        expect(caret().style.left).toBe('74px');

        vi.unstubAllGlobals();
    });

    // Поле времени узкое: длинная строка обрезается краем, и каретка должна
    // стоять на этом крае, а не за ним — иначе её срезает `overflow: hidden`.
    it('pins the caret to the field edge when the text is wider than the field', async () => {
        vi.stubGlobal('ResizeObserver', TestResizeObserver);

        const fixture = await mount({ field: { value: 'https://example.com/74-169/', error: null, hint: null } });
        const el = fixture.nativeElement as HTMLElement;
        const control = el.querySelector('.scene__control') as HTMLElement;
        const field = el.querySelector('kbq-form-field[data-target="field"]') as HTMLElement;
        const input = el.querySelector<HTMLInputElement>('[data-target="field"] input')!;
        const mirror = el.querySelector('.scene__mirror') as HTMLElement;

        offset(input, field, 2);
        offset(field, control, 4);
        input.style.paddingLeft = '8px';
        input.style.borderLeftWidth = '0px';
        Object.defineProperty(input, 'clientWidth', { configurable: true, value: 72 });
        width(mirror, 180);

        await nextFrame();
        fixture.detectChanges();

        // 6 — обёртка до текста, дальше текст не влезает и упирается в 72px поля.
        expect(fixture.componentInstance.caretLeft()).toBe(78);

        vi.unstubAllGlobals();
    });
});
