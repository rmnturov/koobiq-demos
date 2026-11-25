import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownPlaygroundDemo } from './markdown-playground.demo';

describe('MarkdownPlaygroundDemo', () => {
  let page: HTMLElement;
  let fixture: ComponentFixture<MarkdownPlaygroundDemo>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(MarkdownPlaygroundDemo);
    await fixture.whenStable();
    page = fixture.nativeElement;
  });

  it('compares the same Markdown in the 16/20 and 14/20 columns of every row', () => {
    expect(Array.from(page.querySelectorAll('.column-headings span'), el => el.textContent)).toEqual(['16/20', '14/20']);
    for (const row of page.querySelectorAll('.sample')) {
      const cells = row.querySelectorAll('.cell');
      expect(Array.from(cells, cell => cell.getAttribute('aria-label'))).toEqual(['16/20', '14/20']);
      expect(cells[1].classList.contains('markdown-compact')).toBe(true);
      const output = (cell: Element) => cell.querySelector('.kbq-markdown__output')?.textContent;
      expect(output(cells[0])).toBeTruthy();
      expect(output(cells[0])).toBe(output(cells[1]));
    }
  });

  it.each([1, 2, 3, 4, 5, 6])('renders H%i with two consecutive paragraphs after it', (level) => {
    const heading = page.querySelector(`#examples .sample kbq-markdown p + h${level}`);
    expect(heading?.matches(`h${level}:has(+ p + p)`)).toBe(true);
    expect(heading?.closest('.sample')?.querySelector('.sample-label')).toBeNull();
  });

  it('keeps the contents links on the page that hosts the demo', () => {
    const links = page.querySelectorAll<HTMLAnchorElement>('nav a');
    expect(Array.from(links, (link) => link.href)).toEqual(
      ['article', 'changelog', 'examples', 'headings', 'ordered-list'].map((id) => new URL(`#${id}`, window.location.href).href),
    );
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
      'p + table + p',
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
