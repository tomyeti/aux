import Vue from 'vue';
import { IGameView } from './IGameView';
import {
    Scene,
    WebGLRenderer,
    Texture,
    Color,
    Math as ThreeMath,
    Matrix4,
    Vector3,
    Quaternion,
} from 'three';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import {
    AuxFile,
    DEFAULT_SCENE_BACKGROUND_COLOR,
} from '@casual-simulation/aux-common';
import {
    CameraRig,
    CameraType,
    createCameraRig,
    resizeCameraRig,
} from '../scene/CameraRigFactory';
import { Time } from '../scene/Time';
import { BaseInteractionManager } from '../interaction/BaseInteractionManager';
import { InputVR } from '../scene/InputVR';
import { Input, InputType } from '../scene/Input';
import { GridChecker } from '../scene/grid/GridChecker';
import { HtmlMixer } from '../scene/HtmlMixer';
import { SubscriptionLike } from 'rxjs';
import { AuxFile3DDecoratorFactory } from '../scene/decorators/AuxFile3DDecoratorFactory';
import { Viewport } from '../scene/Viewport';
import { Simulation3D } from '../scene/Simulation3D';
import { FileRenderer } from '../scene/FileRenderer';
import { Provide, Component } from 'vue-property-decorator';
import { DebugObjectManager } from '../scene/DebugObjectManager';
import VRControlsModule from 'three-vrcontrols-module';
import VREffectModule from 'three-vreffect-module';
import * as webvrui from 'webvr-ui';
import { find } from 'lodash';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
    createHtmlMixerContext,
} from '../scene/SceneUtils';
import { EventBus } from '../EventBus';
import { TweenCameraToOperation } from '../interaction/TweenCameraToOperation';
import { AuxFile3D } from '../scene/AuxFile3D';
import { default as CameraTypeVue } from '../../shared/vue-components/CameraType/CameraType';
import CameraHome from '../../shared/vue-components/CameraHome/CameraHome';

export interface SidebarItem {
    id: string;
    group: string;
    text: string;
    icon: string;
    click: () => void;
}

@Component({
    components: {
        'camera-type': CameraTypeVue,
        'camera-home': CameraHome,
    },
})
export default class BaseGameView extends Vue implements IGameView {
    protected mainScene: Scene;
    protected renderer: WebGLRenderer;
    protected time: Time;
    protected input: Input;
    protected inputVR: InputVR;
    protected interaction: BaseInteractionManager;
    protected gridChecker: GridChecker;
    protected htmlMixerContext: HtmlMixer.Context;
    protected decoratorFactory: AuxFile3DDecoratorFactory;
    protected subs: SubscriptionLike[];

    mainCameraRig: CameraRig = null;
    mainViewport: Viewport = null;

    xrCapable: boolean = false;
    xrDisplay: any = null;
    xrSession: any = null;
    xrSessionInitParameters: any = null;
    vrDisplay: VRDisplay = null;
    vrCapable: boolean = false;

    protected currentCameraType: CameraType;
    protected enterVr: any;
    protected vrControls: any;
    protected vrEffect: any;

    onFileAdded: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    onFileUpdated: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    onFileRemoved: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    onCameraRigTypeChanged: ArgEvent<CameraRig> = new ArgEvent<CameraRig>();

    abstract get filesMode(): boolean;
    abstract get workspacesMode(): boolean;

    abstract getBackground(): Color | Texture;
    abstract getSimulations(): Simulation3D[];
    abstract getCameraRigs(): CameraRig[];
    abstract getViewports(): Viewport[];
    abstract getUIHtmlElements(): HTMLElement[];

    abstract setGridsVisible(visible: boolean): void;
    abstract setWorldGridVisible(visible: boolean): void;

    abstract setupInteraction(): BaseInteractionManager;
    abstract findFilesById(id: string): AuxFile3D[] {
        throw new Error('[BaseGameView] Method not implemented.');
    }

    /**
     * Adds a new sidebar item to the sidebar.
     * @param id
     * @param text
     * @param click
     */
    abstract baseAddSidebarItem(
        id: string,
        text: string,
        click: () => void,
        icon?: string,
        group?: string
    ): void;

    /**
     * Removes the sidebar item with the given ID.
     * @param id
     */
    abstract baseRemoveSidebarItem(id: string): void;

    /**
     * Removes all the sidebar items with the given group.
     * @param id
     */
    abstract baseRemoveSidebarGroup(group: string): void;

    @Provide() fileRenderer: FileRenderer = new FileRenderer();

