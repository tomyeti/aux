import { RecentFilesManager } from './RecentFilesManager';
import { FileHelper } from './FileHelper';
import { AuxCausalTree, createFile } from '@casual-simulation/aux-common';
import { storedTree, site } from '@casual-simulation/causal-trees';

describe('RecentFilesManager', () => {
    let tree: AuxCausalTree;
    let helper: FileHelper;
    let recent: RecentFilesManager;
    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new FileHelper(tree, 'user');
        recent = new RecentFilesManager(helper);

        await tree.root();
        await helper.createFile('user');
    });

    it('should start with an empty file', () => {
        expect(recent.files).toEqual([
            {
                id: 'empty',
                tags: {},
            },
        ]);
    });

    describe('addTagDiff()', () => {
        it('should add a recent file for editing a tag', () => {
            recent.addTagDiff('testFileId', 'testTag', 'newValue');

            expect(recent.files).toEqual([
                {
                    id: 'testFileId',
                    tags: {
                        testTag: 'newValue',
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['testTag'],
                    },
                },
            ]);
        });

        it('should limit files to 1 file', () => {
            recent.addTagDiff('testFileId1', 'testTag1', 'newValue');
            recent.addTagDiff('testFileId2', 'testTag2', 'newValue');
            recent.addTagDiff('testFileId3', 'testTag3', 'newValue');
            recent.addTagDiff('testFileId4', 'testTag4', 'newValue');
            recent.addTagDiff('testFileId5', 'testTag5', 'newValue');
            recent.addTagDiff('testFileId6', 'testTag6', 'newValue');

            expect(recent.files).toEqual([
                {
                    id: 'testFileId6',
                    tags: {
                        testTag6: 'newValue',
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['testTag6'],
                    },
                },
            ]);
        });

        it('should send an updated event', () => {
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });

            recent.addTagDiff('testFileId', 'testTag', 'newValue');

            expect(updates).toEqual([1]);
        });

        it('should move reused IDs to the front of the list with the new value', () => {
            recent.addTagDiff('testFileId1', 'testTag1', 'newValue1');
            recent.addTagDiff('testFileId2', 'testTag2', 'newValue2');
            recent.addTagDiff('testFileId3', 'testTag3', 'newValue3');
            recent.addTagDiff('testFileId1', 'testTag4', 'newValue4');

            expect(recent.files).toEqual([
                {
                    id: 'testFileId1',
                    tags: {
                        testTag4: 'newValue4',
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['testTag4'],
                    },
                },
            ]);
        });

        it('should unselect the selected recent file', () => {
            recent.addTagDiff('abc', 'deg', 'ghi');
            recent.selectedRecentFile = recent.files[0];

            recent.addTagDiff('xyz', 'deg', 'ghi');

            expect(recent.selectedRecentFile).toBe(null);
        });

        it('should preserve the selected recent file if the ID is the same', () => {
            recent.addTagDiff('abc', 'deg', 'ghi');
            recent.selectedRecentFile = recent.files[0];

            recent.addTagDiff('abc', 'deg', 'zzz');

            expect(recent.selectedRecentFile).toEqual({
                id: 'abc',
                tags: {
                    deg: 'zzz',
                    'aux.mergeBall': true,
                    'aux.mergeBall.tags': ['deg'],
                },
            });
        });
    });

    describe('addFileDiff()', () => {
        it('should add the given file', () => {
            let file = createFile('testId', {
                test: 'abc',
                'aux.color': 'red',
            });
            recent.addFileDiff(file);

            expect(recent.files).toEqual([
                {
                    id: 'merge-testId',
                    tags: {
                        ...file.tags,
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['test', 'aux.color'],
                    },
                },
            ]);
        });

        it('should unselect the selected recent file', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });
            let file2 = createFile('testId2', {
                test: 'abc',
                'aux.color': 'green',
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            recent.addFileDiff(file2);

            expect(recent.selectedRecentFile).toBe(null);
        });

        it('should preserve the selected recent file if the ID is the same', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            let file2 = createFile('merge-testId1', {
                test1: 'abc',
                'aux.color': 'red',
                'aux.mergeBall': true,
                'aux.mergeBall.tags': ['test1', 'aux.color'],
            });

            recent.addFileDiff(file2);

            expect(recent.selectedRecentFile).toEqual({
                id: 'merge-testId1',
                tags: {
                    test1: 'abc',
                    'aux.color': 'red',
                    'aux.mergeBall': true,
                    'aux.mergeBall.tags': ['test1', 'aux.color'],
                },
            });
        });

        it('should ignore well known tags', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                'aux._destroyed': true,
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            expect(recent.files).toEqual([
                {
                    id: 'merge-testId1',
                    tags: {
                        test: 'abc',
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['test'],
                    },
                },
            ]);
        });

        it('should ignore context tags', async () => {
            await helper.createFile('context', {
                'aux.context': 'abc',
            });
            let file1 = createFile('testId1', {
                abc: true,
                'abc.x': 1,
                'abc.y': 2,
                'abc.index': 100,
                def: true,
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            expect(recent.files).toEqual([
                {
                    id: 'merge-testId1',
                    tags: {
                        def: true,
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['def'],
                    },
                },
            ]);
        });

        it('should be an empty file if no tags can be used as a diff', async () => {
            await helper.createFile('context', {
                'aux.context': 'abc',
            });
            let file1 = createFile('testId1', {
                abc: true,
                'abc.x': 1,
                'abc.y': 2,
                'abc.index': 100,
                'aux._user': 'abc',
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            expect(recent.files).toEqual([
                {
                    id: 'empty',
                    tags: {},
                },
            ]);
        });

        it('should update the diff tags', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            let file2 = createFile('merge-testId1', {
                test1: 'abc',
                'aux.color': 'red',
                'aux.mergeBall': true,
                'aux.mergeBall.tags': ['test1', 'aux.color'],
            });

            recent.addFileDiff(file2, true);

            expect(recent.selectedRecentFile).toEqual({
                id: 'merge-testId1',
                tags: {
                    test1: 'abc',
                    'aux.color': 'red',
                    'aux.mergeBall': true,
                    'aux.mergeBall.tags': ['test1', 'aux.color'],
                },
            });
        });

        it('should send updates', () => {
            let file = createFile('testId', {
                test: 'abc',
                'aux.color': 'red',
            });
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });
            recent.addFileDiff(file);

            expect(updates).toEqual([1]);
        });

        it('should trim to the max length', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });
            let file2 = createFile('testId2', {
                test: 'abc',
                'aux.color': 'green',
            });
            let file3 = createFile('testId3', {
                test: 'abc',
                'aux.color': 'blue',
            });
            let file4 = createFile('testId4', {
                test: 'abc',
                'aux.color': 'magenta',
            });
            let file5 = createFile('testId5', {
                test: 'abc',
                'aux.color': 'yellow',
            });
            let file6 = createFile('testId6', {
                test: 'abc',
                'aux.color': 'cyan',
            });

            recent.addFileDiff(file1);
            recent.addFileDiff(file2);
            recent.addFileDiff(file3);
            recent.addFileDiff(file4);
            recent.addFileDiff(file5);
            recent.addFileDiff(file6);

            expect(recent.files).toEqual([
                {
                    id: 'merge-testId6',
                    tags: {
                        ...file6.tags,
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['test', 'aux.color'],
                    },
                },
            ]);
        });

        it('should move reused IDs to the front of the list with the new value', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });
            let file2 = createFile('testId2', {
                test: 'abc',
                'aux.color': 'green',
            });
            let file3 = createFile('testId3', {
                test: 'abc',
                'aux.color': 'blue',
            });
            let file1_2 = createFile('testId1', {
                test1: '999',
                'aux.color': 'magenta',
            });

            recent.addFileDiff(file1);
            recent.addFileDiff(file2);
            recent.addFileDiff(file3);
            recent.addFileDiff(file1_2);

            expect(recent.files).toEqual([
                {
                    id: 'merge-testId1',
                    tags: {
                        ...file1_2.tags,
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['test1', 'aux.color'],
                    },
                },
            ]);
        });

        it('should move files that appear equal to the front of the list', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });
            let file2 = createFile('testId2', {
                test: 'abc',
                'aux.color': 'green',
            });
            let file3 = createFile('testId3', {
                test: 'abc',
                'aux.color': 'blue',
            });
            let file4 = createFile('testId4', {
                test: 'abc',
                'aux.color': 'red',
            });

            recent.addFileDiff(file1);
            recent.addFileDiff(file2);
            recent.addFileDiff(file3);
            recent.addFileDiff(file4);

            expect(recent.files).toEqual([
                {
                    id: 'merge-testId4',
                    tags: {
                        ...file4.tags,
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['test', 'aux.color'],
                    },
                },
            ]);
        });

        it('should ensure that diff IDs start with merge-', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                'aux.color': 'red',
                'aux.mergeBall': true,
                'aux.mergeBall.tags': ['aux.color'],
            });

            recent.addFileDiff(file1);

            expect(recent.files).toEqual([
                {
                    id: 'merge-testId1',
                    tags: {
                        'aux.color': 'red',
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['aux.color'],
                    },
                },
            ]);
        });

        it('should reuse the diff ID if it is correct', () => {
            let file1 = createFile('merge-testId1', {
                test: 'abc',
                'aux.color': 'red',
                'aux.mergeBall': true,
                'aux.mergeBall.tags': ['aux.color'],
            });

            recent.addFileDiff(file1);

            expect(recent.files).toEqual([
                {
                    id: 'merge-testId1',
                    tags: {
                        'aux.color': 'red',
                        'aux.mergeBall': true,
                        'aux.mergeBall.tags': ['aux.color'],
                    },
                },
            ]);
        });
    });

    describe('clear()', () => {
        it('should clear the recent list', () => {
            recent.addTagDiff('fileId', 'tag', 'value');
            recent.clear();
            expect(recent.files).toEqual([
                {
                    id: 'empty',
                    tags: {},
                },
            ]);
        });

        it('should send an update event', () => {
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });
            recent.addTagDiff('fileId', 'tag', 'value');
            recent.clear();

            expect(updates).toEqual([1, 1]);
        });
    });
});