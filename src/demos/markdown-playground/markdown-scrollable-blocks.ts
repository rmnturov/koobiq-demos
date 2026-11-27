import {
    afterRenderEffect,
    ApplicationRef,
    ChangeDetectionStrategy,
    Component,
    createComponent,
    Directive,
    ElementRef,
    EnvironmentInjector,
    inject,
    Injector,
    input,
    untracked,
    ViewEncapsulation
} from '@angular/core';
import { KbqMarkdown } from '@koobiq/components/markdown';
import { KbqScrollbarViewport } from '@koobiq/components/scrollbar';

@Component({
    selector: 'app-markdown-block-viewport',
    hostDirectives: [KbqScrollbarViewport],
    host: { '[class]': 'blockClasses()' },
    template: '<ng-content />',
    styles: `
        .markdown-table-scroll {
            position: relative;
            overflow-x: auto;
            margin-bottom: var(--kbq-markdown-table-size-margin-bottom);
        }

        .markdown-table-scroll > .kbq-markdown__table {
            margin-bottom: 0;
        }
    `,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
class MarkdownBlockViewport {
    readonly blockClasses = input.required<string>();
}

// KbqMarkdown renders HTML through innerHTML, so Angular does not instantiate directives inside it.
@Directive({ selector: 'kbq-markdown[markdownScrollableBlocks]' })
export class MarkdownScrollableBlocks {
    private readonly markdown = inject(KbqMarkdown);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    private readonly application = inject(ApplicationRef);
    private readonly environment = inject(EnvironmentInjector);
    private readonly injector = inject(Injector);

    constructor() {
        afterRenderEffect({ write: (onCleanup) => {
            this.markdown.markdownText();
            const blocks = this.host.querySelectorAll<HTMLElement>('.kbq-markdown__output :is(pre, table)');
            const views = untracked(() => Array.from(blocks, block => this.attachViewport(block)));
            onCleanup(() => views.forEach(view => view.destroy()));
        } });
    }

    private attachViewport(block: HTMLElement) {
        const isTable = block.tagName === 'TABLE';
        const host = isTable ? block.ownerDocument.createElement('div') : block;
        const blockClasses = isTable ? 'markdown-table-scroll' : block.className;
        if (isTable) {
            block.before(host);
        }

        const view = createComponent(MarkdownBlockViewport, {
            hostElement: host,
            projectableNodes: [isTable ? [block] : Array.from(block.childNodes)],
            environmentInjector: this.environment,
            elementInjector: this.injector
        });
        view.setInput('blockClasses', blockClasses);
        this.application.attachView(view.hostView);
        return view;
    }
}
