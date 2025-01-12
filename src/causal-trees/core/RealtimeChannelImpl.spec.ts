import { RealtimeChannelImpl } from './RealtimeChannelImpl';
import { TestChannelConnection } from '../test/TestChannelConnection';
import { RealtimeChannelInfo } from './RealtimeChannelInfo';
import {
    DeviceInfo,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
} from './DeviceInfo';
import { StatusUpdate } from './StatusUpdate';
import { User } from '.';

console.log = jest.fn();

describe('RealtimeChannelImpl', () => {
    let info: RealtimeChannelInfo;
    let connection: TestChannelConnection;
    let channel: RealtimeChannelImpl;
    let user: User;

    beforeEach(() => {
        user = {
            id: 'test',
            name: 'Test',
            token: 'token',
            username: 'username',
        };
        info = {
            id: 'test',
            type: 'abc',
        };
        connection = new TestChannelConnection(info);
        channel = new RealtimeChannelImpl(connection);
    });

    it('should initialize the connection', () => {
        channel.connect();

        expect(connection.initialized).toBe(true);
    });

    it('should unsubscribe the connection when unsubscribed', () => {
        channel.connect();
        channel.unsubscribe();

        expect(connection.closed).toBe(true);
    });

    it('should try to login when connected and has a user', () => {
        channel.connect();
        connection.setConnected(true);
        channel.setUser(user);

        expect(connection.requests.length).toBe(1);
        expect(connection.requests[0].name).toBe('login');
    });

    it('should be able to use the user given in the constructor', () => {
        channel = new RealtimeChannelImpl(connection, user);
        channel.connect();
        connection.setConnected(true);

        expect(connection.requests.length).toBe(1);
        expect(connection.requests[0].name).toBe('login');
    });

    it('should try to join the channel after login', async () => {
        channel.connect();
        connection.setConnected(true);
        channel.setUser(user);

        let device: DeviceInfo = {
            claims: {
                [USERNAME_CLAIM]: 'xyz',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };
        connection.requests[0].resolve({
            success: true,
            value: device,
        });

        await connection.flushPromises();

        expect(connection.requests.length).toBe(2);
        expect(connection.requests[1].name).toBe('join_channel');
    });

    it('should emit status events upon connection', async () => {
        let events: StatusUpdate[] = [];
        channel.statusUpdated.subscribe(e => events.push(e));

        channel.connect();
        connection.setConnected(true);
        channel.setUser(user);

        let device: DeviceInfo = {
            claims: {
                [USERNAME_CLAIM]: 'xyz',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };
        connection.requests[0].resolve({
            success: true,
            value: device,
        });

        await connection.flushPromises();

        connection.requests[1].resolve({
            success: true,
            value: null,
        });

        await connection.flushPromises();

        expect(events).toEqual([
            {
                type: 'connection',
                connected: true,
            },
            {
                type: 'authentication',
                authenticated: true,
                user: user,
                info: device,
            },
            {
                type: 'authorization',
                authorized: true,
            },
        ]);
    });

    it('should emit status events upon disconnection', async () => {
        let events: StatusUpdate[] = [];
        channel.statusUpdated.subscribe(e => events.push(e));

        channel.connect();
        connection.setConnected(false);
        channel.setUser(user);

        await connection.flushPromises();

        expect(events).toEqual([
            {
                type: 'connection',
                connected: false,
            },
            {
                type: 'authorization',
                authorized: null,
            },
            {
                type: 'authentication',
                authenticated: null,
            },
        ]);
    });

    it('should emit status events upon setting the user to null', async () => {
        let events: StatusUpdate[] = [];
        channel.statusUpdated.subscribe(e => events.push(e));

        channel.connect();
        connection.setConnected(true);
        channel.setUser(null);

        await connection.flushPromises();

        expect(events).toEqual([
            {
                type: 'connection',
                connected: true,
            },
            {
                type: 'authorization',
                authorized: null,
            },
            {
                type: 'authentication',
                authenticated: null,
            },
        ]);
    });

    it('should return the login error reason from the connection', async () => {
        let events: StatusUpdate[] = [];
        channel.statusUpdated.subscribe(e => events.push(e));

        channel.connect();
        connection.setConnected(true);
        channel.setUser(user);
        connection.requests[0].resolve({
            success: false,
            value: null,
            error: {
                type: 'not_authenticated',
                reason: 'reason',
            },
        });

        await connection.flushPromises();

        expect(events).toEqual([
            {
                type: 'connection',
                connected: true,
            },
            {
                type: 'authentication',
                authenticated: false,
                reason: 'reason',
            },
        ]);
    });

    it('should return the authorization error reason from the connection', async () => {
        let events: StatusUpdate[] = [];
        channel.statusUpdated.subscribe(e => events.push(e));

        channel.connect();
        connection.setConnected(true);
        channel.setUser(user);
        connection.requests[0].resolve({
            success: true,
            value: null,
        });

        await connection.flushPromises();

        connection.requests[1].resolve({
            success: false,
            value: null,
            error: {
                type: 'not_authorized',
                reason: 'unauthorized',
            },
        });

        await connection.flushPromises();

        expect(events).toEqual([
            {
                type: 'connection',
                connected: true,
            },
            {
                type: 'authentication',
                authenticated: true,
                user: expect.any(Object),
                info: null,
            },
            {
                type: 'authorization',
                authorized: false,
                reason: 'unauthorized',
            },
        ]);
    });

    it('should retry the login after setGrant() is called', async () => {
        let events: StatusUpdate[] = [];
        channel.statusUpdated.subscribe(e => events.push(e));

        channel.connect();
        connection.setConnected(true);
        channel.setUser(user);
        connection.requests[0].resolve({
            success: false,
            value: null,
            error: {
                type: 'not_authenticated',
                reason: 'reason',
            },
        });

        await connection.flushPromises();

        channel.setGrant('abc');

        expect(connection.requests[1].data).toEqual({
            ...user,
            grant: 'abc',
        });
        connection.requests[1].resolve({
            success: true,
            value: null,
        });

        await connection.flushPromises();

        expect(events).toEqual([
            {
                type: 'connection',
                connected: true,
            },
            {
                type: 'authentication',
                authenticated: false,
                reason: 'reason',
            },
            {
                type: 'connection',
                connected: true,
            },
            {
                type: 'authentication',
                authenticated: true,
                user: expect.any(Object),
                info: null,
            },
        ]);
    });
});
