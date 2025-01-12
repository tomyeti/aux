import { LoadedChannel } from './ChannelManager';
import {
    DeviceInfo,
    RealtimeChannelInfo,
} from '@casual-simulation/causal-trees';
import { Observable } from 'rxjs';

/**
 * Defines an interface for objects that can authorize users to access a channel.
 */
export interface ChannelAuthorizer {
    /**
     * Defines if the given device is allowed to load the given channel.
     */
    isAllowedToLoad(
        device: DeviceInfo,
        info: RealtimeChannelInfo
    ): Observable<boolean>;

    /**
     * Determines if the given device is allowed access to the given channel.
     * @param device The device that contains the authenticated roles the user has.
     * @param channel The channel.
     */
    isAllowedAccess(
        device: DeviceInfo,
        channel: LoadedChannel
    ): Observable<boolean>;
}
