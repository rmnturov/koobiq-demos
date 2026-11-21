/**
 * Блок сравнения: одна пара панелей, одно действие на двоих.
 *
 * Панели ничего не решают: вид, каретка, тултипы и ошибка — это состояния моделей
 * `models/old-field.ts` и `models/new-field.ts` после каждого шага действия. Поэтому
 * кадр не может разойтись с кейсом: `finaleOf()` — тот же проход, что играет мультик,
 * только без пауз, и постер тоже берётся из него, а не из подписей.
 *
 * Что видно в проходе:
 * - `type` — символ за символом в обе модели;
 * - `paste` — текст из буфера повисает над парой, затем обе модели его получают;
 * - `key` — кепки `Shift`+`↑` и шаг обеих моделей.
 *
 * Проход кончается уходом из поля там, где уход и есть исход, — и уводит из поля оба
 * поля в одном кадре: `newBlur` поднимает ошибку, когда вид не разобран, а `oldBlur`
 * доводит вид старого контрола до канона значения (`14:3015:00` → `14:59`). Иначе
 * конечный кадр показывал бы стороны в разные моменты: справа уже ошибка по blur,
 * слева ещё незакрытая склейка.
 *
 * Там, где проход кончается результатом действия, фокус остаётся на месте — иначе
 * настоящая директива спрятала бы по blur тултипы, а подпись «распознано» погасла
 * бы вместе с кадром; отказ старой стороны («Только цифры») тоже доживает до конца
 * кадра только без ухода из поля.
 *
 * Время — только через `Clock`: пауза замораживает и кадры, и выдержку между
 * проходами. Петля идёт, пока блок в окне, и гаснет, когда он уходит.
 *
 * Курсор ведет проход, как на `/demo/time-input`: в начале прохода он стоит в точке
 * покоя внутри панели, приходит к полю дугой (`arcKeyframes`) и только потом действует,
 * а у вставки ещё и нажимает. Вид под точкой сменяется со стрелки на I-beam: пока
 * курсор не у поля, видно, что он ещё не начал.
 *
 * Гашение между проходами касается содержимого панелей, подписей, кепок и курсора,
 * но не серых плашек: плашка принадлежит панели, и её прозрачность не меняется никогда —
 * иначе перезапуск читался бы как моргание серым.
 */

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { Signal } from '@angular/core';
import { KeyState, Stopped } from '../../../stage/act';
import { arcKeyframes, moveMs } from '../../../stage/arc';
import { CLOCK_HOST, createClock } from '../../../stage/clock';
import { CursorComponent } from '../../../stage/cursor.component';
import { KeycapsComponent } from '../../../stage/keycaps.component';
import { segmentAt } from '../../timepicker/time-input/time-input.edit';
import { maskPlaceholder } from '../../timepicker/time-input/time-input.format';
import { CaseAction, CompareCase } from '../cases';
import { NewState, newBlur, newEmpty, newPaste, newStep, newType } from '../models/new-field';
import {
  OLD_EMPTY,
  OldSegment,
  OldState,
  oldBlur,
  oldPaste,
  oldStep,
  oldType,
} from '../models/old-field';
import { LARGE_STEP, STEP } from '../models/steps';
import { PanelComponent } from '../panel/panel.component';

/** Тултип отказа: тот же текст, что показывает настоящее поле на `incorrectInput`. */
const BLOCKED = 'Только цифры';

/** Пауза после постановки каретки: поле должно «прочитаться» до первого символа. */
const FOCUS_MS = 420;
/** Шаг набора: один символ в обе модели. */
const CHAR_MS = 300;
/** Сколько кепка символа держится нажатой: остальное время шага она просто видна. */
const CHAR_DOWN_MS = 90;
/** Сколько текст из буфера висит над парой до выделения. */
const CLIP_MS = 700;
/** Протяжка выделения: восемь шагов по 110 мс — примерно столько тянется мышь по строке. */
const SELECT_STEPS = 8;
const SELECT_MS = 110;
/**
 * Выдержка выделения до ⌘C: рука отпускает кнопку и уходит с текста, а шорткат появляется
 * позже. Без паузы выделение и копирование читаются одним движением, хотя между ними
 * человек успевает посмотреть, что выделил.
 */
const SELECT_REST_MS = 500;
/** Кепки: показ, нажатие и сколько висят после отпускания — как в `Act`. */
const KEY_SHOW = 180;
const KEY_DOWN = 140;
const KEY_HOLD = 600;

/**
 * Сколько кепка шортката тлеет после отпускания и гаснет: так делает `act.key` в Stageshow —
 * 180 показа, 140 нажатия и 600 тления, а скрипт гашения не ждет. Без своего гашения кепка
 * висела до конца прохода: ⌘V держалась 3 секунды, хотя действие кончилось.
 */
const LINGER_MS = 600;
/** Выдержка результата перед гашением петли. */
const HOLD_MS = 1400;
/** Пауза между проходами: следующий старт читается как новый проход, а не как продолжение. */
const SETTLE_MS = 300;
/** Ход курсора к полю: пока он не пришёл, проход не начинается. */
const MOVE_MS = 320;
/** Нажатие на поле перед вставкой: короткое, как нажатие в сцене `time-input`. */
const PRESS_MS = 160;
/** Выдох сцены после серии нажатий: рука еще на клавишах, поле устоялось. */
const BREATH_MS = 500;
/** Пауза между приходом руки и нажатием: рука успевает встать, и клик читается отдельно. */
const AIM_MS = 220;

