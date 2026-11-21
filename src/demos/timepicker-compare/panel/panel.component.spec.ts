import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PanelSide, PanelComponent } from './panel.component';

/** Входы панели: обязательные подставляет `render`, остальные приходят из теста. */
interface Inputs {
  mask?: string;
  label?: string;
  side?: PanelSide;
  view?: string;
  caret?: number;
  focused?: boolean;
  error?: string | null;
  recognized?: string | null;
  blocked?: string | null;
  clipboard?: string | null;
  selection?: number;
  blockedTone?: 'contrast' | 'error';
  format?: 'HH:mm';
  cycle?: 'h23' | 'h12';
  segmentHighlight?: boolean;
  keepCaret?: boolean;
  faded?: boolean;
}

/** Обязательные входы: без них панель не собрать, а тесту они не интересны. */
const REQUIRED: Inputs = {
  mask: 'ЧЧ:ММ',
  label: 'Кубик',
  side: 'left',
};

interface Rendered {
  fixture: ComponentFixture<PanelComponent>;
  root: HTMLElement;
}

/** Панель поднимается как есть: без хост-обертки, входы ставятся до первого рендера. */
function render(inputs: Inputs = {}): Rendered {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [PanelComponent] });

  const fixture = TestBed.createComponent(PanelComponent);

  for (const [name, value] of Object.entries({ ...REQUIRED, ...inputs })) {
    fixture.componentRef.setInput(name, value);
  }

  fixture.detectChanges();

  return { fixture, root: fixture.nativeElement };
}

/** Подмена раскладки: jsdom ничего не считает, а замеру панели нужны числа браузера. */
const place = (
  element: HTMLElement,
  box: { left: number; top: number; width: number; height: number },
): void => {
  Object.defineProperty(element, 'offsetLeft', { value: box.left, configurable: true });
  Object.defineProperty(element, 'offsetTop', { value: box.top, configurable: true });
  Object.defineProperty(element, 'offsetWidth', { value: box.width, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: box.height, configurable: true });
};

