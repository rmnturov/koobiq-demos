import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { kbqThemeProvider } from '@koobiq/components/core';
import { KbqModalRef, KbqModalService } from '@koobiq/components/modal';
import { AgGridAngular } from 'ag-grid-angular';
import { CellClickedEvent, ColDef, SELECTION_COLUMN_ID } from 'ag-grid-community';

import { ShadowStore } from '../model/shadow-store';
import { CardsScene } from './cards-scene';
import { LevelsScene } from './levels-scene';
import { ModalScene } from './modal-scene';
import { SelectScene } from './select-scene';
import { WorkspaceScene } from './workspace-scene';

interface Rendered<T> {
    fixture: ComponentFixture<T>;
    root: HTMLElement;
}

/** Поднятые фикстуры: `ShadowStore` пишет переменные на `body`, без `destroy` они доживают до соседа. */
const mounted: Array<ComponentFixture<unknown>> = [];

/**
 * Сцена поднимается на своём хосте: провайдеров у неё нет, а `ShadowStore` приходит из тестового
 * модуля. Адрес выставляется до `createComponent`, потому что хранилище читает его в конструкторе.
 */
async function render<T>(scene: Type<T>, search = ''): Promise<Rendered<T>> {
    history.replaceState(null, '', `/demo/shadow-tuner${search ? `?${search}` : ''}`);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
        imports: [scene],
        providers: [kbqThemeProvider({ mode: 'light', storageKey: 'shadow-tuner-spec-theme' }), ShadowStore]
    }).compileComponents();

    const fixture = TestBed.createComponent(scene);

    mounted.push(fixture as ComponentFixture<unknown>);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, root: fixture.nativeElement as HTMLElement };
}

/**
 * Объявленное правило класса: jsdom не считает computed styles Кубика и падает на его CSS
 * (`Specificity.max` без специфичности), поэтому объявление читается из `<style>` компонента.
 */
function declared(selector: string): string {
    const pattern = new RegExp(`${selector.replace(/[.$]/g, '\\$&')}(?=[\\s,\\[{])[^{}]*\\{([^}]*)\\}`);
    const styles = [...document.querySelectorAll('style')]
        .map((style) => style.textContent ?? '')
        .join('\n');
    const match = pattern.exec(styles);

    if (!match) throw new Error(`в стилях нет правила ${selector}`);

    return match[1];
}

