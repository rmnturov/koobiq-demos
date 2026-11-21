import { importProvidersFrom } from '@angular/core';
import { KbqLuxonDateModule } from '@koobiq/angular-luxon-adapter/adapter';

import { DemoEntry } from './demo.types';

/** The only place where demos are wired into the app. One entry per demo. */
export const DEMOS: readonly DemoEntry[] = [
    {
        slug: 'hello',
        title: 'Hello',
        description: 'Проверка каркаса: тема и компонент Koobiq',
        loadComponent: () => import('./hello/hello.demo').then((m) => m.HelloDemo)
    },
    {
        slug: 'time-input',
        title: 'Время в поле ввода',
        description: 'Мультики о том, как поле времени обрабатывает вставку и ввод',
        loadComponent: () => import('./time-input/time-input.demo').then((m) => m.TimeInputDemo),
        // Оглавление показывает только рабочие демки: это исходный мультик поля.
        hidden: true
    },
    {
        slug: 'timepicker',
        title: 'Таймпикер',
        description: 'Живой прототип поля времени: маска, умная вставка, секунды, миллисекунды и AM/PM',
        loadComponent: () => import('./timepicker/timepicker.demo').then((m) => m.TimepickerDemo)
    },
    {
        slug: 'timepicker-compare',
        title: 'Поле времени: сравнение',
        description: 'Старый таймпикер и новое поле времени рядом: ввод, вставка и что с ними происходит',
        loadComponent: () =>
            import('./timepicker-compare/timepicker-compare.demo').then((m) => m.TimepickerCompareDemo),
        providers: [importProvidersFrom(KbqLuxonDateModule)]
    },
    {
        slug: 'shadow-tuner',
        title: 'Настройка теней',
        description:
            'Тюнинг теней: палитра и геометрия трёх слоёв, сравнение со стоком, превью на настоящих поверхностях и ссылка на готовый набор',
        loadComponent: () => import('./shadow-tuner/shadow-tuner.demo').then((m) => m.ShadowTunerDemo)
    }
];

export function findDemo(slug: string): DemoEntry | undefined {
    return DEMOS.find((demo) => demo.slug === slug);
}