    get gameView(): HTMLElement {
        return <HTMLElement>this.$refs.gameView;
    }

    get container(): HTMLElement {
        return <HTMLElement>this.$refs.container;
    }

    get dev(): boolean {
        return !PRODUCTION;
    }

    getTime() {
        return this.time;
    }
    getInput() {
        return this.input;
    }
    getInputVR() {
        return this.inputVR;
    }
    getInteraction() {
        return this.interaction;
    }
    getScene() {
        return this.mainScene;
    }
    getRenderer() {
        return this.renderer;
    }
    getMainCameraRig(): CameraRig {
        return this.mainCameraRig;
    }
    getMainViewport(): Viewport {
        return this.mainViewport;
    }
    getHtmlMixerContext(): HtmlMixer.Context {
        return this.htmlMixerContext;
    }
    getDecoratorFactory(): AuxFile3DDecoratorFactory {
        return this.decoratorFactory;
    }
    getGridChecker(): GridChecker {
        return this.gridChecker;
    }

    async mounted() {
        console.log('[BaseGameView] mounted start');
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('vrdisplaypresentchange', this.handleResize);

        this.onFileAdded.invoke = this.onFileAdded.invoke.bind(
            this.onFileAdded
        );
        this.onFileRemoved.invoke = this.onFileRemoved.invoke.bind(
            this.onFileRemoved
        );
        this.onFileUpdated.invoke = this.onFileUpdated.invoke.bind(
            this.onFileUpdated
        );

        this.time = new Time();
        this.decoratorFactory = new AuxFile3DDecoratorFactory(this);
        this.subs = [];
        this.setupRenderer();
        this.setupScenes();
        DebugObjectManager.init(this.time, this.mainScene);
        this.input = new Input(this);
        this.inputVR = new InputVR(this);
        this.interaction = this.setupInteraction();

        this.setupWebVR();
        await this.setupWebXR();
        this.handleResize();

        EventBus.$on('centerCamera', this.onCenterCamera);
        EventBus.$on('changeCameraType', this.setCameraType);

        await this.onBeforeMountedComplete();

        this.frameUpdate();
        console.log('[BaseGameView] mounted end');
    }

    protected async onBeforeMountedComplete() {}

    beforeDestroy() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('vrdisplaypresentchange', this.handleResize);
        this.baseRemoveSidebarItem('enable_xr');
        this.baseRemoveSidebarItem('disable_xr');
        this.input.dispose();

        if (this.subs) {
            this.subs.forEach(sub => {
                sub.unsubscribe();
            });
            this.subs = [];
        }

        EventBus.$off('centerCamera', this.onCenterCamera);
        EventBus.$off('changeCameraType', this.setCameraType);

