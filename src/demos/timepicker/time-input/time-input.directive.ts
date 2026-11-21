import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterNextRender,
  booleanAttribute,
  computed,
  Directive,
  DoCheck,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  linkedSignal,
  OnDestroy,
  Provider,
  Renderer2,
  signal,
  untracked,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormGroupDirective,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  NgControl,
  NgForm,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import {
  ErrorStateMatcher,
  KbqErrorStateTracker,
  validationTooltipHideDelay,
} from '@koobiq/components/core';
import { KbqFormFieldControl } from '@koobiq/components/form-field';
import type { KbqTooltipTrigger } from '@koobiq/components/tooltip';

import {
  errorText as formatErrorText,
  formValue,
  formatTime,
  maskPlaceholder,
} from './time-input.format';
import { completeView, parseView, PasteOutcome, pasteOutcome } from './time-input.parse';
import {
  allowedOnly,
  clearSegment,
  edgeSelection,
  insertText,
  isAllowedChar,
  moveSelection,
  segmentAt,
  segmentSpans,
  selectSegment,
} from './time-input.edit';
import { incrementValue } from './time-input.increment';
import { filterTimeSuggestions, timeSuggestions } from './time-input.suggestions';
import { EditResult, HourCycle, Selection, TimeFormat, TimeValue } from './time-input.types';

/** @docs-private */
export const KBQ_TIME_INPUT_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => TimeInputDirective),
  multi: true,
};

/** @docs-private */
export const KBQ_TIME_INPUT_VALIDATORS: Provider = {
  provide: NG_VALIDATORS,
  useExisting: forwardRef(() => TimeInputDirective),
  multi: true,
};

const EMPTY_VIEW = '';

/** Текст о том, что вообще допустимо вводить; зависит от цикла часов. */
const TEXT_DIGITS = 'Только цифры';
const TEXT_DIGITS_AND_MERIDIEM = 'Только цифры и AM/PM';

/** Текст тултипа распознавания: `Распознано как 14:30`. */
const RECOGNIZED_PREFIX = 'Распознано как ';

/** Большой шаг сегмента по Shift: минуты и секунды перескакивают через десяток, часы — на 10 часов. */
const LARGE_STEP = 10;

/**
 * Поле времени внутри `kbq-form-field`: форма получает каноническую 24-часовую строку
 * текущей точности, поле показывает её в текущем цикле часов.
 *
 * Маска, навигация и вставка живут в чистой модели (`time-input.edit`, `time-input.parse`);
 * здесь — значение, форма, ошибка по blur и связывание клавиш с моделью.
 */
