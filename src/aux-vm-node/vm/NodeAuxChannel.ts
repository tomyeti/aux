import {
    AuxCausalTree,
    RemoteEvent,
    LocalEvents,
} from '@casual-simulation/aux-common';
import {
    LocalRealtimeCausalTree,
    RealtimeCausalTree,
    ADMIN_ROLE,
} from '@casual-simulation/causal-trees';
import {
    AuxConfig,
    // AuxChannel
    BaseAuxChannel,
    AuxUser,
} from '@casual-simulation/aux-vm';
import { AuxHelper } from '@casual-simulation/aux-vm/vm';
import { VM2Sandbox } from './VM2Sandbox';

export class NodeAuxChannel extends BaseAuxChannel {
    private _tree: AuxCausalTree;

    constructor(tree: AuxCausalTree, user: AuxUser, config: AuxConfig) {
        super(user, config);
        this._tree = tree;
    }

    async setGrant(grant: string): Promise<void> {}

    protected async _sendRemoteEvents(events: RemoteEvent[]): Promise<void> {}

    protected async _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        return new LocalRealtimeCausalTree<AuxCausalTree>(this._tree);
    }

    protected _createAuxHelper() {
        const helper = new AuxHelper(
            this._aux.tree,
            this._config.config,
            lib => new VM2Sandbox(lib)
        );
        helper.userId = this.user ? this.user.id : null;

        this._subs.push(
            helper.localEvents.subscribe(e => this._processLocalEvents(e))
        );
        return helper;
    }

    protected async _createGlobalsFile() {
        await super._createGlobalsFile();

        if (this._config.id === 'aux-admin') {
            const globals = this.helper.globalsFile;

            await this.helper.updateFile(globals, {
                tags: {
                    'aux.whitelist.roles': [ADMIN_ROLE],
                },
            });
        }
    }

    private _processLocalEvents(events: LocalEvents[]) {
        for (let event of events) {
            if (event.name === 'say_hello') {
                console.log(`User ${event.user} says "Hello!"`);
            }
        }
    }
}