/**
 * Выдох после действия: рука еще над полем, хотя текст уже стоит. Без него уход руки
 * сразу после последнего символа читался бы как продолжение печати.
 */
const REST_MS = 300;

/**
 * Кросс-фейд на стыке проходов: гаснет содержимое плашек, а сама плашка остается.
 * Одной константой живут стили (`--compare-fade`) и ожидание в проходе.
 */
const FADE_MS = 240;

/** Точность координат курсора: субпиксель с запасом, без мусора float-арифметики. */
const PRECISION = 100;

const tidy = (value: number): number => Math.round(value * PRECISION) / PRECISION;

/** Кепка стрелки: у действия одна клавиша, но рисуется она глифом. */
const CAPS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓' };

/** Ожидание кадра: у мультика — часы, у `runOnce` — пустая пауза. */
type Pace = (ms: number) => Promise<void>;

/** Кадр блока: ровно то, что получают панели, и больше ничего. */
export interface Frame {
  /** Состояние старой стороны: вид, значение, каретка и отказ. */
  old: OldState;
  /** Состояние нового поля: вид, выделение, значение, ошибка, тултипы. */
  next: NewState;
  /** Что в буфере: строка над парой, пока вставка не сыграна. */
  clipboard: string | null;
  /** Фокус панелей: он же рисует каретку. Кадр показывает обе стороны разом. */
  oldFocused: boolean;
  newFocused: boolean;
}

/** Точка курсора в пикселях раскладки пары: она же место клика в левом поле. */
interface Point {
  x: number;
  y: number;
}

/**
 * Куда ведет рука: строка буфера перед выделением или поле. Покой — это и есть клик мимо
 * поля: точка покоя лежит на свободном месте, ниже и правее поля, поэтому нажатие там
 * снимает фокус, и проход кончается ровно там, где начинается.
 */
type CursorTarget = 'rest' | 'buffer' | 'field';

/** Строка буфера: начало и ширина. Рука идет по строке слева направо, как мышь. */
interface BufferLine {
  start: Point;
  width: number;
}

/** Точки курсора панели в ее собственных координатах: покой, буфер и поле. */
interface PanelPoint {
  rest: Point;
  /** Строки буфера: их несколько, если текст многострочный. */
  buffer: readonly BufferLine[] | null;
  field: Point;
}

/**
 * Точка курсора под текущую цель. На буфере рука идет по выделению: доля `selection`
 * превращает начало строки в точку, докуда выделение уже дошло.
 */
const pointOf = (
  target: CursorTarget,
  at: PanelPoint | null,
  selection: number,
): Point | null => {
  if (at === null) {
    return null;
  }

  if (target === 'field') {
    return at.field;
  }

  if (target === 'buffer' && at.buffer && at.buffer.length > 0) {
    const first = at.buffer[0];
    const last = at.buffer[at.buffer.length - 1];
    const share = Math.min(Math.max(selection, 0), 1);

    /*
     * Рука идет по диагонали в правый нижний угол выделения, а не ползет по каждой
     * строке отдельно: так ведет себя настоящая мышь, которую тянут через две строки.
     * Само выделение при этом наливается по тексту — строки идут одна за другой.
     */
    return {
      x: tidy(first.start.x + share * (last.start.x + last.width - first.start.x)),
      y: tidy(first.start.y + share * (last.start.y - first.start.y)),
    };
  }

  return at.rest;
};

/**
 * Замер панели: куда рука приходит (поле) и где отдыхает (середина свободного места
 * справа и снизу от поля). Обе точки — из раскладки панели: она меняется на брейкпоинтах,
 * и числа в стилях разошлись бы с ней на первом же складывании пары.
 */
function measurePanel(
  panel: HTMLElement | undefined,
  component: PanelComponent | undefined,
): PanelPoint | null {
  const geometry = component?.fieldGeometry();

  if (!panel || !geometry) {
    return null;
  }

  const width = panel.offsetWidth;
  const height = panel.offsetHeight;

  // Панель еще не разложена: точки нет, и курсора не видно — это честнее угла плашки.
  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  const { box, point } = geometry;
  const clipboard = component?.clipboardGeometry();

  return {
    field: { x: tidy(point.x), y: tidy(point.y) },
    buffer: clipboard
      ? clipboard.lines.map((line) => ({
          start: { x: tidy(line.start.x), y: tidy(line.start.y) },
          width: line.width,
        }))
      : null,
    /*
     * Покой — середина свободного места ниже и правее поля. Она же точка клика мимо поля:
     * фокус уходит нажатием, и проход кончается там же, где начинается. Иначе на стыке
     * проходов рука уезжала бы назад, и петля читалась бы отдельным ходом.
     */
    rest: {
      x: tidy(box.left + box.width + (width - box.left - box.width) / 2),
      y: tidy(box.top + box.height + (height - box.top - box.height) / 2),
    },
  };
}

/**
 * Начало прохода из `from`: поле заполнено, каретка в конце вида — так её оставляют
 * и `oldPaste`, и `newPaste`, и так `newStep` берёт из каретки последний сегмент.
 */
function startOf(item: CompareCase): Frame {
  const empty = newEmpty(item.format, item.cycle);
  const from = item.from;

  return {
    old: from
      ? { view: from.view, value: from.value, caret: from.view.length, rejected: false }
      : OLD_EMPTY,
    next: from
      ? {
          ...empty,
          view: from.view,
          value: from.value,
          selection: { start: from.view.length, end: from.view.length },
        }
      : empty,
    /*
     * Текст вставки висит над парой с первого кадра, а не появляется на первом шаге:
     * иначе на стыке проходов он гаснет и зажигается снова, и петля читается морганием.
     */
    clipboard: item.action.kind === 'paste' ? item.action.text : null,
    // Фокуса в начале нет: он появляется, когда рука дошла до поля, — до этого
    // подсвеченное поле обещало бы готовность к вводу, которой еще нет.
    oldFocused: false,
    newFocused: false,
  };
}

