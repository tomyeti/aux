import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import {
    Bot,
    BotCalculationContext,
    getBotDragMode,
    BotDragMode,
    objectsAtContextGridPosition,
    calculateBotDragStackPosition,
    BotTags,
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { Intersection, Vector2, Ray } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Input } from '../../../shared/scene/Input';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { PlayerGame } from '../../scene/PlayerGame';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import differenceBy from 'lodash/differenceBy';
import take from 'lodash/take';
import drop from 'lodash/drop';
import { IOperation } from '../../../shared/interaction/IOperation';
import { PlayerModDragOperation } from './PlayerModDragOperation';

export class PlayerBotDragOperation extends BaseBotDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: PlayerInteractionManager;
    // This overrides the base class Simulation3D
    protected _simulation3D: PlayerSimulation3D;

    protected _inventorySimulation3D: InventorySimulation3D;

    // Determines if the bot is in the inventory currently
    protected _inInventory: boolean;

    // Determines if the bot was in the inventory at the beginning of the drag operation
    protected _originallyInInventory: boolean;

    protected _originalContext: string;

    protected _initialCombine: boolean;

    protected _botsUsed: Bot[];

    /**
     * The list of bots that were in the stack but were not dragged.
     */
    protected _botsInStack: Bot[];

    protected get game(): PlayerGame {
        return <PlayerGame>this._simulation3D.game;
    }

    /**
     * Create a new drag rules.
     */
    constructor(
        playerSimulation3D: PlayerSimulation3D,
        inventorySimulation3D: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        bots: Bot[],
        context: string,
        vrController: VRController3D | null,
        fromCoord?: Vector2,
        skipOnDragEvents: boolean = false
    ) {
        super(
            playerSimulation3D,
            interaction,
            take(bots, 1),
            context,
            vrController,
            fromCoord,
            skipOnDragEvents
        );

        this._botsInStack = drop(bots, 1);
        this._inventorySimulation3D = inventorySimulation3D;
        this._originalContext = context;
        this._originallyInInventory = this._inInventory =
            context && this._inventorySimulation3D.inventoryContext === context;
    }

    protected _createBotDragOperation(bot: Bot): IOperation {
        return new PlayerBotDragOperation(
            this._simulation3D,
            this._inventorySimulation3D,
            this._interaction,
            [bot],
            this._context,
            this._vrController,
            this._fromCoord,
            true
        );
    }

    protected _createModDragOperation(mod: BotTags): IOperation {
        return new PlayerModDragOperation(
            this._simulation3D,
            this._inventorySimulation3D,
            this._interaction,
            mod,
            this._vrController
        );
    }

    protected _onDrag(calc: BotCalculationContext): void {
        const mode = getBotDragMode(calc, this._bots[0]);

        let nextContext = this._simulation3D.context;

        if (!this._vrController) {
            // Test to see if we are hovering over the inventory simulation view.
            const pagePos = this.game.getInput().getMousePagePos();
            const inventoryViewport = this.game.getInventoryViewport();
            if (Input.pagePositionOnViewport(pagePos, inventoryViewport)) {
                nextContext = this._inventorySimulation3D.inventoryContext;
            }
        }

        const changingContexts = this._originalContext !== nextContext;
        let canDrag = false;

        if (!changingContexts && this._canDragWithinContext(mode)) {
            canDrag = true;
        } else if (changingContexts && this._canDragOutOfContext(mode)) {
            canDrag = true;
        }

        if (!canDrag) {
            return;
        }

        if (nextContext !== this._context) {
            this._previousContext = this._context;
            this._context = nextContext;
            this._inInventory =
                nextContext === this._inventorySimulation3D.inventoryContext;
        }

        // Get input ray for grid ray cast.
        let inputRay: Ray;
        if (this._vrController) {
            inputRay = this._vrController.pointerRay.clone();
        } else {
            // Get input ray from correct camera based on which context we are in.
            const pagePos = this.game.getInput().getMousePagePos();
            const inventoryViewport = this.game.getInventoryViewport();

            if (this._inInventory) {
                inputRay = Physics.screenPosToRay(
                    Input.screenPositionForViewport(pagePos, inventoryViewport),
                    this._inventorySimulation3D.getMainCameraRig().mainCamera
                );
            } else {
                inputRay = Physics.screenPosToRay(
                    this.game.getInput().getMouseScreenPos(),
                    this._simulation3D.getMainCameraRig().mainCamera
                );
            }
        }

        // Get grid tile from correct simulation grid.
        const grid3D = this._inInventory
            ? this._inventorySimulation3D.grid3D
            : this._simulation3D.grid3D;
        const gridTile = grid3D.getTileFromRay(inputRay);

        if (gridTile) {
            this._toCoord = gridTile.tileCoordinate;

            const result = calculateBotDragStackPosition(
                calc,
                this._context,
                gridTile.tileCoordinate,
                ...this._bots
            );

            this._combine = result.combine && this._allowCombine();
            this._other = result.other;
            this._merge = result.merge;

            let sim = this._simulation3D.simulation;

            if (this._combine && !this._initialCombine) {
                this._initialCombine = true;

                const objs = differenceBy(
                    objectsAtContextGridPosition(
                        calc,
                        this._context,
                        gridTile.tileCoordinate
                    ),
                    this._bots,
                    f => f.id
                );

                this._botsUsed = [this._bots[0], objs[0]];

                sim.helper.action(
                    'onCombineEnter',
                    [this._botsUsed[0]],
                    this._botsUsed[1]
                );

                sim.helper.action(
                    'onCombineEnter',
                    [this._botsUsed[1]],
                    this._botsUsed[0]
                );
            } else if (!this._combine && this._initialCombine) {
                this._initialCombine = false;

                sim.helper.action(
                    'onCombineExit',
                    [this._botsUsed[0]],
                    this._botsUsed[1]
                );

                sim.helper.action(
                    'onCombineExit',
                    [this._botsUsed[1]],
                    this._botsUsed[0]
                );
            }

            if (result.stackable || result.index === 0) {
                this._updateBotsPositions(
                    this._bots,
                    gridTile.tileCoordinate,
                    result.index,
                    calc
                );
            } else if (!result.stackable) {
                this._updateBotsPositions(
                    this._bots,
                    gridTile.tileCoordinate,
                    0,
                    calc
                );
            }
        }
    }

    protected _canDragWithinContext(mode: BotDragMode): boolean {
        return this._isDraggable(mode);
    }

    protected _canDragOutOfContext(mode: BotDragMode): boolean {
        return this._isPickupable(mode);
    }

    private _isPickupable(mode: BotDragMode): boolean {
        return mode === 'all' || mode === 'pickupOnly';
    }

    private _isDraggable(mode: BotDragMode): boolean {
        return mode === 'all' || mode === 'moveOnly';
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        super._onDragReleased(calc);
    }
}
