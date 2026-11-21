import { FieldModel } from '../models/field-models';
import { Scenario, isTyping } from '../scenarios/scenarios';
import { Script } from '../../../stage/act';
import { PASTE_TIMES, pasteScript } from './paste.scene';
import { SceneState } from './scene-state';
import { TYPE_INTERVAL, typeScript } from './type.scene';

/** Единая точка входа для плеера: здесь живут оба сценария и их тайминги. */
export { PASTE_TIMES, TYPE_INTERVAL, pasteScript, typeScript };

/**
 * Сценарий под выбранный пример. Режим задаёт сам пример: к вводу модель
 * вставки не применяется, потому что значение печатают, а не вставляют.
 */
export const scriptFor = (scenario: Scenario, model: FieldModel): Script<SceneState> =>
    isTyping(scenario) ? typeScript(scenario) : pasteScript(scenario, model);
