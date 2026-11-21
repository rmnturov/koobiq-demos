import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ErrorStateMatcher } from '@koobiq/components/core';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqInputModule } from '@koobiq/components/input';

import { GEOMETRY_RANGE, GEOMETRY_STEP, Geometry, isValidGeometry } from '../model/shadow-model';

/** Значения применяются на лету, поэтому ошибка видна сразу, пока набирают, а не после blur. */
class WhileTypingMatcher implements ErrorStateMatcher {
    isErrorState(control: AbstractControl | null): boolean {
        return !!control?.invalid;
    }
}

/**
 * Числовой параметр тени. Валидное значение сразу уходит наружу, невалидное подсвечивается
 * и не применяется, а по расфокусу поле возвращается к последнему валидному значению.
 */
@Component({
    selector: 'app-shadow-number-field',
    imports: [KbqFormFieldModule, KbqInputModule, ReactiveFormsModule],
    template: `
        <kbq-form-field>
            <kbq-label>{{ label() }}</kbq-label>
            <input
                kbqNumberInput
                autocomplete="off"
                [integer]="step() === 1"
                [step]="step()"
                [withThousandSeparator]="false"
                [min]="range().min"
                [max]="range().max"
                [bigStep]="10"
                [readonly]="locked()"
                [formControl]="control"
                [errorStateMatcher]="matcher"
                (blur)="restore()"
            />
            @if (!locked()) {
                <kbq-stepper />
            }
            <kbq-error>{{ range().min }}…{{ range().max }}</kbq-error>
        </kbq-form-field>
    `,
    styles: `
        :host {
            display: block;
            min-width: 0;
        }

        /* Степпер нужен, только пока с полем работают: по наведению и в фокусе. */
        kbq-stepper {
            opacity: 0;
            transition: opacity 120ms ease-out;
        }

        kbq-form-field:hover kbq-stepper,
        kbq-form-field:focus-within kbq-stepper {
            opacity: 1;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShadowNumberField {
    readonly label = input.required<string>();
    readonly param = input.required<Geometry>();
    readonly value = input.required<number>();
    /** «Было» показывает сток темы: поле нельзя править, но оно показывает прежнее значение. */
    readonly locked = input(false);

    readonly valueChange = output<number>();

    protected readonly range = computed(() => GEOMETRY_RANGE[this.param()]);
    protected readonly step = computed(() => GEOMETRY_STEP[this.param()]);
    protected readonly matcher = new WhileTypingMatcher();
    protected readonly control = new FormControl<number | null>(null);

    constructor() {
        // Валидатор читает вход `param`, поэтому добавляется после конструктора контрола:
        // FormControl проверяет значение сразу, когда входов ещё нет.
        this.control.addValidators(
            (control): ValidationErrors | null =>
                isValidGeometry(control.value, this.param()) ? null : { range: true }
        );

        // Значение снаружи (смена уровня, сброс, тема) перерисовывает поле; своё эхо — нет.
        effect(() => {
            const value = this.value();

            if (this.control.value !== value) this.control.setValue(value, { emitEvent: false });
        });

        this.control.valueChanges.subscribe((value) => {
            if (isValidGeometry(value, this.param()) && value !== this.value()) this.valueChange.emit(value);
        });
    }

    /** Расфокус: невалидное значение сбрасывается до последнего валидного. */
    restore(): void {
        if (this.control.invalid) this.control.setValue(this.value(), { emitEvent: false });
    }
}
