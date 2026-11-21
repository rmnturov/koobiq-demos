/**
 * Живой прототип поля времени: маска, умная вставка и форматы на настоящем `kbq-form-field`.
 *
 * Точность и цикл часов лежат в URL (`?format=HH:mm:ss&cycle=h12`), поэтому состояние поля
 * отправляется ссылкой. Адрес пишется только через `replaceState`: переключение — не навигация,
 * история от него пухнуть не должна.
 *
 * Значение под карточкой читается у директивы (`field.value()`), а не у формы: `onChange`
 * приходит после проверки, и `control.value` в шаблоне отстаёт на тик.
 *
 * Оба тултипа — на `manual`: `KbqTooltipTrigger` показывает контент сам только для событий
 * пользователя, а здесь показом управляет директива (запрещенный символ и распознанная вставка).
 */

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
  ViewEncapsulation,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqButtonToggleModule } from '@koobiq/components/button-toggle';
import {
  KbqComponentColors,
  KbqOption,
  KbqOptionModule,
  PopUpPlacements,
} from '@koobiq/components/core';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqScrollbarViewport } from '@koobiq/components/scrollbar';
import { KbqToggleModule } from '@koobiq/components/toggle';
import { KbqToolTipModule } from '@koobiq/components/tooltip';

import { TimeInputDirective } from './time-input/time-input.directive';
import { FORMAT_LABELS, TIME_FORMATS } from './time-input/time-input.format';
import { HourCycle, TimeFormat } from './time-input/time-input.types';

/** Настройки поля, которые живут в адресе страницы. */
export interface PickerSettings {
  format: TimeFormat;
  cycle: HourCycle;
}

/** Поле по умолчанию: минуты и сутки целиком — самый частый случай. */
const DEFAULT_SETTINGS: PickerSettings = { format: 'HH:mm', cycle: 'h23' };

/** Циклы в порядке переключателя: сутки целиком, затем половина с меридиемом. */
const CYCLES: readonly { value: HourCycle; name: string }[] = [
  { value: 'h23', name: '24 часа' },
  { value: 'h12', name: '12 часов' },
];

/** Текущий query без зависимости от наличия `location` (тесты, SSR). */
const currentSearch = (): string => (typeof location === 'undefined' ? '' : location.search);

/**
 * Разбирает query: неизвестная точность и неизвестный цикл дают значение по умолчанию.
 * Разбор терпимый — ссылка со старым адресом не должна ломать демо.
 */
export function readPickerSettings(search: string): PickerSettings {
  const params = new URLSearchParams(search);
  const format = TIME_FORMATS.find((item) => item === params.get('format'));
  const cycle = CYCLES.find((item) => item.value === params.get('cycle'))?.value;

  return { format: format ?? DEFAULT_SETTINGS.format, cycle: cycle ?? DEFAULT_SETTINGS.cycle };
}

/** Переписывает query на месте: новая запись истории не появляется. */
export function writePickerSettings(settings: PickerSettings, history?: History): void {
  const target = history ?? (typeof window === 'undefined' ? undefined : window.history);

  target?.replaceState(null, '', `?format=${settings.format}&cycle=${settings.cycle}`);
}

