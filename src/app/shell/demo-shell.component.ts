import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { KbqBreadcrumbsModule } from '@koobiq/components/breadcrumbs';
import { KbqButtonModule, KbqButtonStyles } from '@koobiq/components/button';
import { KbqComponentColors, PopUpPlacements } from '@koobiq/components/core';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqScrollbar } from '@koobiq/components/scrollbar';
import { KbqToolTipModule } from '@koobiq/components/tooltip';
import { KbqTopBarModule } from '@koobiq/components/top-bar';
import { filter, map, startWith } from 'rxjs';
import { findDemo } from '../../demos/demos.registry';
import { pageTitleFor, repoUrlFor, zipPathFor } from '../config';
import { ThemeToggleComponent } from '../theme/theme-toggle.component';

/**
 * Frame of every page: the catalog and the demos share one top bar, so the trail, the actions and the
 * theme switcher are defined once. A page without a demo simply ends its trail at the catalog.
 */
@Component({
    selector: 'app-demo-shell',
    imports: [
        RouterLink,
        RouterOutlet,
        KbqBreadcrumbsModule,
        KbqButtonModule,
        KbqIconModule,
        KbqScrollbar,
        KbqToolTipModule,
        KbqTopBarModule,
        ThemeToggleComponent
    ],
    templateUrl: './demo-shell.component.html',
    styleUrl: './demo-shell.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoShellComponent {
    protected readonly pageScrolled = signal(false);
    private readonly route = inject(ActivatedRoute);
    private readonly pageTitle = inject(Title);

    constructor() {
        // The tab title follows the trail: the demo's own name in front of the site's.
        effect(() => this.pageTitle.setTitle(pageTitleFor(this.demo()?.title)));
    }

    private readonly slug = toSignal(
        inject(Router).events.pipe(
            filter((event) => event instanceof NavigationEnd),
            startWith(null),
            map(() => this.deepestPath())
        ),
        { requireSync: true }
    );

    protected readonly demo = computed(() => findDemo(this.slug()));

    protected readonly repoUrl = computed(() => {
        const demo = this.demo();

        return demo ? repoUrlFor(demo.slug) : '';
    });
    protected readonly zipPath = computed(() => {
        const demo = this.demo();

        return demo ? zipPathFor(demo.slug) : '';
    });

    protected readonly KbqButtonStyles = KbqButtonStyles;
    protected readonly KbqComponentColors = KbqComponentColors;
    protected readonly PopUpPlacements = PopUpPlacements;

    /**
     * A demo keeps its whole state inside its component, so the honest reset is a reload of the page: the
     * URL and the theme (stored by the theme service) survive, the demo starts over. Re-creating only the
     * outlet does not work — the router activates a child on navigation, and a fresh outlet without one
     * stays empty.
     */
    protected resetDemo(): void {
        location.reload();
    }

    /** The demo slug lives in the deepest route; the catalog route resolves to its own empty path. */
    private deepestPath(): string {
        let route = this.route.snapshot;

        while (route.firstChild) {
            route = route.firstChild;
        }

        return route.routeConfig?.path ?? '';
    }
}
