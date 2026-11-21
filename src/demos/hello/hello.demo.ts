import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { KbqButtonModule } from '@koobiq/components/button';

@Component({
    selector: 'hello-demo',
    imports: [KbqButtonModule],
    template: `
        <h2>Hello, Koobiq</h2>
        <button kbq-button>Кнопка</button>
    `,
    styleUrl: './hello.demo.scss',
    encapsulation: ViewEncapsulation.Emulated,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelloDemo {}
