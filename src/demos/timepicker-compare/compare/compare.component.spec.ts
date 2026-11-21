import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CLOCK_HOST, ClockHost } from '../../../stage/clock';
import { CASES, CompareCase, casesOf } from '../cases';
import { PanelComponent } from '../panel/panel.component';
import { CompareComponent } from './compare.component';

/** Ручные часы теста: время идёт только по `tick`, работа — только по запросу. */
interface TestHost extends ClockHost {
  /** Проматывает время вперёд, отдавая микрозадачи между срабатываниями. */
  tick(ms: number): Promise<void>;
}

/**
 * Кадр и таймаут — это отложенный вызов, а продолжение `await` — микрозадача.
 * Промотка отдаёт очередь после каждого срабатывания, иначе следующий таймер петли
 * не будет поставлен и время «уедет» вперёд без работы.
 */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
};

const testHost = (): TestHost => {
  let time = 0;
  let seq = 0;
  const timers = new Map<number, { cb: () => void; due: number }>();

  return {
    now: () => time,
    setTimeout: (cb, ms) => {
      const id = ++seq;

      timers.set(id, { cb, due: time + ms });

      return id;
    },
    clearTimeout: (id) => void timers.delete(id),
    requestAnimationFrame: (cb) => {
      const id = ++seq;

      timers.set(id, { cb, due: time + 16 });

      return id;
    },
    cancelAnimationFrame: (id) => void timers.delete(id),
    tick: async (ms) => {
      const target = time + ms;

      await flush();

      for (;;) {
        let nextId: number | null = null;
        let nextDue = Number.POSITIVE_INFINITY;

        for (const [id, timer] of timers) {
          if (timer.due <= target && timer.due < nextDue) {
            nextId = id;
            nextDue = timer.due;
          }
        }

        if (nextId === null) {
          break;
        }

        const timer = timers.get(nextId)!;

        timers.delete(nextId);
        time = Math.max(time, timer.due);
        timer.cb();

        await flush();
      }

      time = target;

      await flush();
    },
  };
};

/** Созданные фикстуры: уничтожаем их сами, чтобы `ngOnDestroy` исполнялся в каждом тесте. */
const fixtures = new Set<ComponentFixture<unknown>>();

interface Rendered {
  fixture: ComponentFixture<CompareComponent>;
  component: CompareComponent;
  host: TestHost;
}

/** Поднимает блок с подставными часами: время в тесте двигает только `host.tick`. */
function render(
  item: CompareCase,
  options: { reducedMotion?: boolean; play?: boolean } = {},
): Rendered {
  const { reducedMotion = false, play = true } = options;
  const host = testHost();

  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: reducedMotion && query.includes('prefers-reduced-motion'),
        addEventListener: () => {},
        removeEventListener: () => {},
        // Старый API: его дергает CDK MediaMatcher из полей панели.
        addListener: () => {},
        removeListener: () => {},
      }) as unknown as MediaQueryList,
  );

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CompareComponent],
    providers: [{ provide: CLOCK_HOST, useValue: host }],
  });

  const fixture = TestBed.createComponent(CompareComponent);

  fixtures.add(fixture);
  fixture.componentRef.setInput('case', item);
  fixture.componentRef.setInput('play', play);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance, host };
}

/** Панели блока в порядке разметки: слева «Кубик», справа «Новый». */
function panelsOf(fixture: ComponentFixture<unknown>): PanelComponent[] {
  return fixture.debugElement
    .queryAll(By.directive(PanelComponent))
    .map((debug) => debug.componentInstance as PanelComponent);
}

/**
 * Кадр jsdom: замер курсора отложен на `requestAnimationFrame` — так же, как замер
 * каретки у панели, — поэтому тесту нужен один кадр, а не секунда.
 */
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

/**
 * Подмена раскладки: jsdom ничего не считает и отдаёт нули, а тесту нужна геометрия,
 * которую отдал бы браузер. Свойства объявлены заново — снимаются они вместе с фикстурой.
 */
const place = (
  element: HTMLElement,
  box: { left: number; top: number; width: number; height: number },
): void => {
  Object.defineProperty(element, 'offsetLeft', { value: box.left, configurable: true });
  Object.defineProperty(element, 'offsetTop', { value: box.top, configurable: true });
  Object.defineProperty(element, 'offsetWidth', { value: box.width, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: box.height, configurable: true });
};

/**
 * Раскладка левой панели в числах кадра: плашка 480 × 300, поле 136 × 32 по центру
 * (172, 134), текст поля начинается с 205. Точка покоя курсора — середина свободного
 * места справа и снизу от поля: 394 и 233.
 */
const REST = 'translate3d(394px, 233px, 0)';
const FIELD = 'translate3d(205px, 150px, 0)';

