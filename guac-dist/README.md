# guacamole-common-js

This repository tracks the official [guacamole-common-js](https://mvnrepository.com/artifact/org.apache.guacamole/guacamole-common-js) release on Maven and periodically builds a tree-shakable ECMAScript module from it.

## Overview

The goal of this project is to fetch the latest release of the Apache Guacamole Common JS library from Maven Central, convert it into an ES module with named exports, and publish it as an npm package. This way we allow modern bundlers to "tree shake" for smaller bundle sizes.

The project is split into two main parts:

- **Build Scripts**: Located in the `scripts/` directory. These scripts are responsible for downloading, unzipping, transforming, and rebuilding the Guacamole source code.
- **Published Package**: The final npm package is assembled in the `guac-dist/` folder, containing:
  - A `dist/` directory with the built ES module (`index.js`)
  - A `package.json` file configured for ES modules

## Repository Structure
```
my-guac-repo/
├─ .github/
│   └─ workflows/
│       └─ release.yml   # GitHub Actions workflow
│
├─ guac-dist/
│   ├─ dist/
│   │   └─ index.js      # Final ESM build
│   ├─ README.md         # npm Readme (copied from main repo)
│   └─ package.json      # npm package metadata
│
├─ scripts/
│   ├─ package.json      # Dev depedendencies
│   ├─ build-guacamole.js
│   └─ check-latest.js
│
├─ README.md             # Main repo Readme
└─ LICENSE               # Apache 2.0 License
```

## Building the package
```bash
cd scripts
npm run build-guacamole
```

## Usage
To reference this package in your project as `guacamole-common-js` you can include it in your package.json the following way:
```json
  "dependencies": {
    "guacamole-common-js": "npm:@philipab/guacamole-common@^1.5.5"
  },
```

This package is compatible with [@types/guacamole-common-js](https://www.npmjs.com/package/@types/guacamole-common-js). You can import this package in TypeScript the following way:
```ts
// Named imports (if you only need specific functionality):
import { Keyboard, Tunnel } from 'guacamole-common-js';

// Or, use the default export:
import Guacamole from 'guacamole-common-js';
const client = new Guacamole.Client(/* ... */);
```
