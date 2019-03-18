import { Physics } from '../../../shared/scene/Physics';
import { File, PartialFile, fileAdded, FileEvent } from '@yeti-cgi/aux-common/Files';
import { createFile, FileCalculationContext } from '@yeti-cgi/aux-common/Files/FileCalculations';
import { appManager } from '../../../shared/AppManager';
import { merge } from '@yeti-cgi/aux-common/utils';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { BaseBuilderFileDragOperation } from './BaseBuilderFileDragOperation';
import GameView from '../../GameView/GameView';
import { BuilderInteractionManager } from '../BuilderInteractionManager';

/**
 * New File Drag Operation handles dragging of new files from the file queue.
 */
export class BuilderNewFileDragOperation extends BaseBuilderFileDragOperation {

    public static readonly FreeDragDistance: number = 6;

    private _fileAdded: boolean;
    private _initialDragMesh: AuxFile3D;

    /**
     * Create a new drag rules.
     * @param input the input module to interface with.
     * @param buttonId the button id of the input that this drag operation is being performed with. If desktop this is the mouse button
     */
    constructor(gameView: GameView, interaction: BuilderInteractionManager, duplicatedFile: File) {
        super(gameView, interaction, [duplicatedFile], null);
    }

    protected _updateFile(file: File, data: PartialFile): FileEvent {
        if (!this._fileAdded) {

            if (this._initialDragMesh) {
                this._releaseDragMesh(this._initialDragMesh);
                this._initialDragMesh = null;
            }

            // Add the duplicated file.
            this._file = merge(this._file, data || {});
            this._file = createFile(this._file.id, this._file.tags);
            this._files = [this._file];
            this._fileAdded = true;

            return fileAdded(this._file);
        } else {
            return super._updateFile(this._file, data);
        }
    }

    protected _onDragReleased(): void {
        if (this._initialDragMesh) {
            this._releaseDragMesh(this._initialDragMesh);
            this._initialDragMesh = null;
        }

        super._onDragReleased();
    }

    protected _dragFilesFree(calc: FileCalculationContext): void {
        if (!this._fileAdded) {
            // New file has not been added yet, drag a dummy mesh to drag around until it gets added to a workspace.
            if (!this._initialDragMesh) {
                this._initialDragMesh = this._createDragMesh(calc, this._file);
            }

            const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
            let worldPos = Physics.pointOnRay(mouseDir, BuilderNewFileDragOperation.FreeDragDistance);
            this._initialDragMesh.position.copy(worldPos);
            this._initialDragMesh.updateMatrixWorld(true);
        } else {
            // New file has been added, just do the base file drag operation.
            super._dragFilesFree(calc);
        }
    }

    protected _combineFiles(eventName: string) {
        if (this._fileAdded) {
            appManager.fileManager.action(this._file, this._other, eventName);
        }
    }

    private _releaseDragMesh(mesh: AuxFile3D): void {
        if (mesh) {
            mesh.dispose();
            this._gameView.scene.remove(mesh);
        }
    }
}