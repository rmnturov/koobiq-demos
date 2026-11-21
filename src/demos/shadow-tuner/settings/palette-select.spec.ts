import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { kbqThemeProvider } from '@koobiq/components/core';

import { Layer, LayerColor, Scheme } from '../model/shadow-model';
import { PaletteSelect } from './palette-select';

interface Rendered {
    fixture: ComponentFixture<PaletteSelectHost>;
    host: PaletteSelectHost;
    root: HTMLElement;
}

/** Хост держит входы выбора: значение, тему, слой и блокировку режима «Было». */
@Component({
    selector: 'app-palette-select-host',
    imports: [PaletteSelect],
    template: `
        <app-palette-select
            [value]="value()"
            [scheme]="scheme()"
            [token]="token()"
            [label]="label()"
            [locked]="locked()"
            (valueChange)="onValue($event)"
        />
    `
})
class PaletteSelectHost {
    readonly value = signal<LayerColor>('a8');
    readonly scheme = signal<Scheme>('light');
    readonly token = signal<Layer | null>('key');
    readonly label = signal('Цвет слоя');
    readonly locked = signal(false);
    readonly emitted = signal<LayerColor[]>([]);

    onValue(value: LayerColor): void {
        this.emitted.update((values) => [...values, value]);
    }
}

async function render(options: {
    value?: LayerColor;
    scheme?: Scheme;
    token?: Layer | null;
    locked?: boolean;
}): Promise<Rendered> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
        imports: [PaletteSelectHost],
        providers: [kbqThemeProvider({ mode: 'light', storageKey: 'shadow-tuner-spec-theme' })]
    }).compileComponents();

    const fixture = TestBed.createComponent(PaletteSelectHost);
    const host = fixture.componentInstance;

    if (options.value !== undefined) host.value.set(options.value);
    if (options.scheme !== undefined) host.scheme.set(options.scheme);
    if (options.token !== undefined) host.token.set(options.token);
    if (options.locked !== undefined) host.locked.set(options.locked);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, host, root: fixture.nativeElement as HTMLElement };
}

function triggerText(root: HTMLElement): string | undefined {
    return root.querySelector('.trigger__text')?.textContent?.trim();
}

/**
 * Образец красится инлайновым `background` с переменной палитры. Читается атрибут `style`,
 * а не `getComputedStyle`: на CSS Кубика jsdom его не считает.
 */
function swatchStyle(root: HTMLElement): string {
    return root.querySelector('.swatch')?.getAttribute('style') ?? '';
}

/** Пункты списка живут в оверлее CDK на `body`, поэтому ищутся по документу. */
function options(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>('kbq-option')];
}

function optionTexts(): string[] {
    return options().map((option) => option.textContent?.trim() ?? '');
}

function optionByText(text: string): HTMLElement | undefined {
    return options().find((option) => option.textContent?.trim() === text);
}

/** Список открывается кликом по триггеру: панель появляется на следующей проверке. */
async function open({ fixture, root }: Rendered): Promise<HTMLElement[]> {
    root.querySelector<HTMLElement>('.kbq-select__trigger')!.click();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return options();
}

/** Пункты палитры в порядке макета: сначала с альфой, потом сплошные. */
function paletteSlots(): string[] {
    const alpha = Array.from({ length: 20 }, (_, index) => `a${index + 1}`);
    const solid = Array.from({ length: 20 }, (_, index) => `${index + 1}`);

    return [...alpha, ...solid];
}

describe('shadow palette', () => {
    afterEach(() => {
        document.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
    });

    it('names the token slot after its layer and shows the palette slot as is', async () => {
        const token = await render({ value: 'token', token: 'key' });

        expect(triggerText(token.root)).toBe('shadow-key');

        const ambient = await render({ value: 'token', token: 'ambient' });

        expect(triggerText(ambient.root)).toBe('shadow-ambient');

        const slot = await render({ value: 'a8', token: 'key' });

        expect(triggerText(slot.root)).toBe('a8');
    });

    it('paints the swatch with the palette variable of the scheme', async () => {
        const light = await render({ value: 'a8', scheme: 'light' });

        expect(swatchStyle(light.root)).toContain('var(--kbq-semantic-contrast-a8)');

        const dark = await render({ value: 'a6', scheme: 'dark' });

        expect(swatchStyle(dark.root)).toContain('var(--kbq-semantic-dark-contrast-a6)');

        // Общий токен слоя красит образец переменной самого слоя, а не слотом палитры.
        const token = await render({ value: 'token', scheme: 'dark', token: 'key' });

        expect(swatchStyle(token.root)).toContain('var(--kbq-shadow-key)');
    });

    it('offers transparent, the line color, the token and both palette families', async () => {
        const list = await open(await render({ value: 'a8', token: 'key' }));

        expect(list.length).toBe(43);
        expect(optionTexts()).toEqual(['transparent', 'line-contrast-less', 'shadow-key', ...paletteSlots()]);

        // Две группы: альфа и сплошные — каждая со своей подписью и двадцатью пунктами.
        const groups = [...document.querySelectorAll<HTMLElement>('kbq-optgroup')];

        expect(groups.length).toBe(2);
        expect(groups.map((group) => group.textContent?.trim().startsWith('С альфой, a1…a20'))).toEqual([true, false]);
        expect(groups.map((group) => group.textContent?.trim().startsWith('Без прозрачности'))).toEqual([false, true]);
        expect(groups.map((group) => group.querySelectorAll('kbq-option').length)).toEqual([20, 20]);
    });

    it('leaves the token out when no layer is given', async () => {
        const list = await open(await render({ value: 'a8', token: null }));

        expect(list.length).toBe(42);
        expect(optionTexts()).toEqual(['transparent', 'line-contrast-less', ...paletteSlots()]);
    });

    it('paints the swatch of the line color with the koobiq line token', async () => {
        const rendered = await render({ value: 'line', scheme: 'light' });

        expect(swatchStyle(rendered.root)).toContain('var(--kbq-line-contrast-less)');
    });

    it('emits the slot of the chosen option', async () => {
        const rendered = await render({ value: 'a8', token: 'key' });

        await open(rendered);
        optionByText('12')!.click();

        rendered.fixture.detectChanges();
        await rendered.fixture.whenStable();
        rendered.fixture.detectChanges();

        expect(rendered.host.emitted()).toEqual(['12']);
    });

    /**
     * Блокировка «Было» остаётся Кубику (kbq-disabled), а вид активного селекта без каретки
     * вешает класс locked на хост: саму покраску jsdom не считает, она проверяется в браузере.
     */
    it('locks the choice in the before view while keeping the active look', async () => {
        const locked = await render({ value: 'a8', token: 'key', locked: true });

        expect(locked.root.querySelector<HTMLElement>('kbq-select')!.classList).toContain('kbq-disabled');
        expect(locked.root.querySelector('app-palette-select')!.classList).toContain('locked');

        const active = await render({ value: 'a8', token: 'key' });

        expect(active.root.querySelector<HTMLElement>('kbq-select')!.classList).not.toContain('kbq-disabled');
        expect(active.root.querySelector('app-palette-select')!.classList).not.toContain('locked');
    });
});
