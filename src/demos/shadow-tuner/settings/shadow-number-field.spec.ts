import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GEOMETRY_LABELS } from '../model/shadow-labels';
import { Geometry } from '../model/shadow-model';
import { ShadowNumberField } from './shadow-number-field';

interface Rendered {
    fixture: ComponentFixture<NumberFieldHost>;
    host: NumberFieldHost;
    root: HTMLElement;
}

/**
 * Хост повторяет панель: значение приходит числовым полю входом, а правка уходит наружу выходом.
 * Панель не переписывает вход на каждое событие, поэтому здесь тоже копится история значений.
 */
@Component({
    selector: 'app-number-field-host',
    imports: [ShadowNumberField],
    template: `
        <app-shadow-number-field
            [label]="label()"
            [param]="param()"
            [value]="value()"
            (valueChange)="onValue($event)"
        />
    `
})
class NumberFieldHost {
    readonly label = signal('Blur');
    readonly param = signal<Geometry>('blur');
    readonly value = signal(8);
    readonly emitted = signal<number[]>([]);

    onValue(value: number): void {
        this.emitted.update((values) => [...values, value]);
    }
}

/** Поле поднимается на входных значениях хоста: параметр задаёт и подпись, и диапазон. */
async function render(param: Geometry, value: number): Promise<Rendered> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [NumberFieldHost] }).compileComponents();

    const fixture = TestBed.createComponent(NumberFieldHost);
    const host = fixture.componentInstance;

    host.label.set(GEOMETRY_LABELS[param]);
    host.param.set(param);
    host.value.set(value);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, host, root: fixture.nativeElement as HTMLElement };
}

function field(root: HTMLElement): HTMLInputElement {
    return root.querySelector<HTMLInputElement>('input')!;
}

function formField(root: HTMLElement): HTMLElement {
    return root.querySelector<HTMLElement>('kbq-form-field')!;
}

/** Текст ошибки — диапазон параметра: форма показывает `kbq-error` только у невалидного поля. */
function error(root: HTMLElement): string | undefined {
    return root.querySelector('kbq-error')?.textContent?.trim();
}

/**
 * Набор в поле: директива пересчитывает значение в `setTimeout`, поэтому одного микротика мало —
 * до макрозадачи модель формы не обновится и валидатор не сработает.
 */
async function type({ fixture, root }: Rendered, text: string): Promise<void> {
    const input = field(root);

    input.value = text;
    input.dispatchEvent(new Event('input'));

    await new Promise((resolve) => setTimeout(resolve));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

/** Расфокус: поле возвращается к последнему валидному значению в микротаске формы. */
async function blur({ fixture, root }: Rendered): Promise<void> {
    field(root).dispatchEvent(new Event('blur'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

describe('shadow number field', () => {
    it('renders the label and the current value, naming the range in the error', async () => {
        const rendered = await render('blur', 8);

        expect(rendered.root.querySelector('kbq-label')?.textContent?.trim()).toBe('Blur');
        expect(field(rendered.root).value).toBe('8');

        // `kbq-error` форма показывает только в состоянии ошибки, поэтому диапазон виден на плохом наборе.
        await type(rendered, '500');

        expect(error(rendered.root)).toBe('0…96');
    });

    it('emits a valid value right after it is typed', async () => {
        const rendered = await render('blur', 8);

        await type(rendered, '12');

        expect(rendered.host.emitted()).toEqual([12]);
        expect(formField(rendered.root).classList).not.toContain('kbq-form-field_invalid');
    });

    it('keeps an out-of-range value in the field and marks it invalid before blur', async () => {
        const rendered = await render('blur', 8);

        await type(rendered, '500');

        expect(rendered.host.emitted()).toEqual([]);
        expect(field(rendered.root).value).toBe('500');
        expect(formField(rendered.root).classList).toContain('kbq-form-field_invalid');
    });

    it('rejects a value that does not fit the step of the parameter', async () => {
        const rendered = await render('spread', 0);

        await type(rendered, '0,25');

        expect(rendered.host.emitted()).toEqual([]);
        expect(field(rendered.root).value).toBe('0,25');
        expect(formField(rendered.root).classList).toContain('kbq-form-field_invalid');
    });

    it('returns to the last valid value on blur and drops the error', async () => {
        const rendered = await render('blur', 8);

        await type(rendered, '500');
        await blur(rendered);

        expect(field(rendered.root).value).toBe('8');
        expect(formField(rendered.root).classList).not.toContain('kbq-form-field_invalid');
        expect(rendered.host.emitted()).toEqual([]);
    });

    it('repaints the field when the value comes from the input', async () => {
        const rendered = await render('blur', 8);

        rendered.host.value.set(24);
        rendered.fixture.detectChanges();
        await rendered.fixture.whenStable();
        rendered.fixture.detectChanges();

        expect(field(rendered.root).value).toBe('24');
    });

    it('takes half-pixel spreads while x stays whole pixels', async () => {
        const spread = await render('spread', 0);

        await type(spread, '0,5');

        expect(spread.host.emitted()).toEqual([0.5]);
        expect(field(spread.root).value).toBe('0,5');

        const x = await render('x', 0);

        await type(x, '1,5');

        expect(x.host.emitted()).toEqual([]);
        expect(formField(x.root).classList).toContain('kbq-form-field_invalid');
        // Диапазон ошибки идёт от параметра: у x он тот же, что у spread, а у blur — 0…96.
        expect(error(x.root)).toBe('-32…32');
    });
});
