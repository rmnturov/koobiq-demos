import { MODELS, modelById, typingState } from '../models/field-models';
import { SCENARIOS } from '../scenarios/scenarios';
import { Act, Script } from '../../../stage/act';
import { SceneState, TYPE_CAPTIONS, initialState } from './scene-state';
import { TYPE_INTERVAL, pasteScript, scriptFor, typeScript } from './scripts';

function fakeAct(initial: SceneState): { act: Act<SceneState>; state: () => SceneState; states: SceneState[]; calls: string[] } {
    let state = initial;
    const states: SceneState[] = [initial];
    const calls: string[] = [];
    const controller = new AbortController();
    const write = (patch: Partial<SceneState> | ((s: SceneState) => Partial<SceneState>)) => {
        state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
        states.push(state);
    };
    const act: Act<SceneState> = {
        signal: controller.signal,
        put: write,
        set: async (patch) => write(patch),
        wait: async (ms) => void calls.push(`wait:${ms}`),
        type: async (key, text) => {
            calls.push(`type:${text}`);
            for (let i = 1; i <= text.length; i++) write({ [key]: text.slice(0, i) } as Partial<SceneState>);
        },
        move: async (to) => void calls.push(`move:${typeof to === 'string' ? to : to.at}`),
        click: async (to) => void calls.push(`click:${to === undefined ? '' : typeof to === 'string' ? to : to.at}`),
        // Драг отдаёт прогресс шагами: подсветка растёт так же, как в сцене.
        drag: async (from, to, step) => {
            calls.push(`drag:${from}->${to}`);
            for (const t of [0.25, 0.5, 0.75, 1]) step(t);
        },
        key: async (combo) => void calls.push(combo === null ? 'key:none' : `key:${combo}`),
        place: (to) => void calls.push(`place:${typeof to === 'string' ? to : to.at}`),
        enter: async (to) => void calls.push(`enter:${typeof to === 'string' ? to : to.at}`),
        snap: async (patch) => write(patch),
        rect: () => ({ x: 0, y: 0, width: 0, height: 0 })
    };
    return { act, state: () => state, states, calls };
}

const run = async (script: Script<SceneState>) => {
    const fake = fakeAct(initialState());
    await script(fake.act);
    return fake;
};

describe('paste script', () => {
    it.each(SCENARIOS.filter((scenario) => scenario.mode !== 'type').flatMap((scenario) => MODELS.map((model) => [scenario, model] as const)))(
        '«%s» × %s ends on the model result after blur',
        async (scenario, model) => {
            const fake = await run(pasteScript(scenario, model));
            expect(fake.state().field).toEqual(model.onBlur(model.onPaste(scenario.clipboard, { value: '', error: null, hint: null })));
            expect(fake.state().focused).toBe(false);
            expect(fake.state().selection).toBeNull();
        }
    );

    // Из поля уходят кликом мимо него, а не `Tab`: клик виден волной и просадкой курсора.
    it('selects, copies, focuses, pastes and leaves the field by a click', async () => {
        const scenario = SCENARIOS.find((item) => item.id === 'range')!;
        const fake = await run(pasteScript(scenario, modelById('as-is')));
        expect(fake.calls.filter((call) => /^(key|click):/.test(call))).toEqual([
            'key:cmd+c',
            'click:field',
            'key:cmd+v',
            'key:none',
            'click:field'
        ]);
    });

    it('blurs the field by clicking past it, not by Tab', async () => {
        const scenario = SCENARIOS.find((item) => item.id === 'range')!;
        const fake = await run(pasteScript(scenario, modelById('as-is')));

        expect(fake.calls.some((call) => call === 'key:tab')).toBe(false);
        expect(fake.states.at(-1)?.focused).toBe(false);
    });

    // Первое движение — не `move` внутри кадра, а вход из-за его края.
    it('enters from the frame edge before anything else', async () => {
        const scenario = SCENARIOS.find((item) => item.id === 'range')!;
        const fake = await run(pasteScript(scenario, modelById('as-is')));
        const first = fake.calls.find((call) => /^(enter|move|click|place):/.test(call));

        expect(first).toBe('enter:text-start');
    });

    // Выделение — драг слева направо: подсветка растёт шагами, а не появляется целиком.
    it('drags the selection across the whole line', async () => {
        const scenario = SCENARIOS.find((item) => item.id === 'sentence')!;
        const fake = await run(pasteScript(scenario, modelById('as-is')));
        const [from, to] = scenario.selectRange;
        const grown = fake.states
            .map((state) => state.selection)
            .filter((selection): selection is readonly [number, number] => selection !== null);

        expect(fake.calls).toContain('drag:text-start->text-end');
        expect(grown.length).toBeGreaterThan(2);
        expect(grown[0][1]).toBeGreaterThanOrEqual(from);
        expect(grown[0][1]).toBeLessThan(to);
        expect(grown.every((selection) => selection[0] === from)).toBe(true);
        expect(grown.at(-1)).toEqual([from, to]);
        // Растёт именно конец выделения: строка идёт слева направо.
        expect(grown.map((selection) => selection[1])).toEqual([...grown.map((selection) => selection[1])].sort((a, b) => a - b));
    });

    it('shows the verdict caption at the end', async () => {
        const scenario = SCENARIOS.find((item) => item.id === 'digits')!;
        const fake = await run(pasteScript(scenario, modelById('smart')));
        expect(fake.state().caption).toBe('Итог');
        expect(fake.state().field.recognized).toBe('14:30');
    });
});

