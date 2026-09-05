const { Component } = require('./Components');

class Grid {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.cells = Array(height).fill(null).map(() => Array(width).fill(null));
        this.components = [];
    }

    addComponent(component) {
        if (!(component instanceof Component)) {
            throw new Error("Invalid component");
        }
        if (component.x < 0 || component.x >= this.width || component.y < 0 || component.y >= this.height) {
            throw new Error("Component out of bounds");
        }
        if (this.cells[component.y][component.x] !== null) {
            throw new Error("Cell already occupied");
        }
        
        this.cells[component.y][component.x] = component;
        this.components.push(component);
    }

    removeComponent(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const comp = this.cells[y][x];
        if (comp) {
            this.cells[y][x] = null;
            this.components = this.components.filter(c => c !== comp);
        }
    }

    getComponent(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
        return this.cells[y][x];
    }
}

module.exports = { Grid };