describe('panel', () => {
  it('shows the mask when the view is empty', () => {
    const { root } = render({ mask: 'ЧЧ:ММ', view: '' });

    expect(root.querySelector<HTMLInputElement>('[data-target="field"] input')?.placeholder).toBe(
      'ЧЧ:ММ',
    );
  });

  it('shows the error line and marks the field invalid', () => {
    const { root } = render({ error: 'Введите время в формате ЧЧ:ММ, например 14:30' });

    expect(root.textContent).toContain('Введите время в формате');
    expect(root.querySelector('kbq-form-field')?.className).toContain('kbq-form-field_invalid');

    // Поле без ошибки не подсвечено: иначе тест проходил бы и на вечно красной рамке.
    expect(render().root.querySelector('kbq-form-field')?.className).not.toContain(
      'kbq-form-field_invalid',
    );
  });

  it('shows the recognition tooltip above the field', () => {
    const { root } = render({ recognized: 'Распознано как 15:30' });

    expect(root.querySelector('[data-target="hint"]')?.textContent).toContain(
      'Распознано как 15:30',
    );
  });

  it('shows the rejected tooltip next to the recognition one', () => {
    const { root } = render({ recognized: 'Распознано как 15:30', blocked: 'Только цифры' });

    // Оба пузыря стоят в строке подсказок рядом, отказ — вторым: он не подменяет
    // распознавание, и страница сравнения ищет его по отдельному маркеру.
    const hints = [
      ...root.querySelectorAll('[data-target="hint"], [data-target="hint_error"]'),
    ].map((element) => element.textContent?.trim());

    expect(hints).toEqual(['Распознано как 15:30', 'Только цифры']);
  });

  /*
   * Тема отказа — свойство контрола, а не панели: текущий `KbqTimepicker` показывает
   * «Только цифры» черным пузырем, новое поле — красным. Перепутанная тема читается
   * как чужая ошибка, поэтому сверяются оба варианта и их классы.
   */
  it('colors the rejected tooltip by the tone of its control', () => {
    const error = render({ blocked: 'Только цифры' }).root.querySelector(
      '[data-target="hint_error"]',
    )!;
    const contrast = render({ blocked: 'Только цифры', blockedTone: 'contrast' }).root.querySelector(
      '[data-target="hint_error"]',
    )!;

    // Новое поле: красный пузырь — умолчание панели.
    expect(error.classList).toContain('panel__hint_error');
    expect(error.classList).not.toContain('panel__hint_contrast');

    // Текущий `KbqTimepicker`: та же ночная тема, что у распознавания.
    expect(contrast.classList).toContain('panel__hint_contrast');
    expect(contrast.classList).not.toContain('panel__hint_error');
  });

  /*
   * Выделение снимается, а не откатывается: при нулевой доле подложка обязана оказаться
   * нулевой в том же кадре. С переходом она уезжала бы справа налево.
   */
  it('drops the selection at once when its share is zero', () => {
    const { fixture, root } = render({ clipboard: 'встреча в 15:30', selection: 1 });
    const marks = [...root.querySelectorAll('.panel__selection')] as HTMLElement[];

    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].style.transitionDuration).toBe('');

    fixture.componentRef.setInput('selection', 0);
    fixture.detectChanges();

    const after = [...root.querySelectorAll('.panel__selection')] as HTMLElement[];

    expect(after[0].style.transform).toBe('scaleX(0)');
    expect(after[0].style.transitionDuration).toBe('0ms');
  });

  it('shows the clipboard text above the field', () => {
    const { root } = render({ clipboard: 'встреча в 15:30' });

    // Строка из буфера — часть картинки панели: поле она не подменяет, поэтому стоит
    // отдельным спанам над полем, а не в его значении.
    expect(root.querySelector('[data-target="clipboard"]')?.textContent?.trim()).toBe(
      'встреча в 15:30',
    );
  });

  it('labels its side of the pair', () => {
    const { root } = render({ label: 'Новый', side: 'right' });

    const label = root.querySelector('.panel__label');

    expect(label?.textContent?.trim()).toBe('Новый');
    // Подпись набрана капсом: стиль приходит классом типографики, а не своими свойствами.
    expect(label?.className).toContain('kbq-caps-compact');
    // Сторона панели — вход: от нее зависят внешние углы плашки и край подписи.
    expect(root.querySelector('[data-target="panel"]')?.getAttribute('data-side')).toBe('right');
  });

  /*
   * Кадр 15-8682: плашка 480 × 300, поле внутри узкое, 136. Высоту и ширину в jsdom
   * не измерить, но объявленные значения видны в вычисленных стилях — это и есть сторож
   * против возврата «поле во всю панель» и «панель по содержимому».
   */
  it('keeps the frame sizes: a 300 high plate and a 136 wide field', () => {
    const { root } = render({ view: 'x'.repeat(2000) });
    const panel = root.querySelector<HTMLElement>('[data-target="panel"]');

    expect(getComputedStyle(panel!).height).toBe('300px');
    expect(getComputedStyle(panel!).overflow).toBe('hidden');
    expect(getComputedStyle(root.querySelector<HTMLElement>('.panel__field')!).width).toBe('136px');
  });

  /*
   * Новое поле подсвечивает сегмент маски под кареткой: настоящее выделение рисует
   * браузер, а панели приходится рисовать его самой. Кубик сегмент не выделяет.
   */
  it('marks the segment under the caret only when the field asks for it', () => {
    const { fixture } = render({
      view: '15:30',
      caret: 5,
      focused: true,
      segmentHighlight: true,
    });
    const component = fixture.componentInstance;

    expect(component.segmentText()).toBe('30');
    expect(component.beforeSegment()).toBe('15:');

    const quiet = render({ view: '15:30', caret: 5, focused: true }).fixture.componentInstance;

    expect(quiet.segmentText()).toBe('');
  });

  /*
   * Полоса появляется только по замеру: пока ширина сегмента не снята, рисовать нечего,
   * иначе на кадр всплывала бы ширина прошлого вида — полоса мелькала не на месте.
   * В jsdom ширин нет, поэтому полосы нет и здесь: это и есть проверка условия.
   */
  it('lights the segment only after it has been measured', () => {
    const { fixture } = render({ view: '15:30', caret: 5, focused: true, segmentHighlight: true });
    const component = fixture.componentInstance;

    expect(component.segmentText()).toBe('30');
    expect(component.segmentLit()).toBe(false);
  });

  /*
   * Подсвеченный сегмент маски — сам указатель ввода: фон стоит там, куда попадут цифры.
   * Каретка рядом с ним показывала бы два указателя сразу.
   */
  it('drops the caret under the segment it highlights', () => {
    const lit = render({ view: '15:30', caret: 5, focused: true, segmentHighlight: true });
    const litCaret = lit.root.querySelector('.panel__caret');

    expect(lit.fixture.componentInstance.caretVisible()).toBe(false);
    expect(litCaret?.className).not.toContain('panel__caret_visible');

    // Без подсветки сегмента каретка на месте: у Кубика ее ничто не заменяет.
    const quiet = render({ view: '15:30', caret: 5, focused: true });

    expect(quiet.fixture.componentInstance.caretVisible()).toBe(true);
    expect(quiet.root.querySelector('.panel__caret')?.className).toContain('panel__caret_visible');
  });

  /*
   * Каретка — не черта: она мигает, пока поле в фокусе. Постоянная полоска читалась бы
   * как разделитель, а не как место ввода.
   */
  it('blinks the caret while the field is focused', () => {
    render({ view: '15:30', caret: 5, focused: true });

    const css = [...document.querySelectorAll('style')]
      .map((element) => element.textContent ?? '')
      .join('\n');

    expect(css).toContain('panel-caret-blink');
    // Эмуляция вида приписывает к имени анимации свой префикс, поэтому сверка по части имени.
    expect(css).toMatch(/animation:\s*\S*panel-caret-blink\s+1060ms/);
    // Под reduced-motion мигание снимается: петля там не играет.
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  /*
   * Длинный текст: Кубик обрезает его многоточием, новое поле — нет. Многоточие в новом
   * поле показывало бы символ, которого в значении нет.
   */
  it('keeps the ellipsis on the old side only', () => {
    render({ side: 'right' });

    const styles = [...document.querySelectorAll('style')]
      .map((el) => el.textContent)
      .join('');

    /*
     * Правило правой стороны: поле под `data-side=right` и `clip` вместо многоточия.
     * Компилятор снимает кавычки у значения атрибута, поэтому правило ищется шаблоном:
     * селектор, тело и объявление — в том виде, в каком он его выдает.
     */
    expect(styles).toMatch(
      /\.panel\[data-side=right\][^{]*\.panel__field[^{]*\{[^}]*text-overflow:\s*clip/,
    );
    // Общее правило многоточия на месте: его держит Кубик.
    expect(styles).toMatch(/text-overflow:\s*ellipsis/);
  });

  /*
   * Строка буфера не обрезается по ширине поля: в кейсе со ссылкой она должна читаться
   * целиком, и выделение идёт по всей строке. Потолок — внутренняя ширина самой плашки.
   */
  it('gives the buffer the plate width, not the field width', () => {
    render({ clipboard: 'https://example.com/74-169/' });

    const styles = [...document.querySelectorAll('style')]
      .map((el) => el.textContent)
      .join('');

    expect(styles).toContain('max-width: calc(100% - 2 * var(--kbq-size-l))');
    expect(styles).not.toContain('max-width: 136px');
  });

  /*
   * Гасится содержимое, а не плашка: серая плашка — статичный кадр примера, и ее
   * прозрачность читалась бы морганием фона. Поэтому вход `faded` вешает класс на
   * `.panel__content`, а плашка остается как есть.
   */
  it('fades the content and keeps the plate', () => {
    const { fixture, root } = render({ view: '15:30', faded: true });
    const plate = root.querySelector<HTMLElement>('.panel')!;
    const content = root.querySelector('.panel__content')!;

    expect(content.classList).toContain('panel__content_faded');
    expect(plate.classList.contains('panel__content_faded')).toBe(false);
    expect(plate.style.opacity).toBe('');

    // Подпись стороны — часть плашки: в гашении она не участвует и не исчезает с кадром.
    expect(content.contains(root.querySelector('.panel__label'))).toBe(false);

    // Длительность приходит переменной блока сравнения, своей копии в стилях нет.
    const styles = [...document.querySelectorAll('style')]
      .map((el) => el.textContent)
      .join('');

    expect(styles).toContain('var(--compare-fade, 0ms)');
    expect(styles).toContain('.panel__content_faded');

    fixture.componentRef.setInput('faded', false);
    fixture.detectChanges();

    expect(content.classList).not.toContain('panel__content_faded');
  });

  /*
   * Геометрия поля — публичный контракт панели: по ней блок сравнения ставит курсор и
   * больше не ищет поле строковым селектором. Числа подставляет тест: в jsdom раскладки нет.
   */
  /*
   * Длинный текст: новое поле прокручивает его так, чтобы каретка осталась у правого края,
   * и видно конец строки. Иначе каретка уходила бы за край, а в поле читалось бы начало.
   */
  it('scrolls a long text so the caret stays at the right edge', () => {
    const { fixture, root } = render({
      side: 'right',
      view: 'https://example.com/74-169/',
      caret: 25,
      focused: true,
      keepCaret: true,
    });
    const component = fixture.componentInstance;
    const field = root.querySelector<HTMLElement>('[data-target="field"]')!;
    const input = root.querySelector<HTMLInputElement>('[data-target="field"] input')!;
    const head = root.querySelector<HTMLElement>('.panel__mirror > span')!;

    place(field, { left: 172, top: 134, width: 136, height: 32 });
    place(input, { left: 205, top: 135, width: 96, height: 30 });
    Object.defineProperty(input, 'clientWidth', { value: 96, configurable: true });
    // Зеркало шире поля: строка не влезает, и ее надо прокрутить.
    place(head, { left: 0, top: 0, width: 189, height: 20 });

    // Повторный замер: ширина зеркала в jsdom появляется только сейчас.
    fixture.componentRef.setInput('focused', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('focused', true);
    fixture.detectChanges();

    // Текст уехал влево, каретка стоит у правого края поля — в поле, а не за ним.
    expect(input.scrollLeft).toBe(93);
    expect(component.caretLeft()).toBeLessThan(172 + 136);
    expect(component.caretLeft()).toBeGreaterThan(172 + 136 - 16);

    // Без флага поле не прокручивается: Кубик текст не двигает, он обрезает его многоточием.
    const quiet = render({ side: 'left', view: 'https://example.com/74-169/', caret: 25 });
    const quietInput = quiet.root.querySelector<HTMLInputElement>('[data-target="field"] input')!;

    place(quietInput, { left: 205, top: 135, width: 96, height: 30 });
    Object.defineProperty(quietInput, 'clientWidth', { value: 96, configurable: true });

    expect(quietInput.scrollLeft).toBe(0);
  });

  it('gives the field geometry to the block', () => {
    const { fixture, root } = render();
    const field = root.querySelector<HTMLElement>('[data-target="field"]')!;
    const input = root.querySelector<HTMLElement>('[data-target="field"] input')!;

    place(field, { left: 172, top: 134, width: 136, height: 32 });
    place(input, { left: 205, top: 135, width: 103, height: 30 });

    expect(fixture.componentInstance.fieldGeometry()).toEqual({
      box: { left: 172, top: 134, width: 136, height: 32 },
      // Приход курсора — начало текста по центру строки поля: 135 + 30 / 2.
      point: { x: 205, y: 150 },
    });
  });

  /*
   * Рука приходит в минуты, а не в начало поля: каретка после фокуса стоит там, и клик
   * по часам обещал бы ввод часов. Точка сдвинута на ширину часов маски.
   */
  it('meets the hand at the minutes, past the hours of the mask', () => {
    const { fixture, root } = render();
    const field = root.querySelector<HTMLElement>('[data-target="field"]')!;
    const input = root.querySelector<HTMLElement>('[data-target="field"] input')!;
    const hours = root.querySelector<HTMLElement>('.panel__measure')!;

    place(field, { left: 172, top: 134, width: 136, height: 32 });
    place(input, { left: 205, top: 135, width: 103, height: 30 });
    // Ширина «ЧЧ:» в шрифте поля.
    place(hours, { left: 0, top: 0, width: 23, height: 18 });

    expect(hours.textContent?.trim()).toBe('ЧЧ:');
    expect(fixture.componentInstance.fieldGeometry()?.point).toEqual({ x: 228, y: 150 });
  });
});
