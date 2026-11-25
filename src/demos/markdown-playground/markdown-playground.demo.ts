import { afterNextRender, afterRenderEffect, ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, inject } from '@angular/core';
import { KbqMarkdown } from '@koobiq/components/markdown';
import { article, changelog, examples, examplesIntro, headingExamples, orderedList } from './content';

@Component({
    selector: 'app-markdown-playground',
    imports: [KbqMarkdown],
    templateUrl: './markdown-playground.demo.html',
    styleUrl: './markdown-playground.demo.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarkdownPlaygroundDemo {
    private readonly location = inject(DOCUMENT).location;
    protected readonly pageUrl = this.location.href.split('#')[0];
    protected readonly columns = [
        { label: '16/20', compact: false },
        { label: '14/20', compact: true }
    ];
    protected readonly sections: readonly {
        id: string;
        title: string;
        rows: readonly { label?: string; markdown: string }[];
    }[] = [
        { id: 'article', title: 'Статья', rows: [{ markdown: article }] },
        { id: 'changelog', title: 'Чейнджлог', rows: [{ markdown: changelog }] },
        { id: 'examples', title: 'Соседство элементов', rows: [{ markdown: examplesIntro }, ...examples] },
        { id: 'headings', title: 'Заголовки подряд', rows: headingExamples.map(markdown => ({ markdown })) },
        { id: 'ordered-list', title: 'Список из 19 пунктов', rows: [{ markdown: orderedList }] }
    ];

    constructor() {
        const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
        afterRenderEffect({
            earlyRead: () => {
                const headings = host.querySelectorAll<HTMLElement>(
                    ':is(#examples, #headings) .kbq-markdown__output :is(h1, h2, h3, h4, h5, h6)'
                );
                return Array.from(headings, (heading) => {
                    const { fontSize, lineHeight } = getComputedStyle(heading);
                    return { heading, label: `${heading.tagName} ${parseFloat(fontSize)}/${parseFloat(lineHeight)}` };
                });
            },
            write: (measurements) => {
                for (const { heading, label } of measurements()) {
                    heading.dataset['typeScale'] = label;
                }
            }
        });
        afterNextRender(() => {
            // A direct link can arrive before the lazy route has rendered its anchors.
            const id = this.location.hash.slice(1);
            if (id) {
                host.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.scrollIntoView();
            }
        });
    }
}
