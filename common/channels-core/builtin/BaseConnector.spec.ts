import { Subject } from 'rxjs';
import { expect } from 'chai';
import { TestConnector } from '../test/TestConnector';
import { Event } from '../Event';
import { Reducer } from '../Reducer';
import { IChannel, Channel } from '../Channel';
import { ReducingStateStore } from '../StateStore';
import { isObject } from 'util';

describe('builtin', () => {
    describe('BaseConnector', () => {
        let channel: IChannel<number>;
        let serverEvents: Subject<Event>;
        let eventsToServer: Subject<Event>;
        let connectionEvents: Subject<boolean>;
        let connector: TestConnector;
        let reducer = (state: number, event: Event) => {
            state = state || 0;
            if (event.type === 'add') {
                state += 1;
            } else if (event.type === 'subtract') {
                state -= 1;
            }
            return state;
        };
        let store = new ReducingStateStore(0, reducer);

        function init(state?: number) {
            serverEvents = new Subject<Event>();
            connectionEvents = new Subject<boolean>();
            eventsToServer = new Subject<Event>();
            connector = new TestConnector(state, serverEvents, connectionEvents, eventsToServer);
            channel = new Channel<number>({
                id: 'abc',
                name: 'test',
                type: 'custom'
            }, connector, store);
        }

        it('should return info used to connect', () => {
            init();

            return channel.subscribe().then(connection => {
                expect(connection).to.not.be.null;
                expect(connection.info.id).to.equal('abc');
                expect(connection.info.name).to.equal('test');
                expect(connection.info.type).to.equal('custom');
            });
        });

        it('should return store used to connect', () => {
            init();

            return channel.subscribe().then(connection => {
                expect(connection).to.not.be.null;
                expect(connection.store).to.equal(store);
            });
        });

        it('should pass server events through events() observable.', () => {
            init();

            return channel.subscribe().then(connection => {
                let store = connection.store;

                expect(store.state()).to.equal(0);

                let events: Event[] = [];
                let sub = connection.events.subscribe(e => events.push(e));

                serverEvents.next({
                    type: 'add',
                    creation_time: new Date()
                });

                serverEvents.next({
                    type: 'add',
                    creation_time: new Date()
                });

                serverEvents.next({
                    type: 'subtract',
                    creation_time: new Date()
                });

                expect(events.length).to.equal(3);
                expect(events[0]).to.include({
                    type: 'add'
                });
                expect(events[1]).to.include({
                    type: 'add'
                });
                expect(events[2]).to.include({
                    type: 'subtract'
                });

                sub.unsubscribe();
            });
        });

        it('should pass client events through events() observable.', () => {
            init(0);

            return channel.subscribe().then(connection => {
                let store = connection.store;

                expect(store.state()).to.equal(0);

                let events: Event[] = [];
                let sub = connection.events.subscribe(e => events.push(e));

                connection.emit({
                    type: 'add',
                    creation_time: new Date()
                });

                connection.emit({
                    type: 'add',
                    creation_time: new Date()
                });

                connection.emit({
                    type: 'subtract',
                    creation_time: new Date()
                });

                expect(events.length).to.equal(3);
                expect(events[0]).to.include({
                    type: 'add'
                });
                expect(events[1]).to.include({
                    type: 'add'
                });
                expect(events[2]).to.include({
                    type: 'subtract'
                });

                sub.unsubscribe();
            });
        });

        it('should resolve disconnected() when given observable resolves with false', () => {
            init(0);

            return channel.subscribe().then(connection => {
                let store = connection.store;

                expect(store.state()).to.equal(0);
                expect(connection.state).to.equal('online');

                let events: Event[] = [];
                let eventsSentToServer: Event[] = [];
                let sub = connection.events.subscribe(e => events.push(e));
                let eventsToServerSub = eventsToServer.subscribe(e => eventsSentToServer.push(e));

                connection.emit({
                    type: 'add',
                    creation_time: new Date()
                });

                expect(store.state()).to.equal(1);
                expect(eventsSentToServer.length).to.equal(1);

                let disconnectedState = 0;
                let disconnectedSub = connection.disconnected.subscribe(state => {
                    disconnectedState = state;
                });

                connectionEvents.next(false);
                expect(disconnectedState).to.equal(1);
                expect(connection.state).to.equal('offline');

                connection.emit({
                    type: 'add',
                    creation_time: new Date()
                });

                expect(eventsSentToServer.length).to.equal(1, 'should not send an event to the server when offline.');

                disconnectedSub.unsubscribe();
                eventsToServerSub.unsubscribe();
                sub.unsubscribe();
            });
        });

        it('should resolve reconnected() when given observable resolves with true after being disconnected', () => {
            init(0);

            return channel.subscribe().then(connection => {
                let store = connection.store;

                expect(store.state()).to.equal(0);

                let events: Event[] = [];
                let eventsSentToServer: Event[] = [];
                let sub = connection.events.subscribe(e => events.push(e));
                let eventsToServerSub = eventsToServer.subscribe(e => eventsSentToServer.push(e));

                connection.emit({
                    type: 'add',
                    creation_time: new Date()
                });

                expect(store.state()).to.equal(1);
                expect(eventsSentToServer.length).to.equal(1);

                let calls = 0;
                let reconnectedSub = connection.reconnected.subscribe(() => {
                    calls += 1;
                });

                connectionEvents.next(false);
                expect(connection.state).to.equal('offline');
                expect(calls).to.equal(0);

                connection.emit({
                    type: 'add',
                    creation_time: new Date()
                });

                expect(eventsSentToServer.length).to.equal(1, 'should not emit events to server while offline.');

                connectionEvents.next(true);
                expect(connection.state).to.equal('online-disconnected');
                expect(calls).to.equal(1);

                connection.emit({
                    type: 'add',
                    creation_time: new Date()
                });

                expect(eventsSentToServer.length).to.equal(1, 'should not emit events to server while online-disconnected.');

                connection.reconnect();

                connection.emit({
                    type: 'add',
                    creation_time: new Date()
                });

                expect(eventsSentToServer.length).to.equal(2, 'should emit event after reconnect() gets called.');

                reconnectedSub.unsubscribe();
                eventsToServerSub.unsubscribe();
                sub.unsubscribe();
            });
        });
    });
});