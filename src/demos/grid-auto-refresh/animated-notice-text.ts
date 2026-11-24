import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';

const EASING = 'cubic-bezier(0.23, 1, 0.32, 1)';

@Component({
  selector: 'incident-notice-text',
  template: `
    <span class="label-content">
      <span #numberSlot class="number-slot">
        <span #currentNumber class="number-current kbq-tabular-normal">{{ parts().number }}</span>
        <span #outgoingNumber class="number-outgoing kbq-tabular-normal"></span>
      </span>
      <span class="suffix">{{ parts().suffix }}</span>
    </span>
    <span #measurement class="measurement"
      ><span class="kbq-tabular-normal">{{ parts().number }}</span
      ><span>{{ parts().suffix }}</span></span
    >
  `,
  styleUrl: './animated-notice-text.scss',
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnimatedNoticeText {
  readonly text = input('');
  readonly active = input(false);
  readonly parts = computed(() => {
    const match = /^(\d+)(.*)$/.exec(this.text());
    return { number: match?.[1] ?? '', suffix: match?.[2] ?? this.text() };
  });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly currentNumber = viewChild.required<ElementRef<HTMLElement>>('currentNumber');
  private readonly outgoingNumber = viewChild.required<ElementRef<HTMLElement>>('outgoingNumber');
  private readonly numberSlot = viewChild.required<ElementRef<HTMLElement>>('numberSlot');
  private readonly measurement = viewChild.required<ElementRef<HTMLElement>>('measurement');
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private previousText = '';
  private previousNumber = '';
  private previouslyActive = false;
  private animations: Animation[] = [];

  constructor() {
    const destroy = inject(DestroyRef);
    afterRenderEffect({
      earlyRead: () => this.measure(),
      write: (measurement) => this.update(measurement()),
    });
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.update(this.measure()));
      observer.observe(this.measurement().nativeElement);
      observer.observe(this.currentNumber().nativeElement);
      const stopMotion = () => this.cancelAnimations();
      this.reducedMotion.addEventListener('change', stopMotion);
      destroy.onDestroy(() => {
        observer.disconnect();
        this.reducedMotion.removeEventListener('change', stopMotion);
      });
    });
    destroy.onDestroy(() => this.cancelAnimations());
  }

  private measure() {
    const current = this.currentNumber().nativeElement;
    const style = getComputedStyle(current);
    return {
      text: this.text(),
      number: this.parts().number,
      active: this.active(),
      width: parseFloat(getComputedStyle(this.measurement().nativeElement).width),
      numberWidth: parseFloat(style.width),
      opacity: style.opacity,
      transform: style.transform,
    };
  }

  private update(next: ReturnType<AnimatedNoticeText['measure']>): void {
    const changed = next.text !== this.previousText;
    const animate = next.active && this.previouslyActive && changed;
    if (changed || (next.active && !this.previouslyActive)) {
      this.host.nativeElement.classList.toggle('animate-size', animate);
    }
    this.host.nativeElement.style.width = `${next.width}px`;
    this.numberSlot().nativeElement.style.width = `${next.numberWidth}px`;

    if (changed) {
      this.cancelAnimations();
      if (animate && next.number && this.previousNumber && next.number !== this.previousNumber) {
        const outgoing = this.outgoingNumber().nativeElement;
        outgoing.textContent = this.previousNumber;
        const reduce = this.reducedMotion.matches;
        const options = { duration: reduce ? 80 : 160, easing: EASING };
        this.animations = [
          outgoing.animate(
            [
              { opacity: next.opacity, transform: reduce ? 'none' : next.transform },
              { opacity: 0, transform: reduce ? 'none' : 'translateY(-6px)' },
            ],
            options,
          ),
          this.currentNumber().nativeElement.animate(
            [
              { opacity: 0, transform: reduce ? 'none' : 'translateY(6px)' },
              { opacity: 1, transform: 'none' },
            ],
            options,
          ),
        ];
      }
    }
    this.previousText = next.text;
    this.previousNumber = next.number;
    this.previouslyActive = next.active;
  }

  private cancelAnimations(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
  }
}