@Directive({
  selector: 'input[kbqTimeInput]',
  providers: [
    KBQ_TIME_INPUT_VALUE_ACCESSOR,
    KBQ_TIME_INPUT_VALIDATORS,
    { provide: KbqFormFieldControl, useExisting: forwardRef(() => TimeInputDirective) },
  ],
  host: {
    class: 'kbq-input',
    '[attr.id]': 'id()',
    '[attr.placeholder]': 'placeholder()',
    '[attr.aria-invalid]': 'errorState()',
    '[attr.disabled]': 'disabled() || null',
    '[attr.required]': 'required() || null',
    '[attr.role]': 'kbqSuggestions() ? "combobox" : null',
    '[attr.aria-autocomplete]': 'kbqSuggestions() ? "list" : null',
    '[attr.aria-expanded]': 'kbqSuggestions() ? suggestionsOpen() : null',
    '[attr.aria-controls]': 'kbqSuggestions() ? suggestionListId : null',
    '[attr.aria-activedescendant]':
      'suggestionsOpen() ? (kbqActiveSuggestionId() ?? activeSuggestionId()) : null',
    '[style.font-variant-numeric]': '"tabular-nums"',
    '[style.text-overflow]': '"clip"',
    '(focus)': 'onFocus()',
    '(blur)': 'onBlur()',
    '(input)': 'onInput()',
    '(paste)': 'onPaste($event)',
    '(keydown)': 'onKeydown($event)',
    '(compositionstart)': 'onCompositionStart()',
    '(compositionend)': 'onCompositionEnd()',
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',
    '(mouseup)': 'onMouseUp()',
    '(click)': 'onClick()',
  },
  exportAs: 'kbqTimeInput',
})
export class TimeInputDirective
  implements KbqFormFieldControl<string>, ControlValueAccessor, Validator, DoCheck, OnDestroy
{
  private readonly uid = inject(_IdGenerator).getId('kbq-time-input-');
  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  /** Точка инъекции для `afterNextRender`: показ тултипа отложен за пределы текущего события. */
  private readonly injector = inject(Injector);

  private readonly errorStateTracker = new KbqErrorStateTracker(
    inject(ErrorStateMatcher),
    null,
    inject(FormGroupDirective, { optional: true }),
    inject(NgForm, { optional: true }),
  );

  /** Ошибка видна: рамка и текст; состояние считает тот же матчер, что и у остальных полей Koobiq. */
  private readonly trackerErrorState = this.errorStateTracker.errorState;

  /** Пустое обязательное поле краснеет только после попытки отправки, остальное — по blur. */
  readonly errorState = computed(() => {
    if (!this.trackerErrorState()) {
      return false;
    }

    // Показываем только те ошибки, которые прошли правила показа: разбор по blur/отправке,
    // обязательность — по отправке. `required` от пустого значения сам по себе не краснеет.
    if (this.kbqSubmitAttempted()) {
      return (
        this.control?.hasError('required') === true ||
        this.control?.hasError('kbqTimeInputParse') === true
      );
    }

    return this.validationArmed() && this.parseErrorState();
  });

  /** Точность поля: минуты, секунды или миллисекунды. */
  readonly format = input<TimeFormat>('HH:mm');

  /** Цикл часов: сутки целиком или половина с меридиемом. */
  readonly hourCycle = input<HourCycle>('h23');

  /** Тултип ошибки ввода; заполняется задачей о тултипах. */
  readonly kbqValidationTooltip = input<KbqTooltipTrigger | undefined>(undefined);

  /** Тултип распознанной вставки; заполняется задачей о тултипах. */
  readonly kbqRecognizedTooltip = input<KbqTooltipTrigger | undefined>(undefined);

  /** Была попытка отправить форму: пустое обязательное поле и нераспознанный текст показывают ошибку. */
  readonly kbqSubmitAttempted = input(false, { transform: booleanAttribute });

  /** @docs-private */
  readonly idInput = input<string | undefined>(undefined, { alias: 'id' });

  /** Implemented as part of KbqFormFieldControl. */
  readonly id = computed(() => this.idInput() || this.uid);

  /** Маска видна только в фокусе или под курсором: в покое пустое поле остается чистым. */
  readonly placeholder = computed(() =>
    this.focusedState() || this.hoveredState()
      ? maskPlaceholder(this.format(), this.hourCycle())
      : '',
  );

  /** Implemented as part of KbqFormFieldControl. */
  readonly required = input(false, { transform: booleanAttribute });

  /** Подсказки включены: поле становится combobox с выпадающим списком времени. */
  readonly kbqSuggestions = input(false, { transform: booleanAttribute });

  /** Открывать список автоматически, когда поле получает фокус. */
  readonly kbqSuggestionOpenOnFocus = input(true, { transform: booleanAttribute });

  /** Показывать кнопку очистки и разрешать очистку по Esc. */
  readonly kbqClearable = input(false, { transform: booleanAttribute });

  /**
   * `id` подсвеченного варианта, если список рисует `kbq-option`: у компонента свой `id`,
   * и `aria-activedescendant` должен указывать на него, а не на расчетный.
   */
  readonly kbqActiveSuggestionId = input<string | null>(null);

  /** @docs-private */
  readonly disabledInput = input(false, {
    alias: 'disabled',
    transform: booleanAttribute,
  });

  /** Implemented as part of KbqFormFieldControl. Also set by the bound form control. */
  readonly disabled = linkedSignal(() => this.disabledInput());

  /** Implemented as part of KbqFormFieldControl. */
  readonly controlType = 'input';

  private readonly valueState = signal<TimeValue | null>(null);

  /** Implemented as part of KbqFormFieldControl. Значение формы: каноническая 24-часовая строка. */
  readonly value = computed(() => {
    const value = this.valueState();

    return value === null ? null : formValue(value, this.format());
  });

  private readonly viewState = signal(EMPTY_VIEW);

  /** Implemented as part of KbqFormFieldControl. Пустой вид — пустое поле. */
  readonly empty = computed(() => this.viewState().length === 0);

  private readonly focusedState = signal(false);

  /** Implemented as part of KbqFormFieldControl. */
  readonly focused = this.focusedState.asReadonly();

  /** Ввод проверяется по расфокусу; поле, уже отмеченное ошибкой, проверяется на ходу. */
  private readonly validationArmed = signal(false);

  /** Курсор над полем: маска показывается без фокуса, чтобы формат был виден до клика. */
  private readonly hoveredState = signal(false);

  /** Разбор не распознал непустой вид. */
  private readonly parseErrorState = signal(false);

  /** Текст тултипа распознавания: `Распознано как 14:30`, пока тултип виден. */
  readonly recognizedText = signal<string | null>(null);

  /** Список подсказок combobox: сетка на полчаса вокруг значения или текущего времени. */
  readonly suggestions = signal<TimeValue[]>([]);

  /** Список открыт; клавиши ходят по `activeSuggestion`, а не по тексту поля. */
  readonly suggestionsOpen = signal(false);

  /** Подсвеченный вариант; `null` — подсветки нет, Enter ничего не выбирает. */
  readonly activeSuggestion = signal<number | null>(null);

  /** `id` списка и вариантов для `aria-controls`/`aria-activedescendant`. */
  readonly suggestionListId = `${this.uid}suggestions`;

  readonly activeSuggestionId = computed(() => {
    const index = this.activeSuggestion();

    return this.suggestionsOpen() && index !== null ? this.suggestionOptionId(index) : null;
  });

  /** Текст ошибки под полем: только нераспознанный текст; пустое обязательное поле молчит. */
  readonly errorText = computed(() => {
    if (!this.errorState() || !this.parseErrorState()) {
      return null;
    }

    return formatErrorText(this.format(), this.hourCycle());
  });

  /** Что вообще допустимо вводить: в 12-часовом цикле ещё и половину суток. */
  readonly invalidText = computed(() =>
    this.hourCycle() === 'h12' ? TEXT_DIGITS_AND_MERIDIEM : TEXT_DIGITS,
  );

  /** Текст единственного тултипа поля: сначала распознавание, иначе запрещенный символ. */
  readonly tooltipText = computed(() => this.recognizedText() ?? this.invalidText());

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};
  private validatorOnChange: () => void = () => {};
  private control: AbstractControl | null = null;

  /** Последнее значение, отданное форме: смена точности сравнивает с ним, а не с видом. */
  private reportedForm: string | null = null;

  /** Точность, в которой форма получила `reportedForm`: по ней эффект отличает настоящую смену. */
  private reportedFormat: TimeFormat | null = null;

  /** Цикл часов, в котором форма получила `reportedForm`. */
  private reportedCycle: HourCycle | null = null;

  private lastFormat: TimeFormat | null = null;
  private lastCycle: HourCycle | null = null;

  /**
   * Сырое состояние: текст попал в поле мимо маски и остается как есть.
   * Заканчивается очисткой поля, распознанной вставкой, канонизацией по blur и записью из формы.
   */
  private rawState = false;

  /** Идет композиция IME: маска не применяется, текст читается после `compositionend`. */
  private composing = false;

  private recognizedTimer: ReturnType<typeof setTimeout> | null = null;

  /** Тултип сейчас показан: Esc гасит его до очистки поля. */
  private tooltipVisible = false;

  /** Точность, при которой тултипы уже погашены: смена формата гасит их один раз. */
  private tooltipFormat: TimeFormat | null = null;
  private tooltipCycle: HourCycle | null = null;

  /**
   * Отдает форме значение новой точности после проверки шаблона.
   *
   * Вид перерисовывается в `ngDoCheck` (он нужен в том же прогоне CD), а модель — здесь: запись
   * `control.value` из `ngDoCheck` ломает потребителя, который вывел значение в шаблоне выше поля,
   * — первая проверка видит старое значение, и dev-режим бросает
   * `ExpressionChangedAfterItHasBeenCheckedError`.
   */
  private readonly reportFormatChange = effect(() => {
    const format = this.format();
    const cycle = this.hourCycle();

    untracked(() => this.reportForm(format, cycle));
  });

  /**
   * Смена точности или цикла гасит оба тултипа: их текст набран в прежнем формате.
   * Это эффект, а не `ngDoCheck`: скрытие тултипа меняет его сигналы, и внутри проверки
   * это дало бы `ExpressionChangedAfterItHasBeenCheckedError`.
   */
  private readonly hideTooltipsOnFormatChange = effect(() => {
    const format = this.format();
    const cycle = this.hourCycle();

    untracked(() => {
      const changed =
        this.tooltipFormat !== null &&
        (format !== this.tooltipFormat || cycle !== this.tooltipCycle);

      this.tooltipFormat = format;
      this.tooltipCycle = cycle;

      if (changed) {
        this.hideTooltips();
      }
    });
  });

  /** Implemented as part of KbqFormFieldControl. */
  get ngControl(): NgControl | null {
    return this.control as unknown as NgControl | null;
  }

  ngDoCheck(): void {
    this.syncView();
    this.updateErrorState();
  }

  ngOnDestroy(): void {
    this.clearRecognizedTimer();
  }

  /** Implemented as part of KbqFormFieldControl. */
  focus(options?: FocusOptions): void {
    this.elementRef.nativeElement.focus(options);
  }

  /** Фокус в поле и все значение выделено: после неудачной отправки видно, что править. */
  selectAll(): void {
    this.focus();
    this.elementRef.nativeElement.select();
  }

  /** `id` варианта списка: по нему `aria-activedescendant` указывает на подсвеченную строку. */
  suggestionOptionId(index: number): string {
    return `${this.uid}suggestion-${index}`;
  }

  /** Подпись варианта в текущем формате и цикле часов. */
  suggestionText(value: TimeValue): string {
    return formatTime(value, this.format(), this.hourCycle());
  }

  /** Совпадает ли вариант с текущим значением поля: так список помечает выбранную строку. */
  isSuggestionSelected(value: TimeValue): boolean {
    const current = this.valueState();

    return (
      current !== null &&
      current.hours === value.hours &&
      current.minutes === value.minutes &&
      current.seconds === value.seconds &&
      current.milliseconds === value.milliseconds
    );
  }

  /**
   * Открывает список подсказок; повторный вызов ничего не меняет.
   *
   * Заполненное поле показывает всю сетку без фильтра; недонабранное — только варианты
   * с набранным префиксом, поэтому фокус на `11:` не возвращает полный список.
   */
  openSuggestions(): void {
    if (!this.kbqSuggestions() || this.suggestionsOpen()) {
      return;
    }

    const value = this.valueState();
    const view = this.viewState();
    const suggestions =
      value === null && view.trim()
        ? this.matchingSuggestions(view)
        : timeSuggestions(value, new Date());

    if (!suggestions.length) {
      return;
    }

    this.suggestions.set(suggestions);
    this.activeSuggestion.set(this.openedActiveSuggestion(suggestions));
    this.suggestionsOpen.set(true);
  }

  /**
   * Подсветка при открытии списка: строка текущего значения, если она есть в сетке.
   *
   * Заполненное поле без такой строки не подсвечивает ничего: Enter не подменит значение
   * соседним слотом. Пустое поле оставляет первую строку — с нее начинается ход стрелками.
   */
  private openedActiveSuggestion(suggestions: TimeValue[]): number | null {
    const index = suggestions.findIndex((value) => this.isSuggestionSelected(value));

    if (index !== -1) {
      return index;
    }

    return this.valueState() === null ? 0 : null;
  }

  /** Закрывает список, не меняя значение и подсветку поля. */
  closeSuggestions(): void {
    this.suggestionsOpen.set(false);
    this.activeSuggestion.set(null);
  }

  /** Шеврон: открыть, если закрыт, и закрыть, если открыт. */
  toggleSuggestions(): void {
    if (this.suggestionsOpen()) {
      this.closeSuggestions();

      return;
    }

    this.openSuggestions();
  }

  /** Подсветка строки мышью или клавишами. */
  setActiveSuggestion(index: number): void {
    if (index >= 0 && index < this.suggestions().length) {
      this.activeSuggestion.set(index);
    }
  }

  /** Выбор варианта: значение становится каноническим, список закрывается. */
  selectSuggestion(value: TimeValue): void {
    this.rawState = false;
    this.tentativeMinutes = false;
    this.parseErrorState.set(false);
    this.validationArmed.set(false);
    this.writeView(formatTime(value, this.format(), this.hourCycle()));
    this.moveCaret({ start: this.viewState().length, end: this.viewState().length });
    this.commit(value);
    this.closeSuggestions();
    this.hideTooltips();
  }

  /** Очистка из кнопки или по Esc: пустой вид, `null` в форме, каретка в начале, фокус в поле. */
  clear(): void {
    this.rawState = false;
    this.tentativeMinutes = false;
    this.parseErrorState.set(false);
    this.validationArmed.set(false);
    this.writeView(EMPTY_VIEW);
    this.moveCaret({ start: 0, end: 0 });
    this.commit(null);

    // Фокус ставим до закрытия: программный focus может открыть список по фокусу.
    this.elementRef.nativeElement.focus();
    this.closeSuggestions();
    this.hideTooltips();
  }

  /**
   * Клавиши открытого списка по паттерну combobox: ↓/↑ ходят по строкам, Enter выбирает,
   * Esc закрывает без выбора, Tab закрывает и оставляет набранное. Возвращает `true`,
   * когда событие обработано и маске его видеть не нужно.
   */
  private handleSuggestionKey(event: KeyboardEvent): boolean {
    const open = this.suggestionsOpen();

    // Ctrl/Cmd-сочетания остаются браузеру и системе, Alt нужен только для стрелок.
    if (event.ctrlKey || event.metaKey) {
      return false;
    }

    if (event.altKey && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return false;
    }

    switch (event.key) {
      case 'ArrowDown':
        // Закрытый список стрелку не перехватывает: она по-прежнему двигает сегмент.
        if (!open && !event.altKey) {
          return false;
        }

        event.preventDefault();

        if (open) {
          this.moveActiveSuggestion(1);
        } else {
          this.openSuggestions();
        }

        return true;

      case 'ArrowUp':
        if (!open && !event.altKey) {
          return false;
        }

        event.preventDefault();

        // APG: Alt+↑ в открытом списке закрывает его и возвращает управление полю.
        if (open) {
          if (event.altKey) {
            this.closeSuggestions();

            return true;
          }

          this.moveActiveSuggestion(-1);

          return true;
        }

        this.openSuggestions();
        this.moveActiveSuggestion(-1);

        return true;

      case 'Enter': {
        if (!open) {
          return false;
        }

        const active = this.activeSuggestion();
        const value = active === null ? undefined : this.suggestions()[active];

        // Подсветки нет или она стоит на текущем значении: выбирать нечего, Enter уходит форме.
        if (value === undefined || this.isSuggestionSelected(value)) {
          this.closeSuggestions();

          return false;
        }

        event.preventDefault();
        this.selectSuggestion(value);

        return true;
      }

      case 'Tab':
        // Фокус уходит дальше, набранное остается: выбор по Tab не подтверждаем.
        this.closeSuggestions();

        return false;

      case 'ArrowLeft':
      case 'ArrowRight':
        // Каретка возвращается к сегментам, список больше не нужен.
        this.closeSuggestions();

        return false;

      default:
        return false;
    }
  }

  private moveActiveSuggestion(delta: number): void {
    const length = this.suggestions().length;

    if (length === 0) {
      return;
    }

    const current = this.activeSuggestion();
    const next = current === null ? 0 : (current + delta + length) % length;

    this.activeSuggestion.set(next);
  }

  /** Implemented as part of KbqFormFieldControl. */
  onContainerClick(): void {
    this.focus();
  }

  onFocus(): void {
    this.focusedState.set(true);

    // Опция «Открытие по фокусу» открывает список и на заполненном поле: текущее время в нем помечено.
    if (this.kbqSuggestions() && this.kbqSuggestionOpenOnFocus()) {
      this.openSuggestions();
    }
  }

  onMouseEnter(): void {
    this.hoveredState.set(true);
  }

  onMouseLeave(): void {
    this.hoveredState.set(false);
  }

  onBlur(): void {
    this.focusedState.set(false);
    this.closeSuggestions();
    this.hideTooltips();

    // Начатые с минут нули без введенных минут — не значение: поле возвращается к пустому.
    if (this.tentativeMinutes) {
      this.tentativeMinutes = false;
      this.parseErrorState.set(false);
      this.writeView(EMPTY_VIEW);
      this.viewState.set(EMPTY_VIEW);
      this.commit(null);
      this.validationArmed.set(false);
      this.validatorOnChange();
      this.onTouched();
      this.updateErrorState();

      return;
    }

    const before = this.elementRef.nativeElement.value;

    this.readView(true);
    this.recognizeOnBlur(before);
    // В состояние ошибки поле входит по blur; дальше правки проверяются на ходу.
    this.validationArmed.set(this.parseErrorState());
    this.validatorOnChange();
    this.onTouched();
    this.updateErrorState();
  }

  onInput(): void {
    const text = this.elementRef.nativeElement.value;

    // IME: во время композиции текст только читается, нормализация идет после `compositionend`.
    if (this.composing) {
      this.viewState.set(text);

      return;
    }

    // Маска уже записала этот текст: событие пришло из ее же правки.
    if (text === this.viewState()) {
      return;
    }

    // Любой следующий ввод гасит тултип распознавания: он относился к прошлому значению.
    this.hideRecognizedTooltip();

    if (this.rawState) {
      this.hideValidationTooltip();
      this.readView(false);
      this.rawState = text.trim().length > 0;

      return;
    }

    const inserted = singleInsertion(this.viewState(), text);

    if (inserted === null) {
      this.hideValidationTooltip();
      this.readView(false);

      return;
    }

    const result = insertText(
      this.viewState(),
      { start: inserted.at, end: inserted.at },
      inserted.text,
      this.format(),
      this.hourCycle(),
    );

    if (result.rejected) {
      // Отброшенный символ не остается в поле: вид возвращается к прежнему.
      this.writeView(this.viewState());
      this.moveCaret({ start: inserted.at, end: inserted.at });
      this.showValidationTooltip();

      return;
    }

    this.applyEdit(result);
  }

  /**
   * Вставка из буфера. Несколько непустых строк — единственный случай, когда она блокируется:
   * остальное вставляет браузер, и нативная отмена остается целой.
   */
  onPaste(event: ClipboardEvent): void {
    const data = event.clipboardData;
    const text = data?.getData('text') ?? '';

    // Картинка или файл — не текст для поля: гасим вставку молча, без подсказки о строках.
    if (Array.from(data?.items ?? []).some((item) => item.kind === 'file')) {
      event.preventDefault();

      return;
    }

    if (text.length === 0) {
      return;
    }

    // Вставку делаем сами: браузер оставил бы переводы строк как есть.
    event.preventDefault();
    this.applyPaste(pasteOutcome(text, this.format(), this.hourCycle()));
  }

  /** Композиция IME: маска не вмешивается в набор до `compositionend`. */
  onCompositionStart(): void {
    this.composing = true;
  }

  /**
   * IME мог дописать букву мимо маски: недопустимые символы вычищаются из готового текста,
   * чтобы каретка и набранное не переписывались целиком.
   */
  onCompositionEnd(): void {
    this.composing = false;

    const text = this.elementRef.nativeElement.value;
    const filtered = allowedOnly(text, this.hourCycle());

    if (filtered === text) {
      this.readView(false);

      return;
    }

    this.writeView(filtered);
    this.moveCaret({ start: filtered.length, end: filtered.length });
    this.showValidationTooltip();
    this.readView(false);
  }

  /**
   * Клавиши ведут маску: цифры, разделители и буквы меридиема правят вид через модель,
   * стрелки и Home/End двигают выделение, Backspace/Delete очищают сегмент, ↑/↓ меняют его значение.
   * Печатный символ всегда гасится `preventDefault`, иначе браузер дописал бы его мимо маски.
   */
  onKeydown(event: KeyboardEvent): void {
    // Композиция IME ведет ввод сама: клавиши и текст в ней маску не касаются.
    if (event.isComposing || this.composing) {
      return;
    }

    // Esc сначала гасит тултип и выпадашку: очистка — только следующим нажатием.
    if (event.key === 'Escape') {
      const overlayOpen =
        this.suggestionsOpen() || this.tooltipVisible || this.recognizedText() !== null;

      if (overlayOpen) {
        event.preventDefault();
        this.closeSuggestions();
        this.hideTooltips();

        return;
      }

      if (this.kbqClearable() && !this.empty()) {
        event.preventDefault();
        this.clear();

        return;
      }
    }

    // Открытый combobox и Alt со стрелкой забирают клавиши до масок и системных команд.
    if (this.kbqSuggestions() && this.handleSuggestionKey(event)) {
      return;
    }

    // Ctrl/Meta/Alt — команды браузера и системы: копирование, вставку и отмену обрабатывает
    // сам `input`, маска в них не вмешивается.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    // Автокомплит: набор открывает список; маска обработает символ дальше.
    if (
      !this.suggestionsOpen() &&
      this.kbqSuggestions() &&
      event.key.length === 1 &&
      isAllowedChar(event.key, this.hourCycle(), this.viewState())
    ) {
      this.openSuggestions();
    }

    // Сырое состояние: клавиши идут в браузер, маска только не пускает недопустимые символы.
    if (this.rawState) {
      this.onRawKeydown(event);

      return;
    }

    const format = this.format();
    const cycle = this.hourCycle();
    const view = this.viewState();

    switch (event.key) {
      case 'Backspace':
      case 'Delete':
        event.preventDefault();
        this.applyEdit(
          clearSegment(
            view,
            this.selection(),
            format,
            cycle,
            event.key === 'Backspace' ? 'back' : 'forward',
          ),
        );

        return;

      case 'ArrowLeft':
        event.preventDefault();
        this.moveCaret(moveSelection(view, this.selection(), -1, format, cycle));

        return;

      case 'ArrowRight':
        event.preventDefault();

        // Пустое поле не имеет сегментов: «Вправо» заполняет часы нулями и выделяет минуты.
        if (view.length === 0) {
          this.startAtMinutes();

          return;
        }

        this.moveCaret(moveSelection(view, this.selection(), 1, format, cycle));

        return;

      case 'Home':
      case 'PageUp':
        event.preventDefault();
        this.moveCaret(edgeSelection(view, 'start', format, cycle));

        return;

      case 'End':
      case 'PageDown':
        event.preventDefault();
        this.moveCaret(edgeSelection(view, 'end', format, cycle));

        return;

      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault();
        this.increment((event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? LARGE_STEP : 1));

        return;
    }

    if (event.key.length !== 1) {
      return;
    }

    event.preventDefault();

    // Символ, которого нет в словаре поля, до маски не доходит: тот же тултип, что и у IME.
    if (!isAllowedChar(event.key, cycle, view.slice(0, this.selection().start))) {
      this.showValidationTooltip();

      return;
    }

    const result = insertText(view, this.selection(), event.key, format, cycle);

    if (result.rejected) {
      this.showValidationTooltip();

      return;
    }

    this.applyEdit(result);
  }

  /** Клик по полю выделяет сегмент под кареткой: значение и вид не меняются. */
  onMouseUp(): void {
    this.handlePointer();
  }

  /** Тот же выбор сегмента для клавиатурной активации поля и для браузеров без `mouseup`. */
  onClick(): void {
    this.handlePointer();
  }

  /** Implemented as part of ControlValueAccessor. */
  writeValue(value: string | null): void {
    untracked(() => {
      this.rawState = false;
      this.tentativeMinutes = false;

      if (value === null || value === EMPTY_VIEW) {
        this.parseErrorState.set(false);
        this.valueState.set(null);
        this.reportedForm = null;
        this.writeView(EMPTY_VIEW);

        return;
      }

      const parsed = parseView(value, this.format(), this.hourCycle());

      if (parsed === null) {
        this.reportedForm = value;
        this.parseErrorState.set(true);
        this.valueState.set(null);
        this.writeView(value);

        return;
      }

      this.reportedForm = formValue(parsed, this.format());
      this.parseErrorState.set(false);
      this.valueState.set(parsed);
      this.writeView(formatTime(parsed, this.format(), this.hourCycle()));
    });
  }

  /** Implemented as part of ControlValueAccessor. */
  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  /** Implemented as part of ControlValueAccessor. */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** Implemented as part of ControlValueAccessor. */
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  /** Implemented as part of Validator. */
  validate(control: AbstractControl): ValidationErrors | null {
    this.control = control;
    // Обёртка: трекер читает `ngControl.control`, а не сам контрол.
    this.errorStateTracker.ngControl = { control } as unknown as NgControl;

    // Untracked: валидация не должна привязывать потребителя, вызвавшего её из своего эффекта.
    return untracked(() =>
      (this.validationArmed() || this.kbqSubmitAttempted()) && this.parseErrorState()
        ? { kbqTimeInputParse: true }
        : null,
    );
  }

  /** Implemented as part of Validator. */
  registerOnValidatorChange(fn: () => void): void {
    this.validatorOnChange = fn;
  }

  private updateErrorState(): void {
    this.errorStateTracker.updateErrorState();
  }

  /** Границы выделения в поле; без выделения обе границы совпадают. */
  private selection(): Selection {
    const input = this.elementRef.nativeElement;
    const start = input.selectionStart ?? 0;

    return { start, end: input.selectionEnd ?? start };
  }

  /**
   * Записывает вид после правки маски и ставит каретку туда, куда её поставила модель.
   * Значение и ошибка обновляются в том же событии: форма не ждет blur.
   */
  private applyEdit(result: EditResult): void {
    let value = parseView(result.view, this.format(), this.hourCycle());

    // Начатый с минут нулевой час в 12-часовом цикле — это полночь, а не полдень: 12:xx = 00:xx.
    if (
      value !== null &&
      this.tentativeMinutes &&
      this.hourCycle() === 'h12' &&
      value.hours === 12 &&
      !/[ap]/i.test(result.view)
    ) {
      value = { ...value, hours: 0 };
    }

    this.parseErrorState.set(value === null && result.view.length > 0);
    this.hideValidationTooltip();
    this.writeView(result.view);
    this.elementRef.nativeElement.setSelectionRange(result.start, result.end);
    this.commit(value);

    // Автокомплит сужает список до вариантов, которые начинаются с набранного текста.
    if (this.suggestionsOpen()) {
      this.autocompleteSuggestions(result.view);
    }

    if (value !== null) {
      this.tentativeMinutes = false;
    }
  }

  /**
   * Автокомплит: в списке остаются только варианты с набранным префиксом.
   * Пустой текст возвращает сетку от значения поля, а без совпадений список закрывается.
   */
  private autocompleteSuggestions(view: string): void {
    if (!view.trim()) {
      this.suggestions.set(timeSuggestions(this.valueState(), new Date()));
      this.activeSuggestion.set(this.openedActiveSuggestion(this.suggestions()));

      return;
    }

    const matches = this.matchingSuggestions(view);

    if (!matches.length) {
      this.closeSuggestions();

      return;
    }

    this.suggestions.set(matches);
    this.activeSuggestion.set(0);
  }

  /** Варианты, подпись которых начинается с набранного текста. */
  private matchingSuggestions(view: string): TimeValue[] {
    return filterTimeSuggestions(timeSuggestions(null, new Date()), view, (value) =>
      this.suggestionText(value),
    );
  }

  /** Пустое поле: «Вправо» только ставит каретку в минуты, не создавая значение. */
  private tentativeMinutes = false;

  /** Переводит выделение между сегментами: значение и вид не меняются. */
  private moveCaret(selection: Selection): void {
    this.elementRef.nativeElement.setSelectionRange(selection.start, selection.end);
  }

  /**
   * Пустое поле: «Вправо» и клик по минутам фиксируют нулевые часы и ставят каретку в минуты.
   * Это еще не значение: без введенных минут blur вернет поле пустым.
   */
  private startAtMinutes(): void {
    const hours = this.hourCycle() === 'h12' ? '12' : '00';
    const view = this.hourCycle() === 'h12' ? `${hours}: AM` : `${hours}:`;
    const minutes = segmentSpans(view, this.format(), this.hourCycle()).find(
      (span) => span.segment === 'minutes',
    );

    this.tentativeMinutes = true;
    this.parseErrorState.set(false);
    this.hideValidationTooltip();
    this.writeView(view);
    this.viewState.set(view);
    this.commit(null);
    this.moveCaret({ start: minutes?.start ?? view.length, end: minutes?.end ?? view.length });
  }

  /**
   * Шаг сегмента под кареткой: вид перерисовывается целиком, поэтому выделение берётся
   * из нового текста — тот же сегмент остаётся под кареткой.
   * Пустое поле стартует с нулей: `↑` на часах дает `01:00`, `↓` — `23:00`.
   * Нераспознанный текст не инкрементируется: менять нечего.
   */
  private increment(delta: number): void {
    const view = this.viewState();
    let value = this.valueState();

    if (value === null) {
      if (view.length !== 0 && !this.tentativeMinutes) {
        return;
      }

      value = { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 };
    }

    const format = this.format();
    const cycle = this.hourCycle();
    const segment =
      view.length === 0 ? 'hours' : segmentAt(view, this.selection().start, format, cycle);
    const next = incrementValue(value, segment, delta);
    const text = formatTime(next, format, cycle);
    const span = segmentSpans(text, format, cycle).find((item) => item.segment === segment);

    this.parseErrorState.set(false);
    this.hideValidationTooltip();
    this.tentativeMinutes = false;
    this.writeView(text);
    this.elementRef.nativeElement.setSelectionRange(span?.start ?? 0, span?.end ?? 0);
    this.commit(next);
  }

  /**
   * Клик и `mouseup` выделяют сегмент под кареткой; пустое поле выделять нечего,
   * а сырой текст сегментов маски не имеет. Клик по placeholder в зоне минут
   * записывает нулевое время и сразу ставит ввод в минуты.
   */
  private selectSegmentAtCaret(): void {
    const view = this.viewState();

    if (view.length === 0 || this.rawState) {
      return;
    }

    this.moveCaret(selectSegment(view, this.selection().start, this.format(), this.hourCycle()));
  }

  /** Мышь в заполненном поле выделяет сегмент под кареткой; пустое поле ведет себя как обычный input. */
  private handlePointer(): void {
    if (this.viewState().length === 0) {
      this.moveCaret({ start: 0, end: 0 });

      if (this.kbqSuggestions() && this.kbqSuggestionOpenOnFocus()) {
        this.openSuggestions();
      }

      return;
    }

    this.selectSegmentAtCaret();
  }

  /**
   * Сырое состояние: клавиши идут в браузер как есть, маска только гасит недопустимый символ —
   * иначе он попал бы в текст, который пользователь вставил.
   */
  private onRawKeydown(event: KeyboardEvent): void {
    const input = this.elementRef.nativeElement;
    const before = input.value.slice(0, input.selectionStart ?? input.value.length);

    if (event.key.length !== 1 || isAllowedChar(event.key, this.hourCycle(), before)) {
      return;
    }

    event.preventDefault();
    this.showValidationTooltip();
  }

  /**
   * Применяет вставку сам, без браузера. Распознанная заменяет вид целиком и показывает тултип;
   * нераспознанная вставляется нормализованным текстом в каретку и включает сырое состояние.
   */
  private applyPaste(paste: PasteOutcome): void {
    if (paste.kind === 'as-is') {
      // Тултип распознавания относился к прошлому значению, а вставка его уже заменила.
      this.hideRecognizedTooltip();

      const input = this.elementRef.nativeElement;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      const next = input.value.slice(0, start) + paste.text + input.value.slice(end);
      const caret = start + paste.text.length;

      this.rawState = true;
      this.writeView(next);
      this.moveCaret({ start: caret, end: caret });
      this.readView(false);

      return;
    }

    const format = this.format();
    const cycle = this.hourCycle();
    const view = formatTime(paste.value, format, cycle);

    this.rawState = false;
    this.tentativeMinutes = false;
    this.parseErrorState.set(false);
    this.writeView(view);
    this.moveCaret({ start: view.length, end: view.length });
    this.commit(paste.value);
    this.showRecognizedTooltip(view);
  }

  /**
   * Канонизация по blur могла переписать текст (`9:5` → `09:05`, миллисекунды нулями):
   * об этом говорит тултип распознавания. Успешная канонизация заканчивает сырое состояние.
   */
  private recognizeOnBlur(before: string): void {
    if (this.valueState() === null) {
      return;
    }

    this.rawState = false;

    const after = this.elementRef.nativeElement.value;

    if (after !== before) {
      this.showRecognizedTooltip(after);
    }
  }

  /** Тултип запрещенного символа живет без таймера и прячет тултип распознавания: он важнее. */
  private showValidationTooltip(): void {
    const validation = this.kbqValidationTooltip();

    // Демо может повесить оба сообщения на один триггер: тогда достаточно сменить текст.
    if (this.kbqRecognizedTooltip() === validation) {
      this.clearRecognizedTimer();
      this.recognizedText.set(null);
    } else {
      this.hideRecognizedTooltip();
    }

    validation?.show();
    this.tooltipVisible = validation !== undefined;
  }

  private hideValidationTooltip(): void {
    this.kbqValidationTooltip()?.hide();
    this.tooltipVisible = false;
  }

  /**
   * Тултип распознавания живет `validationTooltipHideDelay`; текст его — канонический вид.
   *
   * Показ отложен до следующего рендера: `KbqTooltipTrigger` читает контент из `[kbqTooltip]`
   * только в `ngOnChanges`, а `show()` без контента молча выходит. В одном тике с записью
   * `recognizedText` контент еще пуст, поэтому сначала рендер привязывает текст, и только потом
   * тултип показывается — с него же стартует таймер скрытия.
   */
  private showRecognizedTooltip(view: string): void {
    const text = `${RECOGNIZED_PREFIX}${view}`;

    this.recognizedText.set(text);
    this.hideValidationTooltip();
    this.clearRecognizedTimer();

    const tooltip = this.kbqRecognizedTooltip();

    if (tooltip === undefined) {
      return;
    }

    afterNextRender(
      () => {
        // Пока шел рендер, текст мог смениться или погаснуть: показываем только актуальный.
        if (this.recognizedText() !== text) {
          return;
        }

        tooltip.show();
        this.tooltipVisible = true;
        this.recognizedTimer = setTimeout(() => {
          this.recognizedTimer = null;
          this.tooltipVisible = false;
          this.recognizedText.set(null);
          tooltip.hide();
        }, validationTooltipHideDelay);
      },
      { injector: this.injector },
    );
  }

  private hideRecognizedTooltip(): void {
    this.clearRecognizedTimer();
    this.recognizedText.set(null);
    this.tooltipVisible = false;
    this.kbqRecognizedTooltip()?.hide();
  }

  /** Оба тултипа разом: blur и смена точности. */
  private hideTooltips(): void {
    this.hideRecognizedTooltip();
    this.hideValidationTooltip();
  }

  private clearRecognizedTimer(): void {
    if (this.recognizedTimer !== null) {
      clearTimeout(this.recognizedTimer);
      this.recognizedTimer = null;
    }
  }

  /**
   * Читает набранный текст, который маска не писала: вставку, IME и правку мимо клавиш.
   * Канонизация (blur) переписывает распознанный вид текущим форматом.
   */
  private readView(canonical: boolean): void {
    const text = this.elementRef.nativeElement.value;
    const empty = text.trim().length === 0;
    let value = empty ? null : parseView(text, this.format(), this.hourCycle());

    // По blur недонабранные часы дочитываются нулями: `12` становится `12:00`.
    if (value === null && canonical && !empty) {
      value = completeView(text, this.format(), this.hourCycle());
    }

    this.viewState.set(text);
    this.parseErrorState.set(value === null && !empty);

    // Распознанный текст выводит поле из состояния ошибки: дальше оно снова проверяется по blur.
    if (value !== null) {
      this.validationArmed.set(false);
      this.tentativeMinutes = false;
    }

    if (value === null) {
      if (empty && canonical) {
        this.writeView(EMPTY_VIEW);
      }
    } else if (canonical) {
      this.writeView(formatTime(value, this.format(), this.hourCycle()));
    }

    this.commit(value);
  }

  /** Отдает форме изменившееся значение; неизменившееся только перепроверяет. */
  private commit(next: TimeValue | null): void {
    if (isSameTime(this.valueState(), next)) {
      this.validatorOnChange();

      return;
    }

    this.valueState.set(next);
    this.reportedForm = this.value();
    this.onChange(this.reportedForm);
  }

  /**
   * Смена точности или цикла: вид перерисовывается текущим форматом в этом же прогоне CD.
   * Модель формы трогает `reportForm` из эффекта — здесь только вид и сброс ошибки.
   *
   * Перерисовывается только вид, равный канону прошлого формата: недонабранное (`14:3`)
   * парсер уже читает как `14:03`, и перерисовка потеряла бы текст, который набрал пользователь.
   */
  private syncView(): void {
    const format = this.format();
    const cycle = this.hourCycle();

    if (format === this.lastFormat && cycle === this.lastCycle) {
      return;
    }

    const previousFormat = this.lastFormat;
    const previousCycle = this.lastCycle;

    this.lastFormat = format;
    this.lastCycle = cycle;

    untracked(() => {
      const value = this.valueState();

      this.parseErrorState.set(false);

      if (value === null) {
        return;
      }

      const canonical =
        previousFormat === null ||
        previousCycle === null ||
        this.viewState() === formatTime(value, previousFormat, previousCycle);

      if (!canonical) {
        return;
      }

      this.writeView(formatTime(value, format, cycle));
    });
  }

  /** Отдает форме значение новой точности; на первом запуске эффекта и без смены формата — ничего. */
  private reportForm(format: TimeFormat, cycle: HourCycle): void {
    if (this.reportedFormat === null) {
      // Первый запуск эффекта: форма уже получила значение в своей точности через `writeValue`/`commit`.
      this.reportedFormat = format;
      this.reportedCycle = cycle;

      return;
    }

    if (format === this.reportedFormat && cycle === this.reportedCycle) {
      return;
    }

    this.reportedFormat = format;
    this.reportedCycle = cycle;

    this.emitFormatValue(format);

    // `syncView` сбрасывает ошибку разбора, но рамку считает трекер: без пересчёта поле
    // остаётся красным уже без текста ошибки.
    this.updateErrorState();
  }

  /** Отдает форме каноническую строку новой точности, если она отличается от отданной раньше. */
  private emitFormatValue(format: TimeFormat): void {
    const value = this.valueState();

    if (value === null) {
      this.validatorOnChange();

      return;
    }

    const current = formValue(value, format);

    if (current === this.reportedForm) {
      this.validatorOnChange();

      return;
    }

    this.reportedForm = current;
    this.onChange(current);
  }

  private writeView(text: string): void {
    this.viewState.set(text);
    this.renderer.setProperty(this.elementRef.nativeElement, 'value', text);
  }
}

function isSameTime(a: TimeValue | null, b: TimeValue | null): boolean {
  if (a === b) {
    return true;
  }

  if (a === null || b === null) {
    return false;
  }

  return (
    a.hours === b.hours &&
    a.minutes === b.minutes &&
    a.seconds === b.seconds &&
    a.milliseconds === b.milliseconds
  );
}

/**
 * Один символ, дописанный мимо маски (IME, мобильная клавиатура). Правка текста целиком
 * возвращает `null` и читается как есть: фильтрация по одному символу не переписывает
 * значение и не ломает каретку.
 */
function singleInsertion(previous: string, next: string): { text: string; at: number } | null {
  if (next.length !== previous.length + 1) {
    return null;
  }

  let at = 0;

  while (at < previous.length && previous.charAt(at) === next.charAt(at)) {
    at += 1;
  }

  return next.slice(at + 1) === previous.slice(at) ? { text: next.charAt(at), at } : null;
}
