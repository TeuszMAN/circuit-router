import { Grid } from './src/logic/Grid.js';
import { LogicEngine } from './src/logic/LogicEngine.js';
import { Wire, Source, Sink, AndGate, OrGate, NotGate } from './src/logic/Components.js';

const COLS = 12;
const ROWS = 8;
let grid = new Grid(COLS, ROWS);
let engine = new LogicEngine(grid);

let currentTool = 'WIRE';
let isDragging = false;

const gridContainer = document.getElementById('grid-container');
const statusPanel = document.getElementById('status');

// Setup initial level
function loadLevel() {
    grid = new Grid(COLS, ROWS);
    engine = new LogicEngine(grid);
    
    // Add Sources
    grid.addComponent(new Source(0, 2, 1, 'E'));
    grid.addComponent(new Source(0, 5, 0, 'E'));
    
    // Add Sinks
    grid.addComponent(new Sink(11, 3, 1, 'W')); // Expects 1
    
    renderGrid();
}

function renderGrid() {
    gridContainer.innerHTML = '';
    gridContainer.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    gridContainer.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'cell';
            cellDiv.dataset.x = x;
            cellDiv.dataset.y = y;
            
            const comp = grid.getComponent(x, y);
            if (comp) {
                if (comp instanceof Wire) {
                    cellDiv.classList.add('wire');
                    if (comp.value === 1) cellDiv.classList.add('signal-1');
                    if (comp.value === 0) cellDiv.classList.add('signal-0');
                } else if (comp instanceof Source) {
                    cellDiv.classList.add('source');
                    cellDiv.dataset.val = comp.value;
                } else if (comp instanceof Sink) {
                    cellDiv.classList.add('sink');
                    if (comp.value !== undefined) {
                        cellDiv.classList.add(comp.isSatisfied ? 'satisfied' : 'failed');
                    }
                } else if (comp instanceof AndGate) {
                    cellDiv.classList.add('gate');
                    cellDiv.dataset.dir = comp.direction;
                    cellDiv.textContent = 'AND';
                } else if (comp instanceof OrGate) {
                    cellDiv.classList.add('gate');
                    cellDiv.dataset.dir = comp.direction;
                    cellDiv.textContent = 'OR';
                } else if (comp instanceof NotGate) {
                    cellDiv.classList.add('gate');
                    cellDiv.dataset.dir = comp.direction;
                    cellDiv.textContent = 'NOT';
                }
            }

            // Events
            cellDiv.addEventListener('mousedown', () => { isDragging = true; applyTool(x, y); });
            cellDiv.addEventListener('mouseenter', () => { if (isDragging) applyTool(x, y); });
            cellDiv.addEventListener('mouseup', () => { isDragging = false; });
            
            gridContainer.appendChild(cellDiv);
        }
    }
}

document.addEventListener('mouseup', () => isDragging = false);

function applyTool(x, y) {
    const comp = grid.getComponent(x, y);
    // Don't overwrite Source or Sink
    if (comp instanceof Source || comp instanceof Sink) return;

    if (currentTool === 'ERASER') {
        grid.removeComponent(x, y);
    } else {
        grid.removeComponent(x, y);
        let newComp = null;
        if (currentTool === 'WIRE') newComp = new Wire(x, y);
        else if (currentTool === 'AND') newComp = new AndGate(x, y, 'E');
        else if (currentTool === 'OR') newComp = new OrGate(x, y, 'E');
        else if (currentTool === 'NOT') newComp = new NotGate(x, y, 'E');
        
        if (newComp) grid.addComponent(newComp);
    }
    
    // Clear simulation state on change
    clearSimulation();
    renderGrid();
}

function clearSimulation() {
    for (let c of grid.components) {
        if (c instanceof Wire) c.value = undefined;
        if (c instanceof Sink) { c.value = undefined; c.isSatisfied = false; }
        if (c.output !== undefined) c.output = undefined;
    }
    statusPanel.textContent = 'System Ready';
    statusPanel.className = 'status-panel';
}

document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTool = e.target.dataset.type;
    });
});

document.getElementById('simulate-btn').addEventListener('click', () => {
    try {
        engine.evaluate();
        
        // Check win condition
        let allSatisfied = true;
        let hasSinks = false;
        for (let c of grid.components) {
            if (c instanceof Sink) {
                hasSinks = true;
                if (!c.isSatisfied) allSatisfied = false;
            }
        }
        
        renderGrid();
        
        if (allSatisfied && hasSinks) {
            statusPanel.textContent = 'CIRCUIT COMPLETE! ALL ACTUATORS ACTIVE.';
            statusPanel.className = 'status-panel success';
        } else {
            statusPanel.textContent = 'CIRCUIT FAILED! INCORRECT SIGNALS.';
            statusPanel.className = 'status-panel error';
        }
    } catch(err) {
        renderGrid();
        statusPanel.textContent = 'ERROR: ' + err.message;
        statusPanel.className = 'status-panel error';
    }
});

document.getElementById('reset-btn').addEventListener('click', () => {
    loadLevel();
    statusPanel.textContent = 'System Ready';
    statusPanel.className = 'status-panel';
});

loadLevel();
