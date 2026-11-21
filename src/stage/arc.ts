/**
 * Путь руки по сцене.
 *
 * Мышь не идет по прямой: рука выгибает ход в сторону и разгоняется к середине, поэтому
 * курсор, переставленный из точки в точку переходом `transform`, читается как телепорт.
 * Здесь считается дуга: точки хода с изингом, уже вложенным в смещения кадров, — их
 * отдает `Element.animate`. Один кадр — одна доля пути, поэтому анимация не зависит от
 * частоты кадров, а отменить ее можно так же, как любую другую.
 */

export interface ArcPoint {
  x: number;
  y: number;
}

/** Сколько кадров у хода: больше — плавнее, но каждый лишний кадр это лишний узел. */
const ARC_STEPS = 14;

/** Разгон к середине и торможение к концу — как у руки, которая тянется к цели. */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Точка с точностью до сотых: миллионные доли пикселя в `transform` — только шум. */
const tidy = (value: number): number => Math.round(value * 100) / 100;

/** Выгиб дуги: восьмая часть хода, но не больше 24 px — иначе рука летит по кругу. */
export const arcBow = (distance: number): number => Math.min(distance * 0.08, 24);

/**
 * Длительность хода: долгий ход не укладывается в бит короткого. Мышь проходит 270 px
 * за большее время, чем 120, и один бит на все переходы читается броском от точки покоя
 * до текста. Потолок 650 мс держит петлю в темпе, пол 300 — короткий ход не мигает.
 */
export const moveMs = (from: ArcPoint, to: ArcPoint): number =>
  Math.round(
    Math.min(650, Math.max(300, 260 + Math.hypot(to.x - from.x, to.y - from.y) * 0.9)),
  );

/**
 * Кадры хода из точки в точку. Дуга выгнута вбок от прямой: направление выгиба задает
 * поворот вектора хода на 90°, поэтому короткий ход почти прямой, а длинный — заметно
 * боком. Начало и конец дуги совпадают с точками точно: курсор приходит туда, куда целился.
 */
export function arcKeyframes(from: ArcPoint, to: ArcPoint): Keyframe[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 0.5) {
    return [
      { transform: `translate3d(${tidy(to.x)}px, ${tidy(to.y)}px, 0)`, offset: 0 },
      { transform: `translate3d(${tidy(to.x)}px, ${tidy(to.y)}px, 0)`, offset: 1 },
    ];
  }

  const bow = arcBow(distance);
  // Нормаль к ходу: выгиб всегда в одну сторону, поэтому ход не петляет.
  const nx = -dy / distance;
  const ny = dx / distance;
  const frames: Keyframe[] = [];

  for (let step = 0; step <= ARC_STEPS; step++) {
    const t = step / ARC_STEPS;
    const eased = easeInOutCubic(t);
    const lift = Math.sin(Math.PI * eased) * bow;
    const x = from.x + dx * eased + nx * lift;
    const y = from.y + dy * eased + ny * lift;

    frames.push({ transform: `translate3d(${tidy(x)}px, ${tidy(y)}px, 0)`, offset: t });
  }

  return frames;
}
