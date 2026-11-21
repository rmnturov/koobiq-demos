import { Component, InjectionToken, makeEnvironmentProviders, Type } from '@angular/core';
import { Route } from '@angular/router';
import { DemoEntry } from '../demos/demo.types';
import { buildDemoRoutes } from './demo-routes';
import { DemoLoadErrorComponent } from './shell/demo-load-error.component';

@Component({ selector: 'fake-demo', template: 'fake' })
class FakeDemo {}

const TOKEN = new InjectionToken<string>('fake');

const entry = (slug: string, load: () => Promise<Type<unknown>> = async () => FakeDemo): DemoEntry => ({
    slug,
    title: slug,
    description: slug,
    loadComponent: load,
    providers: [{ provide: TOKEN, useValue: slug }]
});

const resolve = async (route: Route) => (route.loadComponent as () => Promise<Type<unknown>>)();

describe('buildDemoRoutes', () => {
    it('creates a route per slug and a wildcard redirect last', () => {
        const routes = buildDemoRoutes([entry('a'), entry('b')]);
        expect(routes.map((r) => r.path)).toEqual(['a', 'b', '**']);
        expect(routes[2].redirectTo).toBe('/');
    });

    it('passes entry providers to the route', () => {
        const [route] = buildDemoRoutes([entry('a')]);
        expect(route.providers).toEqual([{ provide: TOKEN, useValue: 'a' }]);
    });

    it('accepts environment providers (provideX helpers) in an entry', () => {
        const envProviders = makeEnvironmentProviders([{ provide: TOKEN, useValue: 'env' }]);
        const [route] = buildDemoRoutes([{ ...entry('a'), providers: [envProviders] }]);
        expect(route.providers).toEqual([envProviders]);
    });

    it('loads the demo component on success', async () => {
        const [route] = buildDemoRoutes([entry('a')]);
        expect(await resolve(route)).toBe(FakeDemo);
    });

    it('falls back to the error component when loading fails', async () => {
        const [route] = buildDemoRoutes([entry('a', () => Promise.reject(new Error('chunk')))]);
        expect(await resolve(route)).toBe(DemoLoadErrorComponent);
    });

    it('logs the original load error to the console', async () => {
        const error = new Error('chunk');
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const [route] = buildDemoRoutes([entry('a', () => Promise.reject(error))]);
        await resolve(route);
        expect(spy).toHaveBeenCalledWith(error);
        spy.mockRestore();
    });
});
