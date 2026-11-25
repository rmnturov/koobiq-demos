import { afterNextRender, ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, inject } from '@angular/core';
import { KbqMarkdown } from '@koobiq/components/markdown';
import { article, changelog, examples } from './content';

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
    protected readonly article = article;
    protected readonly changelog = changelog;
    protected readonly examples = examples;

    constructor() {
        const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
        afterNextRender(() => {
            // A direct link can arrive before the lazy route has rendered its anchors.
            const id = this.location.hash.slice(1);
            if (id) {
                host.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.scrollIntoView();
            }
        });
    }
}
