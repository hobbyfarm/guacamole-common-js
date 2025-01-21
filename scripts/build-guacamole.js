#!/usr/bin/env node

/**
 * Builds a local "guacamole-common-js" package:
 *   - Fetches latest from Maven
 *   - Unzips to a .tmp folder
 *   - Uses esbuild to produce dist/index.js with named + default exports
 *   - Writes guac-dist/package.json
 *   - Cleans up
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const { parseStringPromise } = require("xml2js");
const { build } = require("esbuild");

// Where final library goes:
const GUAC_DIST_DIR = path.join(__dirname, "..", "guac-dist");
const DIST_DIR = path.join(GUAC_DIST_DIR, "dist");
// Temp folder for unzipping:
const TMP_DIR = path.join(GUAC_DIST_DIR, ".tmp-guac");

// Maven metadata:
const MAVEN_METADATA_URL =
  "https://repo1.maven.org/maven2/org/apache/guacamole/guacamole-common-js/maven-metadata.xml";

async function getLatestVersion() {
  console.log("Fetching Maven metadata from:", MAVEN_METADATA_URL);
  return new Promise((resolve, reject) => {
    https
      .get(MAVEN_METADATA_URL, (res) => {
        if (res.statusCode !== 200) {
          return reject(
            new Error(
              `Failed to fetch Maven metadata (status: ${res.statusCode})`
            )
          );
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", async () => {
          try {
            const parsed = await parseStringPromise(data);
            const latest = parsed.metadata.versioning[0].latest[0];
            resolve(latest);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

async function downloadZip(version) {
  const zipUrl = `https://repo1.maven.org/maven2/org/apache/guacamole/guacamole-common-js/${version}/guacamole-common-js-${version}.zip`;
  console.log(`Downloading Guacamole Common JS v${version} from: ${zipUrl}`);
  return new Promise((resolve, reject) => {
    https
      .get(zipUrl, (res) => {
        if (res.statusCode !== 200) {
          return reject(
            new Error(`Failed to download zip (status: ${res.statusCode})`)
          );
        }
        const zipFilePath = path.join(
          __dirname,
          `guacamole-common-js-${version}.zip`
        );
        const fileStream = fs.createWriteStream(zipFilePath);
        res.pipe(fileStream);
        fileStream.on("finish", () =>
          fileStream.close(() => resolve(zipFilePath))
        );
        fileStream.on("error", reject);
      })
      .on("error", reject);
  });
}

async function unzipFile(zipFilePath, targetDir) {
  console.log(`Unzipping to: ${targetDir}`);
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipFilePath)
      .pipe(unzipper.Extract({ path: targetDir }))
      .on("close", resolve)
      .on("error", reject);
  });
}

/**
 * Parse 'all.js' to discover lines of the form:
 *   var Guacamole = Guacamole || {};
 *   Guacamole.<Type> = function [OptionalName](
 * We'll gather these <Type> names for named exports.
 */