async function click(fixture: ComponentFixture<unknown>, element: HTMLElement): Promise<void> {
    element.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

/** Кнопка переключателя Кубика: группа рендерит обычные `button`, подпись — единственный ориентир. */
function toggle(root: HTMLElement, target: string, label: string): HTMLButtonElement {
    const buttons = [...root.querySelectorAll<HTMLButtonElement>(`[data-target="${target}"] button`)];
    const button = buttons.find((item) => item.textContent?.trim() === label);

    if (!button) throw new Error(`в переключателе ${target} нет кнопки «${label}»`);

    return button;
}

function texts(root: HTMLElement, selector: string): string[] {
    return [...root.querySelectorAll<HTMLElement>(selector)].map((item) => item.textContent?.trim() ?? '');
}

describe('shadow scenes', () => {
    const nativeGetComputedStyle = window.getComputedStyle;

    beforeEach(() => {
        // jsdom throws on some Koobiq CSS selectors during CDK and AG Grid setup.
        window.getComputedStyle = (element, pseudoElement) => {
            try {
                return nativeGetComputedStyle.call(window, element, pseudoElement);
            } catch {
                return (element as HTMLElement).style;
            }
        };
        localStorage.clear();
    });

    afterEach(() => {
        for (const fixture of mounted.splice(0)) {
            if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
        }

        window.getComputedStyle = nativeGetComputedStyle;
        document.body.removeAttribute('style');
        history.replaceState(null, '', '/');
    });

    it('puts the outline tile first and the three elevation tokens after it', async () => {
        const { root } = await render(LevelsScene);
        const tiles = [...root.querySelectorAll<HTMLElement>('.levels__tile')];

        expect(tiles.length).toBe(4);
        expect(tiles.map((tile) => tile.dataset['target'])).toEqual([
            'tile-outline',
            'tile-card',
            'tile-popup',
            'tile-overlay'
        ]);
        // Первым идёт точка отсчёта: обводка `line-contrast-less`, а не уровень теней.
        expect(tiles.map((tile) => tile.style.getPropertyValue('box-shadow'))).toEqual([
            '0 0 0 1px var(--kbq-line-contrast-less)',
            'var(--kbq-shadow-card)',
            'var(--kbq-shadow-popup)',
            'var(--kbq-shadow-overlay)'
        ]);
    });

    it('switches the levels backdrop class and writes it to the address', async () => {
        const { fixture, root } = await render(LevelsScene);
        const levels = root.querySelector<HTMLElement>('.levels')!;

        expect(levels.classList.contains('levels_bg')).toBe(true);
        expect(levels.classList.contains('levels_bg-secondary')).toBe(false);

        await click(fixture, toggle(root, 'backdrop', 'bg-secondary'));

        expect(levels.classList.contains('levels_bg-secondary')).toBe(true);
        expect(levels.classList.contains('levels_bg')).toBe(false);
        expect(window.location.search).toContain('backdrop=bg-secondary');
    });

    it('renders four cards, one of them outlined, and four tiles', async () => {
        const { root } = await render(CardsScene);
        const cards = [...root.querySelectorAll<HTMLElement>('article.card')];

        expect(cards.length).toBe(4);
        expect(cards.filter((card) => card.classList.contains('card_outline')).length).toBe(1);
        expect(root.querySelectorAll('.tile').length).toBe(4);

        // Тень карточек — уровень card, у последней вместо неё обводка.
        expect(declared('.card')).toMatch(/box-shadow:\s*var\(--kbq-shadow-card\)/);
        expect(declared('.card_outline')).toMatch(/box-shadow:\s*0 0 0 1px var\(--kbq-line-contrast-less\)/);
    });

    it('copies the open select panel with its four periods', async () => {
        const { root } = await render(CardsScene);
        const panel = root.querySelector<HTMLElement>('[data-target="cards-select"]')!;

        expect(panel.classList.contains('kbq-select__panel')).toBe(true);
        expect(texts(panel, 'kbq-option')).toEqual(['За сутки', 'За 7 дней', 'За 30 дней', 'За квартал']);
    });

    it('shows the hidden copy of the select panel with five options', async () => {
        const { root } = await render(SelectScene);
        const panel = root.querySelector<HTMLElement>('[data-target="static-panel"]')!;

        expect(panel.getAttribute('aria-hidden')).toBe('true');
        expect(texts(panel, 'kbq-option')).toEqual([
            'Все события',
            'Инциденты',
            'Уязвимости',
            'Активы',
            'Отчёты'
        ]);
    });

    it('renders the rule grid and shows the clicked row in the panel title', async () => {
        const { fixture, root } = await render(WorkspaceScene);
        const grid = fixture.debugElement.query(By.directive(AgGridAngular)).componentInstance as AgGridAngular<
            Record<string, string>
        >;

        // Строки и колонки отданы гриду: в jsdom он их не рисует, поэтому читаем его входы.
        expect(grid.rowData?.length).toBe(40);
        expect((grid.columnDefs as ColDef[]).map((column) => column.field ?? column.colId)).toEqual([
            'name',
            'scope',
            'rule',
            'category',
            'status',
            'source',
            'owner',
            'schedule',
            'updatedAt',
            'description',
            'nextStep',
            'channel'
        ]);
        expect(root.querySelector('.panel-title')?.textContent?.trim()).toBe('Title');

        // Скроллбары таблицы красит директива Кубика: классы видны на хосте грида.
        const gridHost = root.querySelector<HTMLElement>('ag-grid-angular')!;

        expect(gridHost.classList).toContain('kbq-native-scrollbar');
        expect(gridHost.classList).toContain('kbq-native-scrollbar_descendants');

        const row = grid.rowData![7];

        grid.cellClicked.emit({
            api: grid.api,
            colDef: grid.columnDefs![0],
            data: row
        } as CellClickedEvent<Record<string, string>>);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(root.querySelector('.panel-title')?.textContent?.trim()).toBe(row['name']);
    });

    it('locks the selection and Name columns together at the left edge', async () => {
        const { fixture } = await render(WorkspaceScene);
        const grid = fixture.debugElement.query(By.directive(AgGridAngular)).componentInstance as AgGridAngular;
        const pinned = grid.api.getDisplayedLeftColumns();

        expect(pinned.map((column) => column.getColId())).toEqual([SELECTION_COLUMN_ID, 'name']);

        for (const column of pinned) {
            expect(column.getColDef()).toMatchObject({
                lockPinned: true,
                lockPosition: 'left',
                suppressMovable: true
            });
        }
    });

    it('keeps the popup and overlay surfaces visible for shadow comparison', async () => {
        const { fixture, root } = await render(WorkspaceScene);

        expect(root.querySelector('[data-target="filter-menu"]')).toBeTruthy();
        expect(root.querySelector('[data-target="rule-popover"]')).toBeTruthy();
        expect(root.querySelector('[data-target="panel-menu"]')).toBeTruthy();
        expect(root.querySelector('.selection-bar__count')?.textContent?.trim()).toBe('Selected: 2');
        expect(declared('.preview-menu')).toMatch(/box-shadow:\s*var\(--kbq-shadow-popup\)/);
        expect(declared('.rule-popover')).toMatch(/box-shadow:\s*var\(--kbq-shadow-popup\)/);
        expect(declared('.selection-bar')).toMatch(/box-shadow:\s*var\(--kbq-shadow-overlay\)/);

        await click(fixture, root.querySelector<HTMLElement>('[aria-label="Меню фильтра"]')!);
        expect(root.querySelector('[data-target="filter-menu"]')).toBeNull();
    });

    it('wears the overlay level in the after view and keeps the chosen one', async () => {
        const { fixture, root } = await render(WorkspaceScene);
        const panel = root.querySelector<HTMLElement>('.workspace__panel')!;

        // «Стало» примеряет на панель Overlay по умолчанию: в ссылке это сток, параметра нет.
        expect(panel.style.getPropertyValue('box-shadow')).toBe('var(--kbq-shadow-overlay)');
        expect(panel.classList.contains('workspace__panel_elevated')).toBe(true);
        expect(window.location.search).not.toContain('panel=');

        await click(fixture, toggle(root, 'panel-elevation', 'Popup'));

        expect(panel.style.getPropertyValue('box-shadow')).toBe('var(--kbq-shadow-popup)');
        expect(panel.classList.contains('workspace__panel_elevated')).toBe(true);
        expect(window.location.search).toContain('panel=popup');
    });

    it('locks the preview switches in the before view and restores them after', async () => {
        const { fixture, root } = await render(WorkspaceScene, 'view=before');
        const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-target="panel-elevation"] button')];

        expect(buttons.length).toBe(4);
        expect(buttons.every((button) => button.disabled)).toBe(true);
        // Заблокированный переключатель показывает выбранный уровень, а не сбрасывается.
        expect(root.querySelector('[data-target="panel-elevation"] .kbq-selected')?.textContent?.trim()).toBe('Overlay');

        await click(fixture, toggle(root, 'panel-elevation', 'Popup'));

        // «Было» ничего не пишет: выбор не меняется и в адрес не уходит.
        expect(window.location.search).toContain('view=before');
        expect(window.location.search).not.toContain('panel=popup');
    });

    it('keeps the panel border in the before view', async () => {
        const { root } = await render(WorkspaceScene, 'view=before');
        const panel = root.querySelector<HTMLElement>('.workspace__panel')!;

        // В «Было» панель стоковая: без тени и с обводкой, выбранный уровень на неё не переносится.
        expect(panel.classList.contains('workspace__panel_elevated')).toBe(false);
        expect(panel.style.getPropertyValue('box-shadow')).toBe('');
    });

    it('copies the dialog on the overlay shadow and drops the mask class', async () => {
        const { fixture, root } = await render(ModalScene);
        const backdrop = root.querySelector<HTMLElement>('.backdrop')!;

        expect(declared('.dialog')).toMatch(/box-shadow:\s*var\(--kbq-shadow-overlay\)/);
        expect(backdrop.classList.contains('backdrop_masked')).toBe(true);

        await click(fixture, toggle(root, 'mask', 'Без'));

        expect(backdrop.classList.contains('backdrop_masked')).toBe(false);
        expect(window.location.search).toContain('mask=false');
    });

    it('opens the real modal with the mask the switch shows', async () => {
        const { fixture, root } = await render(ModalScene);
        const create = vi.spyOn(TestBed.inject(KbqModalService), 'create').mockReturnValue({} as KbqModalRef);

        await click(fixture, root.querySelector<HTMLElement>('[data-target="open-modal"]')!);
        await click(fixture, toggle(root, 'mask', 'Без'));
        await click(fixture, root.querySelector<HTMLElement>('[data-target="open-modal"]')!);

        expect(create).toHaveBeenCalledTimes(2);
        expect(create.mock.calls.map(([options]) => options?.kbqMask)).toEqual([true, false]);
    });
});
