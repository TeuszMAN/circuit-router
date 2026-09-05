const { AndGate, OrGate, NotGate } = require('../src/logic/Components');

describe('Logic Gates Transformation', () => {
    describe('AND Gate', () => {
        let andGate;
        beforeEach(() => {
            andGate = new AndGate(0, 0);
        });

        test('0 AND 0 = 0', () => {
            expect(andGate.evaluate(0, 0)).toBe(0);
        });

        test('0 AND 1 = 0', () => {
            expect(andGate.evaluate(0, 1)).toBe(0);
        });

        test('1 AND 0 = 0', () => {
            expect(andGate.evaluate(1, 0)).toBe(0);
        });

        test('1 AND 1 = 1', () => {
            expect(andGate.evaluate(1, 1)).toBe(1);
        });

        test('undefined inputs should return undefined', () => {
            expect(andGate.evaluate(1, undefined)).toBeUndefined();
            expect(andGate.evaluate(undefined, 0)).toBeUndefined();
            expect(andGate.evaluate(undefined, undefined)).toBeUndefined();
        });
    });

    describe('OR Gate', () => {
        let orGate;
        beforeEach(() => {
            orGate = new OrGate(0, 0);
        });

        test('0 OR 0 = 0', () => {
            expect(orGate.evaluate(0, 0)).toBe(0);
        });

        test('0 OR 1 = 1', () => {
            expect(orGate.evaluate(0, 1)).toBe(1);
        });

        test('1 OR 0 = 1', () => {
            expect(orGate.evaluate(1, 0)).toBe(1);
        });

        test('1 OR 1 = 1', () => {
            expect(orGate.evaluate(1, 1)).toBe(1);
        });

        test('undefined inputs should return undefined', () => {
            expect(orGate.evaluate(0, undefined)).toBeUndefined();
            expect(orGate.evaluate(undefined, 0)).toBeUndefined();
            expect(orGate.evaluate(undefined, undefined)).toBeUndefined();
        });
    });

    describe('NOT Gate', () => {
        let notGate;
        beforeEach(() => {
            notGate = new NotGate(0, 0);
        });

        test('NOT 0 = 1', () => {
            expect(notGate.evaluate(0)).toBe(1);
        });

        test('NOT 1 = 0', () => {
            expect(notGate.evaluate(1)).toBe(0);
        });

        test('undefined input should return undefined', () => {
            expect(notGate.evaluate(undefined)).toBeUndefined();
        });
    });
});
