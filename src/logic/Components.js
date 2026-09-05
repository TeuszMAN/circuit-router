class Component {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
    }
}

class LogicGate extends Component {
    constructor(type, x, y, direction = 'E') {
        super(type, x, y);
        this.direction = direction; // 'N', 'S', 'E', 'W'
    }
    
    // Returns relative output coordinate based on direction
    getOutputRelCoords() {
        switch(this.direction) {
            case 'N': return { dx: 0, dy: -1 };
            case 'S': return { dx: 0, dy: 1 };
            case 'E': return { dx: 1, dy: 0 };
            case 'W': return { dx: -1, dy: 0 };
            default: return { dx: 0, dy: 0 };
        }
    }
    
    // Returns relative input coordinates (all sides except output)
    getInputRelCoords() {
        const out = this.getOutputRelCoords();
        const dirs = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, 
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 }
        ];
        return dirs.filter(d => !(d.dx === out.dx && d.dy === out.dy));
    }

    evaluate() {
        throw new Error('Method not implemented.');
    }
}

class AndGate extends LogicGate {
    constructor(x, y, direction = 'E') {
        super('AND', x, y, direction);
    }
    evaluate(in1, in2) {
        if (in1 === undefined || in2 === undefined || in1 === null || in2 === null) return undefined;
        return (in1 === 1 && in2 === 1) ? 1 : 0;
    }
}

class OrGate extends LogicGate {
    constructor(x, y, direction = 'E') {
        super('OR', x, y, direction);
    }
    evaluate(in1, in2) {
        if (in1 === undefined || in2 === undefined || in1 === null || in2 === null) return undefined;
        return (in1 === 1 || in2 === 1) ? 1 : 0;
    }
}

class NotGate extends LogicGate {
    constructor(x, y, direction = 'E') {
        super('NOT', x, y, direction);
    }
    evaluate(in1) {
        if (in1 === undefined || in1 === null) return undefined;
        return in1 === 1 ? 0 : 1;
    }
}

class Wire extends Component {
    constructor(x, y) {
        super('WIRE', x, y);
        this.value = undefined;
    }
}

class Source extends Component {
    constructor(x, y, value, direction = 'E') {
        super('SOURCE', x, y);
        this.value = value;
        this.direction = direction;
    }
}

class Sink extends Component {
    constructor(x, y, expectedValue, direction = 'W') {
        super('SINK', x, y);
        this.expectedValue = expectedValue;
        this.value = undefined;
        this.isSatisfied = false;
        this.direction = direction; // Direction it expects input from
    }
    
    check() {
        this.isSatisfied = (this.value === this.expectedValue);
        return this.isSatisfied;
    }
}

module.exports = { Component, LogicGate, AndGate, OrGate, NotGate, Wire, Source, Sink };
