import { arcBow, arcKeyframes, easeInOutCubic, moveMs } from './arc';

describe('arc', () => {
  /*
   * Ход руки должен быть дугой: середина пути уходит вбок от прямой, а концы совпадают
   * с точками. Прямая середина означала бы, что курсор едет телепортом по линии.
   */
  it('bows away from the straight line and lands on the point', () => {
    const frames = arcKeyframes({ x: 0, y: 0 }, { x: 200, y: 0 });
    const xs = frames.map((frame) => Number(/translate3d\(([-\d.]+)px/.exec(String(frame['transform']))![1]));
    const ys = frames.map((frame) => Number(/translate3d\([-\d.]+px, ([-\d.]+)px/.exec(String(frame['transform']))![1]));

    expect(xs[0]).toBe(0);
    expect(ys[0]).toBe(0);
    expect(xs[xs.length - 1]).toBeCloseTo(200);
    expect(ys[ys.length - 1]).toBeCloseTo(0);

    // Выгиб: середина уходит в сторону, и заметно — до arcBow(200) = 16.
    const middle = Math.floor(frames.length / 2);
    expect(Math.abs(ys[middle])).toBeGreaterThan(arcBow(200) * 0.8);
  });

  /*
   * Изинг заложен в смещения кадров, а не в анимацию: кадры стоят ровно по долям пути,
   * поэтому ход не зависит от частоты кадров, а дуга не растягивается на концах.
   */
  it('spreads the frames evenly and eases the travel', () => {
    const frames = arcKeyframes({ x: 0, y: 0 }, { x: 100, y: 40 });

    expect(frames.map((frame) => frame['offset'])).toEqual(
      frames.map((_, index) => index / (frames.length - 1)),
    );
    // Разгон: первая половина пути проходит меньшую часть расстояния, чем вторая.
    const half = frames[Math.floor(frames.length / 2)]!;
    const x = Number(/translate3d\(([-\d.]+)px/.exec(String(half['transform']))![1]);

    expect(x).toBeGreaterThan(40);
    expect(x).toBeLessThan(60);
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });

  /*
   * Длительность хода растет с расстоянием: один бит на все переходы читался броском,
   * когда рука шла от точки покоя до текста, а короткий ход к полю — миганием.
   */
  it('takes longer for a long hop than for a short one', () => {
    const stay = { x: 0, y: 0 };

    // Короткий ход — пол 300, длинный до 268 px — около 500, дальше растет до потолка.
    expect(moveMs(stay, { x: 20, y: 0 })).toBe(300);
    expect(moveMs(stay, { x: 268, y: 0 })).toBe(Math.round(260 + 268 * 0.9));
    expect(moveMs(stay, { x: 2000, y: 0 })).toBe(650);
    expect(moveMs(stay, { x: 120, y: 0 })).toBeLessThan(moveMs(stay, { x: 240, y: 0 }));
  });

  // Короткий ход — почти прямая: выгиб ограничен и не превращает клик в петлю.
  it('keeps a short hop almost straight', () => {
    expect(arcBow(20)).toBeCloseTo(1.6);
    expect(arcBow(1000)).toBe(24);

    const frames = arcKeyframes({ x: 10, y: 10 }, { x: 12, y: 10 });

    expect(frames.length).toBeGreaterThan(2);
  });
});