        this.onBeforeDestroyComplete();
    }

    protected onBeforeDestroyComplete() {}

    setCameraType(type: CameraType) {
        if (this.currentCameraType === type) return;

        // Clean up current cameras if they exists.
        if (this.mainCameraRig) {
            this.mainScene.remove(this.mainCameraRig.mainCamera);
            this.mainCameraRig = null;
        }

        this.currentCameraType = type;

        this.mainCameraRig = createCameraRig(
            'main',
            this.currentCameraType,
            this.mainScene,
            this.mainViewport
        );

        // Update side bar item.
        this.baseRemoveSidebarItem('toggle_camera_type');
        if (this.currentCameraType === 'orthographic') {
            this.baseAddSidebarItem(
                'toggle_camera_type',
                'Enable Perspective Camera',
                () => {
                    this.setCameraType('perspective');
                },
                'videocam'
            );
        } else {
            this.baseAddSidebarItem(
                'toggle_camera_type',
                'Disable Perspective Camera',
                () => {
                    this.setCameraType('orthographic');
                },
                'videocam_off'
            );
        }

        if (this.htmlMixerContext) {
            this.htmlMixerContext.setupCssCamera(this.mainCameraRig.mainCamera);
        }

        this.onCameraRigTypeChanged.invoke(this.mainCameraRig);
    }

    onCenterCamera(cameraRig: CameraRig): void {
        if (!cameraRig) return;
        this.tweenCameraToPosition(cameraRig, new Vector3(0, 0, 0));
    }

    tweenCameraToFile(
        cameraRig: CameraRig,
        fileId: string,
        zoomValue?: number
    ) {
        console.log('[BaseGameView] Tween to file: ', fileId);

        // find the file with the given ID
        const files = this.findFilesById(fileId);
        if (files.length > 0) {
            const file = files[0];
            const targetPosition = new Vector3();
            file.display.getWorldPosition(targetPosition);

            this.tweenCameraToPosition(cameraRig, targetPosition, zoomValue);
        }
    }

    tweenCameraToPosition(
        cameraRig: CameraRig,
        position: Vector3,
        zoomValue?: number
    ) {
        this.interaction.addOperation(
            new TweenCameraToOperation(
                cameraRig,
                this.interaction,
                position,
                zoomValue
            )
        );
    }

    protected isMac(): boolean {
        return /(Mac)/i.test(navigator.platform);
    }

    protected mainSceneBackgroundUpdate() {
        const background = this.getBackground();
        if (background) {
            this.mainScene.background = background;
        } else {
            this.mainScene.background = new Color(
                DEFAULT_SCENE_BACKGROUND_COLOR
            );
        }
    }

    protected setupRenderer() {
        const webGlRenderer = (this.renderer = new WebGLRenderer({
            antialias: true,
            alpha: true,
        }));
        webGlRenderer.autoClear = false;
        webGlRenderer.shadowMap.enabled = false;

        this.mainViewport = new Viewport('main', null, this.container);
        this.mainViewport.layer = 0;

        this.gameView.appendChild(this.renderer.domElement);
    }

    protected setupScenes() {
        //
        // [Main scene]
        //
        this.mainScene = new Scene();

        // Main scene camera.
        this.setCameraType('orthographic');

        // Main scene ambient light.
        const ambient = baseAuxAmbientLight();
        this.mainScene.add(ambient);

        // Main scene directional light.
        const directional = baseAuxDirectionalLight();
        this.mainScene.add(directional);

        //
        // [Html Mixer Context]
        //
        this.htmlMixerContext = createHtmlMixerContext(
            this.renderer,
            this.mainCameraRig.mainCamera,
            this.gameView
        );
    }

    protected setupWebVR() {
        let onBeforeEnter = () => {
            console.log('[BaseGameView] vr on before enter');

            this.renderer.vr.enabled = true;

            // VR controls
            this.vrControls = new VRControlsModule(
                this.mainCameraRig.mainCamera
            );
            this.vrControls.standing = true;

            // Create VR Effect rendering in stereoscopic mode
            this.vrEffect = new VREffectModule(this.renderer);
            this.renderer.setPixelRatio(window.devicePixelRatio);

            return new Promise(resolve => {
                resolve(null);
            });
        };

        this.vrDisplay = null;

        // WebVR enable button.
        let vrButtonOptions = {
            color: 'black',
            beforeEnter: onBeforeEnter,
        };

        this.enterVr = new webvrui.EnterVRButton(
            this.renderer.domElement,
            vrButtonOptions
        );

        // Event handlers for the vr button.
        this.handleReadyVR = this.handleReadyVR.bind(this);
        this.handleEnterVR = this.handleEnterVR.bind(this);
        this.handleExitVR = this.handleExitVR.bind(this);
        this.handleErrorVR = this.handleErrorVR.bind(this);

        this.enterVr.on('ready', this.handleReadyVR);
        this.enterVr.on('enter', this.handleEnterVR);
        this.enterVr.on('exit', this.handleExitVR);
        this.enterVr.on('error', this.handleErrorVR);

        let vrButtonContainer = document.getElementById('vr-button-container');
        vrButtonContainer.appendChild(this.enterVr.domElement);
    }

    // TODO: All this needs to be reworked to use the right WebXR polyfill
    // - Use this one: https://github.com/immersive-web/webxr-polyfill
    // - instead of this one: https://github.com/mozilla/webxr-polyfill
    protected async setupWebXR() {
        const win = <any>window;
        const navigator = <any>win.navigator;
        const xr = navigator.XR;

        if (typeof xr === 'undefined') {
            console.log('[BaseGameView] WebXR Not Supported.');
            return;
        }

        const displays = await xr.getDisplays();
        this.xrSessionInitParameters = {
            exclusive: false,
            type: win.XRSession.AUGMENTATION,
            videoFrames: false, //computer_vision_data
            alignEUS: true,
            worldSensing: false,
        };
        const matchingDisplay = find(displays, d =>
            d.supportsSession(this.xrSessionInitParameters)
        );
        if (matchingDisplay && this.isRealAR(matchingDisplay)) {
            this.xrCapable = true;
            this.xrDisplay = matchingDisplay;
            this.baseAddSidebarItem('enable_xr', 'Enable AR', () => {
                this.toggleXR();
            });
            console.log('[BaseGameView] WebXR Supported!');
        }
    }

    protected frameUpdate(xrFrame?: any) {
        console.log('[BaseGameView] frameUpdate start');
        DebugObjectManager.update();

        this.input.update();
        this.inputVR.update();
        this.interaction.update();

        const simulations = this.getSimulations();
        if (simulations) {
            for (let i = 0; i < simulations.length; i++) {
                simulations[i].frameUpdate();
            }
        }

        if (this.htmlMixerContext) {
            this.htmlMixerContext.update();
        }

        this.cameraUpdate();
        this.renderUpdate(xrFrame);
        this.time.update();

        if (this.vrDisplay && this.vrDisplay.isPresenting) {
            this.vrDisplay.requestAnimationFrame(() => this.frameUpdate());
        } else if (this.xrSession) {
            this.xrSession.requestFrame((nextXRFrame: any) =>
                this.frameUpdate(nextXRFrame)
            );
        } else {
            requestAnimationFrame(() => this.frameUpdate());
        }
        console.log('[BaseGameView] frameUpdate end');
    }

    protected cameraUpdate() {
        // Keep camera zoom levels in sync.
        let cameraRigs = this.getCameraRigs();
        if (cameraRigs) {
            for (let i = 0; i < cameraRigs.length; i++) {
                const rig = cameraRigs[i];
                if (rig.uiWorldCamera.zoom !== rig.mainCamera.zoom) {
                    rig.uiWorldCamera.zoom = rig.mainCamera.zoom;
                    rig.uiWorldCamera.updateProjectionMatrix();
                }
            }
        }
    }

    protected renderUpdate(xrFrame?: any) {
        console.log('[BaseGameView] renderUpdate start');
        if (this.vrDisplay && this.vrDisplay.isPresenting) {
            this.vrControls.update();
            this.renderCore();
            this.vrEffect.render(this.mainScene, this.mainCameraRig.mainCamera);
        } else if (this.xrSession && xrFrame) {
            this.mainScene.background = null;
            this.renderer.setSize(
                this.xrSession.baseLayer.framebufferWidth,
                this.xrSession.baseLayer.framebufferHeight,
                false
            );
            this.renderer.setClearColor('#000', 0);

            this.mainCameraRig.mainCamera.matrixAutoUpdate = false;

            for (const view of xrFrame.views) {
                // Each XRView has its own projection matrix, so set the main camera to use that
                let matrix = new Matrix4();
                matrix.fromArray(view.viewMatrix);

                let position = new Vector3();
                position.setFromMatrixPosition(matrix);
                position.multiplyScalar(10);

                // Move the player up about a foot above the world.
                position.add(new Vector3(0, 2, 3));
                this.mainCameraRig.mainCamera.position.copy(position);

                let rotation = new Quaternion();
                rotation.setFromRotationMatrix(matrix);
                this.mainCameraRig.mainCamera.setRotationFromQuaternion(
                    rotation
                );

                this.mainCameraRig.mainCamera.updateMatrix();
                this.mainCameraRig.mainCamera.updateMatrixWorld(false);

                this.mainCameraRig.mainCamera.projectionMatrix.fromArray(
                    view.projectionMatrix
                );

                // Set up the _renderer to the XRView's viewport and then render
                const viewport = view.getViewport(this.xrSession.baseLayer);
                this.renderer.setViewport(
                    viewport.x,
                    viewport.y,
                    viewport.width,
                    viewport.height
                );

                this.renderCore();
            }
        } else {
            this.mainCameraRig.mainCamera.matrixAutoUpdate = true;
            this.renderCore();
        }
        console.log('[BaseGameView] renderUpdate end');
    }

    protected renderCore(): void {
        //
        // [Main scene]
        //

        this.renderer.setSize(
            this.mainViewport.width,
            this.mainViewport.height
        );

        this.renderer.setScissorTest(false);

        // Render the main scene with the main camera.
        this.renderer.clear();
        this.renderer.render(this.mainScene, this.mainCameraRig.mainCamera);

        // Set the background color to null when rendering with the ui world camera.
        this.mainScene.background = null;

        // Render the main scene with the ui world camera.
        this.renderer.clearDepth(); // Clear depth buffer so that ui world appears above objects that were just rendererd.
        this.renderer.render(this.mainScene, this.mainCameraRig.uiWorldCamera);

        this.mainSceneBackgroundUpdate();
    }

    protected calculateContainerSize() {
        const width = window.innerWidth;
        const height =
            window.innerHeight - this.container.getBoundingClientRect().top;

        return { width, height };
    }

    protected async toggleXR() {
        console.log('[BaseGameView] Toggle XR');
        if (this.xrDisplay) {
            if (this.xrSession) {
                this.baseRemoveSidebarItem('disable_xr');
                this.baseAddSidebarItem('enable_xr', 'Enable AR', () => {
                    this.toggleXR();
                });

                await this.xrSession.end();
                this.xrSession = null;
                document.documentElement.classList.remove('ar-app');
            } else {
                this.baseRemoveSidebarItem('enable_xr');
                this.baseAddSidebarItem('disable_xr', 'Disable AR', () => {
                    this.toggleXR();
                });

                document.documentElement.classList.add('ar-app');
                this.xrSession = await this.xrDisplay.requestSession(
                    this.xrSessionInitParameters
                );
                this.xrSession.near = 0.1;
                this.xrSession.far = 1000;

                this.xrSession.addEventListener('focus', (ev: any) =>
                    this.handleXRSessionFocus()
                );
                this.xrSession.addEventListener('blur', (ev: any) =>
                    this.handleXRSessionBlur()
                );
                this.xrSession.addEventListener('end', (ev: any) =>
                    this.handleXRSessionEnded()
                );

                this.startXR();

                setTimeout(() => {
                    this.handleResize();
                }, 1000);
            }
        }
    }

    protected startXR() {
        const win = <any>window;
        if (this.xrSession === null) {
            throw new Error('Cannot start presenting without a xrSession');
        }

        // Set the xrSession's base layer into which the app will render
        this.xrSession.baseLayer = new win.XRWebGLLayer(
            this.xrSession,
            this.renderer.context
        );

        // Handle layer focus events
        this.xrSession.baseLayer.addEventListener('focus', (ev: any) => {
            this.handleXRLayerFocus();
        });
        this.xrSession.baseLayer.addEventListener('blur', (ev: any) => {
            this.handleXRLayerBlur();
        });

        // this.xrSession.requestFrame(this._boundHandleFrame)
    }

    protected handleXRSessionFocus() {}

    protected handleXRSessionBlur() {}

    protected handleXRSessionEnded() {}

    protected handleXRLayerFocus() {}

    protected handleXRLayerBlur() {}

    protected isRealAR(xrDisplay: any): boolean {
        // The worst hack of all time.
        // Basically does the check that the webxr polyfill does
        // to see it the device really supports Web XR.
        return (
            typeof (<any>window).webkit !== 'undefined' ||
            xrDisplay._reality._vrDisplay
        );
    }

    protected handleReadyVR(display: VRDisplay) {
        console.log('[BaseGameView] vr display is ready.');
        console.log(display);
        this.vrDisplay = display;

        // When being used on a vr headset, force the normal input module to use touch instead of mouse.
        // Touch seems to work better for 2d browsers on vr headsets (like the Oculus Go).
        this.input.currentInputType = InputType.Touch;
    }

    protected handleEnterVR(display: any) {
        console.log('[BaseGameView] enter vr.');
        console.log(display);
        this.vrDisplay = display;
    }

    protected handleExitVR(display: any) {
        console.log('[BaseGameView] exit vr.');
        console.log(display);

        this.renderer.vr.enabled = false;

        this.inputVR.disconnectControllers();

        this.vrControls.dispose();
        this.vrControls = null;

        this.vrEffect.dispose();
        this.vrEffect = null;

        // reset camera back to default position.
        this.mainCameraRig.mainCamera.position.z = 5;
        this.mainCameraRig.mainCamera.position.y = 3;
        this.mainCameraRig.mainCamera.rotation.x = ThreeMath.degToRad(-30);
        this.mainCameraRig.mainCamera.updateMatrixWorld(false);
    }

    protected handleErrorVR() {
        // console.error('error vr');
        // console.error(error);
    }

    protected handleResize() {
        const { width, height } = this.calculateContainerSize();

        this.mainViewport.setSize(width, height);

        // Resize html view and the webgl renderer.
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.setSize(width, height);
        this.container.style.height = this.gameView.style.height = this.renderer.domElement.style.height;
        this.container.style.width = this.gameView.style.width = this.renderer.domElement.style.width;

        // Resize html mixer css3d renderer.
        if (this.htmlMixerContext) {
            this.htmlMixerContext.rendererCss.setSize(width, height);
        }

        // Resize cameras.
        if (this.mainCameraRig) {
            resizeCameraRig(this.mainCameraRig);
        }

        // Resize VR effect.
        if (this.vrEffect) {
            const vrWidth = window.innerWidth;
            const vrHeight = window.innerHeight;
            this.vrEffect.setSize(vrWidth, vrHeight);
        }
    }
}