function findGuacamoleTypes(allJsPath) {
  const codeLines = fs.readFileSync(allJsPath, "utf8").split("\n");

  const GUAC_DEF_REGEX = /^var\s+Guacamole\s*=\s*Guacamole\s*\|\|\s*{};?$/;
  const GUAC_ASSIGN_REGEX =
    /^Guacamole\.([^.]+)\s*=\s*function(?:\s+[A-Za-z0-9_$]+)?\s*\(/;

  let active = false;
  const types = new Set();

  for (const line of codeLines) {
    const trimmed = line.trim();
    if (GUAC_DEF_REGEX.test(trimmed)) {
      active = true;
      continue;
    }
    if (!active) {
      continue;
    }
    const m = trimmed.match(GUAC_ASSIGN_REGEX);
    if (m) {
      types.add(m[1]);
    }
  }
  console.log("Discovered Guacamole types:", Array.from(types));
  return [...types];
}

async function bundleToEsm(allJsPath, discoveredTypes) {
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // Build named exports:
  let namedExports = "";
  for (const t of discoveredTypes) {
    // No indent so we avoid weird spacing
    namedExports += `export const ${t} = Guacamole.${t};\n`;
  }

  await build({
    entryPoints: [allJsPath],
    outfile: path.join(DIST_DIR, "index.js"),
    bundle: true,
    format: "esm",
    define: {
      window: "globalThis",
      "window.Guacamole": "Guacamole",
    },
    footer: {
      js: `${namedExports}export default Guacamole;`,
    },
    sourcemap: false,
    minify: true,
  });

  console.log(`esbuild: created ESM at ${path.join(DIST_DIR, "index.js")}`);
}

function createPackageJson(latestVersion) {
  // We store final package config in guac-dist/package.json
  // with version set to the latest Guacamole version
  const pkg = {
    name: "@philipab/guacamole-common-js",
    version: latestVersion,
    description:
      "Guacamole Common JS (ESM-bundled from Maven, with named + default exports)",
    license: "Apache-2.0",
    type: "module",
    main: "./dist/index.js",
    // Only publish dist + package.json
    files: ["dist", "package.json", "README.md"],
    author:
      "https://github.com/PhilipAB/guacamole-common-js/graphs/contributors",
    bugs: {
      url: "https://github.com/PhilipAB/guacamole-common-js/issues",
    },
    homepage: "https://github.com/PhilipAB/guacamole-common-js",
    repository: {
      type: "git",
      url: "https://github.com/PhilipAB/guacamole-common-js.git",
    },
    keywords: ["guacamole", "guacamole-common-js"],
    publishConfig: {
      access: "public",
    },
  };

  const pkgPath = path.join(GUAC_DIST_DIR, "package.json");
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
  console.log(`Wrote package.json => ${pkgPath}`);
}

function copyReadme() {
  const rootReadme = path.join(__dirname, "..", "README.md");
  const destReadme = path.join(GUAC_DIST_DIR, "README.md");
  if (fs.existsSync(rootReadme)) {
    fs.copyFileSync(rootReadme, destReadme);
    console.log(`Copied README.md to ${destReadme}`);
  } else {
    console.log("No root README.md to copy.");
  }
}

async function main() {
  try {
    const latestVersion = await getLatestVersion();
    console.log("Latest Guacamole version:", latestVersion);

    if (!fs.existsSync(GUAC_DIST_DIR)) {
      fs.mkdirSync(GUAC_DIST_DIR, { recursive: true });
    }

    // 1) Download ZIP
    const zipPath = await downloadZip(latestVersion);

    // 2) Unzip to TMP_DIR
    if (fs.existsSync(TMP_DIR)) {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TMP_DIR, { recursive: true });
    await unzipFile(zipPath, TMP_DIR);

    // 3) Remove the ZIP
    fs.unlinkSync(zipPath);

    // 4) Locate all.js
    const files = fs.readdirSync(TMP_DIR);
    let allJsDir = path.join(TMP_DIR, files[0]);
    if (fs.existsSync(path.join(TMP_DIR, "all.js"))) {
      allJsDir = TMP_DIR;
    }
    const allJsPath = path.join(allJsDir, "all.js");
    if (!fs.existsSync(allJsPath)) {
      throw new Error(`Could not find "all.js" in ${allJsDir}`);
    }

    // 5) discover named exports
    const types = findGuacamoleTypes(allJsPath);

    // 6) esbuild -> dist/index.js
    await bundleToEsm(allJsPath, types);

    // 7) create package.json in guac-dist
    createPackageJson(latestVersion);

    // 8) copy readme from root directory into guac-dist
    copyReadme();

    // 9) remove .tmp-guac
    fs.rmSync(TMP_DIR, { recursive: true, force: true });

    console.log(
      '\nDone! "guac-dist" now contains dist/ + package.json (version:',
      latestVersion,
      ")"
    );
    console.log("You can publish with:");
    console.log("  cd guac-dist && npm publish");
  } catch (err) {
    console.error("Error building guacamole-common-js:", err);
    process.exit(1);
  }
}

main();
