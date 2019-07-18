import {
    AuxCausalTree,
    AuxObject,
    FileEvent,
    LocalEvent,
    fileAdded,
    createFile,
    fileUpdated,
    GLOBALS_FILE_ID,
    LocalEvents,
    action,
    toast,
    DEFAULT_USER_MODE,
    Sandbox,
    remote,
    RemoteEvent,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from './test/TestAuxVM';
import { AuxHelper } from './AuxHelper';
import { storedTree, site } from '@casual-simulation/causal-trees';

describe('AuxHelper', () => {
    let userId: string = 'user';
    let tree: AuxCausalTree;
    let vm: TestAuxVM;
    let helper: AuxHelper;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new AuxHelper(tree);
        helper.userId = userId;

        await tree.root();
        await tree.file('user');
    });

    it('should use the given sandbox factory', () => {
        const sandbox: Sandbox = {
            library: null,
            interface: null,
            run: null,
        };
        helper = new AuxHelper(tree, undefined, lib => sandbox);
        helper.userId = userId;

        const context = helper.createContext();
        expect(context.sandbox).toBe(sandbox);
    });

    describe('userFile', () => {
        it('should return the file that has the same ID as the user ID', async () => {
            const file = tree.value['user'];
            const user = helper.userFile;

            expect(user).toBe(file);
        });
    });

    describe('globalsFile', () => {
        it('should return the file with the globals ID', async () => {
            await tree.file(GLOBALS_FILE_ID);

            const file = tree.value[GLOBALS_FILE_ID];
            const globals = helper.globalsFile;

            expect(globals).toBe(file);
        });
    });

    describe('objects', () => {
        it('should return active objects', async () => {
            const { added: file1 } = await tree.file('test1');

            const { added: file2 } = await tree.file('test2');
            const { added: tag } = await tree.tag('aux._destroyed', file2);
            const { added: val } = await tree.val(true, tag);

            const objs = helper.objects;

            expect(objs).toEqual([
                tree.value['test2'],
                tree.value['test1'],
                helper.userFile,
            ]);
        });
    });

    describe('createContext()', () => {
        it('should define a library variable when in aux builder', () => {
            helper = new AuxHelper(tree, {
                isBuilder: true,
                isPlayer: false,
            });
            helper.userId = userId;

            const context = helper.createContext();

            expect(context.sandbox.library.isDesigner).toBe(true);
            expect(context.sandbox.library.isPlayer).toBe(false);
        });

        it('should define a library variable when in aux player', () => {
            helper = new AuxHelper(tree, {
                isBuilder: false,
                isPlayer: true,
            });
            helper.userId = userId;

            const context = helper.createContext();

            expect(context.sandbox.library.isDesigner).toBe(false);
            expect(context.sandbox.library.isPlayer).toBe(true);
        });

        it('should default to not in aux builder or player', () => {
            helper = new AuxHelper(tree, {
                isBuilder: false,
                isPlayer: false,
            });
            helper.userId = userId;

            const context = helper.createContext();

            expect(context.sandbox.library.isDesigner).toBe(false);
            expect(context.sandbox.library.isPlayer).toBe(false);
        });
    });

    describe('transaction()', () => {
        it('should emit local events that are sent via transaction()', async () => {
            let events: LocalEvents[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.transaction(toast('test'));

            expect(events).toEqual([toast('test')]);
        });

        it('should run action events', async () => {
            await helper.createFile('test', {
                'action()': 'setTag(this, "#hit", true)',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(helper.filesState['test'].tags.hit).toBe(true);
        });

        it('should emit local events from actions', async () => {
            let events: LocalEvents[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.createFile('test', {
                'action()': 'player.toast("test")',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(events).toEqual([toast('test')]);
        });

        it('should calculate assignment formulas', async () => {
            let events: LocalEvents[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.createFile('test', {});

            await helper.transaction(
                fileUpdated('test', {
                    tags: {
                        test: ':="abc"',
                    },
                })
            );

            expect(helper.filesState['test']).toMatchObject({
                id: 'test',
                tags: {
                    test: {
                        _assignment: true,
                        editing: true,
                        formula: ':="abc"',
                        value: 'abc',
                    },
                },
            });
        });

        it('should emit remote events that are sent via transaction()', async () => {
            let events: RemoteEvent[] = [];
            helper.remoteEvents.subscribe(e => events.push(...e));

            await helper.transaction(remote(toast('test')));

            expect(events).toEqual([remote(toast('test'))]);
        });
    });

    describe('createOrUpdateUserFile()', () => {
        it('should create a file for the user', async () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            helper = new AuxHelper(tree);
            helper.userId = userId;

            await tree.root();
            await helper.createOrUpdateUserFile(
                {
                    id: 'testUser',
                    username: 'username',
                    name: 'test',
                    isGuest: false,
                    token: 'abc',
                },
                null
            );

            expect(helper.filesState['testUser']).toMatchObject({
                id: 'testUser',
                tags: {
                    ['_user_username_1']: true,
                    ['aux.context']: '_user_username_1',
                    ['aux.context.visualize']: true,
                    ['aux._user']: 'username',
                    ['aux._userInventoryContext']: '_user_username_inventory',
                    ['aux._userMenuContext']: '_user_username_menu',
                    ['aux._userSimulationsContext']:
                        '_user_username_simulations',
                    'aux._mode': DEFAULT_USER_MODE,
                },
            });
        });

        const contextCases = [
            ['menu context', 'aux._userMenuContext', '_user_username_menu'],
            [
                'inventory context',
                'aux._userInventoryContext',
                '_user_username_inventory',
            ],
            [
                'simulations context',
                'aux._userSimulationsContext',
                '_user_username_simulations',
            ],
        ];

        it.each(contextCases)(
            'should add the %s to a user that doesnt have it',
            async (desc, tag, value) => {
                await helper.createOrUpdateUserFile(
                    {
                        id: 'user',
                        username: 'username',
                        name: 'test',
                        isGuest: false,
                        token: 'abc',
                    },
                    null
                );

                expect(helper.userFile).toMatchObject({
                    id: 'user',
                    tags: {
                        [tag]: value,
                    },
                });
            }
        );
    });
});
