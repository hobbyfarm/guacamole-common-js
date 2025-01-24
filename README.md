# guacamole-common-js

This repository tracks the official [guacamole-common-js](https://mvnrepository.com/artifact/org.apache.guacamole/guacamole-common-js) release on Maven and periodically builds a tree-shakable ECMAScript module from it. The tracking works semi-automatically with renovate bot.

## Overview

The goal of this project is to fetch the latest release of the Apache Guacamole Common JS library from Maven Central, convert it into an ES module with named exports, and publish it as an npm package. This way we allow modern bundlers to "tree shake" for smaller bundle sizes.

The project is split into two main parts:

- **Build Scripts**: Located in the `scripts/` directory. These scripts are responsible for downloading, unzipping, transforming, testing and rebuilding the Guacamole source code.
- **GitHub Workflows**: Located in the `.github/workflows` directory. This folder contains the following 3 jobs:
  - `renovate-runner.yml`: The job to run our renovate bot (once per month)
  - `build.yml`: The build job to build and test our bundled esm module on PRs
  - `release.yml`: A job which triggers a new release if changes were made to the **VERSION** const of our `build-guacamole.js`

## Repository Structure
```
my-guac-repo/
├─ .github/
│   └─ workflows/
│       ├─ build.yml
│       ├─ release.yml
│       └─ renovate-runner.yml
│
├─ guac-dist/                 # not contained in this repo, but created if build-guacamole.js is run
│   ├─ dist/
│   │   └─ index.js           # final ESM build
│   ├─ README.md              # npm Readme (copied from main repo)
│   └─ package.json           # npm package metadata
│
├─ scripts/
│   ├─ node_modules/          # compiled dev dependencies
│   ├─ tests/
│   │   └─ test-exports.mjs   # file to test our npm package exports
│   ├─ build-guacamole.js     # file to build our npm package
│   ├─ package-lock.json
│   └─ package.json           # dev dependencies metadata
│
├─ LICENSE                    # Apache 2.0 License
├─ README.md                  # Main repo Readme
└─ renovate.json              # config for renovate bot
```

## Building the package
```bash
cd scripts
npm run build-guacamole
```

- **Published Package**: The final npm package is assembled in the `guac-dist/` folder, containing:
  - A `dist/` directory with the built ES module (`index.js`)
  - A `package.json` file configured for ES modules

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
