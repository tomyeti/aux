import { Game } from '../../shared/scene/Game';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import {
    CameraRig,
    createCameraRig,
    resizeCameraRig,
} from '../../shared/scene/CameraRigFactory';
import {
    Scene,
    Color,
    Texture,
    OrthographicCamera,
    Vector3,
    Vector2,
} from 'three';
import { PlayerSimulation3D } from './PlayerSimulation3D';
import { InventorySimulation3D } from './InventorySimulation3D';
import { Viewport } from '../../shared/scene/Viewport';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import { appManager } from '../../shared/AppManager';
import { tap, mergeMap, first } from 'rxjs/operators';
import { flatMap } from 'lodash';
import { PlayerInteractionManager } from '../interaction/PlayerInteractionManager';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import SimulationItem from '../SimulationContext';
import { uniqBy } from 'lodash';
import {
    getFilesStateFromStoredTree,
    calculateFileValue,
    calculateNumericalTagValue,
    clamp,
} from '@casual-simulation/aux-common';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
} from '../../shared/scene/SceneUtils';
import { WebVRDisplays } from '../../shared/WebVRDisplays';
import { Subject } from 'rxjs';
import { MenuItem } from '../MenuContext';
import { CameraRigControls } from 'aux-web/shared/interaction/CameraRigControls';

export class PlayerGame extends Game {
    gameView: PlayerGameView;
    filesMode: boolean;
    workspacesMode: boolean;

    playerSimulations: PlayerSimulation3D[] = [];
    inventorySimulations: InventorySimulation3D[] = [];
    inventoryCameraRig: CameraRig = null;
    inventoryViewport: Viewport = null;
    showInventoryCameraRigHome: boolean = false;

    startZoom: number;
    startAspect: number;

    private inventoryScene: Scene;

    inventoryHeightOverride: number = null;

    private sliderLeft: Element;
    private sliderRight: Element;
    private sliderPressed: boolean = false;

    setupDelay: boolean = false;

    invVisibleCurrent: boolean = true;
    defaultHeightCurrent: number = 0;
    menuUpdated: Subject<MenuItem[]> = new Subject();

    defaultZoom: number = null;
    defaultRotationX: number = null;
    defaultRotationY: number = null;

    invController: CameraRigControls;
    invOffsetCurr: number = 0;
    invOffsetDelta: number = 0;
    firstPan: boolean = true;
    panValueCurr: number = 0;

    constructor(gameView: PlayerGameView) {
        super(gameView);
    }

