const { Grid } = require('../src/logic/Grid');
const { LogicEngine } = require('../src/logic/LogicEngine');
const { Source, Sink, Wire, AndGate, NotGate } = require('../src/logic/Components');

describe('LogicEngine', () => {
    let grid;
    let engine;

    beforeEach(() => {
        grid = new Grid(10, 10);
        engine = new LogicEngine(grid);
    });

    test('propagates signal from Source to Sink via Wires', () => {
        const source = new Source(0, 0, 1, 'E');
        const w1 = new Wire(1, 0);
        const w2 = new Wire(2, 0);
        const sink = new Sink(3, 0, 1, 'W'); // expects 1 from West

        grid.addComponent(source);
        grid.addComponent(w1);
        grid.addComponent(w2);
        grid.addComponent(sink);

        engine.evaluate();

        expect(w1.value).toBe(1);
        expect(w2.value).toBe(1);
        expect(sink.value).toBe(1);
        expect(sink.isSatisfied).toBe(true);
    });

    test('evaluates NOT gate correctly', () => {
        const source = new Source(0, 0, 1, 'E');
        const notGate = new NotGate(1, 0, 'E'); // input from W, output to E
        const sink = new Sink(2, 0, 0, 'W'); // expects 0

        grid.addComponent(source);
        grid.addComponent(notGate);
        grid.addComponent(sink);

        engine.evaluate();

        expect(notGate.output).toBe(0);
        expect(sink.value).toBe(0);
        expect(sink.isSatisfied).toBe(true);
    });

    test('evaluates AND gate correctly', () => {
        const source1 = new Source(0, 0, 1, 'E');
        const source2 = new Source(1, 1, 1, 'N');
        const andGate = new AndGate(1, 0, 'E'); // input from W and S (and N)
        const sink = new Sink(2, 0, 1, 'W');

        grid.addComponent(source1); // points to (1, 0)
        grid.addComponent(source2); // points to (1, 0)
        grid.addComponent(andGate); // at (1, 0), output to E (2, 0)
        grid.addComponent(sink);    // at (2, 0)

        engine.evaluate();

        expect(andGate.output).toBe(1);
        expect(sink.value).toBe(1);
        expect(sink.isSatisfied).toBe(true);
    });

    test('detects short circuit', () => {
        const source1 = new Source(0, 0, 1, 'E');
        const source2 = new Source(2, 0, 0, 'W');
        const w1 = new Wire(1, 0);

        grid.addComponent(source1);
        grid.addComponent(source2);
        grid.addComponent(w1);

        expect(() => engine.evaluate()).toThrow(/Short circuit/);
    });
});
