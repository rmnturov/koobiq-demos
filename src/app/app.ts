import { Component, inject } from '@angular/core';
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
}
