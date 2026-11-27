import { DOCUMENT } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { KbqThemeService } from '@koobiq/components/core';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    template: '<router-outlet />'
})
export class App {
    /** The service applies the theme class to <body> as soon as it is created. */
    private readonly themeService = inject(KbqThemeService);
    private readonly document = inject(DOCUMENT);

    constructor() {
        effect(() => {
            const suffix = this.themeService.colorScheme() === 'dark' ? '-dark' : '';
            for (const format of ['svg', 'ico']) {
                this.document.getElementById(`favicon-${format}`)
                    ?.setAttribute('href', `favicon${suffix}.${format}?v=2`);
            }
        });
    }
}
