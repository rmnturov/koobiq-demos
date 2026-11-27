import { NgTemplateOutlet } from '@angular/common';
import { Component, input, TemplateRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArticleGridComponent } from './article-grid.component';
import { MarkdownPlaygroundDemo } from './markdown-playground.demo';

@Component({
  selector: 'app-article-grid',
  imports: [NgTemplateOutlet],
  template: `<ng-container [ngTemplateOutlet]="articleTemplate()" [ngTemplateOutletContext]="{ $implicit: '# Запись' }" />`,
})
class ArticleGridStub {
  readonly articleTemplate = input.required<TemplateRef<{ $implicit: string }>>();
}

describe('MarkdownPlaygroundDemo', () => {
  let page: HTMLElement;
  let fixture: ComponentFixture<MarkdownPlaygroundDemo>;

  beforeEach(async () => {
    TestBed.overrideComponent(MarkdownPlaygroundDemo, {
      remove: { imports: [ArticleGridComponent] },
      add: { imports: [ArticleGridStub] },
    });
    fixture = TestBed.createComponent(MarkdownPlaygroundDemo);
    await fixture.whenStable();
    page = fixture.nativeElement;
  });

  it('compares the same Markdown in the 16/24 and 14/20 columns of every row', () => {
    expect(Array.from(page.querySelectorAll('.column-headings span'), el => el.textContent)).toEqual(['16/24', '14/20']);
    for (const row of page.querySelectorAll('.sample')) {
      const cells = row.querySelectorAll('.cell');
      expect(Array.from(cells, cell => cell.getAttribute('aria-label'))).toEqual(['16/24', '14/20']);
      expect(cells[1].classList.contains('markdown-compact')).toBe(true);
      const output = (cell: Element) => cell.querySelector('.kbq-markdown__output')?.textContent;
      expect(output(cells[0])).toBeTruthy();
      expect(output(cells[0])).toBe(output(cells[1]));
    }
  });

  it('renders the phone-width H1 specimen for each body size', () => {
    const headings = page.querySelectorAll('#mobile.markdown-mobile .cell kbq-markdown h1');
    expect(Array.from(headings, heading => heading.textContent)).toEqual(['Константинопольский', 'Константинопольский']);
  });

  it('sets the heading scale on input and restores the column defaults on reset', async () => {
    const layout = page.querySelector<HTMLElement>('.layout')!;
    const inputs = page.querySelectorAll<HTMLInputElement>('input[type=range]');
    expect(inputs).toHaveLength(2);
    const [size, gap] = Array.from(inputs);
    const property = (name: string) => layout.style.getPropertyValue('--kbq-markdown-' + name);
    const change = (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    expect(property('h1-font-size')).toBe('');
    change(size, '2');
    change(gap, '4');
    await fixture.whenStable();
    expect(property('h1-font-size')).toBe('var(--kbq-typography-title-font-size)');
    expect(property('h1-line-height')).toBe('var(--kbq-typography-title-line-height)');
    expect(layout.style.getPropertyValue('--kbq-md-typography-md-h1-font-weight')).toBe('var(--kbq-typography-title-font-weight)');
    expect(property('heading-pair-adjustment')).toBe('4px');

    page.querySelector<HTMLButtonElement>('.scale-controls button')!.click();
    await fixture.whenStable();
    expect([size.value, gap.value]).toEqual(['0', '0']);
    expect(property('h1-font-size')).toBe('');
    expect(property('h1-line-height')).toBe('');
    expect(layout.style.getPropertyValue('--kbq-md-typography-md-h1-font-weight')).toBe('');
    expect(property('heading-pair-adjustment')).toBe('0px');
  });

  it.each([1, 2, 3, 4, 5, 6])('renders H%i with two consecutive paragraphs after it', (level) => {
    const heading = page.querySelector(`#examples .sample kbq-markdown p + h${level}`);
    expect(heading?.matches(`h${level}:has(+ p + p)`)).toBe(true);
    expect(heading?.closest('.sample')?.querySelector('.sample-label')).toBeNull();
  });

  it('keeps the contents links on the page that hosts the demo', () => {
    const links = page.querySelectorAll<HTMLAnchorElement>('nav a');
    expect(Array.from(links, (link) => link.href)).toEqual(
      ['article', 'shortcuts', 'mobile', 'changelog', 'examples', 'headings-after-code', 'headings', 'ordered-list', 'article-in-grid'].map((id) => new URL(`#${id}`, window.location.href).href),
    );
  });

  it('links to one full-width grid at the end of the examples and renders its compact desktop article', () => {
    const link = page.querySelector<HTMLAnchorElement>('nav a:last-child')!;
    expect(link.textContent).toBe('Статья в интерфейсе');
    const section = page.querySelector(link.hash);
    expect(section?.matches('.layout > section:last-child')).toBe(true);
    expect(section?.querySelector('h2')?.textContent).toBe(link.textContent);
    expect(page.querySelectorAll('app-article-grid')).toHaveLength(1);
    expect(section?.querySelector(':scope > app-article-grid .markdown-desktop.markdown-compact kbq-markdown[markdownScrollableBlocks] h1')?.textContent).toBe('Запись');
  });

  it('renders the two documents and the block transitions', () => {
    expect(page.querySelector('#examples .sample:first-of-type kbq-markdown p + p')).toBeTruthy();
    expect(page.querySelector('#article kbq-markdown ul ol')).toBeTruthy();
    expect(page.querySelector('#article kbq-markdown table')).toBeTruthy();
    expect(page.querySelectorAll('#changelog kbq-markdown h2').length).toBeGreaterThan(1);

    for (const sequence of [
      'pre + h2 + p',
      'h2 + h3 + p',
      'p + pre + p',
      'p + p + pre + pre + p + p',
      'pre + blockquote + p > img:only-child',
      'p + blockquote + p',
      'p + .markdown-table-scroll:has(> table) + p',
      'p + p + hr + p + p',
      'p + p + figure + p + p',
      'p + p + p:has(> img + em) + p + p',
      'p + p + p:has(> img:only-child) + p + p',
      'ul > li > ul > li > ul',
      'ol > li > ol > li > ol',
      'p + ol + p',
      'p + ul + p',
    ]) {
      expect(page.querySelector(`#examples kbq-markdown ${sequence}`), sequence).toBeTruthy();
    }
  });

  it('mounts Koobiq scrollbars on fenced code and around semantic tables in both columns', () => {
    for (const cell of page.querySelectorAll('#examples .cell')) {
      for (const code of cell.querySelectorAll('pre > code')) {
        expect(code.parentElement?.matches('.kbq-markdown__pre.kbq-scrollbar-viewport')).toBe(true);
        expect(code.parentElement?.querySelector(':scope > kbq-scrollbar-track')).toBeTruthy();
      }
      for (const table of cell.querySelectorAll('table')) {
        expect(table.parentElement?.matches('.markdown-table-scroll.kbq-scrollbar-viewport')).toBe(true);
        expect(table.querySelector('thead th')).toBeTruthy();
      }
    }
  });

  it('renders six adjacent heading levels and each consecutive pair with prose and ten lines of code', () => {
    const samples = page.querySelectorAll('#headings .markdown-compact .kbq-markdown__output');
    expect(samples).toHaveLength(6);
    expect(samples[0].querySelector('h1 + h2 + h3 + h4 + h5 + h6')).toBeTruthy();
    for (let level = 1; level <= 5; level++) {
      const code = samples[level].querySelector(`h${level} + h${level + 1} + p + pre > code`);
      expect(code?.textContent?.trimEnd().split('\n')).toHaveLength(10);
    }
  });

  it('renders 19 ordered items in a standalone section', () => {
    expect(page.querySelectorAll('#ordered-list .markdown-compact kbq-markdown ol > li')).toHaveLength(19);
    expect(page.querySelector('#examples ol > li > p + p')).toBeTruthy();
  });

  it('renders the same illustration with both caption conventions', () => {
    const caption = page.querySelector('#examples kbq-markdown img + em');
    const figure = page.querySelector('#examples kbq-markdown figure');
    expect(caption?.textContent).toBeTruthy();
    expect(figure?.querySelector('figcaption')?.textContent).toBe(caption?.textContent);
    expect(figure?.querySelector('img')?.getAttribute('src')).toBe(
      caption?.previousElementSibling?.getAttribute('src'),
    );
    expect(figure?.nextElementSibling?.tagName).toBe('P');
  });
});
