import { TestBed } from '@angular/core/testing';
import { MarkdownPlaygroundDemo } from './markdown-playground.demo';

describe('MarkdownPlaygroundDemo', () => {
  let page: HTMLElement;

  beforeEach(async () => {
    const fixture = TestBed.createComponent(MarkdownPlaygroundDemo);
    await fixture.whenStable();
    page = fixture.nativeElement;
  });

  it.each([1, 2, 3, 4, 5, 6])('renders H%i between two paragraphs in its own sample', (level) => {
    const sample = Array.from(page.querySelectorAll('#examples .sample')).find(
      (element) => element.querySelector('h3')?.textContent === `Абзац → H${level} → абзац`,
    );

    expect(sample?.querySelector(`kbq-markdown p + h${level} + p`)).toBeTruthy();
  });

  it('keeps the contents links on the current page when the demo is embedded elsewhere', async () => {
    const originalUrl = window.location.href;
    try {
      window.history.replaceState(null, '', '/notes/preview?edition=24');
      const embedded = TestBed.createComponent(MarkdownPlaygroundDemo);
      await embedded.whenStable();
      const links: NodeListOf<HTMLAnchorElement> = embedded.nativeElement.querySelectorAll('nav a');
      expect(Array.from(links, (link) => link.href)).toEqual(
        ['article', 'changelog', 'examples'].map((id) => `${window.location.origin}/notes/preview?edition=24#${id}`),
      );
    } finally {
      window.history.replaceState(null, '', originalUrl);
    }
  });

  it('renders the two documents and the block transitions', () => {
    expect(page.querySelector('#article kbq-markdown ul ol')).toBeTruthy();
    expect(page.querySelector('#article kbq-markdown table')).toBeTruthy();
    expect(page.querySelectorAll('#changelog kbq-markdown h2').length).toBeGreaterThan(1);

    for (const sequence of [
      'pre + h2 + p',
      'h2 + h3 + p',
      'p + pre + p',
      'pre + pre',
      'p + blockquote + p',
      'p + table + p',
      'p + hr + p',
      'p + ol + p',
      'p + ul + p',
    ]) {
      expect(page.querySelector(`#examples kbq-markdown ${sequence}`), sequence).toBeTruthy();
    }
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
