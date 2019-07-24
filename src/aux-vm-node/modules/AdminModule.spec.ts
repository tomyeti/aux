import {
    AuxCausalTree,
    sayHello,
    grantRole,
    fileAdded,
    createFile,
    revokeRole,
    shell,
} from '@casual-simulation/aux-common';
import {
    storedTree,
    site,
    DeviceInfo,
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    ADMIN_ROLE,
} from '@casual-simulation/causal-trees';
import { AuxUser, AuxConfig } from '@casual-simulation/aux-vm';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { AdminModule } from './AdminModule';
import { Subscription } from 'rxjs';

let logMock = (console.log = jest.fn());

describe('AdminModule', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;
    let user: AuxUser;
    let device: DeviceInfo;
    let config: AuxConfig;
    let subject: AdminModule;
    let sub: Subscription;
    let info: RealtimeChannelInfo;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();

        user = {
            id: 'userId',
            isGuest: false,
            name: 'User Name',
            username: 'username',
            token: 'token',
        };
        config = {
            host: 'host',
            config: {
                isBuilder: false,
                isPlayer: false,
            },
            id: 'id',
            treeName: 'treeName',
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
            },
            roles: [],
        };
        info = {
            id: 'aux-admin',
            type: 'aux',
        };

        channel = new NodeAuxChannel(tree, user, config);

        await channel.initAndWait();

        await channel.sendEvents([
            fileAdded(
                createFile('userId', {
                    'aux.account.username': 'username',
                    'aux.account.roles': [ADMIN_ROLE],
                })
            ),
            fileAdded(
                createFile('userTokenId', {
                    'aux.token.username': 'username',
                    'aux.token': 'adminToken',
                })
            ),
        ]);

        subject = new AdminModule();
        sub = await subject.setup(info, channel);

        logMock.mockClear();
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
    });

    describe('events', () => {
        describe('say_hello', () => {
            it('should print a hello message to the console', async () => {
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: sayHello(),
                    },
                ]);

                expect(logMock).toBeCalledWith(
                    expect.stringContaining('Hello!')
                );
            });
        });

        describe('grant_role', () => {
            it('should reject non-admin devices from granting roles', async () => {
                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.account.username': 'otheruser',
                            'aux.account.roles': [],
                        })
                    ),
                ]);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: grantRole('otheruser', ADMIN_ROLE),
                    },
                ]);

                // Wait for the async operations to finish
                await Promise.resolve();
                await Promise.resolve();

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.account.username': 'otheruser',
                        'aux.account.roles': [],
                    },
                });
            });

            it('should not work in non-admin channels without a grant', async () => {
                info = {
                    id: 'aux-test',
                    type: 'aux',
                };
                subject = new AdminModule();
                sub = await subject.setup(info, channel);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.account.username': 'otheruser',
                            'aux.account.roles': [],
                        })
                    ),
                ]);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: grantRole('otheruser', ADMIN_ROLE),
                    },
                ]);

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.account.username': 'otheruser',
                        'aux.account.roles': [],
                    },
                });
            });

            it('should work in non-admin channels with a grant', async () => {
                let testInfo = {
                    id: 'aux-test',
                    type: 'aux',
                };
                let testTree = new AuxCausalTree(storedTree(site(1)));
                await testTree.root();

                let testChannel = new NodeAuxChannel(testTree, user, config);

                await testChannel.initAndWait();

                let sub2 = await subject.setup(testInfo, testChannel);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.account.username': 'otheruser',
                            'aux.account.roles': [],
                        })
                    ),
                ]);

                device.roles.push(ADMIN_ROLE);
                await testChannel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: grantRole('otheruser', ADMIN_ROLE, 'adminToken'),
                    },
                ]);

                // Wait for the async operations to finish
                await Promise.resolve();
                await Promise.resolve();

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.account.username': 'otheruser',
                        'aux.account.roles': [ADMIN_ROLE],
                    },
                });
            });

            it('should grant the role to the given user if sent on the admin channel and by an admin', async () => {
                device.roles.push(ADMIN_ROLE);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.account.username': 'otheruser',
                            'aux.account.roles': [],
                        })
                    ),
                ]);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: grantRole('otheruser', ADMIN_ROLE),
                    },
                ]);

                // Wait for the async operations to finish
                await Promise.resolve();
                await Promise.resolve();

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.account.username': 'otheruser',
                        'aux.account.roles': [ADMIN_ROLE],
                    },
                });
            });

            it('should allow using a token instead of the username', async () => {
                device.roles.push(ADMIN_ROLE);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.account.username': 'otheruser',
                            'aux.account.roles': [],
                        })
                    ),
                    fileAdded(
                        createFile('testOtherUserToken', {
                            'aux.token.username': 'otheruser',
                            'aux.token': 'userToken',
                        })
                    ),
                ]);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: grantRole('userToken', ADMIN_ROLE),
                    },
                ]);

                // Wait for the async operations to finish
                await Promise.resolve();
                await Promise.resolve();

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.account.username': 'otheruser',
                        'aux.account.roles': [ADMIN_ROLE],
                    },
                });
            });
        });

        describe('revoke_role', () => {
            it('should reject non-admin devices from revoking roles', async () => {
                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.account.username': 'otheruser',
                            'aux.account.roles': [ADMIN_ROLE],
                        })
                    ),
                ]);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: revokeRole('otheruser', ADMIN_ROLE),
                    },
                ]);

                // Wait for the async operations to finish
                await Promise.resolve();
                await Promise.resolve();

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.account.username': 'otheruser',
                        'aux.account.roles': [ADMIN_ROLE],
                    },
                });
            });

            it('should not work in non-admin channels', async () => {
                info = {
                    id: 'aux-test',
                    type: 'aux',
                };
                subject = new AdminModule();
                sub = await subject.setup(info, channel);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.account.username': 'otheruser',
                            'aux.account.roles': ['role'],
                        })
                    ),
                ]);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: revokeRole('otheruser', 'role'),
                    },
                ]);

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.account.username': 'otheruser',
                        'aux.account.roles': ['role'],
                    },
                });
            });

            it('should work in non-admin channels with a grant', async () => {
                let testInfo = {
                    id: 'aux-test',
                    type: 'aux',
                };
                let testTree = new AuxCausalTree(storedTree(site(1)));
                await testTree.root();

                let testChannel = new NodeAuxChannel(testTree, user, config);

                await testChannel.initAndWait();

                let sub2 = await subject.setup(testInfo, testChannel);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.account.username': 'otheruser',
                            'aux.account.roles': [ADMIN_ROLE],
                        })
                    ),
                ]);

                device.roles.push(ADMIN_ROLE);
                await testChannel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: revokeRole(
                            'otheruser',
                            ADMIN_ROLE,
                            'adminToken'
                        ),
                    },
                ]);

                // Wait for the async operations to finish
                await Promise.resolve();
                await Promise.resolve();

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.account.username': 'otheruser',
                        'aux.account.roles': [],
                    },
                });
            });

            it('should remove the role from the given user if sent on the admin channel and by an admin', async () => {
                device.roles.push(ADMIN_ROLE);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.account.username': 'otheruser',
                            'aux.account.roles': ['role'],
                        })
                    ),
                ]);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: revokeRole('otheruser', 'role'),
                    },
                ]);

                // Wait for the async operations to finish
                await Promise.resolve();
                await Promise.resolve();

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.account.username': 'otheruser',
                        'aux.account.roles': [],
                    },
                });
            });

            it('should allow using a token instead of the username', async () => {
                device.roles.push(ADMIN_ROLE);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.account.username': 'otheruser',
                            'aux.account.roles': [ADMIN_ROLE],
                        })
                    ),
                    fileAdded(
                        createFile('testOtherUserToken', {
                            'aux.token.username': 'otheruser',
                            'aux.token': 'userToken',
                        })
                    ),
                ]);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: revokeRole('userToken', ADMIN_ROLE),
                    },
                ]);

                // Wait for the async operations to finish
                await Promise.resolve();
                await Promise.resolve();

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.account.username': 'otheruser',
                        'aux.account.roles': [],
                    },
                });
            });
        });

        describe('shell', () => {
            it('should run the given shell command and output the results to the console', async () => {
                expect.assertions(1);

                device.roles.push(ADMIN_ROLE);
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: shell('echo "Hello, World!"'),
                    },
                ]);

                await wait(20);

                expect(logMock).toBeCalledWith(
                    expect.stringContaining('[Shell] Hello, World!')
                );
            });

            it('should not run the given shell command if the user is not an admin', async () => {
                expect.assertions(1);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: shell('echo "Hello, World!"'),
                    },
                ]);

                await wait(20);

                expect(logMock).not.toBeCalledWith(
                    expect.stringContaining('[Shell] Hello, World!')
                );
            });
        });
    });

    describe('deviceConnected()', () => {
        it('should set the number of connected devices on the channel in the admin channel', async () => {
            let testChannelInfo: RealtimeChannelInfo = {
                id: 'test',
                type: 'aux',
            };
            let testUser = {
                id: 'testUserId',
                isGuest: false,
                name: 'Test User Name',
                username: 'testUserId',
                token: 'token',
            };
            let testConfig = {
                host: 'host',
                config: {
                    isBuilder: false,
                    isPlayer: false,
                },
                id: 'id',
                treeName: 'treeName',
            };
            let testTree = new AuxCausalTree(storedTree(site(1)));
            await testTree.root();

            let testChannel = new NodeAuxChannel(
                testTree,
                testUser,
                testConfig
            );
            await testChannel.initAndWait();

            await channel.sendEvents([
                fileAdded(
                    createFile('channelFileId', {
                        'aux.channels': true,
                        'aux.channel': 'test',
                    })
                ),
            ]);

            let testDevice1: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername',
                },
                roles: [],
            };
            const sub1 = await subject.deviceConnected(
                testChannelInfo,
                testChannel,
                testDevice1
            );

            // Wait for the async operations to finish
            await Promise.resolve();
            await Promise.resolve();

            let testDevice2: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername2',
                },
                roles: [],
            };
            const sub2 = await subject.deviceConnected(
                testChannelInfo,
                testChannel,
                testDevice2
            );

            // Wait for the async operations to finish
            await Promise.resolve();
            await Promise.resolve();

            expect(channel.helper.filesState['channelFileId']).toMatchObject({
                id: 'channelFileId',
                tags: {
                    'aux.channels': true,
                    'aux.channel': 'test',
                    'aux.channel.connectedDevices': 2,
                },
            });

            sub1.unsubscribe();

            // Wait for the async operations to finish
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            expect(channel.helper.filesState['channelFileId']).toMatchObject({
                id: 'channelFileId',
                tags: {
                    'aux.channels': true,
                    'aux.channel': 'test',
                    'aux.channel.connectedDevices': 1,
                },
            });

            sub2.unsubscribe();

            // Wait for the async operations to finish
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            expect(channel.helper.filesState['channelFileId']).toMatchObject({
                id: 'channelFileId',
                tags: {
                    'aux.channels': true,
                    'aux.channel': 'test',
                    'aux.channel.connectedDevices': 0,
                },
            });
        });
    });
});

function wait(ms: number) {
    return new Promise<void>(resolve => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}
