const { Wire, Source, Sink, LogicGate, Component } = require('./Components');
const { Grid } = require('./Grid');

class LogicEngine {
    constructor(grid) {
        this.grid = grid;
    }

    // Evaluate the circuit until stable or max iterations reached
    evaluate(maxIterations = 1000) {
        // Reset state
        for (let comp of this.grid.components) {
            if (comp instanceof Wire) comp.value = undefined;
            if (comp instanceof Sink) comp.value = undefined;
            if (comp instanceof LogicGate) comp.output = undefined;
        }

        let changed = true;
        let iterations = 0;

        while (changed && iterations < maxIterations) {
            changed = false;
            iterations++;

            // 1. Sources drive their adjacent cells
            for (let comp of this.grid.components) {
                if (comp instanceof Source) {
                    const dx = comp.direction === 'E' ? 1 : comp.direction === 'W' ? -1 : 0;
                    const dy = comp.direction === 'S' ? 1 : comp.direction === 'N' ? -1 : 0;
                    const neighbor = this.grid.getComponent(comp.x + dx, comp.y + dy);
                    if (neighbor && neighbor instanceof Wire) {
                        if (neighbor.value !== comp.value) {
                            if (neighbor.value !== undefined && neighbor.value !== comp.value) {
                                throw new Error(`Short circuit at wire (${neighbor.x}, ${neighbor.y})`);
                            }
                            neighbor.value = comp.value;
                            changed = true;
                        }
                    }
                }
            }

            // 2. Wires propagate to adjacent wires
            for (let comp of this.grid.components) {
                if (comp instanceof Wire && comp.value !== undefined) {
                    const neighbors = [
                        this.grid.getComponent(comp.x + 1, comp.y),
                        this.grid.getComponent(comp.x - 1, comp.y),
                        this.grid.getComponent(comp.x, comp.y + 1),
                        this.grid.getComponent(comp.x, comp.y - 1)
                    ];
                    for (let n of neighbors) {
                        if (n && n instanceof Wire) {
                            if (n.value === undefined) {
                                n.value = comp.value;
                                changed = true;
                            } else if (n.value !== comp.value) {
                                throw new Error(`Short circuit at wire (${n.x}, ${n.y})`);
                            }
                        }
                    }
                }
            }

            // 3. Logic Gates evaluate
            for (let comp of this.grid.components) {
                if (comp instanceof LogicGate) {
                    const inputCoords = comp.getInputRelCoords();
                    let inputs = [];
                    for (let rel of inputCoords) {
                        const n = this.grid.getComponent(comp.x + rel.dx, comp.y + rel.dy);
                        if (n && n instanceof Wire && n.value !== undefined) {
                            inputs.push(n.value);
                        } else if (n && n instanceof Source && n.direction === this.getOppositeDir(this.getDirFromRel(rel))) {
                            // Direct connection from source
                            inputs.push(n.value);
                        } else if (n && n instanceof LogicGate) {
                            // Direct connection from another gate's output? 
                            // Only if the other gate's output points to this gate's input
                            const nOut = n.getOutputRelCoords();
                            if (n.x + nOut.dx === comp.x && n.y + nOut.dy === comp.y && n.output !== undefined) {
                                inputs.push(n.output);
                            }
                        }
                    }

                    // Evaluate based on gate type
                    let newOutput = undefined;
                    if (comp.type === 'NOT') {
                        newOutput = comp.evaluate(inputs[0]);
                    } else if (comp.type === 'AND' || comp.type === 'OR') {
                        if (inputs.length >= 2) {
                            newOutput = comp.evaluate(inputs[0], inputs[1]);
                        } else if (inputs.length === 1) {
                            // If only 1 input is connected, we might want to evaluate it (e.g. AND with undefined is undefined, OR with 1 is 1)
                            newOutput = comp.evaluate(inputs[0], undefined);
                        }
                    }

                    if (newOutput !== comp.output) {
                        comp.output = newOutput;
                        changed = true;
                        
                        // Drive output wire if exists
                        const outRel = comp.getOutputRelCoords();
                        const outN = this.grid.getComponent(comp.x + outRel.dx, comp.y + outRel.dy);
                        if (outN && outN instanceof Wire) {
                            if (outN.value !== undefined && outN.value !== newOutput) {
                                throw new Error(`Short circuit at wire (${outN.x}, ${outN.y})`);
                            }
                            outN.value = newOutput;
                        }
                    }
                }
            }
        }

        if (iterations >= maxIterations) {
            throw new Error('Circuit evaluation reached max iterations (Possible cycle/oscillator)');
        }

        // 4. Update Sinks
        for (let comp of this.grid.components) {
            if (comp instanceof Sink) {
                const dx = comp.direction === 'E' ? -1 : comp.direction === 'W' ? 1 : comp.direction === 'S' ? -1 : 1;
                // Actually if Sink expects input from W, the neighbor is at x-1
                let nx = comp.x, ny = comp.y;
                if (comp.direction === 'W') nx -= 1;
                else if (comp.direction === 'E') nx += 1;
                else if (comp.direction === 'N') ny -= 1;
                else if (comp.direction === 'S') ny += 1;

                const neighbor = this.grid.getComponent(nx, ny);
                if (neighbor && neighbor instanceof Wire) {
                    comp.value = neighbor.value;
                } else if (neighbor && neighbor instanceof LogicGate) {
                    const nOut = neighbor.getOutputRelCoords();
                    if (neighbor.x + nOut.dx === comp.x && neighbor.y + nOut.dy === comp.y) {
                        comp.value = neighbor.output;
                    }
                }
                comp.check();
            }
        }
    }

    getOppositeDir(dir) {
        if (dir === 'N') return 'S';
        if (dir === 'S') return 'N';
        if (dir === 'E') return 'W';
        if (dir === 'W') return 'E';
        return '';
    }

    getDirFromRel(rel) {
        if (rel.dx === 1) return 'E'; 
        if (rel.dx === -1) return 'W'; 
        if (rel.dy === 1) return 'S';
        if (rel.dy === -1) return 'N';
        return '';
    }
}

module.exports = { LogicEngine };
