import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqLink } from '@koobiq/components/link';
import { KbqScrollbarViewport } from '@koobiq/components/scrollbar';

import {
  NOTIFICATION_STATUSES,
  NotificationBadgeData,
  NotificationTenant,
  tenantInitial,
} from './notification-data';

interface FeedNotification {
  id: string;
  day: string;
  title: string;
  badge: NotificationBadgeData;
  organization?: string;
  content?: string;
  action?: string;
  read?: boolean;
}

function badge(
  status: NotificationBadgeData['status']['id'],
  tenant?: NotificationTenant,
): NotificationBadgeData {
  return {
    status: NOTIFICATION_STATUSES.find((item) => item.id === status)!,
    tenant,
    initial: tenant ? tenantInitial(tenant.name) : undefined,
  };
}

const NOTIFICATIONS: readonly FeedNotification[] = [
  {
    id: 'vulnerability-1',
    day: '9 апреля',
    title: '1 новая трендовая уязвимость в базе',
    badge: badge('warning', { name: 'ООО «ЗащитаДанных»', category: 5 }),
    action: 'Перейти к уязвимостям на активах',
  },
  {
    id: 'connection-ok',
    day: '9 апреля',
    title: 'Подключение проверено',
    badge: badge('success'),
    read: true,
  },
  {
    id: 'vulnerability-2',
    day: '9 апреля',
    title: '2 новые трендовые уязвимости в базе',
    badge: badge('warning', { name: 'КБТехнологии', category: 1 }),
    action: 'Перейти к уязвимостям на активах',
    read: true,
  },
  {
    id: 'connection-error',
    day: '8 апреля',
    title: 'Подключение проверено. Обнаружены ошибки',
    badge: badge('error'),
    action: 'Перейти к результатам',
    read: true,
  },
  {
    id: 'schema-installed',
    day: '8 апреля',
    title:
      'Завершена установка схемы полей событий версии 28.0.904-release-28.0 в конвейер 192.0.2.118',
    badge: badge('success'),
    read: true,
  },
  {
    id: 'tasks-stopped',
    day: '8 апреля',
    title: '50 из 76 задач остановлены',
    badge: badge('warning', { name: 'Альфазащита', category: 3 }),
    action: 'Перейти к задачам',
    read: true,
  },
  {
    id: 'info-shield',
    day: '8 апреля',
    title: 'Заголовок',
    badge: badge('contrast', { name: 'ИнфоЩит', category: 4 }),
    content:
      'Не удалось разморозить холодное сердце. При попытке сохранить штуку сервер сказал «Ой, ошибка»',
    read: true,
  },
  {
    id: 'safe-world',
    day: '8 апреля',
    title: 'Заголовок',
    badge: badge('contrast', { name: 'БезопасныйМир', category: 2 }),
    content:
      'Не удалось разморозить холодное сердце. При попытке сохранить штуку сервер сказал «Ой, ошибка»',
    read: true,
  },
  {
    id: 'kb-technologies',
    day: '8 апреля',
    title: 'Заголовок',
    badge: badge('contrast', { name: 'КБТехнологии', category: 1 }),
    organization: 'ОАО «КБТехнологии»',
    content:
      'Не удалось разморозить холодное сердце. При попытке сохранить штуку сервер сказал «Ой, ошибка»',
    read: true,
  },
];

@Component({
  selector: 'notification-feed',
  imports: [NgTemplateOutlet, KbqButtonModule, KbqIconModule, KbqLink, KbqScrollbarViewport],
  templateUrl: './notification-feed.component.html',
  styleUrl: './notification-feed.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationFeedComponent {
  readonly badgeTemplate = input.required<TemplateRef<{ $implicit: NotificationBadgeData }>>();
  protected readonly opened = signal(true);
  protected readonly silent = signal(false);
  protected readonly notifications = signal<readonly FeedNotification[]>(NOTIFICATIONS);
  protected readonly selected = signal<FeedNotification | null>(null);
  protected readonly groups = computed(() =>
    [...new Set(this.notifications().map((item) => item.day))].map((day) => ({
      day,
      items: this.notifications().filter((item) => item.day === day),
    })),
  );
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  private readonly opener = viewChild('opener', {
    read: ElementRef<HTMLButtonElement>,
  });
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('details');
  private readonly injector = inject(Injector);

  protected remove(id: string): void {
    this.notifications.update((items) => items.filter((item) => item.id !== id));
    this.restoreFocus();
  }

  protected removeDay(day: string): void {
    this.notifications.update((items) => items.filter((item) => item.day !== day));
    this.restoreFocus();
  }

  protected clear(): void {
    this.notifications.set([]);
    this.restoreFocus();
  }

  protected close(): void {
    this.opened.set(false);
    afterNextRender(() => this.opener()?.nativeElement.focus(), { injector: this.injector });
  }

  protected reopen(): void {
    this.opened.set(true);
    this.restoreFocus();
  }

  protected showDetails(notification: FeedNotification): void {
    this.selected.set(notification);
    this.notifications.update((items) =>
      items.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    );
    this.dialog().nativeElement.showModal();
  }

  protected closeDetails(): void {
    this.dialog().nativeElement.close();
  }

  private restoreFocus(): void {
    afterNextRender(() => this.body()?.nativeElement.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }
}
