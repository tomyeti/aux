import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import PlayerGameView from '../../PlayerGameView/PlayerGameView';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { Intersection, Vector2 } from 'three';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import {
    BotCalculationContext,
    getBotPosition,
    objectsAtContextGridPosition,
    getBotIndex,
    duplicateBot,
    Bot,
    getBotDragMode,
    tagsOnBot,
} from '@casual-simulation/aux-common';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { PlayerFileDragOperation } from '../DragOperation/PlayerFileDragOperation';
import { dropWhile } from 'lodash';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerNewFileDragOperation } from '../DragOperation/PlayerNewFileDragOperation';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { PlayerGame } from '../../scene/PlayerGame';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';

export class PlayerFileClickOperation extends BaseFileClickOperation {
    // This overrides the base class.
    protected _interaction: PlayerInteractionManager;

    protected faceClicked: { face: string; context: string };

    constructor(
        simulation3D: Simulation3D,
        interaction: PlayerInteractionManager,
        bot: AuxFile3D,
        faceValue: string,
        vrController: VRController3D | null
    ) {
        super(simulation3D, interaction, bot.bot, bot, vrController);

        this.faceClicked = { face: faceValue, context: null };
    }

    protected _performClick(calc: BotCalculationContext): void {
        const file3D: AuxFile3D = <AuxFile3D>this._file3D;

        this.faceClicked.context = file3D.context;

        this.simulation.helper.action(
            'onClick',
            [this._file],
            this.faceClicked
        );

        this.simulation.helper.action('onAnyBotClicked', null, {
            face: this.faceClicked.face,
            bot: this._file,
            context: file3D.context,
        });
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseFileDragOperation {
        const mode = getBotDragMode(calc, this._file);
        if (mode === 'clone') {
            return this._createCloneDragOperation(calc);
        } else if (mode === 'mod') {
            return this._createDiffDragOperation(calc);
        }

        const file3D: AuxFile3D = <AuxFile3D>this._file3D;
        const context = file3D.context;
        const position = getBotPosition(calc, file3D.bot, context);
        if (position) {
            const objects = objectsAtContextGridPosition(
                calc,
                context,
                position
            );
            if (objects.length === 0) {
                console.log('Found no objects at', position);
                console.log(file3D.bot);
                console.log(context);
            }
            const bot = this._file;
            const draggedObjects = dropWhile(objects, o => o.id !== bot.id);
            const {
                playerSimulation3D,
                inventorySimulation3D,
            } = this._getSimulationsForDragOp();

            return new PlayerFileDragOperation(
                playerSimulation3D,
                inventorySimulation3D,
                this._interaction,
                draggedObjects,
                file3D.context,
                this._vrController,
                fromCoord
            );
        }

        return null;
    }

    protected _createCloneDragOperation(
        calc: BotCalculationContext
    ): BaseFileDragOperation {
        let duplicatedFile = duplicateBot(calc, <Bot>this._file);
        const {
            playerSimulation3D,
            inventorySimulation3D,
        } = this._getSimulationsForDragOp();
        return new PlayerNewFileDragOperation(
            playerSimulation3D,
            inventorySimulation3D,
            this._interaction,
            duplicatedFile,
            (<AuxFile3D>this._file3D).context,
            this._vrController
        );
    }

    protected _createDiffDragOperation(
        calc: BotCalculationContext
    ): BaseFileDragOperation {
        const tags = tagsOnBot(this._file);
        let duplicatedFile = duplicateBot(calc, <Bot>this._file, {
            tags: {
                'aux.mod': true,
                'aux.mod.mergeTags': tags,
            },
        });
        const {
            playerSimulation3D,
            inventorySimulation3D,
        } = this._getSimulationsForDragOp();
        return new PlayerNewFileDragOperation(
            playerSimulation3D,
            inventorySimulation3D,
            this._interaction,
            duplicatedFile,
            (<AuxFile3D>this._file3D).context,
            this._vrController
        );
    }

    private _getSimulationsForDragOp() {
        let playerSimulation3D: PlayerSimulation3D;
        let inventorySimulation3D: InventorySimulation3D;

        if (this._simulation3D instanceof PlayerSimulation3D) {
            playerSimulation3D = this._simulation3D;
            inventorySimulation3D = (<PlayerGame>(
                this.game
            )).findInventorySimulation3D(this._simulation3D.simulation);
        } else if (this._simulation3D instanceof InventorySimulation3D) {
            playerSimulation3D = (<PlayerGame>this.game).findPlayerSimulation3D(
                this._simulation3D.simulation
            );
            inventorySimulation3D = this._simulation3D;
        } else {
            console.error(
                '[PlayerFileClickOperation] Unsupported Simulation3D type for drag operation.'
            );
        }

        return { playerSimulation3D, inventorySimulation3D };
    }
}
