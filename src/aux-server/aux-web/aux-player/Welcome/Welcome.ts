import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import Axios from 'axios';
import {appManager} from '../../shared/AppManager';
import uuid from 'uuid/v4';

@Component
export default class Welcome extends Vue {
    email: string = '';
    
    get channelId(): string {
        return <string>(this.$route.query.id || '');
    }

    get contextId(): string {
        return <string>(this.$route.query.context || '');
    }

    createUser() {
        console.log('[Welcome] Email submitted: ' + this.email);
        this._login(this.email);
    }
    
    continueAsGuest() {
        this._login(`guest_${uuid()}`);
    }
    
    private async _login(email: string) {
        if (await appManager.loginOrCreateUser(email, this.channelId)) {
            this.$router.push({ name: 'home', params: { 
                id: this.channelId || null, 
                context: this.contextId || null 
            }});
        } else {
            // TODO: Show an error message
        }
    }
};