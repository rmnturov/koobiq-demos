/** Точность поля: минуты, секунды или миллисекунды. */
export type TimeFormat = 'HH:mm' | 'HH:mm:ss' | 'HH:mm:ss.SSS';

/** Цикл часов: сутки целиком или половина с меридиемом. */
export type HourCycle = 'h23' | 'h12';

/** Половина суток в 12-часовом цикле. */
export type Meridiem = 'AM' | 'PM';

/** Часть поля, которую можно выделить и править отдельно. */
export type Segment = 'hours' | 'minutes' | 'seconds' | 'milliseconds' | 'meridiem';

/** Сторона, с которой `clearSegment` ищет сегмент для очистки: `back` — Backspace, `forward` — Delete. */
export type ClearDirection = 'back' | 'forward';

/** Части времени. Часы всегда хранятся в 24-часовом виде, независимо от цикла отображения. */
export interface TimeValue {
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
}

/** Выделение в тексте поля: границы в символах. */
export interface Selection {
    start: number;
    end: number;
}

/** Итог правки текста: что осталось в поле и куда встала каретка. */
export interface EditResult extends Selection {
    view: string;
    rejected: boolean;
}