/** Символ в обе модели: отказ одной стороны не мешает другой. */
const typedOf = (item: CompareCase, frame: Frame, char: string): Frame => ({
  ...frame,
  old: oldType(frame.old, char),
  next: newType(frame.next, char, item.format, item.cycle),
});

/** Вставка в обе модели: текст один, исходы разные. */
const pastedOf = (item: CompareCase, frame: Frame, text: string): Frame => ({
  ...frame,
  clipboard: text,
  old: oldPaste(text),
  next: newPaste(frame.next, text, item.format, item.cycle),
});

/** Сегмент, который шагает стрелка: `newStep` берёт его из каретки сам, старому нужен явно. */
const segmentOf = (item: CompareCase, view: string): OldSegment => {
  const segment = segmentAt(view, view.length, item.format, item.cycle);

  return segment === 'hours' ? 'hours' : 'minutes';
};

/**
 * Стрелка по обеим сторонам: крупный шаг `Shift` умножает вызывающий, как директива.
 * `direction` отрицателен на обратной серии: значение возвращается тем же шагом.
 */
const steppedOf = (
  item: CompareCase,
  action: CaseAction,
  frame: Frame,
  direction: 1 | -1 = 1,
): Frame => {
  if (action.kind !== 'key') {
    return frame;
  }

  const delta = (action.shift ? LARGE_STEP : STEP) * direction;

  return {
    ...frame,
    old: oldStep(frame.old, segmentOf(item, frame.old.view), delta, action.shift),
    // У `newStep` сегмент из каретки: без этого `Shift`+`↑` дал бы часы, а не минуты.
    next: newStep(frame.next, segmentOf(item, frame.next.view), delta, item.format, item.cycle),
  };
};

/** Серия одинаковых нажатий: `times` шагов в одну сторону. */
const seriesOf = (
  item: CompareCase,
  action: CaseAction,
  frame: Frame,
  direction: 1 | -1,
): Frame => {
  const times = action.kind === 'key' ? (action.times ?? 1) : 1;

  let out = frame;

  for (let i = 0; i < times; i++) {
    out = steppedOf(item, action, out, direction);
  }

  return out;
};

/**
 * Кадр после ухода из поля, если вид не разобран: blur получают оба поля разом. Иначе
 * стороны разошлись бы по разным моментам: справа ошибка по blur, слева еще склейка
 * (`14:3015:00` вместо `14:59`).
 *
 * Фокус снимается всегда, а blur — только там, где вид не разобран: проход кончается
 * тем, что читатель уводит руку и нажимает мимо поля, а собранное время в поле остается
 * со своей подсказкой о распознавании — `newBlur` погасил бы ее, и подпись кейса обещала
 * бы то, чего в кадре нет.
 */
function endOf(item: CompareCase, frame: Frame): Frame {
  if (frame.next.value !== null) {
    return frame;
  }

  return {
    ...frame,
    old: oldBlur(frame.old),
    next: newBlur(frame.next, item.format, item.cycle),
    oldFocused: false,
    newFocused: false,
  };
}

/**
 * Кадр исхода прохода: поле брошено, фокус снят.
 */
function leftOf(item: CompareCase, frame: Frame): Frame {
  const blurred = endOf(item, frame);

  return { ...blurred, oldFocused: false, newFocused: false };
}

/** Конечное состояние кейса: проход без пауз — постер и последний кадр мультика. */
function finaleOf(item: CompareCase): Frame {
  const start = startOf(item);
  const action = item.action;
  /* Рука в проходе уже дошла до поля, поэтому исходный кадр несет фокус; `leftOf`
     снимает его на кадре исхода. */
  const focused = { ...start, oldFocused: true, newFocused: true };

  switch (action.kind) {
    case 'type': {
      const typed = Array.from(action.text).reduce(
        (frame, char) => typedOf(item, frame, char),
        focused,
      );

      return leftOf(item, typed);
    }
    case 'paste':
      return leftOf(item, pastedOf(item, focused, action.text));
    case 'key': {
      const up = seriesOf(item, action, focused, 1);

      return leftOf(item, action.back ? seriesOf(item, action, up, -1) : up);
    }
  }
}

