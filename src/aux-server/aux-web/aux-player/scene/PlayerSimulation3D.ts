import {
    Object,
    AuxObject,
    FileCalculationContext,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { IGameView } from '../../shared/IGameView';
import { Simulation } from '../../shared/Simulation';
import { tap } from 'rxjs/operators';
import { InventoryContext } from '../InventoryContext';
import { MenuContext } from '../MenuContext';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { doesFileDefinePlayerContext } from '../PlayerUtils';

export class PlayerSimulation3D extends Simulation3D {
    /**
     * Keep files in a back buffer so that we can add files to contexts when they come in.
     * We should not guarantee that contexts will come first so we must have some lazy file adding.
     */
    private _fileBackBuffer: Map<string, AuxObject>;

    /**
     * The current context group 3d that the AUX Player is rendering.
     */
    private _contextGroup: ContextGroup3D;

    context: string;
    inventoryContext: InventoryContext = null;
    menuContext: MenuContext = null;

    constructor(context: string, gameView: IGameView, simulation: Simulation) {
        super(gameView, simulation);

        this.context = context;
        this._fileBackBuffer = new Map();

        this._subs.push(
            this.simulation.watcher
                .fileChanged(this.simulation.helper.userFile)
                .pipe(
                    tap(file => {
                        const userInventoryContextValue = (<Object>file).tags[
                            'aux._userInventoryContext'
                        ];
                        if (
                            !this.inventoryContext ||
                            this.inventoryContext.context !==
                                userInventoryContextValue
                        ) {
                            this.inventoryContext = new InventoryContext(
                                userInventoryContextValue
                            );
                            console.log(
                                '[PlayerSimulation3D] User changed inventory context to: ',
                                userInventoryContextValue
                            );
                        }

                        const userMenuContextValue =
                            file.tags['aux._userMenuContext'];
                        if (
                            !this.menuContext ||
                            this.menuContext.context !== userMenuContextValue
                        ) {
                            this.menuContext = new MenuContext(
                                userMenuContextValue
                            );
                            console.log(
                                '[PlayerSimulation3D] User changed menu context to: ',
                                userMenuContextValue
                            );
                        }
                    })
                )
                .subscribe()
        );
    }

    protected _createContext(calc: FileCalculationContext, file: AuxObject) {
        if (this._contextGroup) {
            return null;
        }
        // We dont have a context group yet. We are in search of a file that defines a player context that matches the user's current context.
        const result = doesFileDefinePlayerContext(file, this.context, calc);
        if (result.matchFound) {
            // Create ContextGroup3D for this file that we will use to render all files in the context.
            this._contextGroup = new ContextGroup3D(
                file,
                'player',
                this._gameView.getDecoratorFactory()
            );

            return this._contextGroup;

            // TODO: Fix
            // Subscribe to file change updates for this context file so that we can do things like change the background color to match the context color, etc.
            // this._fileSubs.push(
            //     this.fileManager.watcher
            //         .fileChanged(file)
            //         .pipe(
            //             tap(file => {
            //                 // Update the context background color.
            //                 let contextBackgroundColor =
            //                     file.tags['aux.context.color'];
            //                 this._contextBackground = hasValue(
            //                     contextBackgroundColor
            //                 )
            //                     ? new Color(contextBackgroundColor)
            //                     : undefined;
            //                 this._sceneBackgroundUpdate();
            //             })
            //         )
            //         .subscribe()
            // );
        } else {
            this._fileBackBuffer.set(file.id, file);
        }
    }

    protected _removeContext(context: ContextGroup3D, removedIndex: number) {
        super._removeContext(context, removedIndex);

        if (context === this._contextGroup) {
            this._contextGroup = null;
        }
    }

    // protected _fileRemovedCore(calc: FileCalculationContext, id: string) {
    //     super._fileRemovedCore(calc, id);

    //     if (this._contextGroup) {
    //         if (this._contextGroup.file.id === id) {
    //             // File that defined player context has been removed.
    //             // Dispose of the context group.
    //             this._contextGroup.dispose();
    //             this.remove(this._contextGroup);
    //             this._contextGroup = null;
    //         }
    //     }
    // }

    protected async _fileAddedCore(
        calc: FileCalculationContext,
        file: AuxObject
    ): Promise<void> {
        await Promise.all(
            this.contexts.map(async c => {
                await c.fileAdded(file, calc);

                if (c === this._contextGroup) {
                    // Apply back buffer of files to the newly created context group.
                    for (let entry of this._fileBackBuffer) {
                        if (entry[0] !== file.id) {
                            await this._contextGroup.fileAdded(entry[1], calc);
                        }
                    }

                    this._fileBackBuffer.clear();
                }
            })
        );

        // Change the user's context after first adding and updating it
        // because the callback for file_updated was happening before we
        // could call fileUpdated from fileAdded.
        if (file.id === this.simulation.helper.userFile.id) {
            const userFile = this.simulation.helper.userFile;
            console.log(
                "[PlayerSimulation3D] Setting user's context to: " +
                    this.context
            );
            this.simulation.helper.updateFile(userFile, {
                tags: { 'aux._userContext': this.context },
            });
        }
    }
}