function layout(fixture: ComponentFixture<unknown>): void {
  // Обе панели: у каждой свой курсор, и он считается от своей плашки.
  for (const panel of [...fixture.nativeElement.querySelectorAll('tc-panel')] as HTMLElement[]) {
    const field = panel.querySelector('[data-target="field"]') as HTMLElement;
    const input = field.querySelector('input') as HTMLElement;

    /*
     * Строки буфера: геометрия теперь по строкам, поэтому раскладывается каждая.
     * Первая начинается на 187 и шириной 100, вторая — под ней, на 187 и 24 ниже.
     */
    const lines = [...panel.querySelectorAll('.panel__clipboard-line')] as HTMLElement[];

    place(panel, { left: 0, top: 0, width: 480, height: 300 });
    place(field, { left: 172, top: 134, width: 136, height: 32 });
    place(input, { left: 205, top: 135, width: 103, height: 30 });

    lines.forEach((line, index) => {
      place(line, { left: 187, top: 20 + index * 24, width: 100, height: 24 });
    });
  }
}

/** Курсоры блока: свой у каждой панели, в порядке разметки. */
const cursorsOf = (fixture: ComponentFixture<unknown>): HTMLElement[] =>
  [...fixture.nativeElement.querySelectorAll('time-input-cursor')] as HTMLElement[];

