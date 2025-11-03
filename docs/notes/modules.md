# Best practices for Node applications
- Use `nodenext` modules.
- If the application is part of a mono repo, extend base configuration.



# Script

Self contained. No imports or exports.

```javascript
function add(a, b) {
  return a + b;
}
console.log(add(10, 20));
```

# CommonJS

Module definition:

```javascript
// add.js
function add(a, b) {
  return a + b;
}

module.exports = add;
```

Module consumption:

```javascript
const add = require('./add.js');

console.log(add(10, 20));
```

tsconfig.json
```json
{
  "compilerOptions": {
    // Code
    "rootDir": "src", // <- in
    "outDir": "dist", // <- out

    // Syntax
    "lib": ["ES2022"], // <- in
    "target": "ES2022", // <- out

    // Modules
    "moduleResoultion": "node", // <- in
    "module": "commonjs", // <- out

    // Type checking behaviour
    "strict": true
  }
}
```

# ECMAScript Module (ESM)

Module declaration:

```javascript
// add.js
function add(a, b) {
  return a + b;
}

export { add };
```

Module consumption:

```javascript
import { add } from './add.js';

console.log(add(10, 20));
```

Forces you to use extensions to import.
`.js` works with `.ts` too, the compiler figures it out.

```json
// package.json
{
  "type": "module" // <- defaults to commonjs
}
```

tsconfig.json for backend
```json
{
  "compilerOptions": {
    // Code
    "rootDir": "src", // <- in
    "outDir": "dist", // <- out

    // Syntax
    "lib": ["ES2022"], // <- in
    "target": "ES2022", // <- out

    // Modules
    "moduleResoultion": "node16", // <- in
    "module": "node16", // <- out

    // Type checking behaviour
    "strict": true
  }
}
```

tsconfig.json for frontend
```json
{
  "compilerOptions": {
    // Code
    "rootDir": "src", // <- in
    "outDir": "dist", // <- out

    // Syntax
    "lib": ["ES2022"], // <- in
    "target": "ES2022", // <- out

    // Modules
    "moduleResoultion": "bundler", // <- in
    "module": "esnext", // <- out

    // Type checking behaviour
    "strict": true
  }
}
```


# Summary

For bundlers (web), Bun and tsx:
- type: module
- module: esnext
- moduleResoultion: bundler

For backend, use:
- type: module
- module: node16 (lock down the version) or nodenext (equivalent of :latest tag)
- moduleResoultion: is usually implied by the module