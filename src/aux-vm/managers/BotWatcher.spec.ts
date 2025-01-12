import { BotWatcher, UpdatedBotInfo } from './BotWatcher';
import {
    createPrecalculatedBot,
    PrecalculatedBot,
    PrecalculatedBotsState,
    BotIndex,
    Bot,
    BotIndexEvent,
} from '@casual-simulation/aux-common';
import { BotHelper } from './BotHelper';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { waitAsync } from '../test/TestHelpers';
import { skip } from 'rxjs/operators';

describe('BotWatcher', () => {
    let vm: TestAuxVM;
    let watcher: BotWatcher;
    let helper: BotHelper;
    let index: BotIndex;

    let userId = 'user';

    beforeEach(async () => {
        vm = new TestAuxVM();
        helper = new BotHelper(vm);
        helper.userId = userId;

        index = new BotIndex();

        watcher = new BotWatcher(helper, index, vm.stateUpdated);
    });

    it('should update the bot helper state', () => {
        const state = {
            user: createPrecalculatedBot('user'),
        };
        vm.sendState({
            state: state,
            addedBots: [],
            updatedBots: [],
            removedBots: [],
        });

        expect(helper.botsState).toEqual(state);
    });

    it('should update the index state with new bots', () => {
        const test = createPrecalculatedBot('test', {
            abc: 'def',
        });
        const state = {
            test: test,
        };

        vm.sendState({
            state: state,
            addedBots: ['test'],
            updatedBots: [],
            removedBots: [],
        });

        expect(index.findBotsWithTag('abc')).toEqual([test]);
    });

    it('should update the index state with removed bots', () => {
        const test = createPrecalculatedBot('test', {
            abc: 'def',
        });
        const state = {
            test: test,
        };

        vm.sendState({
            state: state,
            addedBots: ['test'],
            updatedBots: [],
            removedBots: [],
        });

        const state2 = {
            test: <any>null,
        };
        vm.sendState({
            state: state2,
            addedBots: [],
            updatedBots: [],
            removedBots: ['test'],
        });

        expect(index.findBotsWithTag('abc')).toEqual([]);
    });

    it('should update the index state with updated bots', () => {
        const test = createPrecalculatedBot('test', {
            abc: 'def',
        });
        const state = {
            test: test,
        };

        vm.sendState({
            state: state,
            addedBots: ['test'],
            updatedBots: [],
            removedBots: [],
        });

        const state2: Partial<PrecalculatedBotsState> = {
            test: <any>{
                tags: {
                    abc: 123,
                },
                values: {
                    abc: 123,
                },
            },
        };
        vm.sendState({
            state: state2,
            addedBots: [],
            updatedBots: ['test'],
            removedBots: [],
        });

        expect(index.findBotsWithTag('abc')).toEqual([
            createPrecalculatedBot('test', {
                abc: 123,
            }),
        ]);
    });

    it('should batch index updates', async () => {
        let updates = [] as BotIndexEvent[][];

        index.events.subscribe(e => updates.push(e));

        const test = createPrecalculatedBot('test', {
            abc: 'def',
        });
        const test2 = createPrecalculatedBot('test2', {
            hello: 'world',
        });
        const state = {
            test: test,
            test2: test2,
        };

        vm.sendState({
            state: state,
            addedBots: ['test', 'test2'],
            updatedBots: [],
            removedBots: [],
        });

        const state2: Partial<PrecalculatedBotsState> = {
            test: <any>{
                tags: {
                    abc: 123,
                },
                values: {
                    abc: 123,
                },
            },
            test2: null,
        };
        vm.sendState({
            state: state2,
            addedBots: [],
            updatedBots: ['test'],
            removedBots: ['test2'],
        });

        await waitAsync();

        expect(updates).toEqual([
            [
                {
                    type: 'bot_tag_added',
                    bot: test,
                    tag: 'abc',
                },
                {
                    type: 'bot_tag_added',
                    bot: test2,
                    tag: 'hello',
                },
            ],
            [
                {
                    type: 'bot_tag_removed',
                    bot: test2,
                    tag: 'hello',
                },
                {
                    type: 'bot_tag_updated',
                    bot: createPrecalculatedBot('test', { abc: 123 }),
                    oldBot: test,
                    tag: 'abc',
                },
            ],
        ]);
    });

    it('should merge the new state with the current state', () => {
        vm.sendState({
            state: {
                user: createPrecalculatedBot('user'),
                bot: createPrecalculatedBot('bot'),
            },
            addedBots: [],
            updatedBots: [],
            removedBots: [],
        });

        vm.sendState({
            state: {
                test: createPrecalculatedBot('test'),
                user: <PrecalculatedBot>(<Partial<PrecalculatedBot>>{
                    tags: {
                        abc: 'def',
                    },
                    values: {
                        abc: 'def',
                    },
                }),
                bot: null,
            },
            addedBots: [],
            updatedBots: [],
            removedBots: [],
        });

        expect(helper.botsState).toEqual({
            user: createPrecalculatedBot('user', {
                abc: 'def',
            }),
            test: createPrecalculatedBot('test'),
        });
    });

    describe('botsDiscovered', () => {
        it('should resolve with the added bots', async () => {
            let bots: PrecalculatedBot[] = [];
            watcher.botsDiscovered.subscribe(f => bots.push(...f));

            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
            });

            expect(bots).toEqual([state['test'], state['test2']]);
        });

        it('should resolve with the current bots immediately', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
            });

            let bots: PrecalculatedBot[] = [];
            watcher.botsDiscovered.subscribe(f => bots.push(...f));

            expect(bots).toEqual([state['test'], state['test2']]);
        });

        it('should not start with bots that were removed', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
            });

            state = Object.assign({}, state);
            state['test2'] = null;

            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: [],
                removedBots: ['test2'],
            });

            let bots: PrecalculatedBot[] = [];
            watcher.botsDiscovered.subscribe(f => bots.push(...f));

            expect(bots).toEqual([state['test']]);
        });
    });

    describe('botsRemoved', () => {
        it('should resolve with the removed bot IDs', async () => {
            let bots: string[] = [];
            watcher.botsRemoved.subscribe(f => bots.push(...f));

            vm.sendState({
                state: {},
                addedBots: [],
                updatedBots: [],
                removedBots: ['test', 'test2'],
            });

            expect(bots).toEqual(['test', 'test2']);
        });
    });

    describe('botsUpdated', () => {
        it('should resolve with the updated bots', async () => {
            let bots: PrecalculatedBot[] = [];
            watcher.botsUpdated.subscribe(f => bots.push(...f));

            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: ['test', 'test2'],
                removedBots: [],
            });

            expect(bots).toEqual([state['test'], state['test2']]);
        });

        it('should omit tags that are null', async () => {
            let bots: PrecalculatedBot[] = [];
            watcher.botsUpdated.subscribe(f => bots.push(...f));

            vm.sendState({
                state: {
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                },
                addedBots: ['test'],
                updatedBots: [],
                removedBots: [],
            });

            let state: any = {
                test: {
                    tags: {
                        abc: null,
                    },
                    values: {
                        abc: null,
                    },
                },
            };
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: [],
            });

            expect(bots).toEqual([createPrecalculatedBot('test')]);
        });
    });

    describe('botTagsUpdated', () => {
        it('should include tags whose value was updated but the formula was not', async () => {
            vm.sendState({
                state: {
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                },
                addedBots: ['test'],
                updatedBots: [],
                removedBots: [],
            });

            let bots: UpdatedBotInfo[] = [];
            watcher.botTagsUpdated.subscribe(f => bots.push(...f));

            let state: any = {
                test: {
                    values: {
                        abc: 'red',
                    },
                },
            };
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: [],
            });

            expect(bots).toEqual([
                {
                    bot: createPrecalculatedBot(
                        'test',
                        {
                            abc: 'red',
                        },
                        { abc: 'def' }
                    ),
                    tags: new Set(['abc']),
                },
            ]);
        });
    });

    describe('botChanged()', () => {
        it('should return an observable that only resolved when the given bot changes', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
            });

            let bots: PrecalculatedBot[] = [];
            watcher.botChanged('test').subscribe(f => bots.push(f));

            let secondState = {
                test: createPrecalculatedBot('test', { abc: 'def' }),
                test2: createPrecalculatedBot('test2', { ghi: 'jfk' }),
            };
            vm.sendState({
                state: secondState,
                addedBots: [],
                updatedBots: ['test', 'test2'],
                removedBots: [],
            });

            expect(bots).toEqual([state['test'], secondState['test']]);
        });

        it('should resolve with null if the given bot ID is deleted', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
            });

            let bots: PrecalculatedBot[] = [];
            watcher.botChanged('test').subscribe(f => bots.push(f));

            let secondState: PrecalculatedBotsState = {
                test: null,
            };
            vm.sendState({
                state: secondState,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: ['test'],
            });

            expect(bots).toEqual([state['test'], null]);
        });
    });

    describe('botTagsChanged()', () => {
        it('should return an observable that resolves with the tags that changed on a bot', async () => {
            let state = {
                test: createPrecalculatedBot('test', { test: 123 }),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
            });

            let bots: UpdatedBotInfo[] = [];
            watcher.botTagsChanged('test').subscribe(f => bots.push(f));

            let secondState = {
                test: createPrecalculatedBot('test', {
                    abc: 'def',
                    test: null,
                }),
                test2: createPrecalculatedBot('test2', { ghi: 'jfk' }),
            };
            vm.sendState({
                state: secondState,
                addedBots: [],
                updatedBots: ['test', 'test2'],
                removedBots: [],
            });

            expect(bots).toEqual([
                {
                    bot: state['test'],
                    tags: new Set(),
                },
                {
                    bot: createPrecalculatedBot('test', { abc: 'def' }),
                    tags: new Set(['abc', 'test']),
                },
            ]);
        });

        it('should resolve with null if the given bot ID is deleted', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
            });

            let bots: UpdatedBotInfo[] = [];
            watcher.botTagsChanged('test').subscribe(f => bots.push(f));

            let secondState: PrecalculatedBotsState = {
                test: null,
            };
            vm.sendState({
                state: secondState,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: ['test'],
            });

            expect(bots).toEqual([
                {
                    bot: state['test'],
                    tags: new Set(),
                },
                null,
            ]);
        });
    });
});