describe('typing script', () => {
    // Вход из-за края, а не клик по точке внутри кадра: курсор появляется в сцене.
    // Рука уходит на клавиши, как в Stageshow table-edit: мышь съезжает вниз-влево
    // от цифр, но из кадра не выходит — курсор виден на всём проходе.
    it('enters the field, presses it and steps the mouse off the digits', async () => {
        const scenario = SCENARIOS.find((item) => item.id === 'type-auto')!;
        const fake = await run(typeScript(scenario));

        expect(fake.calls.slice(0, 3)).toEqual(['enter:field', 'click:', 'move:field']);
    });

    it('types the scenario string and validates it on blur for the mask', async () => {
        const scenario = SCENARIOS.find((item) => item.id === 'type-auto')!;
        const fake = await run(typeScript(scenario));
        expect(fake.state().field).toEqual(modelById('mask').onBlur(typingState(scenario.clipboard)));
        expect(fake.calls.filter((call) => call === `wait:${TYPE_INTERVAL}`).length).toBeGreaterThanOrEqual(scenario.clipboard.length);
    });

    // Подпись шага видна во время печати, а не после неё.
    it('captions the typing step from the first keystroke', async () => {
        const scenario = SCENARIOS.find((item) => item.id === 'type-auto')!;
        const fake = await run(typeScript(scenario));
        const firstTyped = fake.states.findIndex((state) => state.field.value.length > 0);

        expect(firstTyped).toBeGreaterThan(0);
        expect(fake.states[firstTyped].caption).toBe(TYPE_CAPTIONS.type);
        expect(fake.state().caption).toBe(TYPE_CAPTIONS.rest);
    });

    it('shows the autocorrect toast while typing when the mask rewrites the text', async () => {
        const scenario = SCENARIOS.find((item) => item.id === 'type-auto')!;
        const fake = await run(typeScript(scenario));
        expect(fake.states.some((state) => state.toast?.includes('Автозамена'))).toBe(true);
    });
});

describe('scriptFor', () => {
    it('runs the typing script for a typing scenario, whatever the model', async () => {
        const typing = SCENARIOS.find((scenario) => scenario.mode === 'type')!;
        const fake = await run(scriptFor(typing, modelById('as-is')));
        expect(fake.state().field).toEqual(modelById('mask').onBlur(typingState(typing.clipboard)));
        expect(fake.calls).not.toContain('key:cmd+c');
    });

    it('runs the chosen model for a paste scenario', async () => {
        const paste = SCENARIOS.find((scenario) => scenario.id === 'range')!;
        const fake = await run(scriptFor(paste, modelById('smart')));
        expect(fake.state().field.recognized).toBe('14:16');
    });
});
