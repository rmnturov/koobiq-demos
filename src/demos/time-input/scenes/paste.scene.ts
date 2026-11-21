import { FieldModel } from '../models/field-models';
import { Scenario } from '../scenarios/scenarios';
import { Script } from '../../../stage/act';
import { CAPTIONS, SceneState } from './scene-state';

import type { Target } from '../../../stage/measure';

/**
 * Куда уходит мышь, когда рука переходит на клавиши: чуть правее поля, внутри
 * кадра. Каретка в конце текста остаётся одна, а курсор не уезжает под форму.
 */
export const MOUSE_ASIDE: Target = { at: 'field', x: 1.35, y: 0.5 };

/**
 * Куда кликает рука, чтобы уйти из поля: пустое место чуть ниже него, правее
 * подсказки. Клик виден — курсор проседает, в точке вспыхивает волна, — и фокус
 * уходит так же, как в жизни; `Tab` для этого не нужен.
 */
export const BLUR_CLICK: Target = { at: 'field', x: 1.35, y: 2.2 };

/**
 * Тайминги вставки: сколько висит каждый шаг и сколько сцена стоит в конце.
 * Время здесь только описывает шаг — ждёт `Act`, поэтому плеер и тесты
 * распоряжаются паузами сами.
 */
export const PASTE_TIMES = {
    intro: 400,
    drag: 420,
    select: 320,
    copy: 500,
    focus: 600,
    paste: 500,
    settle: 900,
    blur: 600,
    outcome: 1400,
    rest: 1000
} as const;

/**
 * Вставка из буфера: выделяем строку в сообщении, копируем, ставим фокус,
 * вставляем и уходим из поля.
 *
 * Значение поля не сочиняется сценой: `onPaste` и `onBlur` — те же функции
 * модели, что и в проде, поэтому кадр сцены совпадает с реальным поведением поля.
 */
export const pasteScript =
    (scenario: Scenario, model: FieldModel): Script<SceneState> =>
    async (act) => {
        await act.wait(PASTE_TIMES.intro);
        act.put({ caption: CAPTIONS.intro });

        // Первое движение — вход: курсор идёт к тексту из точки покоя внутри кадра.
        // Дальше текст выделяют рукой: каретка нажимает слева и ведёт вправо, а
        // подсветка растёт по мере драга — как выделение мышью, а не двойным кликом.
        await act.enter('text-start');
        act.put({ caption: CAPTIONS.select });
        await act.drag(
            'text-start',
            'text-end',
            (t) => {
                const [from, to] = scenario.selectRange;
                act.put({ selection: [from, from + Math.round((to - from) * t)] });
            },
            { duration: PASTE_TIMES.drag }
        );
        await act.wait(PASTE_TIMES.select);

        await act.key('cmd+c');
        act.put({ caption: CAPTIONS.copy });
        await act.wait(PASTE_TIMES.copy);

        await act.move('field');
        await act.click('field');
        act.put({ focused: true });
        act.put({ caption: CAPTIONS.focus });

        // Рука уходит с текста: мышь встаёт чуть правее поля, внутри кадра —
        // курсор виден всё время, а каретка в конце значения читается одна.
        await act.move(MOUSE_ASIDE);
        await act.wait(PASTE_TIMES.focus);

        await act.key('cmd+v');
        act.put((state) => ({ field: model.onPaste(scenario.clipboard, state.field) }));
        act.put({ caption: CAPTIONS.paste });
        await act.wait(PASTE_TIMES.paste);

        act.put({ caption: CAPTIONS.settle });
        await act.wait(PASTE_TIMES.settle);

        act.put({ caption: CAPTIONS.blur });
        // Кепки предыдущего шага гаснут: рука больше не на клавишах, а на мыши.
        await act.key(null);
        await act.click(BLUR_CLICK);
        act.put((state) => ({ focused: false, field: model.onBlur(state.field) }));
        await act.wait(PASTE_TIMES.blur);

        act.put({ caption: CAPTIONS.outcome });
        await act.wait(PASTE_TIMES.outcome);

        // Итог: выделение снято, подпись — конец сценария. Курсор остаётся там,
        // куда кликнул: рука на месте, поле уже не в фокусе.
        act.put({ selection: null, caption: CAPTIONS.rest });
        await act.wait(PASTE_TIMES.rest);
    };
