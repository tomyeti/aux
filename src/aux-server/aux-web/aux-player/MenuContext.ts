import {
    Bot,
    BotCalculationContext,
    TagUpdatedEvent,
    isBotInContext,
    getBotPosition,
    getBotIndex,
    botContextSortOrder,
} from '@casual-simulation/aux-common';
import { remove, sortBy } from 'lodash';
import { getOptionalValue } from '../shared/SharedUtils';
import { PlayerSimulation3D } from './scene/PlayerSimulation3D';
import { Subject, Observable } from 'rxjs';

/**
 * Defines an interface for an item that is in a user's menu.
 */
export interface MenuItem {
    bot: Bot;
    simulationId: string;
    context: string;
}

/**
 * MenuContext is a helper class to assist with managing the user's menu context.
 */
export class MenuContext {
    /**
     * The simulation that the context is for.
     */
    simulation: PlayerSimulation3D;

    /**
     * The context that this object represents.
     */
    context: string = null;

    /**
     * All the bots that are in this context.
     */
    bots: Bot[] = [];

    /**
     * The bots in this contexts mapped into menu items.
     * Files are ordered in ascending order based on their index in the context.
     */
    items: MenuItem[] = [];

    /**
     * Gets an observable that resolves whenever this simulation's items are updated.
     */
    get itemsUpdated(): Observable<void> {
        return this._itemsUpdated;
    }

    private _itemsUpdated: Subject<void>;
    private _itemsDirty: boolean;

    constructor(simulation: PlayerSimulation3D, context: string) {
        if (context == null || context == undefined) {
            throw new Error('Menu context cannot be null or undefined.');
        }
        this.simulation = simulation;
        this.context = context;
        this.bots = [];
        this._itemsUpdated = new Subject<void>();
    }

    /**
     * Notifies this context that the given bot was added to the state.
     * @param bot The bot.
     * @param calc The calculation context that should be used.
     */
    async botAdded(bot: Bot, calc: BotCalculationContext) {
        const isInContext = !!this.bots.find(f => f.id == bot.id);
        const shouldBeInContext = isBotInContext(calc, bot, this.context);

        if (!isInContext && shouldBeInContext) {
            this._addFile(bot, calc);
        }
    }

    /**
     * Notifies this context that the given bot was updated.
     * @param bot The bot.
     * @param updates The changes made to the bot.
     * @param calc The calculation context that should be used.
     */
    async botUpdated(
        bot: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        const isInContext = !!this.bots.find(f => f.id == bot.id);
        const shouldBeInContext = isBotInContext(calc, bot, this.context);

        if (!isInContext && shouldBeInContext) {
            this._addFile(bot, calc);
        } else if (isInContext && !shouldBeInContext) {
            this._removeFile(bot.id);
        } else if (isInContext && shouldBeInContext) {
            this._updateFile(bot, updates, calc);
        }
    }

    /**
     * Notifies this context that the given bot was removed from the state.
     * @param bot The ID of the bot that was removed.
     * @param calc The calculation context.
     */
    botRemoved(id: string, calc: BotCalculationContext) {
        this._removeFile(id);
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this._itemsDirty) {
            this._resortItems(calc);
            this._itemsDirty = false;
        }
    }

    dispose(): void {
        this._itemsUpdated.unsubscribe();
    }

    private _addFile(bot: Bot, calc: BotCalculationContext) {
        this.bots.push(bot);
        this._itemsDirty = true;
    }

    private _removeFile(id: string) {
        remove(this.bots, f => f.id === id);
        this._itemsDirty = true;
    }

    private _updateFile(
        bot: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        let fileIndex = this.bots.findIndex(f => f.id == bot.id);
        if (fileIndex >= 0) {
            this.bots[fileIndex] = bot;
            this._itemsDirty = true;
        }
    }

    private _resortItems(calc: BotCalculationContext): void {
        this.items = sortBy(this.bots, f =>
            botContextSortOrder(calc, f, this.context)
        ).map(f => {
            return {
                bot: f,
                simulationId: this.simulation
                    ? this.simulation.simulation.id
                    : null,
                context: this.context,
            };
        });

        this._itemsUpdated.next();
    }
}
