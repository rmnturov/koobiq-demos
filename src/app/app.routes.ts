import { Routes } from '@angular/router';
import { DEMOS } from '../demos/demos.registry';
import { CatalogComponent } from './catalog/catalog.component';
import { buildDemoRoutes } from './demo-routes';
import { DemoShellComponent } from './shell/demo-shell.component';

export const routes: Routes = [
    {
        path: '',
        component: DemoShellComponent,
        children: [
            { path: '', pathMatch: 'full', component: CatalogComponent },
            { path: 'demo', children: buildDemoRoutes(DEMOS) }
        ]
    },
    { path: '**', redirectTo: '' }
];
