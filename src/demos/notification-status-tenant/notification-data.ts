const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' });

export function tenantInitial(name: string): string {
  const printable = name.replace(
    /^[\p{White_Space}\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]+/u,
    '',
  );
  return (
    graphemes
      .segment(printable)
      [Symbol.iterator]()
      .next()
      .value?.segment.toLocaleUpperCase('ru-RU') || '—'
  );
}

export const NOTIFICATION_STATUSES = [
  { id: 'info', label: 'Информация', icon: 'kbq-circle-info_16', background: 'theme' },
  {
    id: 'warning',
    label: 'Предупреждение',
    icon: 'kbq-triangle-exclamation_16',
    background: 'warning',
  },
  { id: 'error', label: 'Ошибка', icon: 'kbq-triangle-exclamation_16', background: 'error' },
  { id: 'success', label: 'Успешно', icon: 'kbq-circle-check_16', background: 'success' },
  { id: 'contrast', label: 'Информация', icon: 'kbq-circle-info_16', background: 'contrast' },
] as const;

export interface NotificationTenant {
  name: string;
  category: number;
}

export interface NotificationBadgeData {
  status: (typeof NOTIFICATION_STATUSES)[number];
  tenant?: NotificationTenant;
  initial?: string;
}
