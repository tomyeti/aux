import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import some from 'lodash/some';
import union from 'lodash/union';
import {
    botTags,
    isHiddenTag,
    Bot,
    hasValue,
    isFormula,
    getShortId,
    merge,
    SelectionMode,
    AuxCausalTree,
    botAdded,
    getAllBotTags,
    toast,
    isEditable,
    createContextId,
    addToContextDiff,
    DEFAULT_WORKSPACE_SCALE,
    AuxBot,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import { EventBus } from '../../shared/EventBus';

import BotValue from '../BotValue/BotValue';
import TagEditor from '../TagEditor/TagEditor';
import AlertDialogOptions from '../../shared/AlertDialogOptions';
import BotTag from '../../shared/vue-components/BotTag/BotTag';
import BotID from '../BotID/BotID';
import BotTableToggle from '../BotTableToggle/BotTableToggle';
import { TreeView } from 'vue-json-tree-view';
import { downloadAuxState } from '../download';
import Cube from '../public/icons/Cube.svg';
import Hexagon from '../public/icons/Hexagon.svg';
import ResizeIcon from '../public/icons/Resize.svg';
import MultiIcon from '../public/icons/Multi.svg';
import { nextAvailableWorkspacePosition } from '../../shared/WorksurfaceUtils';
import { gridPosToRealPos } from '../../shared/scene/hex';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../shared/AppManager';
import Bowser from 'bowser';
import BotTagMini from '../BotTagMini/BotTagMini';
import TagValueEditor from '../../shared/vue-components/TagValueEditor/TagValueEditor';
import { first } from 'rxjs/operators';

@Component({
    components: {
        'bot-value': BotValue,
        'bot-id': BotID,
        'bot-tag': BotTag,
        'tag-editor': TagEditor,
        'bot-table-toggle': BotTableToggle,
        'tree-view': TreeView,
        'cube-icon': Cube,
        'hex-icon': Hexagon,
        'resize-icon': ResizeIcon,
        'multi-icon': MultiIcon,
        'mini-bot': BotTagMini,
        'tag-value-editor': TagValueEditor,
    },
})
export default class BotTable extends Vue {
    @Prop() bots: Bot[];
    @Prop({ default: null }) searchResult: any;
    @Prop({ default: () => <any>[] })
    extraTags: string[];
    @Prop({ default: false })
    readOnly: boolean;
    @Prop({ default: 'single' })
    selectionMode: SelectionMode;
    @Prop({ default: false })
    diffSelected: boolean;
    @Prop({ default: false })
    isSearch: boolean;
    @Prop({ default: false })
    setLargeSheet: boolean;
    /**
     * A property that can be set to indicate to the table that its values should be updated.
     */
    @Prop({})
    updateTime: number;

    tags: string[] = [];
    addedTags: string[] = [];
    lastEditedTag: string = null;
    focusedBot: Bot = null;
    focusedTag: string = null;
    isFocusedTagFormula: boolean = false;
    multilineValue: string = '';
    isMakingNewTag: boolean = false;
    newTag: string = 'myNewTag';
    newTagValid: boolean = true;
    newTagPlacement: NewTagPlacement = 'top';
    numBotsSelected: number = 0;
    viewMode: 'rows' | 'columns' = 'columns';
    showHidden: boolean = false;

    tagBlacklist: (string | boolean)[][] = [];
    blacklistIndex: boolean[] = [];
    blacklistCount: number[] = [];
    editableMap: Map<string, boolean>;

    showCreateWorksurfaceDialog: boolean = false;
    worksurfaceContext: string = '';
    worksurfaceAllowPlayer: boolean = false;
    showSurface: boolean = true;

    private _simulation: BrowserSimulation;
    private _isMobile: boolean;

    lastTag: string = '';
    wasLastEmpty: boolean = false;
    newTagOpen: boolean = false;
    dropDownUsed: boolean = false;
    deletedBot: Bot = null;
    deletedBotId: string = '';
    showBotDestroyed: boolean = false;
    lastSelectionCount: number = 0;

    uiHtmlElements(): HTMLElement[] {
        if (this.$refs.tags) {
            return [
                ...(<BotTag[]>this.$refs.tags)
                    .filter(t => t.allowCloning)
                    .map(t => t.$el),
                ...(<BotID[]>this.$refs.tags).map(t => t.$el),
            ];
        } else {
            return [];
        }
    }

    isAllTag(tag: string): boolean {
        return tag === '#';
    }

    isSpecialTag(tag: string): boolean {
        if (tag === 'actions()' || tag === 'hidden') {
            return true;
        } else {
            return false;
        }
    }

    isMobile(): boolean {
        return this._isMobile;
    }

    toggleSheet() {
        EventBus.$emit('toggleSheetSize');
    }

    isBlacklistTagActive(index: number): boolean {
        return <boolean>this.tagBlacklist[index][1];
    }

    getBlacklistCount(index: number): number {
        return this.tagBlacklist[index].length - 2;
    }

    isBotReadOnly(bot: Bot): boolean {
        return this.editableMap.get(bot.id) === false;
    }

    get botTableGridStyle() {
        const sizeType = this.viewMode === 'rows' ? 'columns' : 'rows';

        if (this.diffSelected) {
            if (this.tags.length === 0) {
                return {
                    [`grid-template-${sizeType}`]: `auto auto auto`,
                };
            }

            return {
                [`grid-template-${sizeType}`]: `auto auto repeat(${
                    this.tags.length
                }, auto) auto`,
            };
        } else {
            if (this.tags.length === 0) {
                return {
                    [`grid-template-${sizeType}`]: `auto auto auto`,
                };
            }

            return {
                [`grid-template-${sizeType}`]: `auto auto repeat(${
                    this.tags.length
                }, auto) auto`,
            };
        }
    }

    getBotManager() {
        return this._simulation;
    }

    get hasBots() {
        return this.bots.length > 0;
    }

    get hasTags() {
        return this.tags.length > 0;
    }

    get newTagExists() {
        return this.tagExists(this.newTag);
    }

    isEmptyDiff(): boolean {
        if (this.diffSelected) {
            if (this.bots[0].id === 'empty' && this.addedTags.length === 0) {
                return true;
            }
        }

        return false;
    }

    @Watch('bots')
    botsChanged() {
        if (
            this.bots[0] != null &&
            this.bots[0].id.startsWith('mod') &&
            this.addedTags.length > 0
        ) {
            this.addedTags = [];
            appManager.simulationManager.primary.botPanel.isOpen = false;
            this.getBotManager().selection.setMode('single');

            appManager.simulationManager.primary.recent.clear();
            appManager.simulationManager.primary.botPanel.keepSheetsOpen();
        }

        if (
            this.lastSelectionCount === 2 &&
            this.bots.length === 1 &&
            this.selectionMode === 'multi'
        ) {
            this.getBotManager().selection.setMode('single');
        }

        this.lastSelectionCount = this.bots.length;

        this.setTagBlacklist();
        this._updateTags();
        this.numBotsSelected = this.bots.length;
        if (this.focusedBot) {
            this.focusedBot =
                this.bots.find(f => f.id === this.focusedBot.id) || null;
        }

        this._updateEditable();

        if (this.wasLastEmpty) {
            this.wasLastEmpty = false;
            this.$nextTick(() => {
                const tags = this.$refs.tagValues as BotValue[];
                for (let tag of tags) {
                    if (tag.tag === this.lastTag) {
                        tag.$el.focus();

                        break;
                    }
                }
            });
        }
    }

    @Watch('multilineValue')
    multilineValueChanged() {
        if (this.focusedBot && this.focusedTag) {
            if (
                this.focusedBot.id === 'empty' ||
                this.focusedBot.id === 'mod'
            ) {
                const updated = merge(this.focusedBot, {
                    tags: {
                        [this.focusedTag]: this.multilineValue,
                    },
                    values: {
                        [this.focusedTag]: this.multilineValue,
                    },
                });
                this.getBotManager().recent.addBotDiff(updated, true);
            } else {
                this.getBotManager().helper.updateBot(this.focusedBot, {
                    tags: {
                        [this.focusedTag]: this.multilineValue,
                    },
                });
            }
        }
    }

    flipTable() {
        if (this.viewMode === 'rows') {
            this.viewMode = 'columns';
        } else {
            this.viewMode = 'rows';
        }
    }

    async toggleBot(bot: Bot) {
        if (this.isSearch) {
            if (this.bots.length > 1) {
                for (let i = this.bots.length - 1; i >= 0; i--) {
                    if (this.bots[i] === bot) {
                        this.bots.splice(i, 1);
                        break;
                    }
                }
                this.getBotManager().selection.setSelectedBots(this.bots);
            }
            this.getBotManager().botPanel.search = '';
        } else {
            if (this.bots.length === 1) {
                appManager.simulationManager.primary.selection.clearSelection();
                appManager.simulationManager.primary.botPanel.search = '';
                appManager.simulationManager.primary.recent.clear();
            } else {
                this.getBotManager().selection.selectBot(
                    bot,
                    false,
                    this.getBotManager().botPanel
                );
            }
        }
    }

    async undoDelete() {
        if (this.deletedBot) {
            this.showBotDestroyed = false;
            await this.getBotManager().helper.createBot(
                this.deletedBot.id,
                this.deletedBot.tags
            );
        }
    }

    async deleteBot(bot: Bot) {
        const destroyed = await this.getBotManager().helper.destroyBot(bot);
        if (destroyed) {
            if (this.selectionMode != 'multi') {
                appManager.simulationManager.primary.botPanel.isOpen = false;
                this.getBotManager().selection.setMode('single');
            }
            appManager.simulationManager.primary.recent.clear();
            appManager.simulationManager.primary.botPanel.keepSheetsOpen();
            this.deletedBot = bot;
            this.deletedBotId = getShortId(bot);
            this.showBotDestroyed = true;
        } else {
            this.deletedBot = null;
            this.deletedBotId = null;
            await this.getBotManager().helper.transaction(
                toast(`Cannot destroy ${getShortId(bot)}`)
            );
        }
    }

    botCreated(bot: PrecalculatedBot) {
        this.getBotManager().selection.selectBot(
            bot,
            true,
            this.getBotManager().botPanel
        );
    }

    async createBot() {
        const id = await this.getBotManager().helper.createBot();

        this.getBotManager()
            .watcher.botChanged(id)
            .pipe(first(f => !!f))
            .subscribe(f => this.botCreated(f));
    }

    selectNewTag() {
        if (!this.isMakingNewTag && !this.newTagOpen && !this.dropDownUsed) {
            this.isMakingNewTag = true;
            this.newTag = '';
            this.newTagPlacement = 'bottom';
        } else {
            this.newTagOpen = false;
        }
    }

    addTag(placement: NewTagPlacement = 'top') {
        if (this.dropDownUsed) {
            return;
        }

        if (this.isMakingNewTag) {
            this.dropDownUsed = true;
            this.newTagOpen = true;

            this.$nextTick(() => {
                this.$nextTick(() => {
                    this.dropDownUsed = false;
                    this.isMakingNewTag = false;
                    this.newTag = '';
                    this.newTagOpen = false;
                });
            });

            // Check to make sure that the tag is unique.
            if (this.tagExists(this.newTag)) {
                var options = new AlertDialogOptions();
                options.title = 'Tag already exists';
                options.body =
                    "Tag '" + this.newTag + "' already exists on this bot.";
                options.confirmText = 'Close';

                // Emit dialog event.
                EventBus.$emit('showAlertDialog', options);
                return;
            }

            if (!this.tagNotEmpty(this.newTag)) {
                var options = new AlertDialogOptions();
                options.title = 'Tag cannot be empty';
                options.body = 'Tag is empty or contains only whitespace......';
                options.confirmText = 'Close';

                // Emit dialog event.
                EventBus.$emit('showAlertDialog', options);
                return;
            }

            this.wasLastEmpty = this.isEmptyDiff();
            if (this.isEmptyDiff()) {
                this.lastTag = this.newTag;
            }

            if (this.newTagPlacement === 'top') {
                this.addedTags.unshift(this.newTag);
                this.tags.unshift(this.newTag);
            } else {
                this.addedTags.push(this.newTag);
                this.tags.push(this.newTag);
            }

            const addedTag = this.newTag;

            this._updateTags();
            this.$nextTick(() => {
                const tags = this.$refs.tagValues as BotValue[];
                for (let tag of tags) {
                    if (tag.tag === addedTag) {
                        tag.$el.focus();
                        break;
                    }
                }
            });
        } else {
            this.newTag = '';
            this.newTagPlacement = placement;
        }
    }

    openNewTag(placement: NewTagPlacement = 'top') {
        this.isMakingNewTag = true;
        this.newTag = '';
        this.newTagPlacement = placement;
    }

    finishAddTag(inputTag: string) {
        if (this.dropDownUsed) {
            return;
        }

        this.newTag = inputTag;
        this.newTagPlacement = 'bottom';

        this.dropDownUsed = true;
        this.newTagOpen = true;

        if (inputTag.includes('onCombine(')) {
            this.$nextTick(() => {
                this.$nextTick(() => {
                    this.dropDownUsed = false;
                });
            });
            return;
        }

        this.$nextTick(() => {
            this.$nextTick(() => {
                this.dropDownUsed = false;
                this.isMakingNewTag = false;
                this.newTag = '';
                this.newTagOpen = false;
                EventBus.$off('AutoFill');
                EventBus.$once('AutoFill', this.finishAddTag);
            });
        });

        // Check to make sure that the tag is unique.
        if (this.tagExists(this.newTag)) {
            var options = new AlertDialogOptions();
            options.title = 'Tag already exists';
            options.body =
                "Tag '" + this.newTag + "' already exists on this bot.";
            options.confirmText = 'Close';

            // Emit dialog event.
            EventBus.$emit('showAlertDialog', options);
            return;
        }

        if (!this.tagNotEmpty(this.newTag)) {
            var options = new AlertDialogOptions();
            options.title = 'Tag cannot be empty';
            options.body = 'Tag is empty or contains only whitespace.';
            options.confirmText = 'Close';

            // Emit dialog event.
            EventBus.$emit('showAlertDialog', options);
            return;
        }

        this.wasLastEmpty = this.isEmptyDiff();
        if (this.isEmptyDiff()) {
            this.lastTag = this.newTag;
        }

        this.addedTags.push(this.newTag);
        this.tags.push(this.newTag);

        const addedTag = this.newTag;

        this._updateTags();
        this.$nextTick(() => {
            const tags = this.$refs.tagValues as BotValue[];
            for (let tag of tags) {
                if (tag.tag === addedTag) {
                    tag.$el.focus();

                    break;
                }
            }
        });

        this.newTag = '';
        this.newTagPlacement = 'bottom';
        this.cancelNewTag();
    }

    closeWindow() {
        this.$emit('closeWindow');
    }

    cancelNewTag() {
        this.isMakingNewTag = false;
    }

    clearSearch() {
        this.getBotManager().botPanel.search = '';
    }

    async clearSelection() {
        this.addedTags = [];

        await this.getBotManager().selection.selectBot(
            <AuxBot>this.bots[0],
            false,
            this.getBotManager().botPanel
        );

        this.getBotManager().recent.addBotDiff(this.bots[0], true);
        await this.getBotManager().selection.clearSelection();
        appManager.simulationManager.primary.botPanel.isOpen = true;
    }

    async multiSelect() {
        await this.getBotManager().selection.setSelectedBots(this.bots);
    }

    async downloadBots() {
        if (this.hasBots) {
            const stored = await this.getBotManager().exportBots(
                this.bots.map(f => f.id)
            );
            let tree = new AuxCausalTree(stored);
            await tree.import(stored);
            downloadAuxState(tree, `selection-${Date.now()}`);
        }
    }

    public createSurface(): void {
        this.worksurfaceContext = createContextId();
        this.showSurface = true;
        this.worksurfaceAllowPlayer = false;
        this.showCreateWorksurfaceDialog = true;
    }

    /**
     * Confirm event from the create worksurface dialog.
     */
    async onConfirmCreateWorksurface() {
        this.showCreateWorksurfaceDialog = false;

        const nextPosition = nextAvailableWorkspacePosition(
            this.getBotManager().helper.createContext()
        );
        const finalPosition = gridPosToRealPos(
            nextPosition,
            DEFAULT_WORKSPACE_SCALE * 1.1
        );
        const workspace = await this.getBotManager().helper.createWorkspace(
            undefined,
            this.worksurfaceContext,
            this.worksurfaceAllowPlayer,
            this.showSurface,
            finalPosition.x,
            finalPosition.y
        );

        if (!this.diffSelected) {
            const calc = this.getBotManager().helper.createContext();
            for (let i = 0; i < this.bots.length; i++) {
                const bot = this.bots[i];
                await this.getBotManager().helper.updateBot(bot, {
                    tags: {
                        ...addToContextDiff(
                            calc,
                            this.worksurfaceContext,
                            0,
                            0,
                            i
                        ),
                    },
                });
            }
        }

        this.resetCreateWorksurfaceDialog();
    }

    /**
     * Cancel event from the create worksurface dialog.
     */
    onCancelCreateWorksurface() {
        this.resetCreateWorksurfaceDialog();
    }

    resetCreateWorksurfaceDialog() {
        this.showCreateWorksurfaceDialog = false;
        this.worksurfaceAllowPlayer = false;
        this.showSurface = true;
    }

    onTagChanged(bot: Bot, tag: string, value: string) {
        this.lastEditedTag = this.focusedTag = tag;
        this.focusedBot = bot;
        this.multilineValue = value;
        this.isFocusedTagFormula = isFormula(value);
    }

    onTagFocusChanged(bot: Bot, tag: string, focused: boolean) {
        if (focused) {
            this.focusedBot = bot;
            this.focusedTag = tag;
            this.multilineValue = this.focusedBot.tags[this.focusedTag];
            this.isFocusedTagFormula = isFormula(this.multilineValue);

            this.$nextTick(() => {
                if (this.$refs.multiLineEditor) {
                    (<any>this.$refs.multiLineEditor).applyStyles();
                }
            });
        }
        this.$emit('tagFocusChanged', bot, tag, focused);
    }

    toggleHidden() {
        this.showHidden = !this.showHidden;
        this.setTagBlacklist();
        this._updateTags();
    }

    removeTag(tag: string) {
        if (
            tag === this.lastEditedTag ||
            tag === this.newTag ||
            tag === this.focusedTag
        ) {
            this.lastEditedTag = null;
            this.focusedTag = null;
        }
        const index = this.addedTags.indexOf(tag);
        if (index >= 0) {
            this.addedTags.splice(index, 1);
        }

        this.setTagBlacklist();
        this._updateTags();
    }

    tagHasValue(tag: string): boolean {
        return some(this.bots, f => hasValue(f.tags[tag]));
    }

    isHiddenTag(tag: string): boolean {
        return isHiddenTag(tag);
    }

    tagExists(tag: string): boolean {
        return this.tags.indexOf(tag, 0) !== -1;
    }

    tagNotEmpty(tag: string): boolean {
        return tag.trim() != '';
    }

    newTagValidityUpdated(valid: boolean) {
        this.newTagValid = valid;
    }

    getShortId(bot: Bot) {
        return getShortId(bot);
    }

    getTagCellClass(bot: Bot, tag: string) {
        return {
            focused: bot === this.focusedBot && tag === this.focusedTag,
        };
    }

    async clearDiff() {
        this.lastEditedTag = null;
        this.focusedTag = null;
        this.addedTags.length = 0;
        this.getBotManager().recent.clear();
    }

    constructor() {
        super();
        this.editableMap = new Map();
    }

    async created() {
        const bowserResult = Bowser.parse(navigator.userAgent);
        this._isMobile = bowserResult.platform.type === 'mobile';

        appManager.whileLoggedIn((user, sim) => {
            this._simulation = sim;
            return [];
        });

        this.setTagBlacklist();
        this._updateTags();
        this.numBotsSelected = this.bots.length;
        this._updateEditable();

        EventBus.$on('addTag', this.openNewTag);
        EventBus.$on('closeNewTag', this.cancelNewTag);

        EventBus.$off('AutoFill');

        EventBus.$once('AutoFill', this.finishAddTag);
    }

    private _updateTags() {
        const editingTags = this.lastEditedTag ? [this.lastEditedTag] : [];
        const allExtraTags = union(this.extraTags, this.addedTags, editingTags);

        this.tags = botTags(
            this.bots,
            this.tags,
            allExtraTags,
            true,
            this.tagBlacklist
        ).sort();
    }

    toggleBlacklistIndex(index: number) {
        this.tagBlacklist[index][1] = !this.tagBlacklist[index][1];
        this._updateTags();
    }

    setTagBlacklist() {
        let sortedArray: string[] = getAllBotTags(this.bots, true).sort();

        // remove any duplicates from the array to fix multiple bots adding in duplicate tags
        sortedArray = sortedArray.filter(function(elem, index, self) {
            return index === self.indexOf(elem);
        });

        let blacklist: (string | boolean)[][] = [];

        let actionList: (string | boolean)[] = [];
        let hiddenList: (string | boolean)[] = [];
        let generalList: (string | boolean)[] = [];

        for (let i = sortedArray.length - 1; i >= 0; i--) {
            if (isHiddenTag(sortedArray[i])) {
                hiddenList.push(sortedArray[i]);
                sortedArray.splice(i, 1);
            } else if (sortedArray[i].includes('()')) {
                actionList.push(sortedArray[i]);
                sortedArray.splice(i, 1);
            }
        }

        let current = '';
        let tempArray: (string | boolean)[] = [];
        for (let i = sortedArray.length - 1; i >= 0; i--) {
            if (current.split('.')[0] != sortedArray[i].split('.')[0]) {
                if (tempArray.length > 0) {
                    if (blacklist.length === 0) {
                        blacklist = [tempArray];
                    } else {
                        blacklist.push(tempArray);
                    }
                }

                tempArray = [];
            }
            current = sortedArray[i];

            // if new tag matces the current tag section
            if (tempArray.length === 0) {
                // if the temp array has been reset

                // add the section name in slot 0
                tempArray.push(current.split('.')[0]);

                let activeCheck = false;
                // add the section visibility in slot 1
                if (this.tagBlacklist.length > 0) {
                    this.tagBlacklist.forEach(element => {
                        if (element[0] === tempArray[0]) {
                            activeCheck = <boolean>element[1];
                        }
                    });
                }
                tempArray.push(activeCheck);

                // add the tag that started the match in slot 2
                tempArray.push(current);

                sortedArray.splice(i, 2);
            } else {
                tempArray.push(sortedArray[i]);
                sortedArray.splice(i, 1);
            }
        }

        // makes sure if the loop ends on an array it will add in the temp array correctly to the blacklist
        if (tempArray.length > 0) {
            if (blacklist.length === 0) {
                blacklist = [tempArray];
            } else {
                blacklist.push(tempArray);
            }
        }

        if (actionList.length > 0) {
            let activeCheck = false;

            if (this.tagBlacklist.length > 0) {
                this.tagBlacklist.forEach(element => {
                    if (element[0] === 'actions()') {
                        activeCheck = <boolean>element[1];
                    }
                });
            }

            actionList.unshift(activeCheck);
            actionList.unshift('actions()');
            blacklist.unshift(actionList);
        } else {
            actionList.forEach(actionTags => {
                sortedArray.push(<string>actionTags);
            });
        }

        if (hiddenList.length > 0) {
            let activeCheck = false;

            if (this.tagBlacklist.length > 0) {
                this.tagBlacklist.forEach(element => {
                    if (element[0] === 'hidden') {
                        activeCheck = <boolean>element[1];
                    }
                });
            }

            hiddenList.unshift(activeCheck);
            hiddenList.unshift('hidden');
            blacklist.unshift(hiddenList);
        } else {
            hiddenList.forEach(hiddenTags => {
                sortedArray.push(<string>hiddenTags);
            });
        }

        if (sortedArray.length > 0) {
            let activeCheck = true;

            if (this.tagBlacklist.length > 0) {
                this.tagBlacklist.forEach(element => {
                    if (element[0] === '#') {
                        activeCheck = <boolean>element[1];
                    }
                });
            }

            generalList.unshift(activeCheck);
            generalList.unshift('#');

            sortedArray.forEach(generalTags => {
                generalList.push(<string>generalTags);
            });

            blacklist.unshift(generalList);
        }

        this.tagBlacklist = blacklist;
    }

    getTagBlacklist(): string[] {
        let tagList: string[] = [];

        this.tagBlacklist.forEach(element => {
            tagList.push(<string>element[0]);
        });

        return tagList;
    }

    getVisualTagBlacklist(index: number): string {
        let newBlacklist: string;

        if ((<string>this.tagBlacklist[index][0]).length > 15) {
            newBlacklist =
                (<string>this.tagBlacklist[index][0]).substring(0, 15) + '..';
        } else {
            newBlacklist =
                (<string>this.tagBlacklist[index][0]).substring(0, 15) + '.*';
        }

        return '#' + newBlacklist;
    }

    private _updateEditable() {
        const calc = this.getBotManager().helper.createContext();
        for (let bot of this.bots) {
            this.editableMap.set(bot.id, isEditable(calc, bot));
        }
    }

    searchForTag(tag: string) {
        if (this.tagHasValue(tag))
            this.getBotManager().botPanel.search = 'getBots("' + tag + '")';
    }
}

/**
 * Defines a set of valid positions that a new tag can be positioned at in the list.
 */
export type NewTagPlacement = 'top' | 'bottom';
