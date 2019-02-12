import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import { Object } from 'common/Files';

@Component({
    components: {
    },
})
export default class MiniFile extends Vue {

    @Prop() file: Object;
    @Prop({ default: false }) large: boolean;
    @Prop({ default: false }) selected: boolean;

    constructor() {
        super();
    }

    click() {
        this.$emit('click');
    }
};