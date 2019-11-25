import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    calculateNumericalTagValue,
    BotCalculationContext,
    Bot,
    calculateGridScale,
    objectsAtContextGridPosition,
    getBotPosition,
    getBotRotation,
    getContextScale,
    isUserBot,
    getContextGridHeight,
    cacheFunction,
    calculateBooleanTagValue,
} from '@casual-simulation/aux-common';
import { Vector3, Quaternion, Euler, Vector2 } from 'three';
import { calculateGridTileLocalCenter } from '../grid/Grid';
import { realPosToGridPos, Axial, posToKey } from '../hex';
import { BuilderGroup3D } from '../BuilderGroup3D';
import { calculateScale } from '../SceneUtils';

/**
 * Defines an interface that contains possible options for ContextPositionDecorator objects.
 */
export interface ContextPositionDecoratorOptions {
    /**
     * Whether to linear interpolate between positions.
     */
    lerp?: boolean;
}

/**
 * Defines a AuxBot3D decorator that moves the bot to its position inside a context.
 */
export class ContextPositionDecorator extends AuxBot3DDecoratorBase {
    private _lerp: boolean;
    private _atPosition: boolean;
    private _atRotation: boolean;
    private _lastPos: { x: number; y: number; z: number };
    private _nextPos: Vector3;
    private _nextRot: { x: number; y: number; z: number };
    private _lastHeight: number;

    constructor(
        bot3D: AuxBot3D,
        options: ContextPositionDecoratorOptions = {}
    ) {
        super(bot3D);
        this._lerp = !!options.lerp;
    }

    botUpdated(calc: BotCalculationContext): void {
        const userContext = this.bot3D.context;
        if (userContext) {
            const scale = calculateGridScale(calc, this.bot3D.contextGroup.bot);
            const currentGridPos = getBotPosition(
                calc,
                this.bot3D.bot,
                this.bot3D.context
            );
            const currentHeight = calculateVerticalHeight(
                calc,
                this.bot3D.bot,
                this.bot3D.context,
                scale
            );
            this._nextPos = calculateObjectPositionInGrid(
                calc,
                this.bot3D,
                scale
            );

            if (
                this._positionUpdated(currentGridPos) ||
                this._heightUpdated(currentHeight)
            ) {
                const objectsAtPosition = objectsAtContextGridPosition(
                    calc,
                    this.bot3D.context,
                    this._lastPos || currentGridPos
                );
                this.bot3D.contextGroup.simulation3D.ensureUpdate(
                    objectsAtPosition.map(f => f.id)
                );
            }
            this._lastPos = currentGridPos;
            this._lastHeight = currentHeight;
            this._nextRot = getBotRotation(
                calc,
                this.bot3D.bot,
                this.bot3D.context
            );

            this._atPosition = false;
            this._atRotation = false;
            if (!this._lerp) {
                this.bot3D.display.position.copy(this._nextPos);
                this.bot3D.display.rotation.set(
                    this._nextRot.x,
                    this._nextRot.z,
                    this._nextRot.y
                );
            }
        }
    }

    botRemoved(calc: BotCalculationContext): void {
        if (this._lastPos) {
            const objectsAtPosition = objectsAtContextGridPosition(
                calc,
                this.bot3D.context,
                this._lastPos
            );
            this.bot3D.contextGroup.simulation3D.ensureUpdate(
                objectsAtPosition.map(f => f.id)
            );
        }
    }

    private _heightUpdated(currentHeight: number): boolean {
        return Math.abs(this._lastHeight - currentHeight) > 0.01;
    }

    private _positionUpdated(currentGridPos: {
        x: number;
        y: number;
        z: number;
    }): boolean {
        return (
            !this._lastPos ||
            (currentGridPos.x !== this._lastPos.x ||
                currentGridPos.y !== this._lastPos.y ||
                currentGridPos.z !== this._lastPos.z)
        );
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this._lerp && this._nextPos && this._nextRot) {
            if (!this._atPosition) {
                this.bot3D.display.position.lerp(this._nextPos, 0.1);
                const distance = this.bot3D.display.position.distanceTo(
                    this._nextPos
                );
                this._atPosition = distance < 0.01;
            }

            if (!this._atRotation) {
                const euler = new Euler(
                    this._nextRot.x,
                    this._nextRot.z,
                    this._nextRot.y,
                    'XYZ'
                );
                const q = new Quaternion().setFromEuler(euler);
                this.bot3D.display.quaternion.slerp(q, 0.1);

                const angle = this.bot3D.display.quaternion.angleTo(q);
                this._atRotation = angle < 0.1;
            }

            if (!this._atPosition || !this._atRotation) {
                this.bot3D.display.updateMatrixWorld(true);
            }
        }
    }
    dispose(): void {}
}

/**
 * Calculates the position of the given bot.
 * @param context The bot calculation context to use to calculate forumula values.
 * @param bot The bot to calculate position for.
 * @param gridScale The scale of the grid.
 * @param contextId The id of the context we want to get positional data for the given bot.
 */
export function calculateObjectPositionInGrid(
    context: BotCalculationContext,
    bot: AuxBot3D,
    gridScale: number
): Vector3 {
    let position = getBotPosition(context, bot.bot, bot.context);
    let localPosition = calculateGridTileLocalCenter(
        position.x,
        position.y,
        position.z,
        gridScale
    );

    let totalScales = 0;

    if (!calculateBooleanTagValue(context, bot.bot, 'aux.stackable', true)) {
        totalScales = 0;
    } else {
        const objectsAtPosition = objectsAtContextGridPosition(
            context,
            bot.context,
            position
        );

        // Offset local position using index of bot.
        for (let obj of objectsAtPosition) {
            if (obj.id === bot.bot.id) {
                break;
            }

            if (calculateBooleanTagValue(context, obj, 'aux.stackable', true)) {
                totalScales += calculateVerticalHeight(
                    context,
                    obj,
                    bot.context,
                    gridScale
                );
            }
        }
    }

    const indexOffset = new Vector3(0, totalScales, 0);

    localPosition.add(indexOffset);

    if (bot.contextGroup instanceof BuilderGroup3D) {
        if (!isUserBot(bot.bot)) {
            // Offset local position with hex grid height.
            let hexScale = getContextScale(context, bot.contextGroup.bot);
            let axial = realPosToGridPos(
                new Vector2(localPosition.x, localPosition.z),
                hexScale
            );
            let key = posToKey(axial);
            let height = getContextGridHeight(
                context,
                bot.contextGroup.bot,
                '0:0'
            );
            localPosition.add(new Vector3(0, height, 0));
        }
    }

    return localPosition;
}

/**
 * Calculates the total vertical height of the given bot.
 * @param calc The calculation context to use.
 * @param bot The bot to use.
 * @param context The context that the bot's height should be evalulated in.
 * @param gridScale The scale of the grid.
 */
export function calculateVerticalHeight(
    calc: BotCalculationContext,
    bot: Bot,
    context: string,
    gridScale: number
) {
    return cacheFunction(
        calc,
        'calculateVerticalHeight',
        () => {
            const height = calculateScale(calc, bot, gridScale).y;
            const offset = calculateNumericalTagValue(
                calc,
                bot,
                `${context}.z`,
                0
            );

            return height + offset * gridScale;
        },
        bot.id,
        context,
        gridScale
    );
}
