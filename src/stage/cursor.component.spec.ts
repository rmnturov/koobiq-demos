import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CursorComponent } from './cursor.component';

/** Курсор поднимается как есть: вид и номер нажатия ставятся до первого рендера. */
function render(): ComponentFixture<CursorComponent> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [CursorComponent] });

  const fixture = TestBed.createComponent(CursorComponent);

  fixture.detectChanges();

  return fixture;
}

describe('cursor', () => {
  /*
   * Кольцо клика — это анимация, а не статичный круг: оно расходится из точки и гаснет.
   * Без запуска на нажатие кольцо осталось бы в базовом состоянии, и клик читался бы
   * только по сжатию глифа.
   */
  it('sends a ring out of the click point on every press', () => {
    const fixture = render();
    const ring = fixture.nativeElement.querySelector('.cursor__ripple') as HTMLElement | null;

    expect(ring).not.toBeNull();

    const frames: Keyframe[][] = [];
    const animate = HTMLElement.prototype.animate;

    // В jsdom анимаций нет: подменяем и смотрим, что кольцу задали.
    HTMLElement.prototype.animate = function (keyframes: Keyframe[]) {
      frames.push(keyframes as Keyframe[]);

      return { onfinish: null } as unknown as Animation;
    } as typeof HTMLElement.prototype.animate;

    try {
      expect(frames.length).toBe(0);

      fixture.componentRef.setInput('press', 1);
      fixture.detectChanges();

      expect(frames.length).toBe(1);
      expect(frames[0][0]['transform']).toBe('scale(0.2)');
      expect(frames[0][1]['transform']).toBe('scale(1)');

      // Второе нажатие — второе кольцо: счетчик, а не флаг.
      fixture.componentRef.setInput('press', 2);
      fixture.detectChanges();

      expect(frames.length).toBe(2);
    } finally {
      HTMLElement.prototype.animate = animate;
    }
  });
});
