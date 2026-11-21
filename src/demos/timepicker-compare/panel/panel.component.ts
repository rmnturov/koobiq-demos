import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ErrorStateMatcher } from '@koobiq/components/core';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqInputModule } from '@koobiq/components/input';
import { segmentAt, segmentSpans } from '../../timepicker/time-input/time-input.edit';
import { HourCycle, TimeFormat } from '../../timepicker/time-input/time-input.types';

/** Точность координат каретки: субпиксель с запасом, без мусора float-арифметики. */
const PRECISION = 100;

const tidy = (value: number): number => Math.round(value * PRECISION) / PRECISION;

/** Сторона панели в паре: от нее зависят внешние углы плашки и край вертикальной подписи. */
export type PanelSide = 'left' | 'right';

/** Прямоугольник в пикселях раскладки панели. */
export interface PanelBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Строка буфера: откуда она начинается и какой ширины. */
export interface ClipboardLine {
  /** Начало строки по центру ее строки: туда приходит рука. */
  readonly start: { x: number; y: number };
  /** Ширина строки: по ней растет выделение и идет рука. */
  readonly width: number;
}

/**
 * Геометрия буфера по строкам: текст из буфера бывает многострочным, и выделение
 * идет по строкам, как у мыши, — вниз и с переносом на новую строку.
 */
export interface ClipboardGeometry {
  readonly lines: readonly ClipboardLine[];
}

/** Геометрия поля: по ней блок сравнения ставит курсор, а панель — каретку. */
export interface FieldGeometry {
  /** Прямоугольник поля — от него считается точка покоя курсора в панели. */
  readonly box: PanelBox;
  /** Куда приходит курсор: начало текста поля по центру строки. */
  readonly point: { x: number; y: number };
}

/**
 * Доля выделения по строкам. Прогресс — это путь руки по сумме ширин: первая строка
 * заполняется целиком, остаток переходит на следующую. Без замера (ширины нулевые)
 * весь прогресс достается первой строке — так подложка видна и до раскладки.
 */
const coverageOf = (progress: number, widths: readonly number[]): number[] => {
  const total = widths.reduce((sum, width) => sum + width, 0);

  if (!(total > 0)) {
    return widths.map((_, index) => (index === 0 ? progress : 0));
  }

  let left = Math.min(Math.max(progress, 0), 1) * total;

  return widths.map((width) => {
    const part = width > 0 ? Math.min(Math.max(left, 0), width) / width : 0;

    left -= width;

    return part;
  });
};

/**
 * Левая граница элемента в пикселях раскладки: сумма `offsetLeft` до `boundary`.
 *
 * `offsetLeft` — геометрия раскладки, её не касается `transform: scale` на предке,
 * поэтому значение годится для координат внутри панели, а не только окна.
 */
function layoutLeft(element: HTMLElement, boundary: HTMLElement): number {
  let left = 0;

  for (
    let node: HTMLElement | null = element;
    node && node !== boundary;
    node = node.offsetParent as HTMLElement | null
  ) {
    left += node.offsetLeft;
  }

  return left;
}

/** Верхняя граница элемента в пикселях раскладки: сумма `offsetTop` до `boundary`. */
function layoutTop(element: HTMLElement, boundary: HTMLElement): number {
  let top = 0;

  for (
    let node: HTMLElement | null = element;
    node && node !== boundary;
    node = node.offsetParent as HTMLElement | null
  ) {
    top += node.offsetTop;
  }

  return top;
}

/**
 * Ошибка поля живёт во входе панели, а не в форме: матчер отдаёт её `kbq-form-field`,
 * поэтому подсветка и текст ошибки — штатные, как у настоящего поля.
 */
class PanelErrorStateMatcher implements ErrorStateMatcher {
  constructor(private readonly hasError: () => boolean) {}

  isErrorState(): boolean {
    return this.hasError();
  }
}

