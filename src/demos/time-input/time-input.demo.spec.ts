import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { findDemo } from '../demos.registry';
import { SCENARIOS } from './scenarios/scenarios';
import { SceneState } from './scenes/scene-state';
import { StageComponent } from './stage/stage.component';
import { TimeInputDemo, readSelection, resolveSelection, writeSelection } from './time-input.demo';

/** Созданные фикстуры: уничтожаем их сами, чтобы `ngOnDestroy` исполнялся в каждом тесте. */
const fixtures = new Set<ComponentFixture<unknown>>();

function destroyAll(): void {
    for (const fixture of fixtures) {
        fixture.destroy();
    }

    fixtures.clear();
}

/**
 * Демо в состоянии reduced-motion: сцена показывает финальный кадр и не запускает
 * ни одного таймера, поэтому тест занимается только обвязкой, а не плеером.
 */
async function render(search: string): Promise<{ fixture: ComponentFixture<TimeInputDemo>; stage: StageComponent }> {
    vi.stubGlobal(
        'matchMedia',
        (query: string) =>
            ({
                matches: query.includes('prefers-reduced-motion'),
                addEventListener: () => {},
                removeEventListener: () => {},
                // Старый API: его дергает CDK MediaMatcher через FocusMonitor кнопки.
                addListener: () => {},
                removeListener: () => {}
            }) as unknown as MediaQueryList
    );
    history.replaceState(null, '', `/${search}`);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [TimeInputDemo] }).compileComponents();
    const fixture = TestBed.createComponent(TimeInputDemo);

    fixtures.add(fixture);
    fixture.detectChanges();
    await fixture.whenStable();

    const stage = fixture.debugElement.query(By.directive(StageComponent)).componentInstance as StageComponent;

    return { fixture, stage };
}

/*
 * Клик по элементу демо. Список применяет выбор в микротаске после проверки
 * содержимого, поэтому ждём стабилизации.
 */
