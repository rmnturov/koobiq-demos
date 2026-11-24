import { TestBed } from '@angular/core/testing';
import { KbqThemeService, kbqThemeProvider } from '@koobiq/components/core';

import { NotificationStatusTenantDemo, tenantInitial } from './notification-status-tenant.demo';

describe('notification status and tenant', () => {
  it('switches tenant palettes while documenting both themes side by side', async () => {
    TestBed.configureTestingModule({
      imports: [NotificationStatusTenantDemo],
      providers: [kbqThemeProvider({ mode: 'light', storageKey: 'notification-theme-spec' })],
    });
    const theme = TestBed.inject(KbqThemeService);
    theme.setMode('light');
    const fixture = TestBed.createComponent(NotificationStatusTenantDemo);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const surface = root.querySelector<HTMLElement>('.demo')!;
    const families = [
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
    ];
    const checkTheme = (dark: boolean) => {
      for (const [index, family] of families.entries()) {
        const palette = `--kbq-plt-${dark ? 'dark-' : ''}${family}`;
        const foregroundFamily = family === 'yellow-fixed' ? 'yellow' : family;
        const darkForeground = index === 0 ? 13 : 15;
        const background = dark ? `var(--kbq-plt-dark-${foregroundFamily}-7)` : `var(${palette}-6)`;
        const foreground = `var(--kbq-plt-${dark ? 'dark-' : ''}${foregroundFamily}-${dark ? darkForeground : 16})`;
        expect(surface.style.getPropertyValue(`--notification-tenant-bg-${index + 1}`)).toBe(
          background,
        );
        expect(surface.style.getPropertyValue(`--notification-tenant-icon-${index + 1}`)).toBe(
          foreground,
        );
        const backgroundRow = root.querySelector(
          `[data-color-variable="--notification-tenant-bg-${index + 1}"]`,
        )!;
        const foregroundRow = root.querySelector(
          `[data-color-variable="--notification-tenant-icon-${index + 1}"]`,
        )!;
        expect(
          [...backgroundRow.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
        ).toEqual([`var(--kbq-plt-${family}-6)`, `var(--kbq-plt-dark-${foregroundFamily}-7)`]);
        expect(
          [...foregroundRow.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
        ).toEqual([
          `var(--kbq-plt-${foregroundFamily}-16)`,
          `var(--kbq-plt-dark-${foregroundFamily}-${darkForeground})`,
        ]);
      }
      expect(surface.classList.contains('kbq-light')).toBe(false);
      expect(root.querySelector('.variables__swatch')).toBeNull();
    };
    checkTheme(false);
    theme.setMode('dark');
    fixture.detectChanges();
    checkTheme(true);
    theme.setMode('light');
    fixture.detectChanges();
    checkTheme(false);
  });

  it('shows the tenant feed and lets notifications be removed by item, date, and all at once', async () => {
    TestBed.configureTestingModule({ imports: [NotificationStatusTenantDemo] });
    const fixture = TestBed.createComponent(NotificationStatusTenantDemo);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const rows = () => [...root.querySelectorAll<HTMLElement>('[data-feed-notification]')];
    expect(rows()).toHaveLength(9);
    expect(root.querySelectorAll('.feed__organization')).toHaveLength(6);
    expect(rows()[0].textContent).toContain('ООО «ЗащитаДанных»');
    expect(rows()[0].querySelector('[data-notification-badge]')?.getAttribute('data-tenant')).toBe(
      'ООО «ЗащитаДанных»',
    );
    expect(rows()[1].querySelector('.notification-badge__tenant')).toBeNull();
    rows()[0].querySelector<HTMLButtonElement>('.feed__remove')!.click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(8);
    root
      .querySelector<HTMLButtonElement>('[aria-label="Удалить уведомления за 8 апреля"]')!
      .click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(2);
    root.querySelector<HTMLButtonElement>('[aria-label="Удалить все уведомления"]')!.click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(0);
    expect(root.textContent).toContain('Нет уведомлений');
  });

  it('updates the preview and CSS documentation from all six sliders', async () => {
    TestBed.configureTestingModule({ imports: [NotificationStatusTenantDemo] });
    const fixture = TestBed.createComponent(NotificationStatusTenantDemo);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const surface = root.querySelector<HTMLElement>('.demo')!;
    const beforeMask = surface.style.getPropertyValue('--notification-status-mask');
    expect(root.querySelectorAll('input[type="range"]')).toHaveLength(6);
    const values = {
      statusSize: 64,
      tenantSize: 32,
      offset: 12,
      gap: 4,
      statusRadius: 12,
      tenantRadius: 8,
    };
    for (const [key, value] of Object.entries(values)) {
      const input = root.querySelector<HTMLInputElement>(`#badge-${key}`)!;
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    }
    expect(surface.style.getPropertyValue('--notification-status-size')).toBe('64px');
    expect(surface.style.getPropertyValue('--notification-tenant-size')).toBe('32px');
    expect(surface.style.getPropertyValue('--notification-mask-gap')).toBe('4px');
    expect(surface.style.getPropertyValue('--notification-status-mask')).not.toBe(beforeMask);
    const docs = root.querySelector('[aria-label="CSS-переменные: Геометрия"]')!;
    expect([...docs.querySelectorAll('tbody td')].map((cell) => cell.textContent?.trim())).toEqual([
      '4px',
      '12px',
      '64px',
      '12px',
      '8px',
      '32px',
    ]);
    const statusSize = root.querySelector<HTMLInputElement>('#badge-statusSize')!;
    statusSize.value = '24';
    statusSize.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('#badge-tenantSize')?.value).toBe('24');
    expect(root.querySelector<HTMLInputElement>('#badge-tenantSize')?.max).toBe('24');
    expect(surface.style.getPropertyValue('--notification-tenant-size')).toBe('24px');
  });

  it('uses the first printable grapheme without splitting combined characters', () => {
    expect(tenantInitial('  \u200bкубик')).toBe('К');
    expect(tenantInitial('\uFE0FАльфа')).toBe('А');
    expect(tenantInitial('\nalpha')).toBe('A');
    expect(tenantInitial('  7-й филиал')).toBe('7');
    expect(tenantInitial('е\u0308лка')).toBe('Е\u0308');
    expect(tenantInitial('👩‍💻 Команда')).toBe('👩‍💻');
    expect(tenantInitial('   ')).toBe('—');
  });

  it('keeps each tenant in the same category across all three statuses and renders', async () => {
    TestBed.configureTestingModule({ imports: [NotificationStatusTenantDemo] });
    const fixture = TestBed.createComponent(NotificationStatusTenantDemo);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const readBadges = () => [
      ...root.querySelectorAll<HTMLElement>('.preview__grid [data-notification-badge]'),
    ];
    const badges = readBadges();
    expect(badges).toHaveLength(30);
    const tenants = new Map<string, { category: string; statuses: Set<string> }>();
    for (const badge of badges) {
      const name = badge.dataset['tenant']!;
      const category = badge.dataset['category']!;
      const status = badge.dataset['status']!;
      expect(badge.getAttribute('aria-label')).toContain(name);
      expect(badge.querySelector('.notification-badge__tenant')?.textContent?.trim()).toBe(
        tenantInitial(name),
      );
      const tenant = tenants.get(name) ?? { category, statuses: new Set<string>() };
      expect(category).toBe(tenant.category);
      tenant.statuses.add(status);
      tenants.set(name, tenant);
    }
    expect(tenants.size).toBe(10);
    expect(new Set([...tenants.values()].map((tenant) => tenant.category)).size).toBe(10);
    for (const tenant of tenants.values()) {
      expect([...tenant.statuses].sort()).toEqual(['error', 'info', 'warning']);
    }
    const labels = badges.map((badge) => badge.getAttribute('aria-label'));
    fixture.detectChanges();
    expect(readBadges().map((badge) => badge.getAttribute('aria-label'))).toEqual(labels);
    const second = TestBed.createComponent(NotificationStatusTenantDemo);
    second.detectChanges();
    const secondRoot: HTMLElement = second.nativeElement;
    expect(
      [...secondRoot.querySelectorAll('.preview__grid [data-notification-badge]')].map((badge) =>
        badge.getAttribute('aria-label'),
      ),
    ).toEqual(labels);
  });
});
