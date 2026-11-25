import { ChangeDetectionStrategy, Component } from '@angular/core';
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
    protected readonly article = article;
    protected readonly changelog = changelog;
    protected readonly examples = examples;
}
