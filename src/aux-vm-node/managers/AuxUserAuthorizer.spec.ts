import { AuxUserAuthorizer } from './AuxUserAuthorizer';
import { LoadedChannel } from '@casual-simulation/causal-tree-server';
import {
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
    DeviceInfo,
    DEVICE_ID_CLAIM,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import {
    AuxCausalTree,
    createFile,
    GLOBALS_FILE_ID,
    sayHello,
} from '@casual-simulation/aux-common';
import { storedTree, site } from '@casual-simulation/causal-trees';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { AuxLoadedChannel } from './AuxChannelManager';
import { NodeSimulation } from './NodeSimulation';
import { first } from 'rxjs/operators';
import { AuxUser } from '@casual-simulation/aux-vm/AuxUser';

console.log = jest.fn();

describe('AuxUserAuthorizer', () => {
    let authorizer: AuxUserAuthorizer;
    let tree: AuxCausalTree;
    let adminTree: AuxCausalTree;
    let channel: AuxLoadedChannel;
    let adminChannel: AuxLoadedChannel;
    let user: AuxUser;

    beforeEach(async () => {
        user = {
            id: 'user',
            isGuest: false,
            name: 'name',
            token: 'token',
            username: 'username',
        };
        tree = new AuxCausalTree(storedTree(site(1)));
        const config = { isBuilder: false, isPlayer: false };
        const nodeChannel = new NodeAuxChannel(tree, user, {
            config: config,
            host: 'any',
            id: 'test',
            treeName: 'test',
        });

        await tree.root();

        const simulation = new NodeSimulation(nodeChannel, 'test', config);
        await simulation.init();

        adminTree = new AuxCausalTree(storedTree(site(1)));
        const adminNodeChannel = new NodeAuxChannel(adminTree, user, {
            config: config,
            host: 'any',
            id: 'admin',
            treeName: 'test',
        });

        await adminTree.root();

        const adminSim = new NodeSimulation(adminNodeChannel, 'admin', config);
        await adminSim.init();

        adminChannel = {
            info: {
                id: 'admin',
                type: 'aux',
            },
            subscription: new Subscription(),
            channel: adminNodeChannel,
            simulation: adminSim,
            tree: adminTree,
        };

        channel = {
            info: {
                id: 'aux-loadedChannel',
                type: 'aux',
            },
            subscription: new Subscription(),
            tree: tree,
            channel: nodeChannel,
            simulation: simulation,
        };
        authorizer = new AuxUserAuthorizer(adminChannel);

        await adminChannel.simulation.helper.createFile('loadedChannelId', {
            'aux.channel': 'loadedChannel',
            'aux.channels': true,
        });
    });

    describe('isAllowedToLoad()', () => {
        it('should return true if the channel is the admin channel', async () => {
            const allowed = await authorizer
                .isAllowedToLoad(
                    {
                        claims: {
                            [USERNAME_CLAIM]: 'test',
                            [DEVICE_ID_CLAIM]: 'device1',
                        },
                        roles: [ADMIN_ROLE],
                    },
                    {
                        id: 'aux-admin',
                        type: 'aux',
                    }
                )
                .pipe(first())
                .toPromise();

            expect(allowed).toBe(true);
        });

        it('should return true if the channel is loaded via a bot in the admin channel', async () => {
            const allowed = await authorizer
                .isAllowedToLoad(
                    {
                        claims: {
                            [USERNAME_CLAIM]: 'test',
                            [DEVICE_ID_CLAIM]: 'device1',
                        },
                        roles: [ADMIN_ROLE],
                    },
                    {
                        id: 'aux-loadedChannel',
                        type: 'aux',
                    }
                )
                .pipe(first())
                .toPromise();

            expect(allowed).toBe(true);
        });

        it('should return false if the channel is not loaded via a bot in the admin channel', async () => {
            await adminChannel.simulation.helper.destroyFile(
                adminChannel.simulation.helper.filesState['loadedChannelId']
            );

            const allowed = await authorizer
                .isAllowedToLoad(
                    {
                        claims: {
                            [USERNAME_CLAIM]: 'test',
                            [DEVICE_ID_CLAIM]: 'device1',
                        },
                        roles: [ADMIN_ROLE],
                    },
                    {
                        id: 'aux-loadedChannel',
                        type: 'aux',
                    }
                )
                .pipe(first())
                .toPromise();

            expect(allowed).toBe(false);
        });

        it('should update if the channel becomes locked', async () => {
            let results: boolean[] = [];
            authorizer
                .isAllowedToLoad(
                    {
                        claims: {
                            [USERNAME_CLAIM]: 'test',
                            [DEVICE_ID_CLAIM]: 'device1',
                        },
                        roles: [ADMIN_ROLE],
                    },
                    {
                        id: 'aux-loadedChannel',
                        type: 'aux',
                    }
                )
                .subscribe(allowed => results.push(allowed));

            await adminChannel.simulation.helper.updateFile(
                adminChannel.simulation.helper.filesState['loadedChannelId'],
                {
                    tags: {
                        'aux.channel.locked': true,
                    },
                }
            );

            expect(results).toEqual([true, false]);
        });

        it('should update if the channel id changes', async () => {
            await adminChannel.simulation.helper.updateFile(
                adminChannel.simulation.helper.filesState['loadedChannelId'],
                {
                    tags: {
                        'aux.channel': null,
                        'aux.channels': true,
                    },
                }
            );

            let results: boolean[] = [];
            authorizer
                .isAllowedToLoad(
                    {
                        claims: {
                            [USERNAME_CLAIM]: 'test',
                            [DEVICE_ID_CLAIM]: 'device1',
                        },
                        roles: [ADMIN_ROLE],
                    },
                    {
                        id: 'aux-loadedChannel',
                        type: 'aux',
                    }
                )
                .subscribe(allowed => results.push(allowed));

            await adminChannel.simulation.helper.updateFile(
                adminChannel.simulation.helper.filesState['loadedChannelId'],
                {
                    tags: {
                        'aux.channel': 'loadedChannel',
                    },
                }
            );

            expect(results).toEqual([false, true]);
        });

        it('should update if the channel file is removed', async () => {
            let results: boolean[] = [];
            authorizer
                .isAllowedToLoad(
                    {
                        claims: {
                            [USERNAME_CLAIM]: 'test',
                            [DEVICE_ID_CLAIM]: 'device1',
                        },
                        roles: [ADMIN_ROLE],
                    },
                    {
                        id: 'aux-loadedChannel',
                        type: 'aux',
                    }
                )
                .subscribe(allowed => results.push(allowed));

            await adminChannel.simulation.helper.destroyFile(
                adminChannel.simulation.helper.filesState['loadedChannelId']
            );

            expect(results).toEqual([true, false]);
        });

        it('should deduplicate updates', async () => {
            let results: boolean[] = [];
            authorizer
                .isAllowedToLoad(
                    {
                        claims: {
                            [USERNAME_CLAIM]: 'test',
                            [DEVICE_ID_CLAIM]: 'device1',
                        },
                        roles: [ADMIN_ROLE],
                    },
                    {
                        id: 'aux-loadedChannel',
                        type: 'aux',
                    }
                )
                .subscribe(allowed => results.push(allowed));

            await adminChannel.simulation.helper.updateFile(
                adminChannel.simulation.helper.filesState['loadedChannelId'],
                {
                    tags: {
                        test: 'abc',
                    },
                }
            );

            expect(results).toEqual([true]);
        });
    });

    describe('isAllowedAccess()', () => {
        it('should throw if the channel type is not aux', () => {
            const channel = {
                info: {
                    id: 'aux-loadedChannel',
                    type: 'something else',
                },
                subscription: new Subscription(),
                tree: tree,
            };

            return expect(
                authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'test',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [ADMIN_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise()
            ).rejects.toThrow();
        });

        it('should deny access when given null', async () => {
            const allowed = await authorizer
                .isAllowedAccess(null, channel)
                .pipe(first())
                .toPromise();

            expect(allowed).toBe(false);
        });

        it('should always allow a user in the admin role', async () => {
            const allowed = await authorizer
                .isAllowedAccess(
                    {
                        claims: {
                            [USERNAME_CLAIM]: 'test',
                            [DEVICE_ID_CLAIM]: 'device1',
                        },
                        roles: [ADMIN_ROLE],
                    },
                    channel
                )
                .pipe(first())
                .toPromise();

            expect(allowed).toBe(true);
        });

        it('should not allow users without the user role', async () => {
            const allowed = await authorizer
                .isAllowedAccess(
                    {
                        claims: {
                            [USERNAME_CLAIM]: 'test',
                            [DEVICE_ID_CLAIM]: 'device1',
                        },
                        roles: [],
                    },
                    channel
                )
                .pipe(first())
                .toPromise();

            expect(allowed).toBe(false);
        });

        it('should allow access if there is no globals file', async () => {
            let allowed = await authorizer
                .isAllowedAccess(
                    {
                        claims: {
                            [USERNAME_CLAIM]: 'username',
                            [DEVICE_ID_CLAIM]: 'device1',
                        },
                        roles: [USER_ROLE],
                    },
                    channel
                )
                .pipe(first())
                .toPromise();

            expect(allowed).toBe(true);
        });

        describe('aux.channel.maxDevicesAllowed', () => {
            it('should reject users when the user limit is reached', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.filesState[
                        'loadedChannelId'
                    ],
                    {
                        tags: {
                            'aux.channel.maxDevicesAllowed': 0,
                        },
                    }
                );

                let allowed = await authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise();

                expect(allowed).toBe(false);
            });

            it('should keep track of the queue of devices to determine who to allow', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.filesState[
                        'loadedChannelId'
                    ],
                    {
                        tags: {
                            'aux.channel.maxDevicesAllowed': 1,
                        },
                    }
                );

                let device1: DeviceInfo = {
                    claims: {
                        [USERNAME_CLAIM]: 'username',
                        [DEVICE_ID_CLAIM]: 'device1',
                    },
                    roles: [USER_ROLE],
                };
                let device2: DeviceInfo = {
                    claims: {
                        [USERNAME_CLAIM]: 'username',
                        [DEVICE_ID_CLAIM]: 'device2',
                    },
                    roles: [USER_ROLE],
                };

                let first: boolean[] = [];
                let second: boolean[] = [];

                let sub1 = authorizer
                    .isAllowedAccess(device1, channel)
                    .subscribe(allowed => first.push(allowed));

                let sub2 = authorizer
                    .isAllowedAccess(device2, channel)
                    .subscribe(allowed => second.push(allowed));

                await waitAsync();

                sub1.unsubscribe();

                expect(first).toEqual([true]);
                expect(second).toEqual([false, true]);
            });

            it('should allow users before the limit is reached', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.filesState[
                        'loadedChannelId'
                    ],
                    {
                        tags: {
                            'aux.channel.maxDevicesAllowed': 1,
                        },
                    }
                );

                let allowed = await authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise();

                expect(allowed).toBe(true);
            });

            it('should always allow admins', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.filesState[
                        'loadedChannelId'
                    ],
                    {
                        tags: {
                            'aux.channel.maxDevicesAllowed': 1,
                            'aux.channel.connectedDevices': 1,
                        },
                    }
                );

                let allowed = await authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE, ADMIN_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise();

                expect(allowed).toBe(true);
            });

            it('should allow users if the max is not set', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.filesState[
                        'loadedChannelId'
                    ],
                    {
                        tags: {
                            'aux.channel.connectedDevices': 1,
                        },
                    }
                );

                let allowed = await authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise();

                expect(allowed).toBe(true);
            });

            it('should allow users if the current is not set', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.filesState[
                        'loadedChannelId'
                    ],
                    {
                        tags: {
                            'aux.channel.maxDevicesAllowed': 1,
                        },
                    }
                );

                let allowed = await authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise();

                expect(allowed).toBe(true);
            });

            it('should update when the number of devices allowed changes', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.filesState[
                        'loadedChannelId'
                    ],
                    {
                        tags: {
                            'aux.channel.maxDevicesAllowed': -1,
                        },
                    }
                );

                let results: boolean[] = [];
                authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE],
                        },
                        channel
                    )
                    .subscribe(allowed => results.push(allowed));

                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.filesState[
                        'loadedChannelId'
                    ],
                    {
                        tags: {
                            'aux.channel.maxDevicesAllowed': 1,
                        },
                    }
                );

                await waitAsync();

                expect(results).toEqual([false, true]);
            });
        });

        describe('aux.maxDevicesAllowed', () => {
            it('should reject users when the user limit is reached', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.globalsFile,
                    {
                        tags: {
                            'aux.maxDevicesAllowed': 0,
                        },
                    }
                );

                let allowed = await authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise();

                expect(allowed).toBe(false);
            });

            it('should allow users before the limit is reached', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.globalsFile,
                    {
                        tags: {
                            'aux.maxDevicesAllowed': 1,
                        },
                    }
                );

                let allowed = await authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise();

                expect(allowed).toBe(true);
            });

            it('should always allow admins', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.globalsFile,
                    {
                        tags: {
                            'aux.maxDevicesAllowed': -1,
                        },
                    }
                );

                let allowed = await authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE, ADMIN_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise();

                expect(allowed).toBe(true);
            });

            it('should allow users if the max is not set', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.globalsFile,
                    {
                        tags: {
                            'aux.maxDevicesAllowed': null,
                        },
                    }
                );

                let allowed = await authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise();

                expect(allowed).toBe(true);
            });

            it('should allow users if the current is not set', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.globalsFile,
                    {
                        tags: {
                            'aux.maxDevicesAllowed': 1,
                        },
                    }
                );

                let allowed = await authorizer
                    .isAllowedAccess(
                        {
                            claims: {
                                [USERNAME_CLAIM]: 'username',
                                [DEVICE_ID_CLAIM]: 'device1',
                            },
                            roles: [USER_ROLE],
                        },
                        channel
                    )
                    .pipe(first())
                    .toPromise();

                expect(allowed).toBe(true);
            });

            it('should keep track of a users position in the queue to figure out if they are allowed in', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.globalsFile,
                    {
                        tags: {
                            'aux.maxDevicesAllowed': 1,
                        },
                    }
                );

                let device1: DeviceInfo = {
                    claims: {
                        [USERNAME_CLAIM]: 'username',
                        [DEVICE_ID_CLAIM]: 'device1',
                    },
                    roles: [USER_ROLE],
                };
                let device2: DeviceInfo = {
                    claims: {
                        [USERNAME_CLAIM]: 'username',
                        [DEVICE_ID_CLAIM]: 'device2',
                    },
                    roles: [USER_ROLE],
                };

                let first: boolean[] = [];
                let second: boolean[] = [];

                let sub1 = authorizer
                    .isAllowedAccess(device1, channel)
                    .subscribe(allowed => first.push(allowed));

                let sub2 = authorizer
                    .isAllowedAccess(device2, channel)
                    .subscribe(allowed => second.push(allowed));

                await waitAsync();

                sub1.unsubscribe();

                expect(first).toEqual([true]);
                expect(second).toEqual([false, true]);
            });

            it('should update when the max devices allowed changes', async () => {
                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.globalsFile,
                    {
                        tags: {
                            'aux.maxDevicesAllowed': 1,
                        },
                    }
                );

                let device1: DeviceInfo = {
                    claims: {
                        [USERNAME_CLAIM]: 'username',
                        [DEVICE_ID_CLAIM]: 'device1',
                    },
                    roles: [USER_ROLE],
                };

                let first: boolean[] = [];
                let second: boolean[] = [];

                let sub1 = authorizer
                    .isAllowedAccess(device1, channel)
                    .subscribe(allowed => first.push(allowed));

                await adminChannel.simulation.helper.updateFile(
                    adminChannel.simulation.helper.globalsFile,
                    {
                        tags: {
                            'aux.maxDevicesAllowed': -1,
                        },
                    }
                );

                await waitAsync();

                expect(first).toEqual([true, false]);
            });
        });

        describe('aux.whitelist.roles', () => {
            const whitelistCases = [
                [
                    'should allow users with the given role',
                    ['admin'],
                    ['admin'],
                    true,
                ],
                [
                    'should reject users without the given role',
                    ['not_admin'],
                    ['admin'],
                    false,
                ],
                [
                    'should reject users without the given roles',
                    ['extra'],
                    ['admin', 'extra'],
                    false,
                ],
                [
                    'should allow users that have all the required roles',
                    ['other', 'extra', 'any'],
                    ['extra', 'other'],
                    true,
                ],
            ];

            it.each(whitelistCases)(
                '%s',
                async (
                    desc: string,
                    roles: string[],
                    whitelist: any,
                    expected: boolean
                ) => {
                    await tree.addFile(
                        createFile(GLOBALS_FILE_ID, {
                            'aux.whitelist.roles': whitelist,
                        })
                    );

                    let allowed = await authorizer
                        .isAllowedAccess(
                            {
                                claims: {
                                    [USERNAME_CLAIM]: 'username',
                                    [DEVICE_ID_CLAIM]: 'device1',
                                },
                                roles: [USER_ROLE, ...roles],
                            },
                            channel
                        )
                        .pipe(first())
                        .toPromise();

                    expect(allowed).toBe(expected);
                }
            );
        });

        describe('aux.blacklist.roles', () => {
            const whitelistCases = [
                [
                    'should reject users with the given role',
                    ['test'],
                    ['test'],
                    false,
                ],
                [
                    'should allow users without the given role',
                    ['not_admin'],
                    ['admin'],
                    true,
                ],
                [
                    'should reject users with one of the given roles',
                    ['extra'],
                    ['admin', 'extra'],
                    false,
                ],
                [
                    'should reject users that have all the given roles',
                    ['other', 'extra', 'any'],
                    ['extra', 'other'],
                    false,
                ],
            ];

            it.each(whitelistCases)(
                '%s',
                async (
                    desc: string,
                    roles: string[],
                    whitelist: any,
                    expected: boolean
                ) => {
                    await tree.addFile(
                        createFile(GLOBALS_FILE_ID, {
                            'aux.blacklist.roles': whitelist,
                        })
                    );

                    let allowed = await authorizer
                        .isAllowedAccess(
                            {
                                claims: {
                                    [USERNAME_CLAIM]: 'username',
                                    [DEVICE_ID_CLAIM]: 'device1',
                                },
                                roles: [USER_ROLE, ...roles],
                            },
                            channel
                        )
                        .pipe(first())
                        .toPromise();

                    expect(allowed).toBe(expected);
                }
            );
        });

        describe('whitelist', () => {
            const whitelistCases = [
                ['should allow users in the whitelist', 'test', ['test'], true],
                [
                    'should reject users not in the whitelist',
                    'not_test',
                    ['test'],
                    false,
                ],
            ];

            it.each(whitelistCases)(
                '%s',
                async (
                    desc: string,
                    username: string,
                    whitelist: any,
                    expected: boolean
                ) => {
                    await tree.addFile(
                        createFile(GLOBALS_FILE_ID, {
                            'aux.whitelist': whitelist,
                        })
                    );

                    let allowed = await authorizer
                        .isAllowedAccess(
                            {
                                claims: {
                                    [USERNAME_CLAIM]: username,
                                    [DEVICE_ID_CLAIM]: 'device1',
                                },
                                roles: [USER_ROLE],
                            },
                            channel
                        )
                        .pipe(first())
                        .toPromise();

                    expect(allowed).toBe(expected);
                }
            );
        });

        describe('blacklist', () => {
            const whitelistCases = [
                [
                    'should reject users in the blacklist',
                    'test',
                    ['test'],
                    false,
                ],
                [
                    'should allow users not in the blacklist',
                    'not_test',
                    ['test'],
                    true,
                ],
            ];

            it.each(whitelistCases)(
                '%s',
                async (
                    desc: string,
                    username: string,
                    whitelist: any,
                    expected: boolean
                ) => {
                    await tree.addFile(
                        createFile(GLOBALS_FILE_ID, {
                            'aux.blacklist': whitelist,
                        })
                    );

                    let allowed = await authorizer
                        .isAllowedAccess(
                            {
                                claims: {
                                    [USERNAME_CLAIM]: username,
                                    [DEVICE_ID_CLAIM]: 'device1',
                                },
                                roles: [USER_ROLE],
                            },
                            channel
                        )
                        .pipe(first())
                        .toPromise();

                    expect(allowed).toBe(expected);
                }
            );
        });
    });

    describe('canProcessEvent()', () => {
        it('should allow admins to run events', async () => {
            const allowed = authorizer.canProcessEvent(
                {
                    claims: {
                        [USERNAME_CLAIM]: 'test',
                        [DEVICE_ID_CLAIM]: 'device1',
                    },
                    roles: [ADMIN_ROLE],
                },
                sayHello()
            );

            expect(allowed).toBe(true);
        });

        it('should disallow non-admins from running events', async () => {
            const allowed = authorizer.canProcessEvent(
                {
                    claims: {
                        [USERNAME_CLAIM]: 'test',
                        [DEVICE_ID_CLAIM]: 'device1',
                    },
                    roles: [],
                },
                sayHello()
            );

            expect(allowed).toBe(false);
        });
    });
});

async function waitAsync() {
    // Wait for the async operations to finish
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}
