import { importProvidersFrom } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { KbqLuxonDateModule } from '@koobiq/angular-luxon-adapter/adapter';

import { CASES, CompareCase, casesOf, tocLabelOf } from './cases';
import { CompareComponent } from './compare/compare.component';
import { TimepickerCompareDemo } from './timepicker-compare.demo';

interface Rendered {
  fixture: ComponentFixture<TimepickerCompareDemo>;
  root: HTMLElement;
}

/** Группа кейсов в статье: заголовок секции и идентификаторы ее блоков. */
interface CaseGroup {
  heading: string;
  ids: string[];
}

/**
 * Страница поднимается как есть: адаптер даты нужен живой паре, а больше ничего
 * снаружи не требуется — провайдер приходит из записи реестра.
 */
function render(): Rendered {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TimepickerCompareDemo],
    providers: [importProvidersFrom(KbqLuxonDateModule)],
  });

  const fixture = TestBed.createComponent(TimepickerCompareDemo);

  fixture.detectChanges();

  return {
    fixture,
    root: fixture.nativeElement as HTMLElement,
  };
}

/**
 * Ожидаемый состав групп из данных страницы, а не из разметки: кейсы набора, вставка
 * без пар «где разницы нет» и сами совпадения. Пометку `noDiff` держит `cases.ts`, и её
 * состав закреплён в `cases.spec.ts`: здесь она только читается, как на странице.
 * Сегодня это 3 / 7 / 3 кейса — числа написаны намеренно без привязки к разметке.
 */
function expectedGroups(): string[][] {
  const isNoDiff = (item: CompareCase): boolean => item.noDiff === true;
  const pastes = casesOf('paste');

  return [casesOf('type'), pastes.filter((item) => !isNoDiff(item)), pastes.filter(isNoDiff)].map(
    (group) => group.map((item) => item.id),
  );
}

/** Группы так, как их видит читатель: секция статьи и блоки внутри нее по порядку. */
function readGroups(
  fixture: ComponentFixture<TimepickerCompareDemo>,
  article: HTMLElement,
): CaseGroup[] {
  const idOf = new Map<Element, string>();

  // Идентификатор кейса живет во входе блока, а не в разметке: `ng-reflect-*` в проде нет.
  for (const element of fixture.debugElement.queryAll(By.directive(CompareComponent))) {
    idOf.set(element.nativeElement, element.injector.get(CompareComponent).case().id);
  }

  return [...article.querySelectorAll<HTMLElement>(':scope > .demo__section')].map((section) => ({
    heading: section.querySelector('h2')?.textContent?.trim() ?? '',
    ids: [...section.querySelectorAll('tc-compare')].map((element) => idOf.get(element) ?? ''),
  }));
}

/**
 * Страница целиком: 13 блоков сравнения и 26 панелей, каждая со своим замером. Под
 * параллельным прогоном набора штатных 5 с не хватает, и тест падает по таймауту, хотя
 * рендер проходит: здесь поднят потолок, а не ослаблена проверка.
 */
const PAGE_MS = 20_000;

