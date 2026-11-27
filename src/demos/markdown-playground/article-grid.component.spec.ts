import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KbqMarkdown } from '@koobiq/components/markdown';
import { vi } from 'vitest';
import { ArticleGridComponent } from './article-grid.component';

@Component({
  imports: [ArticleGridComponent, KbqMarkdown],
  template: `
    <ng-template #article let-markdown><kbq-markdown [markdownText]="markdown" /></ng-template>
    <app-article-grid [articleTemplate]="article" />
  `,
})
class TestHost {}

describe('ArticleGridComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let page: HTMLElement;

  const names = () => page.querySelectorAll<HTMLElement>('[role="gridcell"][col-id="name"]');
  const heading = () => page.querySelector('kbq-content-panel h1');

  beforeEach(async () => {
    // jsdom cannot compute some AG Grid theme selectors; these tests use DOM events and content.
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element) => (element as HTMLElement).style,
    );
    fixture = TestBed.createComponent(TestHost);
    page = fixture.nativeElement;
    await fixture.whenStable();
    await vi.waitFor(() => expect(names().length).toBeGreaterThan(1));
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  it('opens with the first row checked and switches the article independently of the checkboxes', async () => {
    const [first, second] = Array.from(names());

    await vi.waitFor(() => expect(heading()?.textContent).toBe(first.textContent));
    expect(page.querySelector('kbq-content-panel h1 + p + p + h2 + h3 + p + pre')).toBeTruthy();
    const firstParagraph = page.querySelector('kbq-content-panel p')!.textContent;
    second.click();
    await vi.waitFor(() => expect(heading()?.textContent).toBe(second.textContent));
    expect(page.querySelectorAll('kbq-content-panel h1')).toHaveLength(1);
    expect(page.querySelector('kbq-content-panel p')!.textContent).not.toBe(firstParagraph);
    expect(first.closest('[role="row"]')?.getAttribute('aria-selected')).toBe('true');
    expect(second.closest('[role="row"]')?.classList.contains('article-open')).toBe(true);
  });

  it('changes the status of checked records together while keeping the first article open', async () => {
    await vi.waitFor(() => expect(page.textContent).toContain('Выбрано: 1'));
    const checkboxes = page.querySelectorAll<HTMLInputElement>('.ag-selection-checkbox input');
    checkboxes[1].click();
    await vi.waitFor(() => expect(page.textContent).toContain('Выбрано: 2'));
    const closeIncidents = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.bulk-actions button'),
    ).find((button) => button.textContent.trim() === 'Закрыть')!;
    closeIncidents.click();
    const statuses = () =>
      Array.from(
        page.querySelectorAll('[role="gridcell"][col-id="status"]'),
        (cell) => cell.textContent,
      );
    await vi.waitFor(() =>
      expect(statuses().slice(0, 3)).toEqual(['Закрыт', 'Закрыт', 'В работе']),
    );
    expect(heading()?.textContent).toBe(names()[0].textContent);
  });

  it('opens with Enter and returns focus to the selected record when the reader closes it', async () => {
    const cell = names()[1];
    cell.focus();
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(heading()?.textContent).toBe(cell.textContent));
    const close = page.querySelector<HTMLButtonElement>('button[aria-label="Закрыть статью"]')!;
    close.focus();
    close.click();
    await vi.waitFor(() => expect(heading()).toBeNull());
    expect(document.activeElement).toBe(cell);
    expect(cell.closest('[role="row"]')?.getAttribute('aria-selected')).not.toBe('true');
  });
});
