import { NgStyle, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { KbqThemeService } from '@koobiq/components/core';
import { KbqIconModule } from '@koobiq/components/icon';
import {
  BadgeGeometry,
  badgeGeometryStyles,
  DEFAULT_GEOMETRY,
  GEOMETRY_CONTROLS,
  geometryControlMax,
  updateBadgeGeometry,
} from './badge-geometry';
import { NOTIFICATION_STATUSES as STATUSES, tenantInitial } from './notification-data';
import { NotificationFeedComponent } from './notification-feed.component';

export { tenantInitial } from './notification-data';

const CATEGORIES = [
  { color: 'blue', darkForegroundStep: 13 },
  { color: 'green', darkForegroundStep: 15 },
  { color: 'teal', darkForegroundStep: 15 },
  { color: 'purple', darkForegroundStep: 15 },
  { color: 'red', darkForegroundStep: 15 },
  { color: 'orange', darkForegroundStep: 15 },
  { color: 'yellow', darkForegroundStep: 15 },
  { color: 'slate', darkForegroundStep: 15 },
  { color: 'grey', darkForegroundStep: 15 },
  { color: 'yellow-fixed', darkForegroundStep: 15 },
] as const;

const TENANTS = [
  { name: 'Кубик', category: 1 },
  { name: 'Альфа', category: 4 },
  { name: 'Вектор', category: 2 },
  { name: 'Орбита', category: 6 },
  { name: 'Север', category: 3 },
  { name: 'Маяк', category: 10 },
  { name: 'Пульс', category: 5 },
  { name: 'Горизонт', category: 8 },
  { name: 'Линия', category: 7 },
  { name: 'Ритм', category: 9 },
] as const;

interface ColorVariable {
  name: string;
  lightToken: string;
  darkToken: string;
}

const colorVariable = (
  name: string,
  lightToken: string,
  darkToken = lightToken,
): ColorVariable => ({
  name,
  lightToken,
  darkToken,
});

const STATUS_VARIABLES: readonly ColorVariable[] = STATUSES.flatMap((status) => [
  colorVariable(
    `--notification-status-bg-${status.id}`,
    `--kbq-background-${status.background}-less`,
  ),
  colorVariable(`--notification-status-icon-${status.id}`, `--kbq-icon-${status.background}`),
]);

// Figma hzTjmRSN66Z7r3B8phvwVa: tenant/{bg,icon}/{1..4}, Collection 1.
// Categories 5–10 extend the shared steps; blue keeps its explicit dark icon step.
const TENANT_STEPS = { lightBackground: 6, lightForeground: 16, darkBackground: 7 } as const;

const TENANT_VARIABLES: readonly ColorVariable[] = CATEGORIES.flatMap((category, index) => [
  colorVariable(
    `--notification-tenant-bg-${index + 1}`,
    `--kbq-plt-${category.color}-${TENANT_STEPS.lightBackground}`,
    `--kbq-plt-dark-${category.color === 'yellow-fixed' ? 'yellow' : category.color}-${TENANT_STEPS.darkBackground}`,
  ),
  colorVariable(
    `--notification-tenant-icon-${index + 1}`,
    `--kbq-plt-${category.color === 'yellow-fixed' ? 'yellow' : category.color}-${TENANT_STEPS.lightForeground}`,
    `--kbq-plt-dark-${category.color === 'yellow-fixed' ? 'yellow' : category.color}-${category.darkForegroundStep}`,
  ),
]);

// A fixed permutation covers all 30 pairs without changing a tenant's color on reload.
const SAMPLE_ORDER = [
  7, 20, 3, 16, 29, 12, 25, 8, 21, 4, 11, 26, 1, 18, 24, 9, 13, 22, 0, 17, 28, 14, 27, 2, 19, 6, 10,
  23, 15, 5,
];
const SAMPLES = SAMPLE_ORDER.map((pair) => {
  const tenant = TENANTS[pair % TENANTS.length];
  const status = STATUSES[Math.floor(pair / TENANTS.length)];
  return { tenant, status, initial: tenantInitial(tenant.name) };
});

@Component({
  selector: 'notification-status-tenant-demo',
  imports: [KbqIconModule, NgStyle, NgTemplateOutlet, NotificationFeedComponent],
  templateUrl: './notification-status-tenant.demo.html',
  styleUrl: './notification-status-tenant.demo.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationStatusTenantDemo {
  private readonly theme = inject(KbqThemeService);
  protected readonly geometry = signal({ ...DEFAULT_GEOMETRY });
  protected readonly geometryControls = GEOMETRY_CONTROLS;
  protected readonly geometryVariables = [...GEOMETRY_CONTROLS].sort((a, b) =>
    a.variable.localeCompare(b.variable, 'en', { numeric: true }),
  );
  protected readonly geometryControlMax = geometryControlMax;
  protected readonly squircle = signal(false);
  protected readonly samples = SAMPLES;
  protected readonly variableGroups = [
    {
      label: 'Статусы',
      description: 'Отдельные цвета фона и иконки для каждого статуса.',
      rows: [...STATUS_VARIABLES].sort((a, b) =>
        a.name.localeCompare(b.name, 'en', { numeric: true }),
      ),
    },
    {
      label: 'Тенанты',
      description: 'Десять категорий с отдельными цветами фона и буквы.',
      rows: [...TENANT_VARIABLES].sort((a, b) =>
        a.name.localeCompare(b.name, 'en', { numeric: true }),
      ),
    },
  ];
  protected readonly surfaceStyles = computed(() => ({
    ...Object.fromEntries(
      [...STATUS_VARIABLES, ...TENANT_VARIABLES].map((row) => [
        row.name,
        `var(${this.theme.colorScheme() === 'dark' ? row.darkToken : row.lightToken})`,
      ]),
    ),
    ...badgeGeometryStyles(this.geometry(), this.squircle()),
  }));

  constructor() {
    afterNextRender({
      read: () => {
        this.squircle.set(CSS.supports('corner-shape', 'squircle'));
      },
    });
  }

  protected updateGeometry(key: keyof BadgeGeometry, value: number): void {
    this.geometry.update((geometry) => updateBadgeGeometry(geometry, key, value, this.squircle()));
  }
}