async function click(fixture: ComponentFixture<TimeInputDemo>, selector: string): Promise<void> {
    const target = fixture.nativeElement.querySelector(selector) as HTMLElement | null;

    if (!target) {
        throw new Error(`no element for ${selector}`);
    }

    target.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

/**
 * Строка сценария: `data-scenario` стоит на самой опции списка, а состояние
 * выбора — `aria-selected`, как его рисует `KbqListSelection`.
 */
function scenarioOption(fixture: ComponentFixture<TimeInputDemo>, id: string): HTMLElement {
    const option = fixture.nativeElement.querySelector(`[data-scenario="${id}"]`) as HTMLElement | null;

    if (!option) {
        throw new Error(`no option for ${id}`);
    }

    return option;
}

describe('url selection', () => {
    it('reads known ids from the query', () => {
        expect(readSelection('?scenario=range&model=smart')).toEqual({ scenarioId: 'range', modelId: 'smart' });
    });

    it('ignores unknown ids and falls back to the first scenario and as-is', () => {
        expect(readSelection('?scenario=nope&model=bogus')).toEqual({ scenarioId: SCENARIOS[0].id, modelId: 'as-is' });
    });

    it('reads an empty query as the defaults', () => {
        expect(readSelection('')).toEqual({ scenarioId: SCENARIOS[0].id, modelId: 'as-is' });
    });

    it('forces the mask on typing scenarios and reports it', () => {
        expect(resolveSelection('type-junk', 'smart')).toEqual({ scenario: SCENARIOS.find((s) => s.id === 'type-junk'), model: 'mask', forced: true });
        expect(resolveSelection('range', 'smart')).toEqual({ scenario: SCENARIOS.find((s) => s.id === 'range'), model: 'smart', forced: false });
    });

    it('does not force what is already the mask', () => {
        const resolved = resolveSelection('type-junk', 'mask');

        expect(resolved.model).toBe('mask');
        expect(resolved.forced).toBe(false);
    });

    it('writes the selection with replaceState', () => {
        const replaceState = vi.fn();
        writeSelection('digits', 'mask', { replaceState } as unknown as History);
        expect(replaceState).toHaveBeenCalledWith(null, '', '?scenario=digits&model=mask');
    });

    it('renders twelve scenario rows even when the query is invalid', async () => {
        vi.stubGlobal(
            'matchMedia',
            () =>
                ({
                    matches: true,
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    addListener: () => {},
                    removeListener: () => {}
                }) as unknown as MediaQueryList
        );
        history.replaceState(null, '', '?scenario=nope&model=bogus');
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({ imports: [TimeInputDemo] }).compileComponents();
        const fixture = TestBed.createComponent(TimeInputDemo);
        fixture.detectChanges();
        await fixture.whenStable();
        expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(12);
        vi.unstubAllGlobals();
    });
});

describe('demo wiring', () => {
    afterEach(() => {
        destroyAll();
        TestBed.resetTestingModule();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        history.replaceState(null, '', '/');
    });

    it('leaves the page heading to the shell and keeps only the lead line', async () => {
        const { fixture } = await render('?scenario=range&model=as-is');
        const host = fixture.nativeElement as HTMLElement;
        const stage = host.querySelector('time-input-stage');
        const headings = Array.from(host.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')) as HTMLElement[];

        // Заголовок страницы рисует DemoShellComponent из поля `title` реестра:
        // в собственной обвязке демо заголовков быть не должно (у сцены свой, внутри stage).
        expect(headings.filter((element) => !stage?.contains(element)).length).toBe(0);
        expect(headings.some((element) => element.textContent?.trim() === findDemo('time-input')?.title)).toBe(false);

        const lead = host.querySelector('.demo__lead') as HTMLElement | null;
        const text = lead?.textContent?.trim() ?? '';

        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toBe(findDemo('time-input')?.title);
    });

    it('rewrites the url when a typing scenario forces the mask', async () => {
        const { fixture } = await render('?scenario=type-junk&model=smart');

        expect(location.search).toBe('?scenario=type-junk&model=mask');

        const models = fixture.nativeElement.querySelectorAll('[data-model]');

        expect(models.length).toBe(1);
        expect(models[0].getAttribute('data-model')).toBe('mask');
        expect(models[0].classList.contains('kbq-selected')).toBe(true);
    });

    it('writes the selection into the url without pushing history', async () => {
        const pushState = vi.spyOn(history, 'pushState');
        const replaceState = vi.spyOn(history, 'replaceState');
        const { fixture } = await render('?scenario=range&model=smart');

        await click(fixture, '[data-scenario="digits"]');

        expect(replaceState).toHaveBeenLastCalledWith(null, '', '?scenario=digits&model=smart');
        expect(pushState).not.toHaveBeenCalled();
        expect(scenarioOption(fixture, 'digits').getAttribute('aria-selected')).toBe('true');
    });

    it('remembers the paste model and returns it after a typing scenario', async () => {
        const { fixture } = await render('?scenario=range&model=as-is');

        await click(fixture, '[data-model="smart"] button');
        expect(location.search).toBe('?scenario=range&model=smart');

        await click(fixture, '[data-scenario="type-junk"]');
        expect(location.search).toBe('?scenario=type-junk&model=mask');

        await click(fixture, '[data-scenario="clean"]');
        expect(location.search).toBe('?scenario=clean&model=smart');
    });

    it('restarts the stage on every switch and on the repeat button', async () => {
        const { fixture, stage } = await render('?scenario=range&model=smart');
        const replay = vi.spyOn(stage, 'replay');

        await click(fixture, '[data-scenario="digits"]');
        expect(replay).toHaveBeenCalledTimes(1);

        await click(fixture, '[data-model="as-is"] button');
        expect(replay).toHaveBeenCalledTimes(2);

        await click(fixture, '[data-action="replay"]');
        expect(replay).toHaveBeenCalledTimes(3);
    });

    it('pauses and resumes the stage from the caption row', async () => {
        const { fixture, stage } = await render('?scenario=range&model=smart');
        const pause = vi.spyOn(stage, 'pause');
        const resume = vi.spyOn(stage, 'resume');
        const scene = (): HTMLElement => fixture.nativeElement.querySelector('time-input-scene') as HTMLElement;

        await click(fixture, '[data-action="pause"]');
        expect(pause).toHaveBeenCalledTimes(1);
        expect(fixture.nativeElement.querySelector('[data-action="pause"]').textContent.trim()).toBe('Продолжить');
        // Пауза доходит до сцены: она снимает мигание каретки, а не только часы.
        expect(scene().classList.contains('scene_paused')).toBe(true);

        await click(fixture, '[data-action="pause"]');
        expect(resume).toHaveBeenCalledTimes(1);
        expect(fixture.nativeElement.querySelector('[data-action="pause"]').textContent.trim()).toBe('Пауза');
        expect(scene().classList.contains('scene_paused')).toBe(false);
    });

    it('starts on the resolved scenario and model from the url', async () => {
        const { fixture } = await render('?scenario=range&model=smart');

        // Список применяет значение формы в микротаске после первой проверки.
        await fixture.whenStable();
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(12);
        expect(scenarioOption(fixture, 'range').getAttribute('aria-selected')).toBe('true');
        expect(fixture.nativeElement.querySelector('[data-model="smart"]').classList.contains('kbq-selected')).toBe(true);
        expect(fixture.nativeElement.querySelectorAll('[data-model]').length).toBe(3);
    });

    it('projects the scene into the stage and captions the finished frame', async () => {
        const { fixture } = await render('?scenario=clean&model=as-is');

        expect(fixture.nativeElement.querySelector('time-input-stage [data-target="field"] input')).not.toBeNull();

        // Reduced motion: сцена стоит на финальном кадре, и подпись уже есть.
        const caption = fixture.nativeElement.querySelector('.demo__caption').textContent.trim();

        expect(caption).toContain('Итог');
        expect(caption).toContain('14:30');
    });

    it('keeps the step caption a plain paragraph, not a live region', async () => {
        const { fixture } = await render('?scenario=clean&model=as-is');
        const caption = fixture.nativeElement.querySelector('.demo__caption') as HTMLElement;

        // Подпись сменяется сама каждые 400–900 мс: live-регион объявлял бы её вечно,
        // без действия пользователя. Скринридеру хватает обычного текста.
        expect(caption.hasAttribute('aria-live')).toBe(false);
        expect(caption.hasAttribute('aria-atomic')).toBe(false);
        expect(caption.getAttribute('role')).toBeNull();
    });

    it('adds the verdict only where the field result exists', async () => {
        const { fixture, stage } = await render('?scenario=range&model=smart');
        const caption = (): string => fixture.nativeElement.querySelector('.demo__caption').textContent.trim();

        // Вступление: поле ещё не трогали — вердикт не приписывается, и «поле пустое»
        // не объявляет результат раньше действия.
        stage.state.set({
            field: { value: '', error: null, hint: null },
            focused: false,
            selection: null,
            toast: null,
            caption: 'В буфере строка'
        });
        fixture.detectChanges();

        expect(caption()).toBe('В буфере строка');

        // Разбор: результат модели уже есть, вердикт к подписи приписан.
        stage.state.set({
            field: { value: '14:16', error: null, hint: null },
            focused: false,
            selection: null,
            toast: null,
            caption: 'Что стало с текстом'
        });
        fixture.detectChanges();

        expect(caption()).toBe('Что стало с текстом — «14:16»');
    });

    it('keeps initial and poster stable between renders', async () => {
        const { fixture } = await render('?scenario=range&model=smart');
        // Входы сцены не видны снаружи: проверяем ровно то, что читает её эффект.
        const demo = fixture.componentInstance as unknown as {
            initial: () => SceneState;
            poster: () => SceneState;
        };
        const initial = demo.initial();
        const poster = demo.poster();

        fixture.detectChanges();
        fixture.detectChanges();

        expect(demo.initial()).toBe(initial);
        expect(demo.poster()).toBe(poster);
    });
});
