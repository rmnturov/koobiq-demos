import { modelById, typingState } from '../models/field-models';
import { Scenario } from '../scenarios/scenarios';
import { Script } from '../../../stage/act';
import { BLUR_CLICK, MOUSE_ASIDE } from './paste.scene';
import { SceneState, TYPE_CAPTIONS } from './scene-state';

/** Интервал между символами: читаемая скорость печати. */
export const TYPE_INTERVAL = 110;

/** Пауза после набора, проверка по blur и конец сцены: те же шаги, что и во вставке. */
const TYPE_SETTLE = 900;
const TYPE_BLUR = 600;
const TYPE_OUTCOME = 1400;
const TYPE_REST = 1000;

/**
 * Ввод: клик в поле и печать по символу. Маска переписывает набранное на ходу,
 * поэтому предупреждение появляется в момент, когда двоеточие встало само.
 *
 * Проверяет значение та же модель `mask`, что и в проде: сцена ничего не решает.
 */
export const typeScript =
    (scenario: Scenario): Script<SceneState> =>
    async (act) => {
        const model = modelById('mask');
        const typed = scenario.clipboard;
        const rewritten = typingState(typed).value;

        // Первое движение — вход: курсор идёт к полю из точки покоя внутри кадра.
        await act.enter('field');
        // Клик по текущей точке: вход уже поставил курсор в поле, нажатие нужно для вида.
        await act.click();
        act.put({ focused: true });
        act.put({ caption: TYPE_CAPTIONS.focus });

        // Рука переходит на клавиши: мышь встаёт чуть правее поля, в кадре —
        // курсор виден, а каретка читается одна.
        await act.move(MOUSE_ASIDE);

        // «Печатаем» — это шаг, а не его итог: подпись меняется до первого символа.
        act.put({ caption: TYPE_CAPTIONS.type });

        for (let i = 1; i <= typed.length; i++) {
            const field = typingState(typed.slice(0, i));

            act.put({ field });

            if (scenario.autocorrect && field.value.includes(':')) {
                act.put({ toast: `Автозамена: «${typed}» → ${rewritten}` });
            }

            await act.wait(TYPE_INTERVAL);
        }

        await act.wait(TYPE_SETTLE);

        act.put({ caption: TYPE_CAPTIONS.blur });
        await act.key(null);
        await act.click(BLUR_CLICK);
        act.put((state) => ({ focused: false, field: model.onBlur(state.field), toast: null }));
        await act.wait(TYPE_BLUR);

        act.put({ caption: TYPE_CAPTIONS.outcome });
        await act.wait(TYPE_OUTCOME);

        act.put({ caption: TYPE_CAPTIONS.rest });
        await act.wait(TYPE_REST);
    };
