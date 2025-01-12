import { AuxBot3DDecorator } from '../AuxBot3DDecorator';
import { hasValue } from '@casual-simulation/aux-common';
import { ScaleDecorator } from './ScaleDecorator';
import { ContextPositionDecorator } from './ContextPositionDecorator';
import { BotShapeDecorator } from './BotShapeDecorator';
import { ProgressBarDecorator } from './ProgressBarDecorator';
import { LabelDecorator } from './LabelDecorator';
import { UserMeshDecorator } from './UserMeshDecorator';
import { AuxBot3D } from '../AuxBot3D';
import { LineToDecorator } from './LineToDecorator';
import { WordBubbleDecorator } from './WordBubbleDecorator';
import { appManager } from '../../../shared/AppManager';
import { UserControlsDecorator } from './UserControlsDecorator';
import { TextureDecorator } from './TextureDecorator';
import { IFramePlaneDecorator } from './IFramePlaneDecorator';
import { UpdateMaxtrixDecorator } from './UpdateMatrixDecorator';
import { Simulation3D } from '../Simulation3D';
import { Game } from '../Game';

export class AuxBot3DDecoratorFactory {
    public game: Game;
    public simulation: Simulation3D;

    constructor(game?: Game, simulation?: Simulation3D) {
        this.game = game;
        this.simulation = simulation;
    }

    loadDecorators(bot3d: AuxBot3D): AuxBot3DDecorator[] {
        let decorators: AuxBot3DDecorator[] = [];
        const isUser = !!bot3d.bot && hasValue(bot3d.bot.tags['aux._user']);
        const isLocalUser = isUser && bot3d.bot.id === appManager.user.id;

        if (isUser) {
            if (isLocalUser) {
                // Local user gets controls for changing their user position in contexts.
                decorators.push(new UserControlsDecorator(bot3d, this.game));
            } else {
                // Remote user gets mesh to visualize where it is in contexts.
                decorators.push(new UserMeshDecorator(bot3d));
            }
        } else {
            let botShapeDecorator = new BotShapeDecorator(bot3d);
            let textureDecorator = new TextureDecorator(
                bot3d,
                botShapeDecorator
            );

            let progressBarDecorator = new ProgressBarDecorator(
                bot3d,
                botShapeDecorator
            );

            decorators.push(
                botShapeDecorator,
                textureDecorator,
                progressBarDecorator
            );
        }

        decorators.push(
            new ScaleDecorator(bot3d),
            new ContextPositionDecorator(bot3d, { lerp: isUser })
        );

        if (!!this.game) {
            let labelDecorator = new LabelDecorator(bot3d, this.game);
            let wordBubbleDecorator = new WordBubbleDecorator(
                bot3d,
                labelDecorator
            );

            decorators.push(
                new UpdateMaxtrixDecorator(bot3d),
                labelDecorator,
                wordBubbleDecorator,
                new LineToDecorator(bot3d, this.simulation),
                new IFramePlaneDecorator(bot3d, this.game)
            );
        }

        return decorators;
    }
}
