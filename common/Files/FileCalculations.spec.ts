import {
    isFormula, 
    isNumber,
    isArray,
    updateFile,
    createCalculationContext,
    createFile,
    tagsMatchingFilter,
    calculateFileValue
} from './FileCalculations';
import {
    cloneDeep
} from 'lodash';
import { File, Object } from './File';

describe('FileCalculations', () => {
    describe('isFormula()', () => {
        it('should be true when value starts with a "=" sign', () => {
            expect(isFormula('=')).toBeTruthy();
            expect(isFormula('a=')).toBeFalsy();
        });

        it('should be false when value does not start with a "=" sign', () => {
            expect(isFormula('abc')).toBeFalsy();
        });
    });

    describe('isNumber()', () => {
        it('should be true if the value is a number without symbols', () => {
            expect(isNumber('123')).toBeTruthy();
            expect(isNumber('0')).toBeTruthy();
            expect(isNumber('-12')).toBeTruthy();
            expect(isNumber('19.325')).toBeTruthy();
            expect(isNumber('-27.981')).toBeTruthy();
            expect(isNumber('27.0')).toBeTruthy();
            expect(isNumber('1.')).toBeTruthy();
            expect(isNumber('infinity')).toBeTruthy();
            expect(isNumber('Infinity')).toBeTruthy();
            expect(isNumber('InFIniTy')).toBeTruthy();
        });

        it('should be false if the value is not a number or has symbols', () => {
            expect(isNumber('$123')).toBeFalsy();
            expect(isNumber('abc')).toBeFalsy();
            expect(isNumber('.')).toBeFalsy();
        });
    });

    describe('isArray()', () => {
        it('should be true if the value is a simple list surrounded by square brackets', () => {
            expect(isArray('[1,2,3]')).toBeTruthy();
            expect(isArray('[1]')).toBeTruthy();
            expect(isArray('[]')).toBeTruthy();
            expect(isArray('[eggs, milk, ham]')).toBeTruthy();
            expect(isArray('[(eggs), milk, ham]')).toBeTruthy();
            expect(isArray('[(eggs), (milk, -ham)]')).toBeTruthy();

            expect(isArray('')).toBeFalsy();
            expect(isArray('abc, def, ghi')).toBeFalsy();
            expect(isArray('1,2,3')).toBeFalsy();
            expect(isArray('clone(this, { something: true })')).toBeFalsy();
        });

    });

    describe('calculateFileValue()', () => {
        it('should convert to a number if it is a number', () => {
            const file = createFile();
            file.tags.tag = '123.145'
            const context = createCalculationContext([file]);
            const value = calculateFileValue(context, file, 'tag');

            expect(value).toBeCloseTo(123.145);
        });

        it('should convert to a boolean if it is a boolean', () => {
            const file = createFile();
            file.tags.tag = 'true';

            const context = createCalculationContext([file]);
            const trueValue = calculateFileValue(context, file, 'tag');

            expect(trueValue).toBe(true);

            file.tags.tag = 'false';
            const falseValue = calculateFileValue(context, file, 'tag');

            expect(falseValue).toBe(false);
        });

        it('should convert arrays into arrays', () => {
            const file = createFile();
            file.tags.tag = '[test(a, b, c), 1.23, true]'
            const context = createCalculationContext([file]);
            const value = calculateFileValue(context, file, 'tag');

            expect(value).toEqual([
                'test(a',
                'b',
                'c)',
                1.23,
                true
            ]);
        });
    });

    describe('updateFile()', () => {
        it('should do nothing if there is no new data', () => {

            let file: Object = createFile();
            let newData = {};

            updateFile(file, newData, () => createCalculationContext([file]));

            expect(newData).toEqual({});
        });

        it('should set falsy fields to null in newData', () => {
            let file: Object = createFile();
            let newData = {
                tags: {
                    a: false,
                    b: '',
                    c: 0
                }
            };

            updateFile(file, newData, () => createCalculationContext([file]));

            expect(newData).toEqual({
                tags: {
                    a: null,
                    b: null,
                    c: null
                }
            });
        });

        it('should calculate assignment formulas', () => {
            let file = createFile();
            file.tags.num = 5;

            let newData: any = {
                tags: {
                    sum: ":=this.num + 5"
                }
            };

            updateFile(file, newData, () => createCalculationContext([file]));

            expect(newData.tags.sum.value).toBe(10);
            expect(newData.tags.sum.formula).toBe(':=this.num + 5');
        });
    });

    describe('tagsMatchingFilter()', () => {
        it('should return an empty array if no tags match', () => {
            let file = createFile();
            let other = createFile();
            
            const tags = tagsMatchingFilter(file, other, '+');

            expect(tags).toEqual([]);
        });

        it('should match based on tag and exact value', () => {
            let file = createFile();
            file.tags.name = "Test";
            file.tags.val = "";

            let other = createFile();
            other.tags['+(#name:"Test")'] = 'abc';
            other.tags['+(#val:"")'] = 'abc';
            other.tags['+(#name:"test")'] = 'def';
            
            const tags = tagsMatchingFilter(file, other, '+');

            expect(tags).toEqual([
                '+(#name:"Test")',
                '+(#val:"")'
            ]);
        });

        it('should only match tags in the "other" file', () => {
            let file = createFile();
            file.tags['+(#name:"Test")'] = 'abc';

            let other = createFile();
            other.tags.name = "Test";
            
            const tags = tagsMatchingFilter(file, other, '+');

            expect(tags).toEqual([]);
        });
    });
});