/**
 * Панель — картинка одной стороны сравнения: серая плашка 480 × 300 с узким полем
 * по центру, текст буфера сверху и вертикальная подпись у внешнего края. Панель ничего
 * не решает и не принимает ввода: вид, каретка, фокус, ошибка и тултипы приходят
 * готовыми входами, поэтому один и тот же макет проигрывает и постер, и каждый кадр.
 *
 * Поле декоративное: `readonly` и `tabindex="-1"`, `focus()` не вызывается — фокус
 * рисуется классом `.cdk-focused` на `kbq-form-field`, а каретка отдельным элементом
 * по замеру зеркала. Как и в сцене `time-input`, это не отнимает фокус у страницы.
 *
 * Плашка постоянная: высота 300 и `overflow: hidden` держат кадр независимо от длины
 * вида и от строки ошибки — длинная вставка обрезается полем, а не растит панель.
 *
 * Строка факта с панели снята: ее рисует блок сравнения под парой, вне серой плашки.
 */
@Component({
  selector: 'tc-panel',
  imports: [KbqFormFieldModule, KbqIconModule, KbqInputModule, ReactiveFormsModule],
  template: `
    <div class="panel" data-target="panel" [attr.data-side]="side()">
      <!--
        Подпись стороны — у внешнего края панели, поворот 90°. Она абсолютна, поэтому
        панель от нее не растет и поле не съезжает. Стоит вне .panel__content: это часть
        плашки, а не кадра, и на стыке проходов она не гаснет.
      -->
      <span class="panel__label kbq-caps-compact">{{ label() }}</span>

      <!--
        Плашка — статичный фон примера: прозрачности у нее нет ни на одном кадре, поэтому
        перезапуск прохода не читается как моргание. Содержимое — буфер, поле с кареткой
        и тултипы — подменяется целиком, одним кадром.
      -->
      <div class="panel__content" [class.panel__content_faded]="faded()">
        <!--
          Текст из буфера: одна строка шириной поля и многоточие — так на кадре. Место
          занято всегда, чтобы появление вставки не двигало поле.
        -->
        <span class="panel__clipboard kbq-text-normal" data-target="clipboard" #clipboardEl>
          @for (line of clipboardLines(); track $index) {
            <!--
              Строка буфера — свой блок: у многострочного текста своя подложка на каждой
              строке, и протяжка идет сначала по первой, потом по второй.
            -->
            <span class="panel__clipboard-line" #clipboardLine>
              <!--
                Выделение рисуется подложкой, а не фоном текста: подложка пустая, поэтому
                scaleX тянет ее слева направо, не плюща сами буквы.
              -->
              <span
                class="panel__selection"
                aria-hidden="true"
                [style.transform]="'scaleX(' + (coverage()[$index] ?? 0) + ')'"
                [style.transition-duration]="(coverage()[$index] ?? 0) === 0 ? '0ms' : null"
              ></span>
              <span class="panel__clipboard-text">{{ line }}</span>
            </span>
          }
        </span>

        <div class="panel__box" #box>
          <!--
            Слот тултипов: он висит над полем абсолютом, поэтому пузырь не сдвигает
            поле, а две панели рядом не разъезжаются друг с другом.
          -->
          <div class="panel__hints">
            @if (recognized()) {
              <div class="panel__hint kbq-text-compact" data-target="hint">{{ recognized() }}</div>
            }
            @if (blocked()) {
              <!-- Отдельный маркер: по нему страница сравнения ищет тултип отказа. -->
              <div
                class="panel__hint kbq-text-compact"
                data-target="hint_error"
                [class.panel__hint_error]="blockedTone() === 'error'"
                [class.panel__hint_contrast]="blockedTone() === 'contrast'"
              >
                {{ blocked() }}
              </div>
            }
          </div>

          <kbq-form-field
            class="panel__field"
            data-target="field"
            [class.cdk-focused]="focused()"
          >
            <i kbq-icon="kbq-clock_16" kbqPrefix></i>
            <input
              kbqInput
              readonly
              tabindex="-1"
              [placeholder]="mask()"
              [formControl]="control"
              [errorStateMatcher]="errorMatcher"
            />
            @if (error()) {
              <kbq-error>{{ error() }}</kbq-error>
            }
          </kbq-form-field>

          <!--
            Зеркало держит текст поля целиком: сам input текста в разметку не отдаёт.
            Каретка меряется по префиксу, подсветка сегмента — по двум его частям: текст
            до сегмента и сам сегмент. Спаны стоят соседями, без зазора.
          -->
          <!--
            Часы маски — чтобы рука приходила в минуты: там стоит каретка после фокуса,
            и клик по левой части поля обещал бы ввод часов.
          -->
          <span class="panel__measure" #maskPrefix aria-hidden="true">{{ minutesPrefix() }}</span>

          <span class="panel__mirror" aria-hidden="true">
            <span #head>{{ prefix() }}</span
            ><span #before>{{ beforeSegment() }}</span
            ><span #segment>{{ segmentText() }}</span
            ><span>{{ rest() }}</span>
          </span>

          <!--
            Подсветка сегмента маски: настоящее поле выделяет его фоном, и новый контрол
            делает то же. Слой лежит выше поля, а multiply держит буквы темными.
          -->
          @if (segmentLit()) {
            <span
              class="panel__segment"
              aria-hidden="true"
              [style.left.px]="segmentLeft()"
              [style.width.px]="segmentWidth()"
            ></span>
          }
          <span
            class="panel__caret"
            [class.panel__caret_visible]="caretVisible()"
            [style.left.px]="caretLeft()"
            [style.top.px]="caretTop()"
            aria-hidden="true"
          ></span>
        </div>
      </div>

      <!--
        Слот картинки: курсор и кепки клавиш рисует блок сравнения, но живут они в
        координатах плашки — поэтому проецируются внутрь и позиционируются от нее.
      -->
      <ng-content />
    </div>
  `,
  styleUrl: './panel.component.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelComponent implements AfterViewInit {
  /** Маска поля: `ЧЧ:ММ` или `ЧЧ:ММ AM`. Пустое поле показывает её вместо значения. */
  readonly mask = input.required<string>();

  /** Подпись стороны на плашке: «Кубик» слева, «Новый» справа. */
  readonly label = input.required<string>();

  /** Сторона пары: внешние углы плашки и край вертикальной подписи. */
  readonly side = input.required<PanelSide>();

  /** Что видно в поле: текст собирает сторона сравнения, панель его только рисует. */
  readonly view = input('');

  /** Каретка — индекс в `view`: сегмент под ней сторона сравнения тоже решает сама. */
  readonly caret = input(0);

  /** Фокус рисуется классом: поле панели фокус не получает. */
  readonly focused = input(false);

  /**
   * Содержимое погашено: так выглядит стык проходов. Гасится только содержимое —
   * серая плашка остается, и перезапуск не читается как моргание фона.
   */
  readonly faded = input(false);

  /** Ошибка разбора: та же строка, что настоящее поле показывает под собой. */
  readonly error = input<string | null>(null);

  /** Тултип распознавания: «Распознано как 15:30». */
  readonly recognized = input<string | null>(null);

  /** Тултип отказа: «Только цифры». */
  readonly blocked = input<string | null>(null);

  /**
   * Тема тултипа отказа. У текущего `KbqTimepicker` недопустимый символ показывает
   * черный пузырь (`kbq-contrast`), у нового поля отказ красный (`kbq-error`) — как
   * тултип валидации в демо `timepicker`. Это разные контролы, и цвет у них разный.
   */
  readonly blockedTone = input<'contrast' | 'error'>('error');

  /** Что лежит в буфере: строка над полем. */
  readonly clipboard = input<string | null>(null);

  /** Насколько выделен буфер: 0 — не выделен, 1 — выделен целиком. */
  readonly selection = input(0);

  /** Точность и цикл поля: по ним считается сегмент маски под кареткой. */
  readonly format = input<TimeFormat>('HH:mm');
  readonly cycle = input<HourCycle>('h23');

  /**
   * Подсвечивать ли сегмент маски под кареткой. Новое поле выделяет его фоном, как
   * настоящее: там выделение рисует браузер, а здесь его приходится рисовать панели.
   */
  readonly segmentHighlight = input(false);

  /**
   * Держать каретку в видимой зоне. Новое поле прокручивает длинный текст так, чтобы
   * каретка осталась у правого края, и видно конец строки; Кубик текст не прокручивает.
   */
  readonly keepCaret = input(false);

  /**
   * Видна ли каретка. Подсвеченный сегмент маски и есть указатель ввода: фон стоит там,
   * куда попадут цифры, и каретка рядом с ним показывала бы два указателя сразу.
   */
  readonly caretVisible = computed(() => this.focused() && !(this.segmentHighlight() && !!this.segmentText()));

  /** Сегмент под кареткой: его границы в виде поля. `null`, когда каретки нет. */
  private readonly segmentRange = computed(() => {
    if (!this.segmentHighlight() || !this.focused()) {
      return null;
    }

    const view = this.view();
    const span = segmentSpans(view, this.format(), this.cycle()).find(
      (item) => item.segment === segmentAt(view, this.caretIndex(), this.format(), this.cycle()),
    );

    return span && span.end > span.start ? span : null;
  });

  /** Текст до сегмента: по его ширине считается начало подсветки. */
  readonly beforeSegment = computed(() => {
    const range = this.segmentRange();
    const view = this.view();

    return range ? view.slice(0, range.start) : view.slice(0, this.caretIndex());
  });

  /** Текст сегмента: его ширина и есть ширина подсветки. */
  readonly segmentText = computed(() => {
    const range = this.segmentRange();

    return range ? this.view().slice(range.start, range.end) : '';
  });

  /** Строки буфера: перенос — это настоящая вторая строка, а не знак в тексте. */
  readonly clipboardLines = computed(() => (this.clipboard() ?? '').split('\n'));

  /** Ширины строк после замера: по ним доля выделения раскладывается по строкам. */
  private readonly lineWidths = signal<readonly number[]>([]);

  /** Доля выделения на каждую строку: одна протяжка идет по строкам сверху вниз. */
  readonly coverage = computed(() => coverageOf(this.selection(), this.lineWidths()));

  /** Текст до каретки: по нему зеркало отдаёт её положение. */
  readonly prefix = computed(() => this.view().slice(0, this.caretIndex()));

  /** Часы маски: по их ширине считается точка, куда приходит рука, — начало минут. */
  readonly minutesPrefix = computed(() => `${this.mask().split(':')[0]}:`);

  /** Текст после каретки: поле показывает его как есть, в том числе при выделении. */
  readonly rest = computed(() => this.view().slice(this.caretIndex()));

  /** Каретка не может выйти за вид: сторона сравнения присылает индекс выделения. */
  private readonly caretIndex = computed(() =>
    Math.min(Math.max(this.caret(), 0), this.view().length),
  );

  /** До первого замера каретка стоит у левого края поля. */
  readonly caretLeft = signal(0);

  /** До первого замера каретка стоит по центру строки поля. */
  readonly caretTop = signal(0);

  /** Начало и ширина подсветки сегмента: нулевая ширина — подсветки нет. */
  /** Текст сегмента, по которому снят замер: пока он не совпал, полосу не рисуем. */
  private readonly measuredSegment = signal('');

  /**
   * Полоса сегмента видна, когда замер догнал вид. Без этой сверки на кадр всплывала
   * ширина прошлого вида, и полоса мелькала не на месте — посреди подсказки поля.
   */
  readonly segmentLit = computed(
    () => !!this.segmentText() && this.measuredSegment() === this.segmentText() && this.segmentWidth() > 1,
  );

  readonly segmentLeft = signal(0);
  readonly segmentWidth = signal(0);

  /**
   * Ошибка `kbq-form-field` показывает по `errorState` контрола, а его обновляет матчер,
   * — поэтому поле панели живёт на настоящем `FormControl`, как поле сцены.
   */
  readonly control = new FormControl('', { nonNullable: true });

  /** Ошибки в форме нет: её отдаёт вход панели. */
  readonly errorMatcher = new PanelErrorStateMatcher(() => this.error() !== null);

  /** Спан префикса в зеркале: по его ширине считается положение каретки. */
  private readonly head = viewChild<ElementRef<HTMLElement>>('head');
  private readonly before = viewChild<ElementRef<HTMLElement>>('before');
  private readonly segment = viewChild<ElementRef<HTMLElement>>('segment');
  /** Скрытые часы маски: по их ширине считается точка прихода руки. */
  private readonly maskPrefix = viewChild<ElementRef<HTMLElement>>('maskPrefix');
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly clipboardEl = viewChild<ElementRef<HTMLElement>>('clipboardEl');
  private readonly lineEls = viewChildren<ElementRef<HTMLElement>>('clipboardLine');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private observer: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      // Контрол держит текст поля: поле панели только показывает его.
      this.control.setValue(this.view(), { emitEvent: false });
    });

    effect(() => {
      this.prefix();
      // Сегмент под кареткой и подсветка меняются вместе с видом и фокусом.
      this.segmentText();
      this.focused();
      // Буфер появляется своим кадром: без этой зависимости ширины строк не обновятся.
      this.clipboard();

      /*
       * Замер сразу и еще раз в следующем кадре: сразу — чтобы подсветка сегмента не
       * отставала от кадра, в кадре — потому что текст зеркала к моменту эффекта еще
       * старый, и ширина сегмента снимается по нему.
       */
      this.measure();
      this.schedule();
    });
  }

  ngAfterViewInit(): void {
    this.observe();
  }

  /**
   * Геометрия поля в пикселях раскладки панели — единственный источник координат для
   * блока сравнения: он больше не ищет поле строковым селектором и не повторяет обход
   * `offsetParent` за панелью.
   *
   * `null`, пока поле не отрисовано.
   */
  fieldGeometry(): FieldGeometry | null {
    const host = this.host.nativeElement;
    const field = this.box()?.nativeElement.querySelector<HTMLElement>('[data-target="field"]');
    const input = field?.querySelector<HTMLElement>('input');

    if (!field || !input) {
      return null;
    }

    return {
      box: {
        left: tidy(layoutLeft(field, host)),
        top: tidy(layoutTop(field, host)),
        width: field.offsetWidth,
        height: field.offsetHeight,
      },
      /*
       * Рука приходит в минуты, а не в начало поля: каретка после фокуса стоит там,
       * и клик по часам обещал бы ввод, которого в проходе нет.
       */
      point: {
        x: tidy(layoutLeft(input, host) + (this.maskPrefix()?.nativeElement.offsetWidth ?? 0)),
        y: tidy(layoutTop(input, host) + input.offsetHeight / 2),
      },
    };
  }

  /**
   * Геометрия строки буфера — по ней блок сравнения ведет руку к тексту перед
   * выделением. `null`, пока буфера нет: тогда и вести руку некуда.
   */
  clipboardGeometry(): ClipboardGeometry | null {
    const host = this.host.nativeElement;
    const lines = this.lineEls()
      .map((line) => line.nativeElement)
      .filter((line) => line.offsetWidth > 0)
      .map((line) => ({
        start: {
          x: tidy(layoutLeft(line, host)),
          y: tidy(layoutTop(line, host) + line.offsetHeight / 2),
        },
        width: line.offsetWidth,
      }));

    // Буфера нет — вести руку некуда: пустая строка ширины не имеет.
    return lines.length > 0 ? { lines } : null;
  }

  /** Ширины строк буфера: по ним раскладывается доля выделения. */
  private measureClipboard(): void {
    const widths = this.lineEls().map((line) => line.nativeElement.offsetWidth);
    const known = this.lineWidths();

    if (widths.length === known.length && widths.every((width, index) => width === known[index])) {
      return;
    }

    this.lineWidths.set(widths);
  }

  /**
   * Панель меняет ширину по месту (две колонки, ниже 1000 px — друг под другом),
   * а вид при этом не меняется — поэтому замер повторяется и по размеру обёртки поля,
   * а не только по тексту.
   */
  private observe(): void {
    const box = this.box()?.nativeElement;

    if (!box || typeof ResizeObserver !== 'function') {
      return;
    }

    this.observer = new ResizeObserver(() => this.schedule());
    this.observer.observe(box);
    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  /** Замер откладывается на кадр: в колбэке наблюдателя раскладка ещё не досчитана. */
  private schedule(): void {
    requestAnimationFrame(() => this.measure());
  }

  /**
   * Каретка меряется в пикселях раскладки: и положение поля, и ширина зеркала сняты
   * `offset*`, которые не масштабируются вместе с предком (`transform: scale`).
   */
  private measure(): void {
    this.measureClipboard();

    const head = this.head()?.nativeElement;
    const box = this.box()?.nativeElement;
    const input = box?.querySelector('input');

    if (!head || !box || !input) {
      return;
    }

    const style = getComputedStyle(input);

    head.style.font = style.font;
    head.style.letterSpacing = style.letterSpacing;

    const maskPrefix = this.maskPrefix()?.nativeElement;

    if (maskPrefix) {
      maskPrefix.style.font = style.font;
      maskPrefix.style.letterSpacing = style.letterSpacing;
    }

    for (const part of [this.before()?.nativeElement, this.segment()?.nativeElement]) {
      if (part) {
        part.style.font = style.font;
        part.style.letterSpacing = style.letterSpacing;
      }
    }

    const inset = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.borderLeftWidth) || 0);
    const tail = (parseFloat(style.paddingRight) || 0) + (parseFloat(style.borderRightWidth) || 0);
    const width = input.clientWidth;

    /*
     * Поле панели узкое: длинный текст не влезает, и каретка за краем пропала бы.
     * Настоящее поле прокручивает текст так, чтобы каретка осталась у правого края, —
     * и тогда видно конец строки, а начало уходит за левую границу. Здесь то же самое:
     * прокрутка ставится руками, потому что `readonly`-поле само не скроллится.
     */
    const text = inset + head.offsetWidth;
    const end = width > 0 ? width - tail : text;

    if (this.keepCaret() && width > 0) {
      input.scrollLeft = Math.max(0, text - end);
    }

    /*
     * Где каретка на самом деле: браузер может прокрутить чуть меньше, чем просили
     * (прокрутка считается вместе с паддингом), и позицию берем по факту, а не по просьбе.
     */
    const scroll = input.scrollLeft || 0;
    const edge = Math.max(0, Math.min(text - scroll, width > 0 ? width : text));

    this.caretLeft.set(tidy(layoutLeft(input, box) + edge));
    this.caretTop.set(tidy(layoutTop(input, box) + input.offsetHeight / 2));

    /*
     * Подсветка сегмента меряется по зеркалу — теми же шрифтом и кеглем, что у поля.
     * За краем поля её ширина обрезается: половина подсветки на пустом месте не читается.
     */
    const before = this.before()?.nativeElement;
    const segment = this.segment()?.nativeElement;
    const start = layoutLeft(input, box) + inset + (before?.offsetWidth ?? 0);
    const left = Math.max(layoutLeft(input, box) + inset, start - scroll);
    const right = start + (segment?.offsetWidth ?? 0) - scroll;
    const viewEnd = width > 0 ? layoutLeft(input, box) + width : right;
    const visible = Math.max(0, Math.min(right, viewEnd) - left);

    this.segmentLeft.set(tidy(left));
    this.segmentWidth.set(this.segmentText() ? tidy(visible) : 0);
    this.measuredSegment.set(this.segmentText());
  }
}
