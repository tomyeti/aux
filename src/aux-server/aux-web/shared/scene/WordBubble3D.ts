import {
    Math as ThreeMath,
    Mesh,
    Object3D,
    DoubleSide,
    Color,
    Vector3,
    Vector2,
    Box2,
    Shape,
    MeshBasicMaterial,
    ShapeBufferGeometry,
} from 'three';
import { merge } from '@casual-simulation/aux-common/utils';
import { setLayerMask } from './SceneUtils';

export class WordBubble3D extends Object3D {
    private _shapeGeometry: ShapeBufferGeometry;
    private _shapeMeshMaterial: MeshBasicMaterial;
    private _shapeMesh: Mesh;

    private _options: WordBubbleOptions;

    constructor(opt?: WordBubbleOptions) {
        super();

        // Default options.
        this._options = {
            paddingWidth: 0.02,
            paddingHeight: 0.02,
            color: new Color(1, 1, 1),
        };

        if (opt) {
            // Merge values of provied options into internal options.
            this._options = merge(this._options, opt);
        }

        // Material for word bubble.
        this._shapeMeshMaterial = new MeshBasicMaterial({
            side: DoubleSide,
            color: this._options.color,
        });
    }

    /**
     * Update the world bubble so that it encapsulates the provided Box2.
     * @param box The world space box to encapsulate inside the word bubble.
     * @param arrowPoint The world position that the arrow should point at.
     */
    public update(box: Box2, arrowPoint: Vector3): void {
        this.regenerateMesh(box, arrowPoint);
    }

    public regenerateMesh(box: Box2, arrowPoint: Vector3) {
        let boxWithPadding = box.clone();
        boxWithPadding.expandByVector(
            new Vector2(this._options.paddingWidth, this._options.paddingHeight)
        );

        // Get local space conversion of min, max, and arrowPoint.
        const arrowPointLocal = this.worldToLocal(arrowPoint.clone());
        const minLocal = this.worldToLocal(
            new Vector3(
                boxWithPadding.min.x,
                boxWithPadding.min.y,
                arrowPointLocal.z
            )
        );
        const maxLocal = this.worldToLocal(
            new Vector3(
                boxWithPadding.max.x,
                boxWithPadding.max.y,
                arrowPointLocal.z
            )
        );

        // Clamp arrow width to the size of the box if the box is smaller than the defualt arrow width.
        const arrowWidthPct = 0.3;
        const boxWidth = maxLocal.x - minLocal.x;
        const arrowWidth = boxWidth * arrowWidthPct;

        // Generate base word bubble mesh.
        let shape = new Shape();

        // Sharp corners.
        shape.moveTo(arrowPointLocal.x, arrowPointLocal.y);
        shape.lineTo(-arrowWidth / 2 + arrowPointLocal.x, minLocal.y);
        shape.lineTo(minLocal.x, minLocal.y);
        shape.lineTo(minLocal.x, maxLocal.y);
        shape.lineTo(maxLocal.x, maxLocal.y);
        shape.lineTo(maxLocal.x, minLocal.y);
        shape.lineTo(arrowWidth / 2 + arrowPointLocal.x, minLocal.y);

        // let points: Vector2[] = shape.getPoints();
        // points.forEach((p, i) => {
        //     let p3d = new Vector3(p.x, p.y, 0);
        //     let step = 1 / points.length;
        //     let cval = step * i;
        //     let color = new Color(1, cval, 0);
        //     DebugObjectManager.debugPoint(p3d, this, 0.05, false, color);
        // });

        // Dispose of old geometry.
        if (this._shapeGeometry) {
            this._shapeGeometry.dispose();
        }
        this._shapeGeometry = new ShapeBufferGeometry(shape, 12);

        // Only create mesh if it doesnt exist. Otherwise just update geometry.
        if (!this._shapeMesh) {
            this._shapeMesh = new Mesh(
                this._shapeGeometry,
                this._shapeMeshMaterial
            );
            setLayerMask(this._shapeMesh, this.layers.mask, true);
            this.add(this._shapeMesh);
        } else {
            this._shapeMesh.geometry = this._shapeGeometry;
        }

        // Nudge the shape mesh back so that meshes that we encapsulated can render 'on top'.
        this._shapeMesh.position.set(0, 0, arrowPointLocal.z - 0.01);

        this.updateMatrixWorld(true);
    }

    dispose(): void {}
}

interface WordBubbleOptions {
    /**
     * How much extra padding should there be inside the bubble's height?
     */
    paddingHeight?: number;

    /**
     * How much extra padding should there be inside the bubble's width?
     */
    paddingWidth?: number;

    /**
     * Color of the bubble.
     */
    color?: Color;
}