    getBackground(): Color | Texture {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];
            if (sim.backgroundColor) {
                return sim.backgroundColor;
            }
        }

        return null;
    }

    getInventoryVisible(): boolean {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.inventoryVisible != null) {
                return sim.inventoryVisible;
            }
        }

        return null;
    }

    getInventoryHeight(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.inventoryHeight != null) {
                return sim.inventoryHeight;
            }
        }

        return 1;
    }

    getPlayerZoom(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.playerZoom != null) {
                return sim.playerZoom;
            }
        }

        return null;
    }

    getPlayerRotationX(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.playerRotationX != null) {
                return sim.playerRotationX;
            }
        }

        return null;
    }

    getPlayerRotationY(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.playerRotationY != null) {
                return sim.playerRotationY;
            }
        }

        return null;
    }

    getInventoryColor(): Color | Texture {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];
            if (sim.inventoryColor) {
                return sim.inventoryColor;
            }
        }

        return null;
    }

    getViewports(): Viewport[] {
        return [this.mainViewport, this.inventoryViewport];
    }
    getCameraRigs(): CameraRig[] {
        return [this.mainCameraRig, this.inventoryCameraRig];
    }
    getSimulations(): Simulation3D[] {
        return [...this.playerSimulations, ...this.inventorySimulations];
        // return [...this.playerSimulations];
        // return [...this.inventorySimulations];
    }
    getUIHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.gameView.$refs.inventory];
    }
    getInventoryViewport(): Viewport {
        return this.inventoryViewport;
    }
    getInventoryCameraRig(): CameraRig {
        return this.inventoryCameraRig;
    }
    findFilesById(id: string): AuxFile3D[] {
        return flatMap(flatMap(this.playerSimulations, s => s.contexts), c =>
            c.getFiles().filter(f => f.file.id === id)
        );
    }
    setGridsVisible(visible: boolean): void {
        // This currently does nothing for AUX Player, we dont really show any grids right now.
    }
    setWorldGridVisible(visible: boolean): void {
        // This currently does nothing for AUX Player, we dont really show any grids right now.
    }
    setupInteraction(): BaseInteractionManager {
        return new PlayerInteractionManager(this);
    }
    addSidebarItem(
        id: string,
        text: string,
        click: () => void,
        icon?: string,
        group?: string
    ): void {
        this.gameView.addSidebarItem(id, text, click, icon, group);
    }
    removeSidebarItem(id: string): void {
        this.gameView.removeSidebarItem(id);
    }
    removeSidebarGroup(group: string): void {
        this.gameView.removeSidebarGroup(group);
    }

    /**
     * Find Inventory Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    findInventorySimulation3D(sim: BrowserSimulation): InventorySimulation3D {
        return this.inventorySimulations.find(s => s.simulation === sim);
    }

    /**
     * Find Player Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    findPlayerSimulation3D(sim: BrowserSimulation): PlayerSimulation3D {
        return this.playerSimulations.find(s => s.simulation === sim);
    }

    dispose(): void {
        super.dispose();

        this.removeSidebarItem('debug_mode');
        this.removeSidebarGroup('simulations');
    }

    protected async onBeforeSetupComplete() {
        this.subs.push(
            appManager.simulationManager.simulationAdded
                .pipe(
                    mergeMap(
                        sim =>
                            sim.connection.syncStateChanged.pipe(
                                first(sync => sync)
                            ),
                        (sim, sync) => sim
                    ),
                    tap(sim => {
                        this.simulationAdded(sim);
                    })
                )
                .subscribe()
        );

        this.subs.push(
            appManager.simulationManager.simulationRemoved
                .pipe(
                    tap(sim => {
                        this.simulationRemoved(sim);
                    })
                )
                .subscribe()
        );
    }

    private simulationAdded(sim: BrowserSimulation) {
        const playerSim3D = new PlayerSimulation3D(
            this.gameView.context,
            this,
            sim
        );
        playerSim3D.init();
        playerSim3D.onFileAdded.addListener(this.onFileAdded.invoke);
        playerSim3D.onFileRemoved.addListener(this.onFileRemoved.invoke);
        playerSim3D.onFileUpdated.addListener(this.onFileUpdated.invoke);

        this.subs.push(
            playerSim3D.simulationContext.itemsUpdated.subscribe(() => {
                this.onSimsUpdated();
            }),
            playerSim3D.menuContext.itemsUpdated.subscribe(() => {
                this.onMenuUpdated();
            })
        );

        this.subs.push(
            playerSim3D.simulation.localEvents.subscribe(e => {
                if (e.name === 'go_to_context') {
                    this.playerSimulations.forEach(s => {
                        s.setContext(e.context);
                    });
                } else if (e.name === 'import_aux') {
                    this.importAUX(sim, e.url);
                }
            })
        );

        this.playerSimulations.push(playerSim3D);
        this.mainScene.add(playerSim3D);

        //
        // Create Inventory Simulation
        //
        const inventorySim3D = new InventorySimulation3D(this, sim);
        inventorySim3D.init();
        inventorySim3D.onFileAdded.addListener(this.onFileAdded.invoke);
        inventorySim3D.onFileRemoved.addListener(this.onFileRemoved.invoke);
        inventorySim3D.onFileUpdated.addListener(this.onFileUpdated.invoke);

        this.inventorySimulations.push(inventorySim3D);
        this.inventoryScene.add(inventorySim3D);
    }

    private simulationRemoved(sim: BrowserSimulation) {
        //
        // Remove Player Simulation
        //
        const playerSimIndex = this.playerSimulations.findIndex(
            s => s.simulation.id === sim.id
        );
        if (playerSimIndex >= 0) {
            const removed = this.playerSimulations.splice(playerSimIndex, 1);
            removed.forEach(s => {
                s.onFileAdded.removeListener(this.onFileAdded.invoke);
                s.onFileRemoved.removeListener(this.onFileRemoved.invoke);
                s.onFileUpdated.removeListener(this.onFileUpdated.invoke);
                s.unsubscribe();
                this.mainScene.remove(s);
            });
        }

        //
        // Remove Inventory Simulation
        //
        const invSimIndex = this.inventorySimulations.findIndex(
            s => s.simulation.id == sim.id
        );

        if (invSimIndex >= 0) {
            const removed = this.inventorySimulations.splice(invSimIndex, 1);
            removed.forEach(s => {
                s.onFileAdded.removeListener(this.onFileAdded.invoke);
                s.onFileRemoved.removeListener(this.onFileRemoved.invoke);
                s.onFileUpdated.removeListener(this.onFileUpdated.invoke);
                s.unsubscribe();
                this.inventoryScene.remove(s);
            });
        }
    }

    private onSimsUpdated() {
        let items: SimulationItem[] = [];
        this.playerSimulations.forEach(sim => {
            if (sim.simulationContext) {
                for (let i = 0; i < sim.simulationContext.items.length; i++) {
                    items[i] = sim.simulationContext.items[i];
                }
            }
        });

        items = uniqBy(items, i => i.simulationToLoad);
        appManager.simulationManager.updateSimulations([
            appManager.simulationManager.primary.id,
            ...items.map(i => i.simulationToLoad),
        ]);
    }

    private onMenuUpdated() {
        let items: MenuItem[] = [];
        this.playerSimulations.forEach(sim => {
            if (sim.menuContext) {
                items.push(...sim.menuContext.items);
            }
        });

        this.menuUpdated.next(items);
    }

    private async importAUX(sim: BrowserSimulation, url: string) {
        const stored = await appManager.loadAUX(url);
        const state = await getFilesStateFromStoredTree(stored);
        await sim.helper.addState(state);
    }

    /**
     * Render the current frame for the default browser mode.
     */
    protected renderBrowser() {
        super.renderBrowser();

        this.inventoryCameraRig.mainCamera.updateMatrixWorld(true);

        //
        // [Inventory scene]
        //

        this.renderer.clearDepth(); // Clear depth buffer so that inventory scene always appears above the main scene.

        if (this.mainScene.background instanceof Color) {
            this.inventorySceneBackgroundUpdate(this.mainScene.background);
        }

        this.renderer.setViewport(
            this.inventoryViewport.x,
            this.inventoryViewport.y,
            this.inventoryViewport.width,
            this.inventoryViewport.height
        );
        this.renderer.setScissor(
            this.inventoryViewport.x,
            this.inventoryViewport.y,
            this.inventoryViewport.width,
            this.inventoryViewport.height
        );

        this.renderer.setScissorTest(true);

        // Render the inventory scene with the inventory main camera.
        this.renderer.render(
            this.inventoryScene,
            this.inventoryCameraRig.mainCamera
        );
    }

    /**
     * Render the current frame for XR (AR mode).
     */
    protected renderXR() {
        super.renderXR();
    }

    /**
     * Render the current frame for VR.
     */
    protected renderVR() {
        this.renderer.setScissorTest(false);
        super.renderVR();
        this.renderer.setScissorTest(false);
    }

    private inventorySceneBackgroundUpdate(colorToOffset: Color) {
        if (!colorToOffset) return;

        let invColor: Color | Texture = colorToOffset.clone();
        let tagColor = this.getInventoryColor();

        if (tagColor != undefined) {
            invColor = tagColor;
        } else {
            invColor.offsetHSL(0, -0.02, -0.04);
        }

        this.inventoryScene.background = invColor;
    }

    protected setupRenderer() {
        super.setupRenderer();

        this.inventoryViewport = new Viewport('inventory', this.mainViewport);
        console.log(
            'Set height initial value: ' + this.inventoryViewport.height
        );
        this.inventoryViewport.layer = 1;
    }

    protected setupScenes() {
        super.setupScenes();

        //
        // [Inventory scene]
        //
        this.inventoryScene = new Scene();
        this.inventoryScene.autoUpdate = false;

        // Inventory camera.
        this.inventoryCameraRig = createCameraRig(
            'inventory',
            'orthographic',
            this.inventoryScene,
            this.inventoryViewport
        );
        this.inventoryCameraRig.mainCamera.zoom = 50;

        // Inventory ambient light.
        const invAmbient = baseAuxAmbientLight();
        this.inventoryScene.add(invAmbient);

        // Inventory direction light.
        const invDirectional = baseAuxDirectionalLight();
        this.inventoryScene.add(invDirectional);

        this.setupDelay = true;
    }

    onWindowResize(width: number, height: number) {
        super.onWindowResize(width, height);

        this.firstPan = true;
        if (this.inventoryHeightOverride === null) {
            this.setupInventory(height);
        }

        this.setupInventory(height);
    }

    setupInventory(height: number) {
        let invHeightScale = 1;

        const context = appManager.simulationManager.primary.helper.createContext();
        const globalsFile =
            appManager.simulationManager.primary.helper.globalsFile;
        let defaultHeight = this.getInventoryHeight();

        if (this.defaultHeightCurrent != this.getInventoryHeight()) {
            this.inventoryHeightOverride = null;
        }

        if (defaultHeight === null || defaultHeight === 0) {
            calculateNumericalTagValue(
                context,
                globalsFile,
                'aux.context.inventory.height',
                null
            );
        }

        if (defaultHeight != null && defaultHeight != 0) {
            if (defaultHeight < 1) {
                invHeightScale = 1;
            } else if (defaultHeight > 10) {
                invHeightScale = 10;
            } else {
                invHeightScale = <number>defaultHeight;
            }
        }

        this.defaultHeightCurrent = defaultHeight;
        this.invVisibleCurrent = this.getInventoryVisible();

        if (this.invVisibleCurrent === false) {
            this.inventoryViewport.setScale(null, 0);
            if (this.sliderLeft === undefined)
                this.sliderLeft = document.querySelector('.slider-hiddenLeft');

            if (this.sliderRight === undefined)
                this.sliderRight = document.querySelector(
                    '.slider-hiddenRight'
                );

            (<HTMLElement>this.sliderLeft).style.display = 'none';
            (<HTMLElement>this.sliderRight).style.display = 'none';

            return;
        } else {
            if (this.sliderLeft === undefined)
                this.sliderLeft = document.querySelector('.slider-hiddenLeft');

            if (this.sliderRight === undefined)
                this.sliderRight = document.querySelector(
                    '.slider-hiddenRight'
                );

            (<HTMLElement>this.sliderLeft).style.display = 'block';
            (<HTMLElement>this.sliderRight).style.display = 'block';
        }

        let w = window.innerWidth;

        if (w > 700) {
            w = 700;
        }

        let unitNum = invHeightScale;

        invHeightScale = (0.11 - 0.04 * ((700 - w) / 200)) * unitNum + 0.02;
        this.invOffsetDelta = (49 - 18 * ((700 - w) / 200)) * (unitNum - 1);

        // if there is no existing height set by the slider then
        if (this.inventoryHeightOverride === null) {
            // get a new reference to the slider object in the html
            if (this.sliderLeft === undefined)
                this.sliderLeft = document.querySelector('.slider-hiddenLeft');

            if (this.sliderRight === undefined)
                this.sliderRight = document.querySelector(
                    '.slider-hiddenRight'
                );

            let invOffsetHeight = 40;

            if (window.innerWidth <= 700) {
                invOffsetHeight = window.innerWidth * 0.05;
                this.inventoryViewport.setScale(0.9, invHeightScale);
            } else {
                this.inventoryViewport.setScale(0.8, invHeightScale);
            }

            if (this.inventoryViewport.getSize().x > 700) {
                let num = 700 / window.innerWidth;
                this.inventoryViewport.setScale(num, invHeightScale);
            }

            this.inventoryViewport.setOrigin(
                window.innerWidth / 2 - this.inventoryViewport.getSize().x / 2,
                invOffsetHeight
            );

            // set the new slider's top position to the top of the inventory viewport
            let sliderTop =
                height - this.inventoryViewport.height - (invOffsetHeight - 10);
            (<HTMLElement>this.sliderLeft).style.top =
                sliderTop.toString() + 'px';

            (<HTMLElement>this.sliderRight).style.top =
                sliderTop.toString() + 'px';

            this.inventoryHeightOverride =
                this.inventoryViewport.getSize().y - 5;

            (<HTMLElement>this.sliderLeft).style.left =
                (this.inventoryViewport.x - 15).toString() + 'px';

            (<HTMLElement>this.sliderRight).style.left =
                (
                    this.inventoryViewport.x +
                    this.inventoryViewport.getSize().x -
                    15
                ).toString() + 'px';
        } else {
            let invOffsetHeight = 40;

            if (window.innerWidth < 700) {
                invOffsetHeight = window.innerWidth * 0.05;
                this.inventoryViewport.setScale(0.9, invHeightScale);
            } else {
                this.inventoryViewport.setScale(0.8, invHeightScale);
            }

            if (this.inventoryViewport.getSize().x > 700) {
                let num = 700 / window.innerWidth;
                this.inventoryViewport.setScale(num, invHeightScale);
            }

            this.inventoryViewport.setOrigin(
                window.innerWidth / 2 - this.inventoryViewport.getSize().x / 2,
                invOffsetHeight
            );

            let sliderTop =
                height - this.inventoryViewport.height - invOffsetHeight - 10;
            (<HTMLElement>this.sliderLeft).style.top =
                sliderTop.toString() + 'px';

            (<HTMLElement>this.sliderRight).style.top =
                sliderTop.toString() + 'px';

            (<HTMLElement>this.sliderLeft).style.left =
                (this.inventoryViewport.x - 12).toString() + 'px';

            (<HTMLElement>this.sliderRight).style.left =
                (
                    this.inventoryViewport.x +
                    this.inventoryViewport.getSize().x -
                    12
                ).toString() + 'px';
        }

        if (this.inventoryCameraRig) {
            this.overrideOrthographicViewportZoom(this.inventoryCameraRig);
            resizeCameraRig(this.inventoryCameraRig);
        }
    }

    async mouseDownSlider() {
        this.sliderPressed = true;

        if (this.inventoryCameraRig.mainCamera instanceof OrthographicCamera) {
            this.startAspect =
                this.inventoryCameraRig.viewport.width /
                this.inventoryCameraRig.viewport.height;
            this.startZoom = this.inventoryCameraRig.mainCamera.zoom;
        }
    }

    async mouseUpSlider() {
        let invOffsetHeight = 40;

        if (window.innerWidth < 700) {
            invOffsetHeight = window.innerWidth * 0.05;
        }

        this.sliderPressed = false;
        let sliderTop =
            window.innerHeight -
            this.inventoryViewport.height -
            invOffsetHeight;
        (<HTMLElement>this.sliderLeft).style.top = sliderTop.toString() + 'px';

        (<HTMLElement>this.sliderRight).style.top = sliderTop.toString() + 'px';
    }

    protected frameUpdate(xrFrame?: any) {
        super.frameUpdate(xrFrame);

        if (this.setupDelay) {
            this.onCenterCamera(this.inventoryCameraRig);
            this.setupDelay = false;
        } else if (this.firstPan) {
            this.firstPan = false;
            this.overrideOrthographicViewportZoom(this.inventoryCameraRig);
        }

        if (
            this.defaultZoom === null &&
            this.defaultRotationX === null &&
            this.defaultRotationY === null
        ) {
            let zoomNum = this.getPlayerZoom();
            if (zoomNum != null) {
                zoomNum = clamp(zoomNum, 0, 80);
            }

            let rotX = this.getPlayerRotationX();
            let rotY = this.getPlayerRotationY();

            if (rotX != null) {
                rotX = clamp(rotX, 1, 90);
                rotX = rotX / 180;
            } else {
                rotX = 0.0091;
            }

            if (rotY != null) {
                rotY = clamp(rotY, -180, 180);
                rotY = rotY / 180;
            } else {
                rotY = 0.0091;
            }

            if (
                (zoomNum != undefined && zoomNum != this.defaultZoom) ||
                (rotX != undefined && rotX != this.defaultRotationX) ||
                (rotY != undefined && rotY != this.defaultRotationY)
            ) {
                if (rotX != null && rotY != null) {
                    this.setCameraToPosition(
                        this.mainCameraRig,
                        new Vector3(0, 0, 0),
                        zoomNum,
                        new Vector2(rotX, rotY)
                    );
                } else {
                    this.setCameraToPosition(
                        this.mainCameraRig,
                        new Vector3(0, 0, 0),
                        zoomNum
                    );
                }
            }

            this.defaultZoom = zoomNum;
            this.defaultRotationX = rotX;
            this.defaultRotationY = rotY;
        }

        if (
            this.invVisibleCurrent != this.getInventoryVisible() ||
            this.defaultHeightCurrent != this.getInventoryHeight()
        ) {
            this.setupInventory(window.innerHeight);
        }

        if (!this.sliderPressed) return false;

        let invOffsetHeight: number = 40;

        if (window.innerWidth < 700) {
            invOffsetHeight = window.innerWidth * 0.05;
        }

        let sliderPos = this.input.getMousePagePos().y + invOffsetHeight;

        //prevent the slider from being positioned outside the window bounds
        if (sliderPos < 0) sliderPos = 0;
        if (sliderPos > window.innerHeight) sliderPos = window.innerHeight;

        (<HTMLElement>this.sliderLeft).style.top =
            sliderPos - invOffsetHeight + 'px';

        (<HTMLElement>this.sliderRight).style.top =
            sliderPos - invOffsetHeight + 'px';

        this.inventoryHeightOverride = window.innerHeight - sliderPos;

        let invHeightScale = this.inventoryHeightOverride / window.innerHeight;

        if (invHeightScale < 0.1) {
            invHeightScale = 0.1;
        } else if (invHeightScale > 1) {
            invHeightScale = 1;
        }

        this.inventoryViewport.setScale(null, invHeightScale);

        if (this.inventoryCameraRig) {
            this.overrideOrthographicViewportZoom(this.inventoryCameraRig);
            resizeCameraRig(this.inventoryCameraRig);
        }

        if (!this.input.getMouseButtonHeld(0)) {
            this.sliderPressed = false;
        }
    }

    /**
     * This is a hacky function that gets us a more pleasent orthographic zoom level
     * as we change the aspect ratio of the viewport that has an orthographic camera.
     */
    private overrideOrthographicViewportZoom(cameraRig: CameraRig) {
        if (cameraRig.mainCamera instanceof OrthographicCamera) {
            const aspect = cameraRig.viewport.width / cameraRig.viewport.height;

            if (this.startAspect != null) {
                let zoomC = this.startZoom / this.startAspect;
                const newZoom =
                    this.startZoom - (this.startZoom - aspect * zoomC);
                cameraRig.mainCamera.zoom = newZoom;
            } else {
                // edit this number to change the initial zoom number
                let initNum = 240;
                // found that 50 is the preset zoom of the rig.maincamera.zoom so I am using this as the base zoom
                const newZoom = initNum - (initNum - aspect * (initNum / 7));
                cameraRig.mainCamera.zoom = newZoom;
            }
        }

        if (!this.setupDelay) {
            if (this.invController == null) {
                this.invController = this.interaction.cameraRigControllers.find(
                    c => c.rig.name === cameraRig.name
                );
            }

            if (!this.firstPan) {
                let num = this.invOffsetDelta - this.invOffsetCurr;

                // try to center it by using the last offset
                this.invController.controls.setPan(-this.panValueCurr);

                // the final pan movement with the current offset
                this.panValueCurr += num;

                this.invController.controls.setPan(this.panValueCurr);
                this.invOffsetCurr = this.invOffsetDelta;
            }
        }
    }
}
