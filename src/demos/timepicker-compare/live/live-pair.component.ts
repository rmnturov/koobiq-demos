import { ChangeDetectionStrategy, Component, computed, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqTimepickerModule, TimeFormats } from '@koobiq/components/timepicker';
import { KbqToolTipModule } from '@koobiq/components/tooltip';

import { TimeInputDirective } from '../../timepicker/time-input/time-input.directive';
import type { TimeFormat } from '../../timepicker/time-input/time-input.types';

/**
 * Значение старого таймпикера — Luxon `DateTime`. Пакет `luxon` в проекте без типов,
 * а паре нужно от него одно: каноническая строка `ЧЧ:ММ`.
 */
export interface LuxonTime {
  toFormat(format: string): string;
}

/** Пустое значение в строке факта: прочерк вместо пустоты, чтобы строки не прыгали. */
const EMPTY_TEXT = '—';

/** Точность нового поля: строка точности, как у директивы из демо. */
const FORMAT = 'HH:mm';

/**
 * Точность старого поля — перечисление `TimeFormats`: к нему литерал `'HH:mm'` не приводится,
 * хотя значение то же самое.
 */
const OLD_FORMAT = TimeFormats.HHmm;

/**
 * Живая пара настоящих полей: слева текущий `kbqTimepicker`, справа новое поле из демо
 * `timepicker`. Оба принимают набор и вставку, значение формы у них своё, а общего у пары
 * ровно одно — подсказка «Только цифры»: она висит на общем триггере, иначе две копии
 * тултипа спорили бы за место на экране.
 *
 * Провайдер адаптера даты ставит реестр демо, спеке его подставляет `KbqLuxonDateModule`:
 * без адаптера старый таймпикер не создаётся.
 */
@Component({
  selector: 'tc-live-pair',
  imports: [
    ReactiveFormsModule,
    KbqFormFieldModule,
    KbqButtonModule,
    KbqTimepickerModule,
    KbqToolTipModule,
    TimeInputDirective,
  ],
  template: `
    <!--
      Триггер подсказки один на пару и живёт на самой паре: «manual» — потому что показывает
      его поле, а не наведение. Оба поля получают этот же триггер входом kbqValidationTooltip.
    -->
    <div
      class="pair"
      #digitsTip="kbqTooltip"
      [kbqTooltip]="'Только цифры'"
      [kbqTrigger]="'manual'"
    >
      <section class="pair__side" data-target="old">
        <kbq-form-field class="pair__field">
          <input
            kbqTimepicker
            [format]="oldFormat"
            [formControl]="oldControl"
            [kbqValidationTooltip]="digitsTip"
          />
        </kbq-form-field>

        <div class="pair__fact">
          <span class="pair__value kbq-text-compact" data-target="old-value">{{ oldText() }}</span>
          <button kbq-button type="button" class="pair__clear" (click)="clearOld()">Очистить</button>
        </div>
      </section>

      <section class="pair__side" data-target="next">
        <kbq-form-field class="pair__field">
          <input
            kbqTimeInput
            [format]="nextFormat"
            [hourCycle]="'h23'"
            [formControl]="nextControl"
            [kbqValidationTooltip]="digitsTip"
          />
        </kbq-form-field>

        <div class="pair__fact">
          <span class="pair__value kbq-text-compact" data-target="next-value">{{ nextText() }}</span>
          <button kbq-button type="button" class="pair__clear" (click)="clearNext()">Очистить</button>
        </div>
      </section>
    </div>
  `,
  styleUrl: './live-pair.component.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LivePairComponent {
  /** Точность старого поля: перечисление, какое просит `kbqTimepicker`. */
  protected readonly oldFormat = OLD_FORMAT;

  /** Точность нового поля: та же `ЧЧ:ММ`, но строкой — так её видит директива. */
  protected readonly nextFormat: TimeFormat = FORMAT;

  /** Старое поле: значение разбирает адаптер, отдаёт `DateTime`. */
  readonly oldControl = new FormControl<LuxonTime | null>(null);

  /** Новое поле: значение — каноническая 24-часовая строка. */
  readonly nextControl = new FormControl<string | null>(null);

  /** Значение старого поля как есть, из формы: поле правит его и набором, и стрелками. */
  private readonly oldValue = toSignal(this.oldControl.valueChanges, {
    initialValue: this.oldControl.value,
  });

  /** Значение нового поля: директива отдаёт форму уже в `ЧЧ:ММ`, приводить нечего. */
  private readonly nextValue = toSignal(this.nextControl.valueChanges, {
    initialValue: this.nextControl.value,
  });

  /** Строка факта под старым полем: нормализованный `ЧЧ:ММ` или прочерк. */
  readonly oldText = computed(() => this.oldValue()?.toFormat(OLD_FORMAT) ?? EMPTY_TEXT);

  /** Строка факта под новым полем: значение формы как есть или прочерк. */
  readonly nextText = computed(() => this.nextValue() ?? EMPTY_TEXT);

  /** Очистка только старой стороны: вторая половина пары не должна шевелиться. */
  clearOld(): void {
    this.oldControl.setValue(null);
    this.oldControl.markAsDirty();
  }

  /** Очистка только новой стороны. */
  clearNext(): void {
    this.nextControl.setValue(null);
    this.nextControl.markAsDirty();
  }
}
