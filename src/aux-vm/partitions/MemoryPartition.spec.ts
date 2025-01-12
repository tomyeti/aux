import { testPartitionImplementation } from './test/PartitionTests';
import { createMemoryPartition } from './MemoryPartition';
import { StatusUpdate } from '@casual-simulation/causal-trees';
import { Bot, createBot } from '@casual-simulation/aux-common';

describe('MemoryPartition', () => {
    testPartitionImplementation(async () => {
        return createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
    });

    describe('connect', () => {
        it('should issue connection and sync event', () => {
            const mem = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });

            const updates: StatusUpdate[] = [];
            mem.onStatusUpdated.subscribe(update => updates.push(update));

            mem.connect();

            expect(updates).toEqual([
                {
                    type: 'connection',
                    connected: true,
                },
                {
                    type: 'sync',
                    synced: true,
                },
            ]);
        });

        it('should send an onBotsAdded event for all the bots in the partition on init', async () => {
            const mem = createMemoryPartition({
                type: 'memory',
                initialState: {
                    test: createBot('test'),
                    test2: createBot('test2'),
                },
            });

            let added: Bot[] = [];
            mem.onBotsAdded.subscribe(e => added.push(...e));

            expect(added).toEqual([createBot('test'), createBot('test2')]);
        });
    });
});
