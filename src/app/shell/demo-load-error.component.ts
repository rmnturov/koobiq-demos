import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KbqLinkModule } from '@koobiq/components/link';

@Component({
    selector: 'app-demo-load-error',
    imports: [RouterLink, KbqLinkModule],
    template: `
        <p>Не удалось загрузить демо</p>
        <a kbqLink routerLink="/">Назад</a>
    `,
    styles: ':host { display: block; padding: var(--kbq-size-l); color: var(--kbq-foreground-contrast); }',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoLoadErrorComponent {}
