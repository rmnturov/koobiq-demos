import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoEntry } from '../../demos/demo.types';
import { DEMOS } from '../../demos/demos.registry';

@Component({
    selector: 'app-catalog',
    imports: [RouterLink],
    templateUrl: './catalog.component.html',
    styleUrl: './catalog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogComponent {
    readonly demos = input<readonly DemoEntry[]>(DEMOS);

    /** В каталог идут только видимые: у скрытых остается маршрут, но не карточка. */
    protected readonly visible = computed(() => this.demos().filter((demo) => !demo.hidden));
}
