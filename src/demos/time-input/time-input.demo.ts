/**
 * Обвязка демо: сценарии, переключатель механик, URL и управление плеером.
 *
 * Сцена живёт в `StageComponent`, всё остальное — здесь: вкладки 12 сценариев,
 * три механики обработки и три кнопки управления. Выбор сценария и механики лежит
 * в URL (`?scenario=<id>&model=<id>`), поэтому ссылку на конкретный мультик можно
 * отправить в задачу или чат. URL пишется только через `replaceState`: переключение
 * — это не навигация, история не должна пухнуть.
 *
 * `initial` и `poster` — `computed`, а не вызовы в шаблоне: эффект сцены
 * перезапускает проход, когда меняется идентичность входа, поэтому состояния
 * обязаны быть стабильными ссылками между переключениями.
 */

import { ChangeDetectionStrategy, Component, computed, signal, ViewEncapsulation, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqButtonToggleModule } from '@koobiq/components/button-toggle';
import { KbqListModule } from '@koobiq/components/list';
import { FieldModel, MODELS, ModelId, modelById } from './models/field-models';
import { SCENARIOS, Scenario, isTyping } from './scenarios/scenarios';
import { SceneState, initialState, posterState, showsVerdict, verdict } from './scenes/scene-state';
import { scriptFor } from './scenes/scripts';
import { SceneComponent } from './scenes/scene.component';
import { StageComponent } from './stage/stage.component';
import type { Target } from '../../stage/measure';

/** Выбор, который лежит в URL. */
export interface Selection {
    scenarioId: string;
    modelId: ModelId;
}

/** Механика по умолчанию: строка вставляется как есть. */
const DEFAULT_MODEL: ModelId = 'as-is';

/** Единственная механика сценариев ввода: значение набирают, а не вставляют. */
const TYPING_MODEL: ModelId = 'mask';

/** Текущий query без зависимости от наличия `location` (тесты, SSR). */
const currentSearch = (): string => (typeof location === 'undefined' ? '' : location.search);

/**
 * Разбирает query: неизвестный сценарий даёт первый, неизвестная механика — `as-is`.
 * Разбор терпимый: ссылка со старым id не должна ломать демо.
 */
export function readSelection(search: string): Selection {
    const params = new URLSearchParams(search);
    const scenario = SCENARIOS.find((item) => item.id === params.get('scenario'));
    const model = MODELS.find((item) => item.id === params.get('model'));

    return { scenarioId: scenario?.id ?? SCENARIOS[0].id, modelId: model?.id ?? DEFAULT_MODEL };
}

/**
 * Приводит выбор к тому, что может играть: сценарий — существующий, механика —
 * известная. У сценария ввода механики нет, поэтому `smart`/`as-is` заменяются
 * маской; `forced` говорит, что URL надо переписать.
 */
export function resolveSelection(
    scenarioId: string,
    modelId: ModelId
): { scenario: Scenario; model: ModelId; forced: boolean } {
    const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0];
    const known = MODELS.some((item) => item.id === modelId) ? modelId : DEFAULT_MODEL;
    const typing = isTyping(scenario);

    return { scenario, model: typing ? TYPING_MODEL : known, forced: typing && known !== TYPING_MODEL };
}

/** Переписывает query на месте: новая запись истории не появляется. */
export function writeSelection(scenarioId: string, modelId: ModelId, history: History = window.history): void {
    history.replaceState(null, '', `?scenario=${scenarioId}&model=${modelId}`);
}

