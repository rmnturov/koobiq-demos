import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { KbqThemeService, PopUpPlacements, kbqThemeProvider } from '@koobiq/components/core';
import { KbqSelect } from '@koobiq/components/select';
import { KbqTooltipTrigger } from '@koobiq/components/tooltip';
import { ThemeToggleComponent } from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
    let fixture: ComponentFixture<ThemeToggleComponent>;
    let theme: KbqThemeService;

    const trigger = (): HTMLElement => fixture.nativeElement.querySelector('.theme-toggle__trigger');
    const triggerIcon = (): string =>
        Array.from(trigger().querySelector('i')!.classList).find((name) => /_\d+$/.test(name))!;
    /** The list lives in an overlay, which CDK mounts on the document body. */
    const options = (): HTMLElement[] => Array.from(document.querySelectorAll('kbq-option')) as HTMLElement[];
    const open = async (): Promise<HTMLElement[]> => {
        fixture.nativeElement.querySelector('.kbq-select__trigger').click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        return options();
    };

    beforeEach(async () => {
        localStorage.clear();
        await TestBed.configureTestingModule({
            imports: [ThemeToggleComponent],
            providers: [kbqThemeProvider({ mode: 'auto', storageKey: 'toggle-spec-theme' })]
        }).compileComponents();
        theme = TestBed.inject(KbqThemeService);
        fixture = TestBed.createComponent(ThemeToggleComponent);
        await fixture.whenStable();
    });

    afterEach(() => {
        document.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
    });

    it('offers the modes in the design order, each with its own icon', async () => {
        const list = await open();
        expect(list.map((option) => option.textContent?.trim())).toEqual(['Системная', 'Светлая', 'Темная']);
        expect(list[0].querySelector('.kbq-icon.kbq-desktop-o_16')).not.toBeNull();
        expect(list[1].querySelector('.kbq-icon.kbq-sun_16')).not.toBeNull();
        expect(list[2].querySelector('.kbq-icon.kbq-moon_16')).not.toBeNull();
    });

    it('shows the system mode on the trigger by default', () => {
        expect(theme.mode()).toBe('auto');
        expect(triggerIcon()).toBe('kbq-desktop-o_16');
    });

    it('reflects service mode changes on the trigger', () => {
        theme.setMode('dark');
        fixture.detectChanges();
        expect(triggerIcon()).toBe('kbq-moon_16');

        theme.setMode('light');
        fixture.detectChanges();
        expect(triggerIcon()).toBe('kbq-sun_16');
    });

    it('sets the service mode from the list', async () => {
        const list = await open();
        list[2].click();
        await fixture.whenStable();
        expect(theme.mode()).toBe('dark');

        theme.setMode('auto');
        fixture.detectChanges();
        (await open())[1].click();
        await fixture.whenStable();
        expect(theme.mode()).toBe('light');
    });

    it('names the combobox for assistive technology', () => {
        expect(fixture.nativeElement.querySelector('kbq-select')?.getAttribute('aria-label')).toBe('Тема');
    });

    it('anchors the panel to the trailing edge of the trigger', async () => {
        await open();
        const select = fixture.debugElement.query(By.directive(KbqSelect)).componentInstance as KbqSelect;
        expect(select.positions.length).toBeGreaterThan(0);
        expect(select.positions.every(({originX, overlayX}) => originX === 'end' && overlayX === 'end')).toBe(true);
    });

    it('names the current mode in a tooltip on the left, without an arrow', () => {
        const tooltip = fixture.debugElement
            .query(By.css('.theme-toggle__trigger'))
            .injector.get(KbqTooltipTrigger);

        expect(tooltip.content).toBe('Системная тема');
        expect(tooltip.tooltipPlacement).toBe(PopUpPlacements.Left);
        expect(tooltip.arrow).toBe(false);
    });

    it('keeps the tooltip in step with the selected mode', async () => {
        theme.setMode('dark');
        fixture.detectChanges();
        const tooltip = fixture.debugElement
            .query(By.css('.theme-toggle__trigger'))
            .injector.get(KbqTooltipTrigger);

        expect(tooltip.content).toBe('Темная тема');
    });
});
