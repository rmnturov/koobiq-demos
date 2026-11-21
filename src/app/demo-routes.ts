import { Type } from '@angular/core';
import { Routes } from '@angular/router';
import { DemoEntry } from '../demos/demo.types';
import { DemoLoadErrorComponent } from './shell/demo-load-error.component';

/** Child routes of the demo shell: one lazy route per registry entry plus a redirect for unknown slugs. */
export function buildDemoRoutes(demos: readonly DemoEntry[]): Routes {
    return [
        ...demos.map((demo) => ({
            path: demo.slug,
            providers: demo.providers,
            loadComponent: (): Promise<Type<unknown>> =>
                demo.loadComponent().catch((error: unknown) => {
                    console.error(error);
                    return DemoLoadErrorComponent;
                })
        })),
        { path: '**', redirectTo: '/' }
    ];
}