@Component({
  selector: 'tc-compare',
  imports: [PanelComponent, CursorComponent, KeycapsComponent],
  template: `
    <div class="compare">
      <!--
        Пара панелей — во всю ширину статьи: две колонки по 480 максимум и зазор 2 по
        кадру, пара центрирована. Подписи факта стоят под панелями, вне серых плашек:
        так подпись не обрезается по ширине кадра.
      -->
      <div class="compare__pair" #pair>
        <!--
          У каждой панели свои курсор и кепки: действие одно на двоих, но рука читается
          в обеих сторонах сразу. Курсор проецируется внутрь плашки и живёт в ее
          координатах, поэтому точка поля приходит замером панели без пересчета.
        -->
        <tc-panel
          #oldPanel
          side="left"
          label="Кубик"
          [clipboard]="frame().clipboard"
          [selection]="selection()"
          [mask]="oldMask()"
          [view]="frame().old.view"
          [caret]="frame().old.caret"
          [focused]="frame().oldFocused"
          [blocked]="frame().old.rejected ? blocked : null"
          blockedTone="contrast"
          [faded]="fading()"
        >
          <time-input-cursor
            #oldCursor
            class="compare__cursor"
            [kind]="kind()"
            [press]="clicks()"
            [attr.data-placed]="oldPoint() ? '' : null"
            [attr.data-pressed]="pressed() ? '' : null"
            [attr.data-asleep]="asleep() ? '' : null"
            [style.transform]="shift(oldPoint())"
          />
          <time-input-keycaps [keys]="keys()" />
        </tc-panel>

        <tc-panel
          #newPanel
          side="right"
          label="Новый"
          [clipboard]="frame().clipboard"
          [selection]="selection()"
          [mask]="newMask()"
          [view]="frame().next.view"
          [caret]="frame().next.selection.start"
          [focused]="frame().newFocused"
          [error]="frame().next.error"
          [recognized]="frame().next.recognized"
          [blocked]="frame().next.rejected ? blocked : null"
          [format]="case().format"
          [cycle]="case().cycle"
          [keepCaret]="true"
          [segmentHighlight]="bandOf()"
          [faded]="fading()"
        >
          <time-input-cursor
            #newCursor
            class="compare__cursor"
            [kind]="kind()"
            [press]="clicks()"
            [attr.data-placed]="newPoint() ? '' : null"
            [attr.data-pressed]="pressed() ? '' : null"
            [attr.data-asleep]="asleep() ? '' : null"
            [style.transform]="shift(newPoint())"
          />
          <time-input-keycaps [keys]="keys()" />
        </tc-panel>

        <!-- Подписи факта: своей колонкой под своей панелью, до трех строк. -->
        <span class="compare__caption kbq-text-normal">{{ case().caption.old }}</span>
        <span class="compare__caption kbq-text-normal">{{ case().caption.next }}</span>
      </div>
    </div>
`,
  styleUrl: './compare.component.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Блок не интерактивен: курсор ведёт проход, а не читатель. Живая пара выше —
    // единственное место страницы, где можно набирать.
    '[attr.data-static]': "''",
    // Длительность кросс-фейда — та же константа `FADE_MS`, что ждет проход.
    '[style.--compare-fade]': 'fade',
    // Пока атрибут стоит, содержимое плашек погашено.
    '[attr.data-fading]': "fading() ? '' : null",
    // Пока рука тянет выделение, ход короткий: иначе она отстает от подложки.
    '[attr.data-dragging]': "dragging() ? '' : null",
  },
})
export class CompareComponent implements AfterViewInit, OnDestroy {
  /** Кейс, который играет блок: действие, точки `from`/`old`/`next` и подписи. */
  readonly case = input.required<CompareCase>();

  /** Разрешён ли автоплей: страница может погасить мультик, не трогая кейс. */
  readonly play = input(true);

  /** Идут ли сейчас кадры мультика. */
  readonly running = signal(false);

  /** Рука стоит над целью, а не летит к ней: вид курсора меняется только на приходе. */
  readonly hover = signal(false);

  /** Постер — конечное состояние кейса: до автоплея, на паузе и под reduced motion. */
  readonly showPoster = computed(() => !this.running());

  /** Что сообщил `IntersectionObserver`: в окне блок играет, вне окна — стоит. */
  readonly onVisibility = (visible: boolean): void => {
    if (this.visible === visible) {
      return;
    }

    this.visible = visible;

    if (visible) {
      this.start();
    } else {
      this.stop();
    }
  };

  /** Кепки клавиш: ими владеет проход, шаблон только показывает. */
  readonly keys = signal<KeyState | null>(null);

  /** Конечное состояние кейса: считается моделями, а не берётся из подписей. */
  readonly poster = computed(() => finaleOf(this.case()));

  /** Что видят панели: кадры мультика или постер. */
  readonly frame = computed(() =>
    this.showPoster() ? this.poster() : (this.live() ?? this.poster()),
  );

  /** Маска левой панели: меридиема у текущего контрола нет, вид всегда 24-часовой. */
  readonly oldMask = computed(() => maskPlaceholder(this.case().format, 'h23'));

  /** Маска правой панели: точность и цикл кейса. */
  readonly newMask = computed(() => maskPlaceholder(this.case().format, this.case().cycle));

  /**
   * Куда ведет рука: точка покоя, строка буфера (ее выделяют перед копированием) или
   * поле. Стрелка в покое, I-beam на тексте.
   */
  readonly target = signal<CursorTarget>('rest');

  /** Насколько выделен буфер: 0 — нет, 1 — целиком. Растет шагами, как протяжка мышью. */
  readonly selection = signal(0);

  /** Нажатие курсора на поле: показывается только у вставки. */
  readonly pressed = signal(false);

  /**
   * Подсветка сегмента маски — только у набора: она показывает, куда попадут следующие
   * цифры. Вставка заменяет значение целиком, и каретка после нее стоит за текстом —
   * полоса там означала бы выделение, которого нет.
   */
  readonly bandOf = computed(() => this.case().action.kind !== 'paste');

  /**
   * Указатель мыши спит, пока идет ввод с клавиатуры. Так ведет себя macOS: курсор
   * убирается, чтобы не заслонять текст, и возвращается на первом движении руки.
   * Поэтому скрыть его мало — будить нужно там, где рука трогается с места, а не там,
   * где кончилась печать. Каретка остается: это другой указатель, и он не прячется.
   */
  readonly asleep = signal(false);

  /** Счетчик нажатий: каждое посылает от точки клика кольцо у обеих рук. */
  readonly clicks = signal(0);

