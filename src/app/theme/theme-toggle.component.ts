import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { KbqThemeMode, KbqThemeService, PopUpPlacements } from '@koobiq/components/core';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqSelect, KbqSelectModule } from '@koobiq/components/select';
import { KbqToolTipModule } from '@koobiq/components/tooltip';

/** Icon of the trigger, one per mode: the mode that follows the browser is the machine itself. */
const MODE_ICONS: Record<KbqThemeMode, string> = {
    light: 'kbq-sun_16',
    dark: 'kbq-moon_16',
    auto: 'kbq-desktop-o_16'
};

/** The icon alone does not say what the button switches, so the tooltip names the mode in words. */
const MODE_TOOLTIPS: Record<KbqThemeMode, string> = {
    light: 'Светлая тема',
    dark: 'Темная тема',
    auto: 'Системная тема'
};

/**
 * Theme switcher shaped as an icon button: the select host is the combobox, so the trigger stays a plain
 * box instead of nesting a button inside a widget role.
 */
@Component({
    selector: 'app-theme-toggle',
    imports: [KbqIconModule, KbqSelectModule, KbqToolTipModule],
    template: `
        <kbq-select
            aria-label="Тема"
            class="theme-toggle"
            [panelMinWidth]="0"
            [value]="themeService.mode()"
            (valueChange)="themeService.setMode($event)"
        >
            <span
                class="theme-toggle__trigger"
                kbq-select-trigger
                [kbqPlacement]="PopUpPlacements.Left"
                [kbqTooltip]="tooltip()"
                [kbqTooltipArrow]="false"
            >
                <i [kbq-icon]="icon()"></i>
            </span>
            <kbq-option value="auto">
                <i class="theme-toggle__option-icon" kbq-icon="kbq-desktop-o_16"></i>Системная
            </kbq-option>
            <kbq-option value="light">
                <i class="theme-toggle__option-icon" kbq-icon="kbq-sun_16"></i>Светлая
            </kbq-option>
            <kbq-option value="dark">
                <i class="theme-toggle__option-icon" kbq-icon="kbq-moon_16"></i>Темная
            </kbq-option>
        </kbq-select>
    `,
    styles: `
        :host {
            display: inline-flex;
        }

        .theme-toggle {
            width: auto;
            --kbq-select-size-single-padding-vertical: 0;
            --kbq-select-size-single-padding-left: 0;
            --kbq-select-size-single-padding-right: 0;
        }

        /* Same box as the neighbouring icon buttons: button tokens are scoped to the button itself. */
        .theme-toggle__trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            height: var(--kbq-size-3xl);
            padding-inline: var(--kbq-size-s);
            border-radius: var(--kbq-size-border-radius);

            @supports (corner-shape: squircle) {
                corner-shape: squircle;
                border-radius: clamp(
                    var(--kbq-size-border-radius) * 1.85,
                    var(--kbq-size-border-radius) * 2.3 - 3.6px,
                    var(--kbq-size-border-radius) * 2
                );
            }
        }

        /* The design keeps a full step between an option's icon and its label; the space in the markup
           would only give the width of a word gap. */
        .theme-toggle__option-icon {
            margin-inline-end: var(--kbq-size-s);
        }

        /* The icon is the whole trigger: the select's own chevron would make the button look like a field. */
        :host ::ng-deep .kbq-select .kbq-select__arrow-wrapper {
            display: none;
        }

        .theme-toggle:hover .theme-toggle__trigger {
            background: var(--kbq-states-background-transparent-hover);
        }

        .theme-toggle:active .theme-toggle__trigger,
        .theme-toggle[aria-expanded='true'] .theme-toggle__trigger {
            background: var(--kbq-states-background-contrast-fade-active);
        }

        .theme-toggle:focus-visible {
            outline: none;
        }

        .theme-toggle:focus-visible .theme-toggle__trigger {
            outline: 1px solid var(--kbq-states-line-focus-theme);
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeToggleComponent {
    protected readonly themeService = inject(KbqThemeService);
    protected readonly icon = computed(() => MODE_ICONS[this.themeService.mode()]);
    protected readonly tooltip = computed(() => MODE_TOOLTIPS[this.themeService.mode()]);
    protected readonly PopUpPlacements = PopUpPlacements;

    private readonly select = viewChild(KbqSelect);

    constructor() {
        // The trigger is an icon button at the trailing edge of the bar, so there is no room for the panel on
        // its right: aligned to the trigger's start the menu overflows the viewport, and the push that keeps
        // it on screen leaves a gap between the two. Anchored to the trailing edge instead, the panel hangs
        // to the left of the trigger, flush with it — as in the design.
        afterNextRender(() => {
            const select = this.select();

            if (!select) {
                return;
            }

            select.positions = select.positions.map((position) => ({...position, originX: 'end', overlayX: 'end'}));
        });
    }
}