describe('compare', () => {
  afterEach(() => {
    for (const fixture of [...fixtures]) {
      fixture.destroy();
    }

    fixtures.clear();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  /*
   * Проход и постер считаются одной моделью, но разными вызовами: расхождение между ними —
   * прыжок кадра в момент остановки. Разметка этого не покажет: подпись постера тоже
   * содержит `15:30`, поэтому сверяется кадр прохода, а не текст панелей. Два кейса:
   * у набора конец прохода добавляет ошибку по blur, у вставки — тултип распознавания.
   */
  describe('pass and poster', () => {
    for (const item of [casesOf('type')[0], casesOf('paste')[0]]) {
      it(`${item.id}: the pass ends on the poster`, async () => {
        const { fixture, component } = render(item);
        const frame = await component.runOnce();

        // Кадр прохода, а не начало: проход, который ничего не сделал, отдал бы пустое поле.
        expect(frame.old.view).toBe(item.old.view);
        expect(frame.next.recognized).toBe(item.next.recognized ?? null);
        expect(frame).toEqual(component.poster());

        // Длительность кросс-фейда — та же константа, что ждет стык проходов; ход руки
        // считается по расстоянию и в стилях не живет вовсе.
        const host = fixture.nativeElement as HTMLElement;

        expect(host.style.getPropertyValue('--compare-fade')).toBe('240ms');
        expect(host.style.getPropertyValue('--compare-move')).toBe('');
      });
    }
  });

  /*
   * Подписи факта — из `case().caption` и под своими панелями: у пары два разных исхода,
   * и перепутанные места дают кадр, который читается как факт, но говорит обратное.
   * Две пары с разными по тексту подписями: одна и та же пара перепутывание не поймала бы.
   */
  describe('captions', () => {
    for (const item of [casesOf('type')[0], casesOf('type')[2]]) {
      it(`${item.id}: each side shows its own caption`, async () => {
        const { fixture, component } = render(item);

        await component.runOnce();
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        const captions = [...root.querySelectorAll('.compare__caption')].map((element) =>
          element.textContent?.trim(),
        );

        // Подписи кейса не совпадают — иначе проверка ниже ничего не различает.
        expect(item.caption.old).not.toBe(item.caption.next);
        expect(captions).toEqual([item.caption.old, item.caption.next]);
        // Панель больше не рисует строку факта: подпись стоит вне серой плашки по кадру.
        expect(root.querySelectorAll('.panel__caption').length).toBe(0);
      });
    }
  });

  it('labels the left and the right panel', () => {
    const { fixture } = render(casesOf('type')[0]);
    const [old, next] = panelsOf(fixture);

    expect(old.label()).toBe('Кубик');
    expect(next.label()).toBe('Новый');
    expect(old.side()).toBe('left');
    expect(next.side()).toBe('right');
  });

  /*
   * Текст вставки висит над парой с первого кадра: он не появляется на первом шаге и
   * потому не гаснет на стыке проходов. Иначе петля читается морганием текста.
   */
  it('keeps the pasted text above the pair from the very first frame', async () => {
    const { fixture, component } = render(casesOf('paste')[0]);

    component.onVisibility(true);
    fixture.detectChanges();

    const texts = [...fixture.nativeElement.querySelectorAll('[data-target="clipboard"]')].map(
      (element: HTMLElement) => element.textContent?.trim(),
    );

    expect(texts).toEqual(['встреча в 15:30', 'встреча в 15:30']);
  });

  it('shows the clipboard of the action in both panels', async () => {
    const { fixture, component } = render(casesOf('paste')[0]);

    await component.runOnce();
    fixture.detectChanges();

    const texts = [...fixture.nativeElement.querySelectorAll('[data-target="clipboard"]')].map(
      (element: HTMLElement) => element.textContent?.trim(),
    );

    expect(texts).toEqual(['встреча в 15:30', 'встреча в 15:30']);
  });

  it('does not start with reduced motion', async () => {
    const { component } = render(casesOf('type')[0], { reducedMotion: true });

    expect(component.running()).toBe(false);
    expect(component.showPoster()).toBe(true);
    // Курсор не едет: он сразу стоит у поля — постер, а не начало прохода.
    expect(component.target()).toBe('field');
  });

  it('shows the rejected-character tooltip on the old side', async () => {
    const { fixture, component } = render(casesOf('type')[2]); // 02:30, затем p

    await component.runOnce();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-target="hint_error"]')?.textContent,
    ).toContain('Только цифры');
  });

  it('pauses the loop when the block leaves the viewport', async () => {
    const { component } = render(casesOf('type')[0]);

    component.onVisibility(false);

    expect(component.running()).toBe(false);
  });

  /*
   * Блок не интерактивен: признак стоит на хосте, и внутри нет ни одного фокусируемого
   * или нажимаемого элемента. Живая пара выше — единственное место, где можно набирать.
   */
  it('is not interactive', () => {
    const { fixture, component } = render(casesOf('type')[0]);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.hasAttribute('data-static')).toBe(true);
    expect(
      host.querySelectorAll(
        'button, a[href], input:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
      ).length,
    ).toBe(0);
    // Проход не запускается вводом: автоплеем владеет наблюдатель, а не читатель.
    expect(component.play()).toBe(true);
  });

  /*
   * Стык проходов — кросс-фейд содержимого, а не подмена кадра: проход кончается полем
   * с текстом и без фокуса, и жесткая смена на пустое поле читалась рывком. Гасится
   * только содержимое плашек: серая плашка остается, иначе перезапуск моргал бы фоном.
   */
  it('cross-fades the content between passes and keeps the plate', async () => {
    const { fixture, component, host } = render(casesOf('type')[0]);

    layout(fixture);
    await nextFrame();
    component.onVisibility(true);

    // Стык начинается на 5492 — после клика мимо поля и выдержки исхода.
    await host.tick(5560);
    fixture.detectChanges();

    expect(component.fading()).toBe(true);
    expect(fixture.nativeElement.hasAttribute('data-fading')).toBe(true);

    const plate = fixture.nativeElement.querySelector('.panel') as HTMLElement;
    const content = fixture.nativeElement.querySelector('.panel__content') as HTMLElement;

    /*
     * Плашка статична: гасится только содержимое, поэтому класс фейда стоит на нем,
     * а не на плашке. Правило в стилях одно — `.panel__content_faded`.
     */
    expect(content.classList).toContain('panel__content_faded');
    expect(plate.classList.contains('panel__content_faded')).toBe(false);
    expect(plate.style.opacity).toBe('');

    // Кросс-фейд конечен: к началу нового прохода содержимое снова видно.
    await host.tick(500);
    fixture.detectChanges();

    expect(component.fading()).toBe(false);
    expect(fixture.nativeElement.hasAttribute('data-fading')).toBe(false);
    expect(content.classList).not.toContain('panel__content_faded');
  });

  /*
   * Проход обязан дойти до исхода кейса, а не до похожего: подписи под панелями
   * обещают именно эту пару. Расхождение — красный тест, а не правка кадра.
   *
   * Сверяется последний кадр прохода, а не постер: после остановки панели получают
   * конечное состояние кейса, и гвард смотрел бы на чужой кадр — потерянный символ
   * или пропущенный уход из поля прошли бы незамеченными.
   */
  describe('ends at the declared pair', () => {
    for (const item of CASES) {
      it(`${item.id}: ${item.title}`, async () => {
        const { fixture, component } = render(item);
        const frame = await component.runOnce();

        expect(frame.old.view).toBe(item.old.view);
        expect(frame.next.view).toBe(item.next.view);
        expect(frame.next.recognized).toBe(item.next.recognized ?? null);

        // Ошибка под полем — это и есть исход «ошибка по blur»: она появляется
        // только там, где новое поле не разобрало вид.
        expect(frame.next.error !== null).toBe(item.next.value === null);

        // «Только цифры» доживает до конца кадра у старой стороны: в кейсах её
        // взводит единственный отказ — буква `p` в 12-часовом цикле.
        expect(frame.old.rejected).toBe(item.id === 'meridiem-typing');
        expect(frame.next.rejected).toBe(false);

        // Оба поля в кадре — в одном моменте: проход кончается тем, что рука уходит
        // и нажимает мимо поля, поэтому фокуса нет ни у одной стороны.
        expect(frame.oldFocused).toBe(frame.newFocused);
        expect(frame.oldFocused).toBe(false);

        // И тот же кадр стоит на панелях: проход и постер обещают читателю одно и то же.
        fixture.detectChanges();

        const [old, next] = panelsOf(fixture);

        expect(old.view()).toBe(frame.old.view);
        expect(next.view()).toBe(frame.next.view);
        expect(next.recognized()).toBe(frame.next.recognized);
        expect(next.error()).toBe(frame.next.error);
        expect(old.blocked()).toBe(frame.old.rejected ? 'Только цифры' : null);
        expect(next.blocked()).toBeNull();
      });
    }
  });

  /*
   * Стрелка и I-beam одного размера: со своей единицей стрелка выглядела мелкой рядом с
   * текстовым курсором, и смена вида читалась как скачок размера, а не как подсказка.
   */
  it('keeps the arrow the same size as the I-beam', () => {
    render(casesOf('type')[0]);

    const css = [...document.querySelectorAll('style')]
      .map((element) => element.textContent ?? '')
      .join('\n');
    const rule = css.slice(css.indexOf('.compare__cursor'));

    expect(rule).toContain('--cursor-size: 1.4');
  });

  it('draws the I-beam cursor above the field it points at', async () => {
    // Середина прохода: рука у поля, поле в фокусе. Конец прохода не годится — он
    // кончается уходом из поля, и слоя фокуса там уже нет.
    const { fixture, component, host } = render(casesOf('type')[1]);

    layout(fixture);
    await nextFrame();
    component.onVisibility(true);
    // Первое нажатие стрелки на 740: рука дошла и держит I-beam.
    await host.tick(800);
    fixture.detectChanges();

    const cursor = cursorsOf(fixture)[0];
    const field = fixture.nativeElement.querySelector('[data-target="field"]') as HTMLElement;

    // Вид приходит входом `kind`, а не статикой: host-binding курсора (`[attr.data-kind]`)
    // перекрыл бы статический атрибут, и вместо I-beam рисовалась бы стрелка.
    expect(cursor.getAttribute('data-kind')).toBe('ibeam');
    // Поле в фокусе — то самое, у которого свой слой: под ним курсора не видно.
    expect(field.classList).toContain('cdk-focused');
    expect(Number(getComputedStyle(cursor).zIndex)).toBeGreaterThan(
      Number(getComputedStyle(field).zIndex),
    );
    // И сам слой не спрятан: до замера точка неизвестна, после — курсор виден.
    expect(getComputedStyle(cursor).visibility).toBe('visible');
  });

  /*
   * Курсор ведет проход: до старта он стоит в точке покоя и показывает стрелку, в начале
   * прохода приходит к полю — переходом `transform` — и только там становится I-beam.
   * Убери приход, и курсор останется точкой-статиком в углу панели: тест покраснеет,
   * потому что `transform` не сменился бы.
   */
  it('walks both cursors to their fields at the start of the pass', async () => {
    const { fixture, component, host } = render(casesOf('type')[0]);

    layout(fixture);
    await nextFrame();
    fixture.detectChanges();

    const cursors = cursorsOf(fixture);

    // Рука у каждой стороны своя: пара — две стороны одного действия, а не один герой.
    expect(cursors.length).toBe(2);

    for (const cursor of cursors) {
      expect(cursor.style.transform).toBe(REST);
      expect(cursor.getAttribute('data-kind')).toBe('default');
    }

    component.onVisibility(true);
    fixture.detectChanges();

    expect(component.target()).toBe('field');

    // Ход от точки покоя до поля — 446 мс по расстоянию: рука пришла, проход ждет поле.
    await host.tick(460);
    fixture.detectChanges();

    for (const cursor of cursors) {
      expect(cursor.style.transform).toBe(FIELD);
      expect(cursor.getAttribute('data-kind')).toBe('ibeam');
      // Набор и стрелки не нажимают: рука просто стоит у поля.
      expect(cursor.hasAttribute('data-pressed')).toBe(false);
    }
  });

  /*
   * Нажатие показывается только у вставки: это действие начинается с клика по полю,
   * и без него «вставили» читалось бы как «поле само поменялось».
   */
  it('presses the field before a paste', async () => {
    const { fixture, component, host } = render(casesOf('paste')[0]);

    layout(fixture);
    await nextFrame();
    fixture.detectChanges();

    const cursors = cursorsOf(fixture);

    for (const cursor of cursors) {
      expect(cursor.hasAttribute('data-pressed')).toBe(false);
    }

    /*
     * Вставка начинается с буфера: сначала рука выделяет строку и жмет ⌘C, потом
     * приходит к полю. Поэтому нажатие проверяется после выделения, а не сразу.
     */
    /*
     * До нажатия проходит буфер: показ 700, ход к строке 520, протяжка 8 × 110, пауза
     * на выделении 500, ⌘C (140, гашение не ждут), ход к полю 367 и пауза перед
     * нажатием 220 — нажатие на 3327.
     */
    component.onVisibility(true);
    await host.tick(3400);
    fixture.detectChanges();

    // Пришел и нажал: нажатие живет PRESS_MS, а не до конца прохода.
    for (const cursor of cursorsOf(fixture)) {
      expect(cursor.style.transform).toBe(FIELD);
      expect(cursor.hasAttribute('data-pressed')).toBe(true);
    }

    await host.tick(200);
    fixture.detectChanges();

    for (const cursor of cursorsOf(fixture)) {
      expect(cursor.hasAttribute('data-pressed')).toBe(false);
    }
  });

  it('plays the pass by the clock and gives the poster back on the way out', async () => {
    const { fixture, component, host } = render(casesOf('type')[0]);
    const [old] = panelsOf(fixture);

    // До автоплея виден постер — конечное состояние кейса, а не пустое поле.
    expect(component.running()).toBe(false);
    expect(component.showPoster()).toBe(true);
    expect(old.view()).toBe('23:59');

    component.onVisibility(true);
    expect(component.running()).toBe(true);

    // Ход курсора (320 мс) и пауза перед первым символом (420 мс), затем первая цифра.
    await host.tick(800);
    fixture.detectChanges();

    expect(old.view()).toBe('2');
    expect(old.blocked()).toBeNull();

    component.onVisibility(false);
    fixture.detectChanges();

    expect(component.running()).toBe(false);
    expect(component.showPoster()).toBe(true);
    expect(old.view()).toBe('23:59');

    // Вне окна часы стоят: кадр не двигается, даже если прошло много времени.
    await host.tick(10000);
    fixture.detectChanges();

    expect(old.view()).toBe('23:59');
  });

  /*
   * Петля замыкается на одной точке: проход кончается кликом в пустоту, а пустота — это
   * и есть точка покоя, с которой проход начинается. Иначе на стыке рука уезжала бы
   * назад, и повтор читался бы отдельным ходом.
   */
  it('ends the pass where it starts, so the cursor needs no fade', async () => {
    const { fixture, component } = render(casesOf('type')[0]);

    layout(fixture);
    await nextFrame();
    fixture.detectChanges();

    const [cursor] = cursorsOf(fixture);

    expect(cursor.style.transform).toBe(REST);

    await component.runOnce();
    fixture.detectChanges();

    // Клик мимо поля — та же точка: курсор на месте, значит и гасить его на стыке нечего.
    expect(cursor.style.transform).toBe(REST);
  });

  /*
   * Потеря фокуса — следствие клика, а не ухода руки: пока рука идет мимо поля, рамка
   * и каретка на месте, и гаснут они на самом нажатии. Без паузы перед нажатием оба
   * события приходятся на один кадр, и клика не видно.
   */
  /*
   * Указатель мыши убирается на время набора — так делает macOS, чтобы курсор не заслонял
   * текст, — и возвращается не с последним символом, а на первом движении руки. Каретка
   * в поле при этом остается.
   */
  it('puts the mouse away while it types and wakes it on the next move', async () => {
    const { fixture, component, host } = render(casesOf('type')[2]);

    layout(fixture);
    await nextFrame();
    component.onVisibility(true);

    expect(component.asleep()).toBe(false);

    // Ввод кончился на 2540, выдох после него — до 2840.
    await host.tick(2600);
    fixture.detectChanges();

    expect(component.asleep()).toBe(true);

    // Рука еще стоит над полем: указатель не всплывает на последнем символе.
    await host.tick(200);
    fixture.detectChanges();

    expect(component.asleep()).toBe(true);

    // Рука пошла мимо поля — здесь указатель и возвращается.
    await host.tick(200);
    fixture.detectChanges();

    expect(component.asleep()).toBe(false);
  });

  /*
   * Стрелки — та же клавиатура: пока рука стоит над полем и значение шагает, указатель
   * скрыт, как при наборе.
   */
  it('puts the mouse away while the arrows step the value', async () => {
    const { fixture, component, host } = render(casesOf('type')[1]);

    layout(fixture);
    await nextFrame();
    component.onVisibility(true);

    // Первое нажатие — на 866, после прихода руки к полю.
    await host.tick(900);
    fixture.detectChanges();

    expect(component.asleep()).toBe(true);

    // Серия и выдох проходят без движения руки.
    await host.tick(1200);
    fixture.detectChanges();

    expect(component.asleep()).toBe(true);
  });

  /*
   * Клик виден кольцом у обеих рук: счетчик нажатий растет на самом нажатии, и по нему
   * курсор запускает расходящееся кольцо. Без него нажатие читается только сжатием глифа.
   */
  it('marks the click so both cursors send a ring', async () => {
    const { fixture, component, host } = render(casesOf('type')[0]);

    layout(fixture);
    await nextFrame();
    component.onVisibility(true);

    expect(component.clicks()).toBe(0);

    // Клик мимо поля — на 3332: выдох, ход руки и пауза перед нажатием.
    await host.tick(3400);
    fixture.detectChanges();

    expect(component.clicks()).toBe(1);
  });

  it('keeps the focus until the click, and only then drops it', async () => {
    const { fixture, component, host } = render(casesOf('type')[0]);
    const [old] = panelsOf(fixture);

    component.onVisibility(true);

    // Набор кончился на 2240, выдох 300 и ход мимо поля 320: рука на месте, клика еще нет.
    await host.tick(2860);
    fixture.detectChanges();

    expect(old.focused()).toBe(true);
    expect(cursorsOf(fixture)[0].hasAttribute('data-pressed')).toBe(false);

    // Нажатие начинается на 3080 — через 220 после прихода руки.
    await host.tick(260);
    fixture.detectChanges();

    expect(old.focused()).toBe(false);
    expect(cursorsOf(fixture)[0].hasAttribute('data-pressed')).toBe(true);
  });

  it('wraps the loop back to the start of the case', async () => {
    const { fixture, component, host } = render(casesOf('type')[0]);
    const [old] = panelsOf(fixture);

    component.onVisibility(true);

    /*
     * Проход 25:88: 320 ход + 420 перед первым символом + 5 × 300 = 2240, затем выдох
     * 300, клик мимо поля (320 ход + 220 пауза + 160 нажатие) и выдержка 600 → 3840;
     * выдержка исхода 1400 → 5240; кросс-фейд 240 → 5480, пауза между проходами
     * 300 → 5780. К 5600 кадр уже вернулся к началу.
     */
    await host.tick(5600);
    fixture.detectChanges();

    expect(component.running()).toBe(true);
    expect(old.view()).toBe('');

    // Второй проход: старт 5780, 320 ход + 420 пауза — первый символ на 6520.
    await host.tick(950);
    fixture.detectChanges();

    expect(old.view()).toBe('2');
  });

  it('keeps the poster when autoplay is off', async () => {
    const { fixture, component } = render(casesOf('paste')[0], { play: false });

    component.onVisibility(true);
    fixture.detectChanges();

    expect(component.running()).toBe(false);
    expect(panelsOf(fixture)[1].recognized()).toBe('Распознано как 15:30');
  });

  /*
   * Кепки — у каждой плашки свои: обе стороны делают одно действие, и нажатие должно
   * читаться в обеих. Проверяются обе строки, а не одна: копия только с одной стороны
   * и была прежним поведением.
   */
  const capsOf = (fixture: ComponentFixture<unknown>): string[] =>
    [...fixture.nativeElement.querySelectorAll('tc-panel time-input-keycaps')].map(
      (el) => (el as HTMLElement).textContent?.replace(/\s+/g, '') ?? '',
    );

  it('shows the Shift and the arrow on both key cap rows', async () => {
    const { fixture, component, host } = render(casesOf('type')[1]); // Shift + ↑

    component.onVisibility(true);
    await host.tick(800);
    fixture.detectChanges();

    const rows = capsOf(fixture);

    expect(rows.length).toBe(2);

    for (const caps of rows) {
      expect(caps).toContain('⇧');
      expect(caps).toContain('↑');
    }
  });

  /*
   * Выделение — это протяжка: рука идет по строке слева направо вместе с подложкой,
   * а не стоит в начале. Тест собирает точки курсора за проход: слева направо — рост,
   * и в пике выделения рука на правом краю строки.
   */
  it('drags the cursor along the selected text', async () => {
    const { fixture, component, host } = render(casesOf('paste')[0]);

    layout(fixture);
    await nextFrame();
    component.onVisibility(true);

    const xs: number[] = [];

    for (let i = 0; i < 26; i++) {
      await host.tick(100);
      fixture.detectChanges();

      if (component.target() === 'buffer') {
        const cursor = cursorsOf(fixture)[0];
        const match = /translate3d\(([\d.]+)px/.exec(cursor.style.transform);

        xs.push(match ? Number(match[1]) : Number.NaN);
      }
    }

    // Буфер: начало строки 187, ширина 100. Рука идет от начала к правому краю.
    expect(xs.length).toBeGreaterThan(2);
    expect(Math.min(...xs)).toBe(187);
    expect(Math.max(...xs)).toBe(287);

    // Слева направо до правого края: выделение держится, пока рука не ушла к полю.
    const forward = xs.slice(0, xs.indexOf(287) + 1);

    expect(forward.length).toBeGreaterThan(1);

    for (let i = 1; i < forward.length; i++) {
      expect(forward[i]).toBeGreaterThanOrEqual(forward[i - 1]);
    }
  });

  /*
   * Стрелки играют серию: три шага вверх, пауза, три обратно. Поле возвращается
   * в исходное, поэтому проверяется не исход, а ход — вершина серии и обратный счет.
   */
  it('runs the arrow series up and back down', async () => {
    const { fixture, component, host } = render(casesOf('type')[1]);

    layout(fixture);
    await nextFrame();
    component.onVisibility(true);

    const seen: string[] = [];
    const caps: string[] = [];

    for (let i = 0; i < 45; i++) {
      await host.tick(100);
      fixture.detectChanges();

      // Шагает правая сторона: левая на Shift не реагирует — в этом и кейс.
      const [, next] = [
        ...(fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>),
      ];
      const view = next.value;

      if (seen[seen.length - 1] !== view) {
        seen.push(view);
      }

      const keys = [...fixture.nativeElement.querySelectorAll('time-input-keycaps')]
        .map((node: HTMLElement) => node.textContent?.replace(/\s+/g, '') ?? '')
        .join(',');

      if (keys && caps[caps.length - 1] !== keys) {
        caps.push(keys);
      }
    }

    // Вершина серии: 14:00 плюс три шага по 10 минут.
    expect(seen).toContain('14:30');
    // И возврат: последний кадр прохода — там же, где начали.
    expect(seen[seen.length - 1]).toBe('14:00');
    // Кепки меняют стрелку на обратном ходу: сценарий читается как «туда и обратно».
    expect(caps).toContain('⇧↑,⇧↑');
    expect(caps).toContain('⇧↓,⇧↓');
  });

  /*
   * Многострочный буфер: перенос — настоящая вторая строка. Протяжка идет сначала по
   * первой строке, потом переходит на вторую, рука спускается вместе с ней, а подсветка
   * держится до клика в поле.
   */
  it('keeps the selection until the click into the field', async () => {
    const { fixture, component, host } = render(
      casesOf('paste').find((item) => item.id === 'multiline')!,
    );

    layout(fixture);
    await nextFrame();
    component.onVisibility(true);

    const points: { x: number; y: number }[] = [];
    const atBuffer: number[][] = [];
    const atField: number[][] = [];

    for (let i = 0; i < 40; i++) {
      await host.tick(100);
      fixture.detectChanges();

      const [panel] = [...fixture.nativeElement.querySelectorAll('tc-panel')] as HTMLElement[];
      const scale = [...panel.querySelectorAll('.panel__selection')].map((mark) => {
        const value = /scaleX\(([\d.]+)\)/.exec((mark as HTMLElement).style.transform);

        return value ? Number(value[1]) : 0;
      });

      if (component.target() === 'buffer') {
        const cursor = cursorsOf(fixture)[0];
        const match = /translate3d\(([\d.]+)px, ([\d.]+)px/.exec(cursor.style.transform);

        if (match) {
          points.push({ x: Number(match[1]), y: Number(match[2]) });
        }

        atBuffer.push(scale);
      }

      if (component.target() === 'field') {
        atField.push(scale);
      }
    }

    // Первая строка начинается на 187, вторая лежит 24 ниже: рука проходит обе.
    expect(points.some((point) => point.y === 32)).toBe(true);
    expect(points.some((point) => point.y === 56)).toBe(true);

    /*
     * Рука идет диагональю в правый нижний угол: обе координаты растут в одном темпе,
     * а не по очереди (сперва строка, потом спуск).
     */
    const diagonal = points.slice(0, points.findIndex((point) => point.y === 56) + 1);

    for (let i = 1; i < diagonal.length; i++) {
      expect(diagonal[i].x).toBeGreaterThanOrEqual(diagonal[i - 1].x);
      expect(diagonal[i].y).toBeGreaterThanOrEqual(diagonal[i - 1].y);
    }

    expect(diagonal.filter((point) => point.y > 32 && point.y < 56).length).toBeGreaterThan(0);

    // Сначала подложка только на первой строке, потом переходит на вторую.
    expect(atBuffer[0][1]).toBe(0);
    expect(atBuffer.some(([first, second]) => first === 1 && second > 0)).toBe(true);

    /*
     * К ⌘C выделены обе строки, и подсветка держится, пока рука не ушла к полю:
     * гаснет она на клике в поле, а не на копировании.
     */
    expect(atBuffer[atBuffer.length - 1]).toEqual([1, 1]);
    // Путь к полю подсветку не снимает: она гаснет на нажатии, а не на уходе с текста.
    expect(atField[0]).toEqual([1, 1]);
    expect(atField[atField.length - 1]).toEqual([0, 0]);
  });

  /*
   * I-beam означает «здесь текст»: пока рука летит между строкой буфера и полем, она
   * обычная стрелка, и вид меняется только на приходе.
   */
  it('keeps the arrow while the hand flies and turns it into the I-beam on arrival', async () => {
    const { fixture, component, host } = render(casesOf('paste')[0]);

    layout(fixture);
    await nextFrame();
    component.onVisibility(true);

    const kinds: string[] = [];

    for (let i = 0; i < 50; i++) {
      await host.tick(100);
      fixture.detectChanges();
      kinds.push(cursorsOf(fixture)[0].getAttribute('data-kind') ?? '');
    }

    const first = kinds.indexOf('ibeam');

    expect(kinds[0]).toBe('default');
    expect(first).toBeGreaterThan(0);
    // До прихода к строке буфера — ни одного I-beam: рука еще в пути.
    expect(kinds.slice(0, first).every((kind) => kind === 'default')).toBe(true);
  });

  /*
   * Сегмент маски выделяет только новое поле: у Кубика такой подсветки нет, и его
   * сторона не должна просить ее у панели.
   */
  /*
   * Полосу сегмента просит только набор: вставка заменяет значение целиком, и каретка
   * после нее стоит за текстом. Полоса там показывала бы выделение, которого нет.
   */
  it('asks for the segment band on typing cases only', () => {
    const typed = render(casesOf('type')[0]).fixture.componentInstance;
    const pasted = render(casesOf('paste')[0]).fixture.componentInstance;

    expect(typed.bandOf()).toBe(true);
    expect(pasted.bandOf()).toBe(false);
  });

  it('asks for the segment highlight on the new side only', () => {
    const { fixture } = render(casesOf('type')[1]);
    const [old, next] = panelsOf(fixture);

    expect(old.segmentHighlight()).toBe(false);
    expect(next.segmentHighlight()).toBe(true);
    expect(next.format()).toBe('HH:mm');
  });

  /*
   * Подписи под плашками — проза, а не часть мультика: блок инертен, но подпись
   * выделяется и ловит мышь. Иначе факт нельзя ни скопировать, ни процитировать.
   */
  it('leaves the fact captions selectable inside the static block', () => {
    render(casesOf('paste')[0]);

    const styles = [...document.querySelectorAll('style')]
      .map((el) => el.textContent)
      .join('');

    expect(styles).toMatch(
      /\.compare__caption[^{]*\{[^}]*user-select:\s*text/,
    );
    expect(styles).toMatch(/\.compare__caption[^{]*\{[^}]*pointer-events:\s*auto/);
  });

  /* Набор показывает кепку на каждый символ: строка не должна появляться сама по себе. */
  it('caps every typed character', async () => {
    const { fixture, component, host } = render(casesOf('type')[0]);

    component.onVisibility(true);
    await host.tick(800); // рука дошла до поля, начинается набор
    fixture.detectChanges();

    const seen = new Set<string>();

    for (let i = 0; i < 8; i++) {
      await host.tick(150);
      fixture.detectChanges();

      for (const caps of capsOf(fixture)) {
        if (caps) {
          seen.add(caps);
        }
      }
    }

    // Кепки набраны из символов кейса: '2', '5', ':', '8', '8'.
    for (const char of ['2', '5']) {
      expect([...seen].some((caps) => caps.includes(char))).toBe(true);
    }
  });

  /*
   * Вставка начинается с копирования: текст появляется над полем, рука его выделяет,
   * затем ⌘C. Выделение — состояние панели, поэтому проверяется его рост, а не картинка.
   */
  it('selects the buffer text and copies it before the paste', async () => {
    const { fixture, component, host } = render(casesOf('paste')[0]);

    component.onVisibility(true);

    const widths: number[] = [];
    const combos = new Set<string>();

    /*
     * Полсекунды выделение держится подсвеченным до ⌘C, поэтому шагов нужно больше:
     * счет идет до клика по полю, где выделение снимается.
     */
    for (let i = 0; i < 42; i++) {
      await host.tick(100);
      fixture.detectChanges();
      widths.push(component.selection());

      const keys = component.keys();

      if (keys) {
        combos.add(keys.combo);
      }
    }

    // Выделение росло шагами и потом сняли: 0 до начала, 1 в пике, снова 0.
    expect(Math.max(...widths)).toBe(1);
    expect(widths[0]).toBe(0);
    // Текст держится выделенным всю паузу перед ⌘C — и гаснет только на клике по полю.
    expect(widths.lastIndexOf(1) - widths.indexOf(1)).toBeGreaterThan(8);
    expect(widths[widths.length - 1]).toBe(0);
    // Перед вставкой текст копируют: ⌘C, затем ⌘V в поле.
    expect(combos.has('cmd+c')).toBe(true);
    expect(combos.has('cmd+v')).toBe(true);
  });
});