  /**
   * Стык проходов: содержимое плашек погашено. Пока флаг стоит, кадр меняется на начало —
   * жесткая подмена читалась бы рывком, а серую плашку гасить нельзя, она статична.
   */
  readonly fading = signal(false);

  /**
   * Идет протяжка выделения: точка курсора меняется на каждом шаге, и ход там рисует
   * короткий переход, а не дуга. Отдельный флаг, а не цель `buffer`: к строке буфера
   * рука один раз идет — этот ход дугой, как все остальные.
   */
  readonly dragging = signal(false);

  /**
   * Вид под точкой: I-beam у поля и стрелка в точке покоя. Пока курсор не пришел,
   * I-beam обещал бы готовность к вводу, которой еще нет.
   */
  /*
   * I-beam только там, где он что-то значит: над текстом буфера и над полем. В полете
   * между ними и в точке покоя рука — обычная стрелка, как у руки, идущей по пустому
   * месту плашки.
   */
  readonly kind = computed<'ibeam' | 'default'>(() =>
    this.hover() && this.target() !== 'rest' ? 'ibeam' : 'default',
  );

  /**
   * Длительность хода к цели: считается по расстоянию, как у руки, которая идет по
   * плашке. Тем же числом живут дуга (`travel`) и ожидание в проходе: иначе ховер и вид
   * курсора переключались бы раньше прихода руки.
   */
  private hopMs(to: CursorTarget): number {
    const from = this.oldPoint();
    const next = pointOf(to, this.oldAt(), 0);

    return from && next ? moveMs(from, next) : MOVE_MS;
  }

  /**
   * Сдвиг курсора панели: движение делает переход `transform` в SCSS, поэтому здесь
   * только конечная точка. До замера панели сдвига нет — курсора не видно.
   */
  shift(point: Point | null): string | null {
    return point ? `translate3d(${point.x}px, ${point.y}px, 0)` : null;
  }

  /** Текст тултипа отказа: один и тот же на обеих сторонах. */
  protected readonly blocked = BLOCKED;

  /** Кросс-фейд стыка проходов: стили берут длительность отсюда, как и ход руки. */
  protected readonly fade = `${FADE_MS}ms`;

  /**
   * Точка курсора левой панели в ее координатах: точка поля, когда курсор пришел, и точка
   * покоя, пока проход не начался. `null`, пока панель не замерена.
   */
  readonly oldPoint = computed(() => pointOf(this.target(), this.oldAt(), this.selection()));

  /** То же для правой панели: у каждой стороны своя рука. */
  readonly newPoint = computed(() => pointOf(this.target(), this.newAt(), this.selection()));

  /** Точки покоя и поля обеих панелей: считаются замером, а не числами в стилях. */
  private readonly oldAt = signal<PanelPoint | null>(null);
  private readonly newAt = signal<PanelPoint | null>(null);

  /** Текущий кадр прохода; `null` до первого запуска — тогда виден постер. */
  private readonly live = signal<Frame | null>(null);

  /** Пара панелей: её раскладка — система координат курсора. */
  private readonly pair = viewChild<ElementRef<HTMLElement>>('pair');

  /** Панели как элементы: их раскладка — система координат своих курсоров. */
  private readonly oldPanelElement: Signal<ElementRef<HTMLElement> | undefined> = viewChild(
    'oldPanel',
    { read: ElementRef },
  );
  private readonly newPanelElement: Signal<ElementRef<HTMLElement> | undefined> = viewChild(
    'newPanel',
    { read: ElementRef },
  );

