import { BotHelper } from '@casual-simulation/aux-vm';
import {
    getSelectionMode,
    selectionIdForUser,
    updateUserSelection,
    toggleBotSelection,
    filterBotsBySelection,
    SelectionMode,
    newSelectionId,
    fileUpdated,
    PrecalculatedBot,
    Bot,
} from '@casual-simulation/aux-common';
import { Subject, Observable } from 'rxjs';
import { BotPanelManager } from './FilePanelManager';

/**
 * Defines a class that is able to manage selections for users.
 */
export default class SelectionManager {
    private static readonly _debug = false;
    private _helper: BotHelper;

    private _userChangedSelection: Subject<void>;

    /**
     * Gets an observable that resolves whenever the user takes an action to change the selection.
     */
    get userChangedSelection(): Observable<void> {
        return this._userChangedSelection;
    }

    /**
     * Creates a new object that is able to manage selections for a user.
     * @param helper The file helper to use.
     */
    constructor(helper: BotHelper) {
        this._helper = helper;
        this._userChangedSelection = new Subject<void>();
    }

    /**
     * Gets the selection mode that the current user is in.
     */
    get mode() {
        return getSelectionMode(this._helper.userFile);
    }

    /**
     * Selects the given file for the current user.
     * @param file The file to select.
     * @param multiSelect Whether to put the user into multi-select mode. (Default false)
     */
    async selectFile(
        file: Bot,
        multiSelect: boolean = false,
        fileManager: BotPanelManager = null
    ) {
        if (
            multiSelect ||
            this._helper.userFile.tags['aux._selection'] != file.id
        ) {
            await this._selectFileForUser(
                file,
                this._helper.userFile,
                multiSelect
            );
        } else {
            if (fileManager != null) {
                fileManager.keepSheetsOpen();
            }
        }
    }

    /**
     * Sets the list of files that the user should have selected.
     * @param files The files that should be selected.
     */
    async setSelectedFiles(files: Bot[]) {
        const newId = newSelectionId();

        await this._helper.transaction(
            fileUpdated(this._helper.userFile.id, {
                tags: {
                    ['aux._selection']: newId,
                    ['aux._selectionMode']: 'multi',
                },
            }),
            ...files.map(f =>
                fileUpdated(f.id, {
                    tags: {
                        [newId]: true,
                    },
                })
            )
        );

        this._userChangedSelection.next();
    }

    /**
     * Clears the selection for the current user.
     */
    async clearSelection() {
        await this._clearSelectionForUser(this._helper.userFile);
        this._userChangedSelection.next();
    }

    /**
     * Sets the selection mode for the current user.
     * @param mode The mode.
     */
    async setMode(mode: SelectionMode) {
        const currentMode = getSelectionMode(this._helper.userFile);
        if (currentMode !== mode) {
            return this._helper.updateBot(this._helper.userFile, {
                tags: {
                    'aux._selectionMode': mode,
                },
            });
        }
    }

    /**
     * Gets a list of files that the given user has selected.
     * @param user The file of the user.
     */
    getSelectedFilesForUser(user: PrecalculatedBot): PrecalculatedBot[] {
        if (!user) {
            return [];
        }
        return <PrecalculatedBot[]>(
            filterBotsBySelection(
                this._helper.objects,
                user.tags['aux._selection']
            )
        );
    }

    /**
     * Clears the selection that the given user has.
     * @param user The file for the user to clear the selection of.
     */
    private async _clearSelectionForUser(user: PrecalculatedBot) {
        if (SelectionManager._debug) {
            console.log('[SelectionManager] Clear selection for', user.id);
        }
        const update = updateUserSelection(null, null);
        await this._helper.updateBot(user, {
            tags: {
                ...update.tags,
                'aux._selectionMode': 'single',
            },
        });
    }

    private async _selectFileForUser(
        file: Bot,
        user: PrecalculatedBot,
        multiSelect: boolean
    ) {
        if (SelectionManager._debug) {
            console.log('[SelectionManager] Select Bot:', file.id);
        }

        const mode = getSelectionMode(user);

        if (mode === 'multi') {
            const { id, newId } = selectionIdForUser(user);
            if (newId) {
                const update = updateUserSelection(newId, file.id);
                await this._helper.updateBot(user, update);
            }
            if (id) {
                const update = toggleBotSelection(file, id, user.id);
                await this._helper.updateBot(file, update);
            }
        } else {
            if (multiSelect) {
                const newId = newSelectionId();
                const current = user.tags['aux._selection'];
                const update = updateUserSelection(newId, file.id);
                await this._helper.updateBot(user, {
                    tags: {
                        ...update.tags,
                        ['aux._selectionMode']: 'multi',
                    },
                });

                if (current) {
                    const currentFile = this._helper.filesState[current];
                    if (currentFile) {
                        await this._helper.updateBot(currentFile, {
                            tags: {
                                [newId]: true,
                            },
                        });
                    }
                }

                await this._helper.updateBot(file, {
                    tags: {
                        [newId]: true,
                    },
                });
            } else {
                const selection = file.id;

                const update = updateUserSelection(selection, file.id);
                await this._helper.updateBot(user, update);
                await this._helper.updateBot(file, { tags: {} });
            }
        }

        this._userChangedSelection.next();
    }
}