@Component({
    selector: 'time-input-demo',
    imports: [FormsModule, KbqButtonModule, KbqButtonToggleModule, KbqListModule, StageComponent, SceneComponent],
    template: `
        <article class="demo">
            <p class="demo__lead kbq-text-normal">Поле времени в настоящей форме: выберите сценарий и механику — сцена покажет, что станет с текстом.</p>

            <nav class="demo__scenarios" aria-label="Сценарии вставки">
                <kbq-list-selection
                    class="demo__list"
                    [multiple]="false"
                    [ngModel]="scenario().id"
                    (ngModelChange)="selectFromList($event)"
                >
                    @for (item of scenarios; track item.id) {
                        <kbq-list-option [value]="item.id" [attr.data-scenario]="item.id">{{ item.title }}</kbq-list-option>
                    }
                </kbq-list-selection>
            </nav>

            <div class="demo__main">
                <kbq-button-toggle-group
                    aria-label="Механика обработки"
                    [value]="model()"
                    [disabled]="models().length === 1"
                    (change)="selectModel($any($event.value))"
                >
                    @for (item of models(); track item.id) {
                        <kbq-button-toggle [value]="item.id" [attr.data-model]="item.id">{{ item.name }}</kbq-button-toggle>
                    }
                </kbq-button-toggle-group>
                <p class="demo__tagline kbq-text-compact">{{ currentModel().tagline }}</p>

                <time-input-stage
                    #stage
                    [width]="720"
                    [height]="480"
                    [fill]="true"
                    [script]="script()"
                    [poster]="poster()"
                    [initial]="initial()"
                    [cursorAt]="parked"
                >
                    <ng-template let-s let-p="paused">
                        <time-input-scene [state]="s" [scenario]="scenario()" [paused]="p" />
                    </ng-template>
                </time-input-stage>

                <div class="demo__controls">
                    <!-- Подпись меняется сама каждые 400–900 мс: live-регион читал бы её без остановки. -->
                    <p class="demo__caption kbq-text-compact">{{ caption() }}</p>
                    <div class="demo__actions">
                        <button kbq-button type="button" data-action="pause" (click)="togglePause()">
                            {{ paused() ? 'Продолжить' : 'Пауза' }}
                        </button>
                        <button kbq-button type="button" kbqStyle="outline" data-action="replay" (click)="repeat()">Повторить</button>
                    </div>
                </div>
            </div>
        </article>
    `,
    styleUrl: './time-input.demo.scss',
    encapsulation: ViewEncapsulation.Emulated,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeInputDemo {
    /** Ссылка, с которой демо открыли: разбирается один раз, до создания сигналов. */
    private readonly fromUrl = readSelection(currentSearch());
    /** Что из ссылки действительно можно играть. */
    private readonly picked = resolveSelection(this.fromUrl.scenarioId, this.fromUrl.modelId);

    /** Сценарии списком: их порядок и состав заданы данными. */
    protected readonly scenarios = SCENARIOS;

    protected readonly scenario = signal<Scenario>(this.picked.scenario);
    protected readonly model = signal<ModelId>(this.picked.model);

    /**
     * Последняя выбранная механика вставки. У сценария ввода выбора нет, но при
     * возврате к вставке демо возвращает именно её, а не сбрасывает на `as-is`.
     * Открытие ссылки с механикой — тоже выбор, поэтому старт берётся из неё.
     */
    private readonly lastPasteModel = signal<ModelId>(
        isTyping(this.picked.scenario) ? DEFAULT_MODEL : this.picked.model
    );

    /** Механики под текущий сценарий: у ввода — только маска. */
    protected readonly models = computed<readonly FieldModel[]>(() =>
        isTyping(this.scenario()) ? [modelById(TYPING_MODEL)] : MODELS
    );

    /** Механика, которой играет сцена: её `tagline` стоит под переключателем. */
    protected readonly currentModel = computed(() => modelById(this.model()));

    /** Начало прохода: одна и та же ссылка, пока её не сменят. */
    protected readonly initial = computed<SceneState>(() => initialState());

    /** Финальный кадр для reduced-motion: пересчитывается только под новый выбор. */
    protected readonly poster = computed<SceneState>(() => posterState(this.scenario(), this.currentModel()));

    protected readonly script = computed(() => scriptFor(this.scenario(), this.currentModel()));

    /**
     * Где курсор стоит до первого движения и между проходами: справа от текста,
     * который копируют. В сценариях ввода текста рядом стоит заголовок формы.
     * Точка внутри кадра, поэтому `Act.enter` ведёт курсор к цели без прыжка.
     */
    protected readonly parked: Target = 'park';

    private readonly stage = viewChild<StageComponent>('stage');

    protected readonly paused = computed(() => this.stage()?.paused() ?? false);

    /**
     * Подпись шага и, если поле уже проверено, вердикт одной строкой. До первого
     * прохода подписи нет — сцена ещё не сказала, где она.
     */
    protected readonly caption = computed(() => {
        const state = this.stage()?.state();

        if (!state?.caption) {
            return '';
        }

        return showsVerdict(state.caption) ? `${state.caption} — ${verdict(state)}` : state.caption;
    });

    constructor() {
        // Ссылка с неприменимой механикой приводится к маске сразу, чтобы адрес
        // не расходился с тем, что играет.
        if (this.picked.forced) {
            writeSelection(this.picked.scenario.id, this.picked.model);
        }
    }

    /**
     * Список отдаёт и одиночное значение, и массив — в зависимости от режима
     * выбора. Демо берёт идентификатор и находит по нему сценарий.
     */
    protected selectFromList(value: string | string[] | null): void {
        const id = Array.isArray(value) ? value[0] : value;
        const scenario = this.scenarios.find((item) => item.id === id);

        if (scenario) {
            this.selectScenario(scenario);
        }
    }

    protected selectScenario(scenario: Scenario): void {
        this.scenario.set(scenario);
        this.model.set(isTyping(scenario) ? TYPING_MODEL : this.lastPasteModel());
        this.restart();
    }

    protected selectModel(model: ModelId): void {
        // У ввода механика одна: переключать нечего, и запоминать нечего.
        if (isTyping(this.scenario())) {
            return;
        }

        this.lastPasteModel.set(model);
        this.model.set(model);
        this.restart();
    }

    protected togglePause(): void {
        const stage = this.stage();

        if (!stage) {
            return;
        }

        if (stage.paused()) {
            stage.resume();
        } else {
            stage.pause();
        }
    }

    protected repeat(): void {
        this.stage()?.replay();
    }

    /** Новый выбор — новый проход и новый адрес. */
    private restart(): void {
        this.stage()?.replay();
        writeSelection(this.scenario().id, this.model());
    }
}
