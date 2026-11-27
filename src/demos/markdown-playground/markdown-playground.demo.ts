import { afterNextRender, afterRenderEffect, ChangeDetectionStrategy, Component, computed, DOCUMENT, ElementRef, inject, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqToggleModule } from '@koobiq/components/toggle';
import { KbqLink } from '@koobiq/components/link';
import { KbqMarkdown } from '@koobiq/components/markdown';
import { ArticleGridComponent } from './article-grid.component';
import { article, changelog, examples, examplesIntro, headingExamples, headingsAfterCode, mobileArticle, orderedList, shortcutTable } from './content';
import { MarkdownScrollableBlocks } from './markdown-scrollable-blocks';

@Component({
    selector: 'app-markdown-playground',
    imports: [KbqMarkdown, MarkdownScrollableBlocks, KbqButtonModule, KbqToggleModule, KbqLink, ArticleGridComponent],
    templateUrl: './markdown-playground.demo.html',
    styleUrls: ['./markdown-playground.demo.scss', './markdown-hot-keys.scss', './markdown-tables.scss', './markdown-captions.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarkdownPlaygroundDemo {
    private readonly location = inject(DOCUMENT).location;
    private readonly mobileViewport = toSignal(inject(BreakpointObserver).observe('(max-width: 760px)'));
    protected readonly previewOverride = signal<boolean | null>(null);
    protected readonly mobilePreview = computed(() => this.previewOverride() ?? this.mobileViewport()?.matches ?? false);
    protected readonly pageUrl = this.location.href.split('#')[0];
    protected readonly presets = [
        { label: 'Subheading', token: '--kbq-typography-subheading' },
        { label: 'Title', token: '--kbq-typography-title' },
        { label: 'Headline', token: '--kbq-typography-headline' },
        { label: 'Display Compact', token: '--kbq-typography-display-compact' },
        { label: 'Display Compact Strong', token: '--kbq-typography-display-compact-strong' },
        { label: 'Display Normal', token: '--kbq-typography-display-normal' },
        { label: 'Display Normal Strong', token: '--kbq-typography-display-normal-strong' },
        { label: 'Display Big', token: '--kbq-typography-display-big' },
        { label: 'Display Big Strong', token: '--kbq-typography-display-big-strong' }
    ];
    protected readonly presetIndex = signal(0);
    protected readonly preset = computed(() => this.presetIndex() === 0 ? null : this.presets[this.presetIndex() - 1]);
    protected readonly headingStyle = computed(() => {
        const preset = this.preset();
        return preset ? {
            '--kbq-markdown-h1-font-size': `var(${preset.token}-font-size)`,
            '--kbq-markdown-h1-line-height': `var(${preset.token}-line-height)`,
            '--kbq-md-typography-md-h1-font-weight': `var(${preset.token}-font-weight)`
        } : {};
    });
    protected readonly presetLabel = computed(() => this.preset()?.label ?? 'Markdown H1');
    protected readonly pairAdjustment = signal(0);
    protected readonly gapLabel = computed(() => {
        const value = this.pairAdjustment();
        return `${value > 0 ? '+' : ''}${value} px`;
    });
    protected readonly columns = [
        { label: '16/24', compact: false },
        { label: '14/20', compact: true }
    ];
    protected readonly sections: readonly {
        id: string;
        title: string;
        rows: readonly { label?: string; markdown: string }[];
    }[] = [
        { id: 'article', title: 'Статья', rows: [{ markdown: article }] },
        { id: 'shortcuts', title: 'Сочетания клавиш', rows: [{ markdown: shortcutTable }] },
        { id: 'mobile', title: 'Мобильные стили', rows: [{ label: 'Экран 320 px · поля по 16 px', markdown: mobileArticle }] },
        { id: 'changelog', title: 'Чейнджлог', rows: [{ markdown: changelog }] },
        { id: 'examples', title: 'Соседство элементов', rows: [{ markdown: examplesIntro }, ...examples] },
        { id: 'headings-after-code', title: 'Заголовки после кода', rows: [{ markdown: headingsAfterCode }] },
        { id: 'headings', title: 'Заголовки подряд', rows: headingExamples.map(markdown => ({ markdown })) },
        { id: 'ordered-list', title: 'Список из 19 пунктов', rows: [{ markdown: orderedList }] }
    ];

    constructor() {
        const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
        afterRenderEffect({
            earlyRead: () => {
                // Both the preset and the viewport can change the sizes reported by the labels.
                this.preset();
                this.mobilePreview();
                const headings = host.querySelectorAll<HTMLElement>(
                    ':is(#examples, #headings, #headings-after-code) .kbq-markdown__output :is(h1, h2, h3, h4, h5, h6)'
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

    protected resetScale(): void {
        this.presetIndex.set(0);
        this.pairAdjustment.set(0);
    }
}