  /** Панели как компоненты: геометрию поля знает панель, а не блок. */
  private readonly oldPanel: Signal<PanelComponent | undefined> = viewChild('oldPanel', {
    read: PanelComponent,
  });
  private readonly newPanel: Signal<PanelComponent | undefined> = viewChild('newPanel', {
    read: PanelComponent,
  });

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly clock = createClock(inject(CLOCK_HOST));
  private readonly motionAllowed = !(
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  /** Курсоры как элементы: их ход рисует дуга, а не переход `transform` в стилях. */
  private readonly oldCursorEl = viewChild('oldCursor', { read: ElementRef });
  private readonly newCursorEl = viewChild('newCursor', { read: ElementRef });

  /** Где рука стояла до текущего кадра: от этой точки считается дуга. */
  private lastOld: Point | null = null;
  private lastNew: Point | null = null;

  private controller: AbortController | null = null;

  /** Номер последней кепки: по нему гашение не трогает ту, что уже сменила следующая. */
  private capSeq = 0;
  private observer: IntersectionObserver | null = null;
  private resizer: ResizeObserver | null = null;
  private visible = false;

  constructor() {
    // Под reduced motion курсор не едет: он сразу стоит у поля, и нажатия нет.
    this.target.set(this.motionAllowed ? 'rest' : 'field');

    // Входы — единственное, что перезапускает блок: кейс или разрешение автоплея.
    effect(() => {
      const item = this.case();
      const play = this.play();

      untracked(() => this.begin(item, play));
    });

    /*
     * Ход руки — дугой: мышь не идет по прямой, и переход `transform` из точки в точку
     * читается телепортом. Протяжку выделения дуга не трогает: там точка меняется каждый
     * шаг, и переход в 120 мс и есть ход.
     */
    effect(() => {
      const oldPoint = this.oldPoint();
      const newPoint = this.newPoint();
      const dragging = this.dragging();

      untracked(() => {
        if (!dragging) {
          this.travel(this.oldCursorEl()?.nativeElement, this.lastOld, oldPoint);
          this.travel(this.newCursorEl()?.nativeElement, this.lastNew, newPoint);
        }

        this.lastOld = oldPoint;
        this.lastNew = newPoint;
      });
    });
  }

  /**
   * Ход от прошлой точки к новой по дуге. Точку в стиле уже поставил шаблон, поэтому
   * кадры идут от прошлой к ней: в jsdom анимаций нет, и там курсор просто оказывается
   * на месте — вид дуги проверяется в браузере.
   */
  private travel(element: HTMLElement | undefined, from: Point | null, to: Point | null): void {
    if (!element || !from || !to || !this.motionAllowed || typeof element.animate !== 'function') {
      return;
    }

    // Точка не сдвинулась — анимировать нечего: так бывает, когда меняется только флаг
    // протяжки, а курсор стоит на месте.
    if (Math.hypot(to.x - from.x, to.y - from.y) < 0.5) {
      return;
    }

    element.animate(arcKeyframes(from, to), { duration: moveMs(from, to), easing: 'linear' });
  }

  ngAfterViewInit(): void {
    // Замер отложен на кадр: панели к этому моменту ещё не досчитали раскладку.
    this.schedule();
    this.observePair();

    // jsdom наблюдателя не знает: там блок стоит на постере, и это честный кадр.
    if (typeof IntersectionObserver !== 'function') {
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];

      if (entry) {
        this.onVisibility(entry.isIntersecting);
      }
    });
    this.observer.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.stop();
    this.observer?.disconnect();
    this.resizer?.disconnect();
    this.clock.dispose();
  }

  /**
   * Один проход без петли, для спеки. Паузы мультика не ждутся: шаги те же, но
   * кадр не зависит от хода часов — проверяется состояние, а не тайминг.
   *
   * Возвращается последний кадр прохода: после остановки панели получают постер,
   * и проверка «проход дошёл до исхода» иначе смотрела бы не на проход.
   */
  async runOnce(): Promise<Frame> {
    this.stop();
    this.running.set(true);

    try {
      return await this.drive(async () => {});
    } finally {
      this.running.set(false);
    }
  }

  /**
   * Точки курсора — по геометрии панели, а не по числам в стилях: где стоит поле и
   * сколько места остается вокруг него, знает только панель (`fieldGeometry`).
   *
   * Приход — начало текста по центру строки поля, как у каретки панели. Точка покоя —
   * середина свободного места справа и снизу от поля: она внутри плашки и получается
   * замером, а не константой.
   */
  private measure(): void {
    this.oldAt.set(measurePanel(this.oldPanelElement()?.nativeElement, this.oldPanel()));
    this.newAt.set(measurePanel(this.newPanelElement()?.nativeElement, this.newPanel()));
  }

  /** Замер откладывается на кадр: в колбэке наблюдателя раскладка ещё не досчитана. */
  private schedule(): void {
    requestAnimationFrame(() => this.measure());
  }

  /**
   * Панель меняет ширину по месту (две колонки, ниже 1000 px — друг под другом), и поле
   * переезжает вместе с ней: курсор обязан переехать с полем, а не остаться на месте.
   */
  private observePair(): void {
    const pair = this.pair()?.nativeElement;

    if (!pair || typeof ResizeObserver !== 'function') {
      return;
    }

    this.resizer = new ResizeObserver(() => this.schedule());
    this.resizer.observe(pair);
  }

  /** Перезапуск блока: новый кейс начинается с постера, живой кадр сбрасывается. */
  private begin(item: CompareCase, play: boolean): void {
    this.stop();
    this.live.set(startOf(item));
    this.keys.set(null);

    if (play && this.visible) {
      this.start();
    }
  }

  private start(): void {
    if (!this.motionAllowed || !this.play() || this.controller) {
      return;
    }

    const controller = new AbortController();

    this.controller = controller;
    this.running.set(true);
    void this.loop(controller.signal);
  }

  private stop(): void {
    this.controller?.abort();
    this.controller = null;
    this.running.set(false);
    // Кепки — часть кадра: остановленный проход не оставляет их висеть над постером.
    this.keys.set(null);
    // Постер — начало прохода: курсор в точке покоя. Под reduced motion он стоит у поля.
    this.target.set(this.motionAllowed ? 'rest' : 'field');
    this.selection.set(0);
    this.pressed.set(false);
    this.asleep.set(false);
    // Остановка посреди стыка не оставляет плашки погашенными.
    this.fading.set(false);
    this.dragging.set(false);
    // Под reduced motion рука стоит у поля — значит, она над ним и держит I-beam.
    this.hover.set(!this.motionAllowed);
  }

  /** Проход за проходом: кадры, выдержка результата, гашение и возврат к началу. */
  private async loop(signal: AbortSignal): Promise<void> {
    try {
      for (;;) {
        await this.drive((ms) => this.after(ms, signal));
        await this.after(HOLD_MS, signal);
        await this.gap(signal);
      }
    } catch (error) {
      // `Stopped` — штатный конец запуска, всё остальное — ошибка прохода.
      if (!(error instanceof Stopped)) {
        console.error('timepicker-compare: проход упал', error);
      }
    } finally {
      if (this.controller?.signal === signal) {
        this.controller = null;
        this.running.set(false);
      }
    }
  }

  /**
   * Серия нажатий одной стрелки. Первое нажатие несет показ кепок — дальше они уже
   * висят, и такт держится на нажатии и отпускании, как у набранного символа.
   */
  private async series(
    pace: Pace,
    item: CompareCase,
    action: CaseAction,
    frame: Frame,
    direction: 1 | -1,
  ): Promise<Frame> {
    if (action.kind !== 'key') {
      return frame;
    }

    const times = action.times ?? 1;
    const arrow = direction > 0 ? CAPS['ArrowUp'] : CAPS['ArrowDown'];
    const combo = action.shift ? `shift+${arrow}` : arrow;

    let out = frame;

    /*
     * Стрелки — та же клавиатура: указатель убирается на первом нажатии и возвращается
     * не с концом серии, а на движении руки. Так ведет себя macOS, и здесь это видно:
     * рука стоит над полем, пока значение шагает.
     */
    this.asleep.set(true);

    for (let i = 0; i < times; i++) {
      this.keys.set({ combo, show: true, down: true });
      await pace(KEY_DOWN);
      this.keys.set({ combo, show: true, down: false });

      out = steppedOf(item, action, out, direction);
      this.live.set(out);
      await pace(KEY_SHOW);
    }

    return out;
  }

  /**
   * Один проход: действие по кейсу, после каждого шага панели получают новый кадр.
   * Возвращается кадр, на котором проход кончился, — он же последний кадр мультика.
   */
  private async drive(pace: Pace): Promise<Frame> {
    const item = this.case();
    const action = item.action;
    let frame = startOf(item);

    this.asleep.set(false);
    this.live.set(frame);

    /*
     * Вставка начинается с буфера: текст появляется над полем, рука выделяет его
     * и копирует — только после этого он попадает в поле. Так же идет сцена пасты
     * в демо `time-input`: сначала выделение и ⌘C, потом клик по полю и ⌘V.
     */
    if (action.kind === 'paste') {
      frame = await this.copy(pace, frame, action.text);
    }

    frame = await this.act(pace, item, action, frame);

    return this.finish(pace, item, frame);
  }

  /**
   * Копирование в буфер: строка появляется над полем, рука приходит к ней и тянет
   * выделение шагами, затем ⌘C. Выделение снимается до того, как рука уйдет к полю.
   */
  private async copy(pace: Pace, frame: Frame, text: string): Promise<Frame> {
    const shown: Frame = { ...frame, clipboard: text };

    // Текст уже в кадре: первая пауза держит его над парой, пока рука не пошла к нему.
    this.live.set(shown);
    await pace(CLIP_MS);
    // Буфер уже в разметке: точки строк снимаются здесь, а не до прохода.
    this.measure();

    // Новая цель — рука снова в пути: вид стрелки возвращается до прихода.
    const toBuffer = this.hopMs('buffer');

    this.hover.set(false);
    this.asleep.set(false);
    this.target.set('buffer');
    await pace(toBuffer);
    this.hover.set(true);

    /*
     * Протяжка: восемь шагов по ширине строки читаются как движение мыши, а не как
     * вспышка. Пока флаг стоит, точку ведет короткий переход, а не дуга: шаг длиной
     * в строку дугой читался бы заплетанием.
     */
    this.dragging.set(true);

    for (let step = 1; step <= SELECT_STEPS; step++) {
      this.selection.set(step / SELECT_STEPS);
      await pace(SELECT_MS);
    }

    this.dragging.set(false);

    /*
     * Пауза на выделении: текст уже подсвечен, руки на клавишах еще нет. Читатель успевает
     * увидеть, что выделено, и только потом появляется ⌘C.
     */
    await pace(SELECT_REST_MS);

    // Копирование подсветку не снимает: текст остается выделенным, пока рука не ушла.
    await this.flash(pace, 'cmd+c');

    return shown;
  }

  /**
   * Действие кейса: рука приходит к полю, где нужно — нажимает, затем модели получают
   * шаг. Набор печатает кепкой на каждый символ, вставка жмет ⌘V, стрелки — свои кепки.
   */
  private async act(
    pace: Pace,
    item: CompareCase,
    action: CaseAction,
    frame: Frame,
  ): Promise<Frame> {
    const toField = this.hopMs('field');

    this.hover.set(false);
    this.asleep.set(false);
    this.target.set('field');
    await pace(toField);
    this.hover.set(true);

    if (action.kind === 'paste') {
      // Рука встает до клика: пауза та же, что у нажатия мимо поля.
      await pace(AIM_MS);

      /*
       * Клик по полю: на самом нажатии гаснет выделение буфера и появляется фокус —
       * рамка и каретка. Так же ведет себя настоящее поле, и подсветке после ухода
       * с текста держаться не за что.
       */
      this.selection.set(0);
      frame = { ...frame, oldFocused: true, newFocused: true };
      this.live.set(frame);
      this.pressed.set(true);
      this.clicks.update((count) => count + 1);
      await pace(PRESS_MS);
      this.pressed.set(false);
    } else {
      // Набор и стрелки не нажимают: фокус ставит сам приход руки к полю.
      frame = { ...frame, oldFocused: true, newFocused: true };
      this.live.set(frame);
    }

    await pace(FOCUS_MS);

    switch (action.kind) {
      case 'type': {
        /*
         * Кепка на каждый символ: набор — это тоже нажатия, и без них строка появляется
         * сама по себе. Кепка висит до следующего символа, поэтому строка читается как
         * печать, а не как вспышка.
         */
        // Первое же нажатие убирает указатель: он не нужен, пока идет набор.
        this.asleep.set(true);

        for (const char of Array.from(action.text)) {
          this.keys.set({ combo: char, show: true, down: true });
          frame = typedOf(item, frame, char);
          this.live.set(frame);
          await pace(CHAR_DOWN_MS);
          this.keys.set({ combo: char, show: true, down: false });
          await pace(CHAR_MS - CHAR_DOWN_MS);
        }

        /*
         * Набор кончился, но указатель остается скрытым: macOS возвращает его на первом
         * движении руки, а не на последнем символе. Иначе рука всплывала бы посреди
         * выдержки, хотя читатель ее не двигал.
         */
        return frame;
      }

      case 'paste': {
        /*
         * Шорткат и его результат — один кадр: кепка нажимается в тот же миг, когда поле
         * получает значение. Раньше ⌘V приходился на клик, и вставка читалась частью
         * нажатия, хотя между фокусом и клавиатурой человек выжидает.
         */
        frame = pastedOf(item, frame, action.text);
        this.live.set(frame);
        await this.flash(pace, 'cmd+v');

        return frame;
      }

      case 'key': {
        frame = await this.press(pace, item, action, frame);

        return frame;
      }
    }
  }

  /**
   * Кепка шортката: показ, нажатие, отпускание и гашение через `LINGER_MS`. Гашение не
   * держит проход (`void`) и сверяется с номером: иначе устаревший таймер погасил бы
   * кепку, которую уже сменила следующая.
   */
  private async flash(pace: Pace, combo: string): Promise<void> {
    const id = ++this.capSeq;

    this.keys.set({ combo, show: true, down: true });
    await pace(KEY_DOWN);
    this.keys.set({ combo, show: true, down: false });

    void pace(LINGER_MS).then(
      () => {
        if (id === this.capSeq) {
          this.keys.set(null);
        }
      },
      // Проход остановили: гасить нечего, кепки снимает остановка.
      () => undefined,
    );
  }

  /**
   * Конец прохода: кадр исхода, Tab (если кейс кончается уходом из поля) и выдержка,
   * после которой кепки гаснут.
   */
  private async finish(pace: Pace, item: CompareCase, frame: Frame): Promise<Frame> {
    // Кадр исхода — уже после ухода из поля: с обеих сторон, чтобы стороны не разошлись.
    const last = leftOf(item, frame);

    // Рука стоит над полем еще бит: результат должен прочитаться до ухода.
    await pace(REST_MS);

    /*
     * Уход из поля — клик в пустоту, а не кепка Tab: рука идет в точку покоя, встает,
     * выжидает и только потом нажимает. Без паузы перед нажатием уход руки и потеря
     * фокуса читаются одним движением, и клика не видно. Точка покоя лежит вне поля,
     * поэтому кадр кончается ровно там, где начнется следующий проход.
     */
    const toRest = this.hopMs('rest');

    this.hover.set(false);
    this.asleep.set(false);
    this.target.set('rest');
    await pace(toRest);
    await pace(AIM_MS);
    // Фокус уходит на самом нажатии: рамка и каретка гаснут в тот же кадр.
    this.pressed.set(true);
    this.clicks.update((count) => count + 1);
    this.live.set(last);
    await pace(PRESS_MS);
    this.pressed.set(false);

    await pace(KEY_HOLD);
    this.keys.set(null);

    return last;
  }

  /** Кепка комбо: показ, нажатие, отпускание; шаг моделей — между нажатием и гашением. */
  private async press(
    pace: Pace,
    item: CompareCase,
    action: CaseAction,
    frame: Frame,
  ): Promise<Frame> {
    if (action.kind !== 'key') {
      return frame;
    }

    frame = await this.series(pace, item, action, frame, 1);
    await pace(KEY_HOLD);

    /*
     * Обратная серия — то же число нажатий и тот же шаг: значение возвращается туда,
     * откуда пришло, и кадр кончается тем же видом, что был до первого нажатия.
     */
    if (action.back) {
      frame = await this.series(pace, item, action, frame, -1);
    }

    this.keys.set(null);
    await pace(BREATH_MS);

    return frame;
  }

  /**
   * Разрыв между проходами: вернуть начало и устояться.
   *
   * Гашения нет намеренно: прозрачность на перезапуске читалась как моргание фона,
   * а серая плашка — статичный кадр примера, а не часть прохода. Состояние подменяется
   * одним кадром, пауза `SETTLE_MS` отделяет новый проход от прежнего.
   */
  private async gap(signal: AbortSignal): Promise<void> {
    /*
     * Стык проходов — кросс-фейд: содержимое плашек гаснет, кадр меняется и проявляется
     * снова. Серая плашка при этом не гаснет: она статичный кадр примера, и ее
     * прозрачность читалась бы морганием фона.
     */
    this.keys.set(null);
    this.fading.set(true);
    await this.after(FADE_MS, signal);

    this.live.set(startOf(this.case()));
    this.selection.set(0);
    this.pressed.set(false);
    this.hover.set(false);
    this.dragging.set(false);
    /*
     * Рука уже стоит в точке покоя: проход кончился там же, где начинается следующий,
     * поэтому курсор в кросс-фейде не участвует и лишнего хода назад нет. Указатель
     * просыпается на этом движении — после набора он ждет первой подвижки руки.
     */
    this.asleep.set(false);
    this.fading.set(false);

    await this.after(SETTLE_MS, signal);
  }

  /** Ожидание через часы блока: отмена снимает таймер и завершает проход. */
  private after(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new Stopped());

        return;
      }

      let settled = false;
      let timer = 0;

      const done = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        signal.removeEventListener('abort', stopped);
        resolve();
      };

      const stopped = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        this.clock.clearTimeout(timer);
        reject(new Stopped());
      };

      timer = this.clock.timeout(done, ms);
      signal.addEventListener('abort', stopped, { once: true });

      if (signal.aborted) {
        stopped();
      }
    });
  }
}
