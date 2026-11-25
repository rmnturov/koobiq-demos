import { importProvidersFrom } from '@angular/core';
import { KbqLuxonDateModule } from '@koobiq/angular-luxon-adapter/adapter';

import { DemoEntry } from './demo.types';

/** The only place where demos are wired into the app. One entry per demo. */
export const DEMOS: readonly DemoEntry[] = [
    {
        slug: 'markdown-playground',
        title: 'Полигон Markdown',
        description: 'Типографика Koobiq в статье, чейнджлоге и примерах соседства элементов',
        loadComponent: () => import('./markdown-playground/markdown-playground.demo').then((m) => m.MarkdownPlaygroundDemo)
    },
    {
        slug: 'notification-status-tenant',
        title: 'Статус и тенант',
        description: 'Бейджи уведомлений с цветами тенантов и CSS-переменными',
        loadComponent: () =>
            import('./notification-status-tenant/notification-status-tenant.demo').then((m) => m.NotificationStatusTenantDemo)
    },
    {
        slug: 'grid-auto-refresh',
        title: 'Автообновление в гриде',
        description: 'Поток инцидентов, защищённое обновление и бесконечная прокрутка',
        loadComponent: () => import('./grid-auto-refresh/grid-auto-refresh.demo').then(m => m.GridAutoRefreshDemo)
    },
    {
        slug: 'drilldown-menu',
        title: 'Меню настройки грида',
        description: 'Настройка автообновления с переходами между экранами',
        loadComponent: () => import('./drilldown-menu/drilldown-menu.demo').then((m) => m.DrilldownMenuDemo)
    },
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