@Component({
  selector: 'timepicker-demo',
  imports: [
    ReactiveFormsModule,
    KbqButtonModule,
    KbqButtonToggleModule,
    KbqFormFieldModule,
    KbqIconModule,
    KbqOptionModule,
    KbqScrollbarViewport,
    KbqToggleModule,
    KbqToolTipModule,
    TimeInputDirective,
  ],
  template: `
    <article class="demo">
      <p class="demo__lead kbq-text-normal">
        Живой прототип поля времени: маска, умная вставка, форматы с секундами, миллисекундами и
        AM/PM
      </p>

      <div class="demo__toggles">
        <kbq-button-toggle-group
          aria-label="Точность"
          [value]="format()"
          (change)="selectFormat($event.value)"
        >
          @for (item of formats; track item) {
            <kbq-button-toggle [value]="item" [attr.data-format]="item">{{
              labels[item]
            }}</kbq-button-toggle>
          }
        </kbq-button-toggle-group>

        <kbq-button-toggle-group
          aria-label="Цикл часов"
          [value]="cycle()"
          (change)="selectCycle($event.value)"
        >
          @for (item of cycles; track item.value) {
            <kbq-button-toggle [value]="item.value" [attr.data-cycle]="item.value">{{
              item.name
            }}</kbq-button-toggle>
          }
        </kbq-button-toggle-group>
      </div>

      <div class="demo__suggest-settings">
        <kbq-toggle [checked]="suggestionsEnabled()" (change)="setSuggestions($event.checked)"
          >Подсказки</kbq-toggle
        >

        <!-- Опции показываются только при включенных подсказках: выключенная группа не занимает место. -->
        @if (suggestionsEnabled()) {
          <div class="demo__suggest-options" role="group" aria-label="Открытие подсказок">
            <kbq-toggle
              data-target="focus"
              [checked]="openOnFocus()"
              (change)="setOpenOnFocus($event.checked)"
              >Открытие по фокусу</kbq-toggle
            >

            <kbq-toggle
              data-target="chevron"
              [checked]="chevronEnabled()"
              (change)="setChevron($event.checked)"
              >Шеврон</kbq-toggle
            >
          </div>
        }
      </div>

      <div class="demo__field-options" role="group" aria-label="Поле">
        <kbq-toggle
          data-target="clock"
          [checked]="clockIcon()"
          (change)="setClockIcon($event.checked)"
          >Иконка часов</kbq-toggle
        >

        <kbq-toggle
          data-target="clearable"
          [checked]="clearable()"
          (change)="setClearable($event.checked)"
          >Очистка</kbq-toggle
        >
      </div>

      <section class="demo__card">
        <div class="demo__field-wrap">
          <!-- Оба сообщения висят на одном тултипе у каретки: распознавание и запрещенный символ. -->
          <kbq-form-field class="demo__field" data-target="field" [style.width.px]="fieldWidth()">
            <kbq-label>Время</kbq-label>
            @if (clockIcon()) {
              <i
                kbqPrefix
                kbq-icon="kbq-clock_16"
                class="demo__clock"
                aria-hidden="true"
                [autoColor]="true"
              ></i>
            }
            <input
              kbqTimeInput
              #field="kbqTimeInput"
              #fieldTooltip="kbqTooltip"
              required
              [format]="format()"
              [hourCycle]="cycle()"
              [formControl]="control"
              [kbqSuggestions]="suggestionsEnabled()"
              [kbqSuggestionOpenOnFocus]="openOnFocus()"
              [kbqClearable]="clearable()"
              [kbqActiveSuggestionId]="activeOptionId()"
              [kbqSubmitAttempted]="submitAttempted()"
              [kbqRecognizedTooltip]="fieldTooltip"
              [kbqValidationTooltip]="fieldTooltip"
              [kbqTooltip]="field.tooltipText()"
              [kbqTooltipColor]="
                field.recognizedText() ? KbqComponentColors.Contrast : KbqComponentColors.Error
              "
              [kbqRelativeToCaret]="true"
              [kbqPlacement]="PopUpPlacements.Top"
              [kbqTooltipArrow]="false"
              [kbqTrigger]="'manual'"
              [kbqEnterDelay]="10"
            />
            @if (clearable() && !field.empty()) {
              <button
                class="demo__clear-icon demo__field-button"
                type="button"
                kbqSuffix
                tabindex="-1"
                aria-label="Очистить поле"
                (mousedown)="$event.preventDefault()"
                (click)="clearField()"
              >
                <i kbq-icon="kbq-xmark-circle_16" [autoColor]="true"></i>
              </button>
            }
            @if (showChevron()) {
              <button
                class="demo__chevron demo__field-button"
                type="button"
                kbqSuffix
                tabindex="-1"
                aria-hidden="true"
                (mousedown)="$event.preventDefault()"
                (click)="field.toggleSuggestions()"
              >
                <i kbq-icon="kbq-chevron-down-s_16" [autoColor]="true"></i>
              </button>
            }
            @if (field.errorText(); as error) {
              <kbq-error>{{ error }}</kbq-error>
            }
          </kbq-form-field>

          @if (field.suggestionsOpen()) {
            <!-- Панель как у Autocomplete: свой оверлейный скроллбар, список внутри. -->
            <div class="demo__suggestions">
              <div class="demo__suggestion-scroll" kbqScrollbarViewport>
                <ul
                  class="demo__suggestion-list"
                  role="listbox"
                  aria-label="Подсказки времени"
                  [id]="field.suggestionListId"
                  (mousedown)="$event.preventDefault()"
                >
                  @for (item of field.suggestions(); track $index) {
                    <kbq-option
                      #suggestionOption="kbqOption"
                      [value]="item"
                      (mouseenter)="field.setActiveSuggestion($index)"
                      (click)="field.selectSuggestion(item)"
                    >
                      {{ field.suggestionText(item) }}
                    </kbq-option>
                  }
                </ul>
              </div>
            </div>
          }
        </div>

        <div class="demo__actions">
          <button
            kbq-button
            type="button"
            class="demo__submit"
            data-action="submit"
            [color]="KbqComponentColors.Contrast"
            (click)="submit()"
          >
            Отправить
          </button>
          <button kbq-button type="button" class="demo__clear" (click)="clear()">Очистить</button>
        </div>
      </section>

      <!-- Значение стоит под карточкой, а не в ней: строка описывает результат всей карточки. -->
      <p class="demo__value kbq-text-compact">
        Значение поля: <span class="demo__value-text" data-value>{{ field.value() ?? '—' }}</span>
      </p>

      @if (sentValue(); as sent) {
        <p class="demo__value kbq-text-compact" data-sent>Форма отправлена: {{ sent }}</p>
      }

      <!-- Скрытый живой регион: текст тултипа распознавания для скринридера. -->
      <p class="demo__live" aria-live="polite">{{ field.recognizedText() ?? '' }}</p>
    </article>
  `,
  styleUrl: './timepicker.demo.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimepickerDemo {
  protected readonly formats = TIME_FORMATS;
  protected readonly labels = FORMAT_LABELS;
  protected readonly cycles = CYCLES;
  protected readonly KbqComponentColors = KbqComponentColors;
  protected readonly PopUpPlacements = PopUpPlacements;

  /** Настройка демо: показывать ли выпадашку подсказок. По умолчанию выключена. */
  protected readonly suggestionsEnabled = signal(false);

  /** Настройка демо: открывать список автоматически по фокусу пустого поля. */
  protected readonly openOnFocus = signal(true);

  /** Настройка демо: показывать ли шеврон; клик по нему открывает список. */
  protected readonly chevronEnabled = signal(false);

  /** Настройка демо: кнопка очистки и очистка по Esc. */
  protected readonly clearable = signal(false);

  /** Настройка демо: статичная иконка часов слева. */
  protected readonly clockIcon = signal(false);

  /** Шеврон — независимая опция: показывается, только когда включен. */
  protected readonly showChevron = computed(
    () => this.suggestionsEnabled() && this.chevronEnabled(),
  );

  protected readonly control = new FormControl<string | null>(null);

  /** Поле нужно кнопке отправки: после неудачной проверки фокус встает в него. */
  private readonly field = viewChild(TimeInputDirective);

  /** Строки списка — настоящие `kbq-option`: разметку, состояния и стили ведет компонент. */
  private readonly options = viewChildren<KbqOption>('suggestionOption');

  /** `id` подсвеченной строки для `aria-activedescendant`: его выдает `kbq-option`. */
  protected readonly activeOptionId = computed(() => {
    const index = this.field()?.activeSuggestion();

    return index === null || index === undefined ? null : (this.options()[index]?.id ?? null);
  });

  /** Попытка отправки включает ошибки, которые по blur не показываются, — например пустое обязательное поле. */
  protected readonly submitAttempted = signal(false);

  /** Подтверждение отправки: строка появляется только после успешной проверки. */
  protected readonly sentValue = signal<string | null>(null);

  constructor() {
    // Открытие страницы — сразу в поле: демо показывает маску, а не пустую карточку без фокуса.
    afterNextRender(() => this.field()?.focus());

    // Подсветка и прокрутка строки: состояние ведет `kbq-option`, в поле зрения ее возвращаем сами.
    effect(() => {
      const index = this.field()?.activeSuggestion() ?? null;
      const options = this.options();

      options.forEach((option, position) =>
        position === index ? option.setActiveStyles() : option.setInactiveStyles(),
      );

      const active = index === null ? undefined : options[index]?.getHostElement();

      if (active) {
        requestAnimationFrame(() => active.scrollIntoView?.({ block: 'nearest' }));
      }
    });

    // Выбранная строка: если значение поля есть в списке, `kbq-option` рисует ее выбранной.
    effect(() => {
      const field = this.field();
      const options = this.options();
      const suggestions = field?.suggestions() ?? [];

      options.forEach((option, index) => {
        const value = suggestions[index];
        const selected = value !== undefined && (field?.isSuggestionSelected(value) ?? false);

        selected ? option.select(false) : option.deselect(false);
      });
    });

    // Любая правка отменяет прошлую отправку: строка подтверждения к новому значению не относится.
    this.control.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.sentValue.set(null));
  }

  private readonly settings = signal(readPickerSettings(currentSearch()));

  protected readonly format = computed(() => this.settings().format);
  protected readonly cycle = computed(() => this.settings().cycle);

  /**
   * Поле уже карточки: ширина растет с точностью, в 12-часовом цикле — еще на меридием и иконки.
   * База и добавки совпадают с макетом: 80/104/128 px, иконка 28 px, очистка 28 px + 16 px зазора.
   * Шеврон резервирует свои 28 px, только когда очистки нет; с очисткой его слот уже помещается
   * в добавленные 44 px.
   */
  protected readonly fieldWidth = computed(() => {
    const precision = this.format() === 'HH:mm' ? 80 : this.format() === 'HH:mm:ss' ? 104 : 128;
    const addons = (this.clockIcon() ? 28 : 0) + (this.clearable() ? 28 + 16 : 0);
    const chevron = this.showChevron() && !this.clearable() ? 28 : 0;

    return precision + (this.cycle() === 'h12' ? 30 : 0) + addons + chevron;
  });

  protected selectFormat(format: TimeFormat): void {
    this.apply({ ...this.settings(), format });
  }

  protected selectCycle(cycle: HourCycle): void {
    this.apply({ ...this.settings(), cycle });
  }

  /** Выключение подсказок закрывает открытый список и убирает шеврон из поля. */
  protected setSuggestions(enabled: boolean): void {
    this.suggestionsEnabled.set(enabled);
    this.field()?.closeSuggestions();
  }

  /** Новое поведение применяется сразу: без фокуса старый открытый список закрывается. */
  setOpenOnFocus(enabled: boolean): void {
    this.openOnFocus.set(enabled);

    if (!enabled) {
      this.field()?.closeSuggestions();
    }
  }

  /** Шеврон — независимая опция: включение показывает кнопку, выключение убирает. */
  setChevron(enabled: boolean): void {
    this.chevronEnabled.set(enabled);
  }

  /** Одна опция отвечает и за крестик, и за очистку по Esc. */
  setClearable(enabled: boolean): void {
    this.clearable.set(enabled);
  }

  /** Иконка часов — только оформление: на ввод, фокус и значение не влияет. */
  setClockIcon(enabled: boolean): void {
    this.clockIcon.set(enabled);
  }

  /** Кнопка демо: сбрасывает поле в пустое состояние и возвращает в него фокус. */
  protected clear(): void {
    this.submitAttempted.set(false);
    this.sentValue.set(null);
    this.control.reset(null);
    this.field()?.focus();
  }

  /**
   * Крестик в поле: та же отмена неудачной отправки, что и у кнопки под карточкой,
   * иначе пустое обязательное поле сразу краснеет.
   */
  protected clearField(): void {
    this.submitAttempted.set(false);
    this.sentValue.set(null);
    this.field()?.clear();
  }

  /** Отправка не блокируется: кнопка всегда активна, а проверка и фокус происходят по клику. */
  protected submit(): void {
    this.submitAttempted.set(true);
    this.sentValue.set(null);
    this.control.markAsTouched();
    this.control.updateValueAndValidity();

    if (this.control.invalid) {
      this.field()?.selectAll();

      return;
    }

    this.sentValue.set(this.field()?.value() ?? '—');
  }

  /** Настройка применяется сразу и переписывает адрес: ссылка повторяет то, что на экране. */
  private apply(settings: PickerSettings): void {
    this.settings.set(settings);
    writePickerSettings(settings);
  }
}