describe('timepicker-compare demo', () => {

  it('renders the live pair before the case sections', () => {
    const { root } = render();
    const tags = [...root.querySelectorAll('tc-live-pair, h2')].map((el) =>
      el.tagName.toLowerCase(),
    );

    expect(tags[0]).toBe('tc-live-pair');
  }, PAGE_MS);

  it('renders the sections in the declared order', () => {
    const { root } = render();
    const headings = [...root.querySelectorAll('h2')].map((el) => el.textContent?.trim());

    expect(headings).toEqual(['Ввод с клавиатуры', 'Вставка', 'Где разницы нет']);
  }, PAGE_MS);

  it('collects one compare block per case', () => {
    const { root } = render();

    expect(root.querySelectorAll('tc-compare').length).toBe(CASES.length);
  }, PAGE_MS);

  it('keeps every case in its own group right under its heading', () => {
    const { fixture, root } = render();
    const groups = readGroups(fixture, root.querySelector('article')!);
    const expected = expectedGroups();

    // Групп ровно три и они под своими заголовками: четвертый заголовок блоков не забирает.
    expect(groups.map((group) => group.heading)).toEqual([
      'Ввод с клавиатуры',
      'Вставка',
      'Где разницы нет',
    ]);

    // Длины групп в порядке статьи — 3 / 7 / 3 от данных кейсов.
    expect(groups.map((group) => group.ids.length)).toEqual(expected.map((group) => group.length));

    // Состав и порядок: сюда попадают и перепутанные группы, и кейс, потерянный в одной из них.
    expect(groups.map((group) => group.ids)).toEqual(expected);
  }, PAGE_MS);

  /*
   * Заголовок у каждого сравнения: `h3` с названием кейса и `id` вида `case-<id>`.
   * Проверяется вместе с блоком: заголовок обязан стоять над своим блоком, иначе подпись
   * и картинка разъезжаются, а якорь ведет не туда.
   */
  it('heads every comparison with a case title and its own anchor', () => {
    const { root } = render();

    for (const item of CASES) {
      const heading = root.querySelector<HTMLElement>(`#case-${item.id}`);

      expect(heading?.tagName).toBe('H3');
      expect(heading?.textContent?.trim()).toBe(item.title);
      // Заголовок стоит прямо перед блоком своего кейса: между ними только строка точности.
      const block = heading?.parentElement?.nextElementSibling;

      expect(block?.tagName.toLowerCase()).toBe('tc-compare');
    }
  }, PAGE_MS);

  /*
   * Оглавление секции: якорные ссылки на ее кейсы до первого примера. Число ссылок
   * сверяется с числом кейсов, а каждая ссылка — с настоящим заголовком в документе:
   * так ловится и потерянная ссылка, и якорь, который висит в воздухе.
   */
  it('lists the cases of a section as anchors in the table of contents', () => {
    const { root } = render();
    const expectations: {
      label: string;
      items: readonly CompareCase[];
      toc: (item: CompareCase) => string;
    }[] = [
      {
        label: 'Кейсы набора',
        items: casesOf('type'),
        // Слово секции в списке не повторяется: над оглавлением уже стоит «Ввод».
        toc: tocLabelOf,
      },
      {
        label: 'Кейсы вставки',
        items: casesOf('paste').filter((item) => item.noDiff !== true),
        // То же у вставки: «Вставка» остается только в заголовке кейса.
        toc: tocLabelOf,
      },
    ];

    for (const { label, items, toc } of expectations) {
      const nav = root.querySelector(`nav[aria-label="${label}"]`);

      expect(nav).not.toBeNull();

      // Семантика списка: ссылки живут в `ul`/`li`, а не в абзаце через запятую.
      const links = [...nav!.querySelectorAll('li > a')] as HTMLAnchorElement[];

      expect(links.length).toBe(items.length);
      expect(links.map((link) => link.textContent?.trim())).toEqual(items.map(toc));
      expect(links.map((link) => link.getAttribute('href'))).toEqual(
        items.map((item) => `#case-${item.id}`),
      );

      // Ссылка ведет к заголовку своего кейса: слово секции живет в заголовке, не в списке.
      links.forEach((link, index) => {
        const target = document.querySelector(link.getAttribute('href')!);

        expect(target?.tagName).toBe('H3');
        expect(target?.textContent?.trim()).toBe(items[index].title);
      });
    }
  }, PAGE_MS);

  /*
   * Абзац перед сравнением — часть кейса: он объясняет, откуда взялся исход, там, где
   * подпись под панелью уже не помогает. Проверяются оба случая: без абзаца его нет,
   * с абзацем он стоит последним в колонке текста, сразу под заголовком. Данные подменяются на один тест
   * и возвращаются назад.
   */
  it('puts a case note between the meta line and the comparison', () => {
    const cases = CASES as CompareCase[];
    const index = cases.findIndex((item) => item.section === 'paste');
    const original = cases[index]!;

    cases[index] = { ...original, note: 'Абзац о разборе' };

    try {
      const { root } = render();
      const heading = root.querySelector<HTMLElement>(`#case-${original.id}`)!;
      const note = heading.nextElementSibling as HTMLElement;

      expect(note.classList).toContain('demo__note');
      expect(note.textContent).toContain('Абзац о разборе');
      // Абзац последний в колонке текста, а пара стоит под ним: абзац объясняет то,
      // что читатель увидит ниже.
      expect(note.nextElementSibling).toBeNull();
      expect(note.parentElement?.nextElementSibling?.tagName.toLowerCase()).toBe('tc-compare');
    } finally {
      cases[index] = original;
    }
  }, PAGE_MS);

  it('gives no table of contents to the section without differences', () => {
    const { root } = render();
    const sections = [...root.querySelectorAll<HTMLElement>('article > .demo__section')];
    const last = sections[sections.length - 1];

    expect(last.querySelector('h2')?.textContent?.trim()).toBe('Где разницы нет');
    expect(last.querySelector('nav')).toBeNull();
  }, PAGE_MS);

  /*
   * Переход по оглавлению делает компонент: в этой оболочке `<base href="/">` разрешает
   * относительный якорь от корня сайта, и обычный `href="#case-…"` уводит на каталог
   * вместо заголовка. Сторож держит и отмену перехода, и адресата прокрутки.
   */
  it('jumps to the case heading instead of leaving the page', () => {
    const { root } = render();
    const link = root.querySelector<HTMLAnchorElement>('nav[aria-label="Кейсы набора"] li > a')!;
    const target = root.querySelector<HTMLElement>(link.getAttribute('href')!);
    const scrolled: Element[] = [];
    const native = Element.prototype.scrollIntoView;

    Element.prototype.scrollIntoView = function (this: Element): void {
      scrolled.push(this);
    };

    try {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });

      link.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(scrolled).toEqual([target]);
    } finally {
      Element.prototype.scrollIntoView = native;
    }
  }, PAGE_MS);

  /*
   * Кадр 15-8682: статья 1280 с полями 16, колонка текста 640, блок сравнения — во всю
   * ширину статьи. Ширину в jsdom не измерить, но объявленные значения видны в стилях:
   * это и есть сторож против возврата к одной колонке на всю страницу.
   */
  it('keeps the text column at 640 and the comparison at the article width', () => {
    const { root } = render();
    const article = root.querySelector<HTMLElement>('.demo')!;
    const text = root.querySelector<HTMLElement>('.demo__text')!;

    expect(getComputedStyle(article).width).toBe('1280px');
    expect(getComputedStyle(text).width).toBe('640px');
    // Сравнение не носит своей ширины: оно растягивается по статье, и это видно по его хосту.
    expect(getComputedStyle(article).boxSizing).toBe('border-box');
    expect(getComputedStyle(article).paddingLeft).toBe('16px');
    // Низ статьи — 200 по кадру: последний абзац не прилипает к краю окна.
    expect(getComputedStyle(article).paddingBottom).toBe('200px');
  }, PAGE_MS);

  /*
   * Заголовки статьи — отступы кадра (H1 32/12, H2 20/12, H3 16/12) и масштаб статей
   * Кубика: переменные `--kbq-md-typography-md-h*` держат 36/44, 24/32 и 20/28 кадра.
   * Прикладные классы `kbq-headline`/`kbq-title`/`kbq-subheading` сюда не годятся —
   * они на ступень ниже (28/32, 20/28, 18/26), и это и есть сторож против возврата.
   */
  it('styles the headings by the frame', () => {
    const { root } = render();
    const h1 = root.querySelector<HTMLElement>('h1')!;
    const h2 = root.querySelector<HTMLElement>('.demo__h2')!;
    const h3 = root.querySelector<HTMLElement>('.demo__h3')!;
    const styles = [...document.querySelectorAll('style')].map((el) => el.textContent).join('');

    expect(h1.className).not.toContain('kbq-headline');
    expect(getComputedStyle(h1).marginTop).toBe('32px');
    expect(getComputedStyle(h1).marginBottom).toBe('12px');

    expect(h2.className).not.toContain('kbq-title');
    // Первый раздел стоит под серой парой: там отступ больше, иначе пример прилипает.
    expect(getComputedStyle(h2).marginTop).toBe('48px');
    expect(getComputedStyle(h2).marginBottom).toBe('12px');

    expect(h3.className).not.toContain('kbq-subheading');
    // Первый кейс идет сразу за прозой раздела, поэтому здесь 32, а не базовые 16.
    expect(getComputedStyle(h3).marginTop).toBe('32px');
    expect(getComputedStyle(h3).marginBottom).toBe('12px');
    // Запас прокрутки под верхнюю панель: иначе якорь уводит заголовок под нее.
    expect(getComputedStyle(h3).scrollMarginTop).toBe('64px');

    /*
     * Отступ идет от того, что стоит над заголовком: проза над кейсом — 32, пример над
     * кейсом — 16 (вместе с 24 снизу блока это 40 по кадру). Серая пара сверху держит 24,
     * чтобы не слипаться со вступительным абзацем.
     */
    const cases = [...root.querySelectorAll<HTMLElement>('.demo__case')];
    const afterProse = cases.find((item) => item.previousElementSibling?.classList.contains('demo__text'))!;
    const afterBlock = cases.find((item) => item.previousElementSibling?.classList.contains('demo__case'))!;
    const live = root.querySelector<HTMLElement>('.demo__live')!;

    expect(getComputedStyle(afterProse.querySelector<HTMLElement>('.demo__h3')!).marginTop).toBe('32px');
    expect(getComputedStyle(afterBlock.querySelector<HTMLElement>('.demo__h3')!).marginTop).toBe('16px');
    expect(getComputedStyle(live).marginTop).toBe('24px');

    // Размеры — из markdown-типографики Кубика, единственной шкалы с шагами кадра.
    for (const level of [1, 2, 3]) {
      expect(styles).toContain(`--kbq-md-typography-md-h${level}-font-size`);
      expect(styles).toContain(`--kbq-md-typography-md-h${level}-line-height`);
    }
  }, PAGE_MS);
});
