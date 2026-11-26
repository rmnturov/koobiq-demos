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
import { KbqScrollbarViewport } from '@koobiq/components/scrollbar';
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
import {
  BadgeTheme,
  TENANT_BACKGROUND_MIN,
  themeLightnessContrast,
  themeWcagContrast,
} from './tenant-contrast';

export { tenantInitial } from './notification-data';

const CATEGORIES = [
  'blue',
  'green',
  'teal',
  'purple',
  'red',
  'orange',
  'yellow',
  'slate',
  'grey',
  'yellow-fixed',
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

function tenantVariables(
  letterSteps: Record<BadgeTheme, number>,
  backgroundSteps: Record<BadgeTheme, number>,
): readonly ColorVariable[] {
  return CATEGORIES.flatMap((color, index) => {
    const letterColor = color === 'yellow-fixed' ? 'yellow' : color;
    return [
      colorVariable(
        `--notification-tenant-bg-${index + 1}`,
        `--kbq-plt-${color}-a${backgroundSteps.light}`,
        `--kbq-plt-dark-${letterColor}-a${backgroundSteps.dark}`,
      ),
      colorVariable(
        `--notification-tenant-icon-${index + 1}`,
        `--kbq-plt-${letterColor}-${letterSteps.light}`,
        `--kbq-plt-dark-${letterColor}-${letterSteps.dark}`,
      ),
    ];
  });
}

function formattedContrast(theme: BadgeTheme, foreground: number, background: number) {
  return {
    apca: themeLightnessContrast(theme, foreground, background).toFixed(1),
    wcag: themeWcagContrast(theme, foreground, background).toFixed(2),
  };
}

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
  imports: [
    KbqIconModule,
    KbqScrollbarViewport,
    NgStyle,
    NgTemplateOutlet,
    NotificationFeedComponent,
  ],
  templateUrl: './notification-status-tenant.demo.html',
  styleUrl: './notification-status-tenant.demo.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationStatusTenantDemo {
  private readonly theme = inject(KbqThemeService);
  protected readonly letterSteps = signal({ light: 16, dark: 15 });
  protected readonly backgroundSteps = signal({ light: 6, dark: 7 });
  protected readonly backgroundMin = TENANT_BACKGROUND_MIN;
  protected readonly letterControls = [
    {
      key: 'light',
      label: 'Буква тенанта · Светлая тема',
      backgroundLabel: 'Фон тенанта · Светлая тема',
    },
    {
      key: 'dark',
      label: 'Буква тенанта · Тёмная тема',
      backgroundLabel: 'Фон тенанта · Тёмная тема',
    },
  ] as const;
  protected readonly contrast = computed(() => {
    const letters = this.letterSteps();
    const backgrounds = this.backgroundSteps();
    return {
      light: formattedContrast('light', letters.light, backgrounds.light),
      dark: formattedContrast('dark', letters.dark, backgrounds.dark),
    };
  });
  protected readonly backgroundContrast = computed(() => {
    const backgrounds = this.backgroundSteps();
    return {
      light: formattedContrast('light', backgrounds.light, TENANT_BACKGROUND_MIN.light),
      dark: formattedContrast('dark', backgrounds.dark, TENANT_BACKGROUND_MIN.dark),
    };
  });
  private readonly tenantVariables = computed(() =>
    tenantVariables(this.letterSteps(), this.backgroundSteps()),
  );
  protected readonly geometry = signal({ ...DEFAULT_GEOMETRY });
  protected readonly geometryControls = GEOMETRY_CONTROLS;
  protected readonly geometryVariables = [...GEOMETRY_CONTROLS].sort((a, b) =>
    a.variable.localeCompare(b.variable, 'en', { numeric: true }),
  );
  protected readonly geometryControlMax = geometryControlMax;
  protected readonly squircle = signal(false);
  protected readonly samples = SAMPLES;
  protected readonly variableGroups = computed(() => [
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
      rows: [...this.tenantVariables()].sort((a, b) =>
        a.name.localeCompare(b.name, 'en', { numeric: true }),
      ),
    },
  ]);
  protected readonly surfaceStyles = computed(() => ({
    ...Object.fromEntries(
      [...STATUS_VARIABLES, ...this.tenantVariables()].map((row) => [
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

  protected updateLetterColor(theme: BadgeTheme, value: number): void {
    this.letterSteps.update((steps) => ({ ...steps, [theme]: value }));
  }

  protected updateTenantBackground(theme: BadgeTheme, value: number): void {
    this.backgroundSteps.update((steps) => ({
      ...steps,
      [theme]: Math.max(TENANT_BACKGROUND_MIN[theme], Math.min(20, value)),
    }));
  }
}
