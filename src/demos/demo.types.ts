import { EnvironmentProviders, Provider, Type } from '@angular/core';

export interface DemoEntry {
    /** Unique kebab-case id; equals the folder name in `src/demos`. */
    slug: string;
    title: string;
    description: string;
    loadComponent: () => Promise<Type<unknown>>;
    /**
     * Не показывать в каталоге. Маршрут при этом остается: на демку ссылаются статьи
     * и другие демки, и прямой адрес должен открываться.
     */
    hidden?: boolean;
    /** Route-level providers: put per-demo overrides here. */
    providers?: Array<Provider | EnvironmentProviders>;
}
