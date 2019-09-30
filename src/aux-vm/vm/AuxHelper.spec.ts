import {
    AuxCausalTree,
    AuxObject,
    BotAction,
    botAdded,
    createBot,
    botUpdated,
    GLOBALS_BOT_ID,
    LocalActions,
    action,
    toast,
    DEFAULT_USER_MODE,
    Sandbox,
    addState,
    updateBot,
    botRemoved,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from './test/TestAuxVM';
import { AuxHelper } from './AuxHelper';
import {
    storedTree,
    site,
    USERNAME_CLAIM,
    DeviceAction,
    RemoteAction,
    remote,
} from '@casual-simulation/causal-trees';
import uuid from 'uuid/v4';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

console.log = jest.fn();
console.error = jest.fn();

describe('AuxHelper', () => {
    let userId: string = 'user';
    let tree: AuxCausalTree;
    let vm: TestAuxVM;
    let helper: AuxHelper;

    beforeEach(async () => {
        uuidMock.mockReset();
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new AuxHelper(tree);
        helper.userId = userId;

        await tree.root();
        await tree.bot('user');
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

    describe('userBot', () => {
        it('should return the bot that has the same ID as the user ID', async () => {
            const bot = tree.value['user'];
            const user = helper.userBot;

            expect(user).toBe(bot);
        });
    });

    describe('globalsBot', () => {
        it('should return the bot with the globals ID', async () => {
            await tree.bot(GLOBALS_BOT_ID);

            const bot = tree.value[GLOBALS_BOT_ID];
            const globals = helper.globalsBot;

            expect(globals).toBe(bot);
        });
    });

    describe('objects', () => {
        it('should return active objects', async () => {
            const { added: bot1 } = await tree.bot('test1');

            const { added: bot2 } = await tree.bot('test2');
            const { added: tag } = await tree.tag('aux._destroyed', bot2);
            const { added: val } = await tree.val(true, tag);

            const objs = helper.objects;

            expect(objs).toEqual([
                tree.value['test2'],
                tree.value['test1'],
                helper.userBot,
            ]);
        });
    });

    describe('createContext()', () => {
        describe('player.inDesigner()', () => {
            it('should return true when in builder', () => {
                helper = new AuxHelper(tree, {
                    isBuilder: true,
                    isPlayer: false,
                });
                helper.userId = userId;

                const context = helper.createContext();

                expect(context.sandbox.library.player.inDesigner()).toBe(true);
            });

            it('should return false when not in builder', () => {
                helper = new AuxHelper(tree, {
                    isBuilder: false,
                    isPlayer: true,
                });
                helper.userId = userId;

                const context = helper.createContext();

                expect(context.sandbox.library.player.inDesigner()).toBe(false);
            });

            it('should default to not in aux builder or player', () => {
                helper = new AuxHelper(tree);
                helper.userId = userId;

                const context = helper.createContext();

                expect(context.sandbox.library.player.inDesigner()).toBe(false);
            });
        });
    });

    describe('transaction()', () => {
        it('should emit local events that are sent via transaction()', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.transaction(toast('test'));

            expect(events).toEqual([toast('test')]);
        });

        it('should run action events', async () => {
            await helper.createBot('test', {
                'action()': 'setTag(this, "#hit", true)',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(helper.botsState['test'].tags.hit).toBe(true);
        });

        it('should support player.inDesigner() in actions', async () => {
            helper = new AuxHelper(tree, {
                isBuilder: true,
                isPlayer: true,
            });
            helper.userId = userId;

            await helper.createBot('test', {
                'action()': 'setTag(this, "#value", player.inDesigner())',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(helper.botsState['test'].tags.value).toBe(true);
        });

        it('should emit local events from actions', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.createBot('test', {
                'action()': 'player.toast("test")',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(events).toEqual([toast('test')]);
        });

        it('should calculate assignment formulas', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.createBot('test', {});

            await helper.transaction(
                botUpdated('test', {
                    tags: {
                        test: ':="abc"',
                    },
                })
            );

            expect(helper.botsState['test']).toMatchObject({
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
            let events: RemoteAction[] = [];
            helper.remoteEvents.subscribe(e => events.push(...e));

            await helper.transaction(remote(toast('test')));

            expect(events).toEqual([remote(toast('test'))]);
        });

        it('should emit device events that are sent via transaction()', async () => {
            let events: DeviceAction[] = [];
            helper.deviceEvents.subscribe(e => events.push(...e));

            await helper.transaction({
                type: 'device',
                device: null,
                event: toast('test'),
            });

            expect(events).toEqual([
                {
                    type: 'device',
                    device: null,
                    event: toast('test'),
                },
            ]);
        });

        describe('paste_state', () => {
            it('should add the given bots to a new context', async () => {
                uuidMock
                    .mockReturnValueOnce('context')
                    .mockReturnValueOnce('bot1')
                    .mockReturnValueOnce('bot2');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot1: createBot('bot1', {
                        'aux.context': 'context',
                        'aux.context.visualize': 'surface',
                        'aux.context.x': 0,
                        'aux.context.y': 1,
                        'aux.context.z': 2,
                    }),
                    bot2: createBot('bot2', {
                        context: true,
                        'context.x': 0,
                        'context.y': 0,
                        test: 'abc',
                    }),
                });
            });

            it('should preserve X and Y positions if a context bot is included', async () => {
                uuidMock
                    .mockReturnValueOnce('context')
                    .mockReturnValueOnce('bot1')
                    .mockReturnValueOnce('bot2')
                    .mockReturnValueOnce('bot3');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                            old: true,
                            'old.x': 3,
                            'old.y': 2,
                            'old.z': 1,
                        }),
                        contextBot: createBot('contextBot', {
                            'aux.context': 'old',
                            'aux.context.visualize': true,
                            other: 'def',
                        }),
                    },
                    options: {
                        x: -1,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot1: createBot('bot1', {
                        'aux.context': 'context',
                        'aux.context.visualize': true,
                        'aux.context.x': -1,
                        'aux.context.y': 1,
                        'aux.context.z': 2,
                        other: 'def',
                    }),
                    bot2: createBot('bot2', {
                        context: true,
                        'context.x': 3,
                        'context.y': 2,
                        'context.z': 1,
                        test: 'abc',
                    }),
                });
            });

            it('should check the current state for contexts if they are not included in the copied state', async () => {
                uuidMock
                    .mockReturnValueOnce('context')
                    .mockReturnValueOnce('bot1')
                    .mockReturnValueOnce('bot2')
                    .mockReturnValueOnce('bot3');

                await helper.transaction(
                    addState({
                        contextBot: createBot('contextBot', {
                            'aux.context': 'old',
                            'aux.context.visualize': true,
                            other: 'def',
                        }),
                    })
                );
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                            'old.x': 3,
                            'old.y': 2,
                            'old.z': 1,
                        }),
                    },
                    options: {
                        x: -1,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.botsState).toEqual({
                    contextBot: expect.any(Object),
                    user: expect.any(Object),
                    bot1: expect.objectContaining(
                        createBot('bot1', {
                            'aux.context': 'context',
                            'aux.context.visualize': 'surface',
                            'aux.context.x': -1,
                            'aux.context.y': 1,
                            'aux.context.z': 2,
                        })
                    ),
                    bot2: expect.objectContaining(
                        createBot('bot2', {
                            context: true,
                            'context.x': 0,
                            'context.y': 0,
                            'context.sortOrder': 0,
                            test: 'abc',
                        })
                    ),
                });
            });

            it('should add the given bots the given context at the given grid position', async () => {
                uuidMock.mockReturnValueOnce('bot2');

                await helper.transaction(
                    addState({
                        contextBot: createBot('contextBot', {
                            'aux.context': 'old',
                            'aux.context.visualize': true,
                            other: 'def',
                        }),
                    })
                );
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                            old: true,
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                        context: 'fun',
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot2: {
                        tags: expect.not.objectContaining({
                            old: true,
                        }),
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot2: createBot('bot2', {
                        fun: true,
                        'fun.x': 0,
                        'fun.y': 1,
                        'fun.z': 2,
                        test: 'abc',
                    }),
                });
            });

            it('should add the given bots the given context at the given grid position', async () => {
                uuidMock.mockReturnValueOnce('bot2');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                        context: 'fun',
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot2: createBot('bot2', {
                        fun: true,
                        'fun.x': 0,
                        'fun.y': 1,
                        'fun.z': 2,
                        test: 'abc',
                    }),
                });
            });
        });

        describe('onAction()', () => {
            it('should emit an onAction() call to the globals bot', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    'onAction()': 'setTag(this, "hit", true)',
                });

                await helper.transaction({
                    type: 'go_to_url',
                    url: 'test',
                });

                expect(helper.globalsBot).toMatchObject({
                    id: GLOBALS_BOT_ID,
                    tags: {
                        'onAction()': 'setTag(this, "hit", true)',
                        hit: true,
                    },
                });
            });

            it('should skip actions that onAction() rejects', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    'onAction()': 'action.reject(that.action)',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: expect.not.objectContaining({
                        updated: true,
                    }),
                });
            });

            it('should allow rejecting rejections', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    'onAction()': 'action.reject(that.action)',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: expect.not.objectContaining({
                        updated: true,
                    }),
                });
            });

            const falsyTests = [
                ['0'],
                ['""'],
                ['null'],
                ['undefined'],
                ['NaN'],
            ];

            it.each(falsyTests)(
                'should allow actions that onAction() returns %s for',
                async val => {
                    await helper.createBot(GLOBALS_BOT_ID, {
                        'onAction()': `return ${val};`,
                    });

                    await helper.createBot('test', {});

                    await helper.transaction(
                        botUpdated('test', {
                            tags: {
                                updated: true,
                            },
                        })
                    );

                    expect(helper.botsState['test']).toMatchObject({
                        id: 'test',
                        tags: expect.objectContaining({
                            updated: true,
                        }),
                    });
                }
            );

            it('should allow actions that onAction() returns true for', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    'onAction()': 'return true',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: {
                        updated: true,
                    },
                });
            });

            it('should allow actions when onAction() errors out', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    'onAction()': 'throw new Error("Error")',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: {
                        updated: true,
                    },
                });
            });

            it('should be able to filter based on action type', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    'onAction()': `
                        if (that.action.type === 'update_bot') {
                            action.reject(that.action);
                        }
                        return true;
                    `,
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: expect.not.objectContaining({
                        updated: true,
                    }),
                });
            });

            it('should filter actions from inside shouts', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {
                    'onAction()': `
                        if (that.action.type === 'update_bot') {
                            action.reject(that.action);
                        }
                        return true;
                    `,
                    'test()': 'setTag(this, "abc", true)',
                });

                await helper.createBot('test', {});

                await helper.transaction(action('test'));

                expect(helper.botsState[GLOBALS_BOT_ID]).toMatchObject({
                    id: GLOBALS_BOT_ID,
                    tags: expect.not.objectContaining({
                        abc: true,
                    }),
                });
            });

            it('should prevent updates to the onAction() handler by default', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {});

                await helper.transaction(
                    botUpdated(GLOBALS_BOT_ID, {
                        tags: {
                            'onAction()': `
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                        },
                    })
                );

                expect(helper.globalsBot).toMatchObject({
                    id: GLOBALS_BOT_ID,
                    tags: expect.not.objectContaining({
                        'onAction()': `
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                    }),
                });
            });

            it('should prevent deleting the globals bot by default', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {});

                await helper.transaction(botRemoved(GLOBALS_BOT_ID));

                expect(helper.globalsBot).toBeTruthy();
            });
        });
    });

    describe('search()', () => {
        it('should support player.inDesigner()', async () => {
            helper = new AuxHelper(tree, {
                isBuilder: true,
                isPlayer: true,
            });
            helper.userId = userId;

            await helper.createBot('test', {
                'action()': 'setTag(this, "#value", player.inDesigner())',
            });

            const result = await helper.search('player.inDesigner()');

            expect(result.result).toBe(true);
        });
    });

    describe('getTags()', () => {
        it('should return the full list of tags sorted alphabetically', async () => {
            await helper.createBot('test', {
                abc: 'test1',
                xyz: 'test2',
            });

            await helper.createBot('test2', {
                '123': 456,
                def: 'test1',
                xyz: 'test2',
            });

            const tags = helper.getTags();

            expect(tags).toEqual(['123', 'abc', 'def', 'xyz']);
        });
    });

    describe('formulaBatch()', () => {
        it('should support player.inDesigner()', async () => {
            helper = new AuxHelper(tree, {
                isBuilder: true,
                isPlayer: true,
            });
            helper.userId = userId;

            await helper.createBot('test', {
                'action()': 'setTag(this, "#value", player.inDesigner())',
            });

            await helper.formulaBatch([
                'setTag(getBot("id", "test"), "value", player.inDesigner())',
            ]);

            expect(helper.botsState['test'].tags.value).toBe(true);
        });
    });

    describe('createOrUpdateUserBot()', () => {
        it('should create a bot for the user', async () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            helper = new AuxHelper(tree);
            helper.userId = userId;

            await tree.root();
            await helper.createOrUpdateUserBot(
                {
                    id: 'testUser',
                    username: 'username',
                    name: 'test',
                    isGuest: false,
                    token: 'abc',
                },
                null
            );

            expect(helper.botsState['testUser']).toMatchObject({
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
                await helper.createOrUpdateUserBot(
                    {
                        id: 'user',
                        username: 'username',
                        name: 'test',
                        isGuest: false,
                        token: 'abc',
                    },
                    null
                );

                expect(helper.userBot).toMatchObject({
                    id: 'user',
                    tags: {
                        [tag]: value,
                    },
                });
            }
        );
    });
});
