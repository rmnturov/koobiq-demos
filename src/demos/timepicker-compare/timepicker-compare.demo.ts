/**
 * Страница-статья о разнице между текущим `KbqTimepicker` и новым полем времени.
 *
 * Порядок задан читателем, а не кодом: сначала живая пара, которой можно пользоваться,
 * затем набор, затем вставка, затем честные совпадения и цена контракта. Проза приходит
 * кусками из `content.ts`, а между кусками стоят интерактивные блоки: `kbq-markdown`
 * рендерит строку в `innerHTML`, и вложить в нее компонент нельзя.
 *
 * Заголовки — разметка, а не markdown: им нужны `id` для якорного оглавления. Оглавление
 * стоит под заголовком секции и до первого примера — по кадру 15-8682, где читатель
 * выбирает кейс по названию, а не прокручивает семь пар.
 *
 * Пары «где разницы нет» лежат в кейсах той же секцией `paste`: страница делит их сама
 * по пометке `noDiff` из данных, чтобы у совпадений был свой заголовок, иначе они
 * читаются хвостом списка проигрышей. Оглавления у этой секции нет: кадр его не рисует,
 * а пар там три.
 *
 * Ширина статьи — кадр: текст и заголовки в колонке 640, блок сравнения во всю ширину
 * статьи (1248 при 1280). Поэтому текст обернут в `.demo__text`, а блок стоит прямо
 * в потоке статьи.
 */

import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { KbqMarkdown } from '@koobiq/components/markdown';

import { CompareCase, casesOf, tocLabelOf } from './cases';
import { CompareComponent } from './compare/compare.component';
import { INTRO_TEXT, NO_DIFF_TEXT, PASTE_TEXT, TYPE_TEXT } from './content';
import { LivePairComponent } from './live/live-pair.component';

/** Заголовок статьи: то же название, что в реестре демо, — оболочка показывает его только в крошках. */
const TITLE = 'Поле времени: сравнение';

/** Признак пары «где разницы нет»: пометка стоит в самом кейсе, а не в списке id здесь. */
const isNoDiff = (item: CompareCase): boolean => item.noDiff === true;

/** Якорь заголовка кейса: один формат на ссылку и на `id`, иначе оглавление висит в воздухе. */
const anchorOf = (item: CompareCase): string => `case-${item.id}`;

/**
 * Плавная прокрутка разрешена, если система ее не запрещает: под reduced motion
 * оглавление прыгает к заголовку сразу.
 */
const smoothScroll = (): boolean =>
  !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

@Component({
  selector: 'timepicker-compare-demo',
  imports: [KbqMarkdown, LivePairComponent, CompareComponent],
  template: `
    <article class="demo">
      <div class="demo__text">
        <h1 class="demo__h1">{{ title }}</h1>
        <kbq-markdown [markdownText]="introText" />
      </div>

      <div class="demo__live">
        <tc-live-pair />
      </div>

      <section class="demo__section">
        <div class="demo__text">
          <h2 class="demo__h2">Ввод с клавиатуры</h2>

          <!-- Оглавление секции: ссылки на заголовки кейсов ниже, до первого примера. -->
          <nav class="demo__toc" aria-label="Кейсы набора">
            <ul class="demo__toc-list">
              @for (item of types; track item.id) {
                <li class="demo__toc-item">
                  <a
                    class="demo__toc-link kbq-text-big"
                    [href]="'#' + anchorOf(item)"
                    (click)="jump($event, item)"
                    >{{ tocOf(item) }}</a
                  >
                </li>
              }
            </ul>
          </nav>

          <kbq-markdown [markdownText]="typeText" />
        </div>

        @for (item of types; track item.id) {
          <section class="demo__case">
            <div class="demo__text">
              <h3 class="demo__h3" [id]="anchorOf(item)">{{ item.title }}</h3>
              @if (item.note) {
                <!-- Абзац кейса: markdown, как у прозы статьи, — между фактом и парой. -->
                <kbq-markdown class="demo__note" [markdownText]="item.note" />
              }
            </div>

            <tc-compare [case]="item" />
          </section>
        }
      </section>

      <section class="demo__section">
        <div class="demo__text">
          <h2 class="demo__h2">Вставка</h2>

          <nav class="demo__toc" aria-label="Кейсы вставки">
            <ul class="demo__toc-list">
              @for (item of pastes; track item.id) {
                <li class="demo__toc-item">
                  <a
                    class="demo__toc-link kbq-text-big"
                    [href]="'#' + anchorOf(item)"
                    (click)="jump($event, item)"
                    >{{ tocOf(item) }}</a
                  >
                </li>
              }
            </ul>
          </nav>

          <kbq-markdown [markdownText]="pasteText" />
        </div>

        @for (item of pastes; track item.id) {
          <section class="demo__case">
            <div class="demo__text">
              <h3 class="demo__h3" [id]="anchorOf(item)">{{ item.title }}</h3>
              @if (item.note) {
                <!-- Абзац кейса: markdown, как у прозы статьи, — между фактом и парой. -->
                <kbq-markdown class="demo__note" [markdownText]="item.note" />
              }
            </div>

            <tc-compare [case]="item" />
          </section>
        }
      </section>

      <section class="demo__section">
        <div class="demo__text">
          <h2 class="demo__h2">Где разницы нет</h2>
          <kbq-markdown [markdownText]="noDiffText" />
        </div>

        @for (item of same; track item.id) {
          <section class="demo__case">
            <div class="demo__text">
              <h3 class="demo__h3" [id]="anchorOf(item)">{{ item.title }}</h3>
              @if (item.note) {
                <!-- Абзац кейса: markdown, как у прозы статьи, — между фактом и парой. -->
                <kbq-markdown class="demo__note" [markdownText]="item.note" />
              }
            </div>

            <tc-compare [case]="item" />
          </section>
        }
      </section>

    </article>
  `,
  styleUrl: './timepicker-compare.demo.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimepickerCompareDemo {
  /** Заголовок статьи — тот же, что в реестре. */
  protected readonly title = TITLE;

  /** Вступление: что сравнивается и почему обе колонки живые. */
  protected readonly introText = INTRO_TEXT;

  /** Абзац секции набора. */
  protected readonly typeText = TYPE_TEXT;

  /** Абзац секции вставки. */
  protected readonly pasteText = PASTE_TEXT;

  /** Абзац секции совпадений. */
  protected readonly noDiffText = NO_DIFF_TEXT;

  /** Кейсы набора в объявленном порядке. */
  protected readonly types = casesOf('type');

  /** Кейсы вставки без пар «где разницы нет»: их оглавление и их блоки. */
  protected readonly pastes = casesOf('paste').filter((item) => !isNoDiff(item));

  /** Пары «где разницы нет» в объявленном порядке. */
  protected readonly same = casesOf('paste').filter(isNoDiff);

  /** Якорь заголовка кейса: `#case-<id>`. */
  protected readonly anchorOf = anchorOf;

  /** Ярлык ссылки в оглавлении: без слова секции, из самого кейса. */
  protected readonly tocOf = tocLabelOf;

  /**
   * Переход по оглавлению. Обычный `href="#case-…"` в этой оболочке уводит на каталог:
   * `<base href="/">` разрешает относительный якорь от корня сайта, и роутер видит `/`,
   * а не текущую страницу. Поэтому прокрутку делает компонент, а ссылка остается
   * ссылкой — со своим адресом, текстом и видом.
   */
  protected jump(event: Event, item: CompareCase): void {
    const target = document.getElementById(anchorOf(item));

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView?.({ block: 'start', behavior: smoothScroll() ? 'smooth' : 'auto' });
  }
}
