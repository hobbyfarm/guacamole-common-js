#!/usr/bin/env node

/**
 * Checks if there's a newer Guacamole version on Maven than the one
 * currently recorded in guac-dist/package.json. 
 * If so, rebuild -> commit -> push to main.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const childProcess = require('child_process');
const { parseStringPromise } = require('xml2js');

const GUAC_DIST_PKG_PATH = path.join(__dirname, '..', 'guac-dist', 'package.json');
const MAVEN_METADATA_URL =
  'https://repo1.maven.org/maven2/org/apache/guacamole/guacamole-common-js/maven-metadata.xml';

function getLocalVersion() {
  if (!fs.existsSync(GUAC_DIST_PKG_PATH)) {
    // If no package => assume no local version
    return null;
  }
  const pkgData = JSON.parse(fs.readFileSync(GUAC_DIST_PKG_PATH, 'utf8'));
  return pkgData.version; // The guacamole-common-js version last built
}

async function getMavenLatest() {
  return new Promise((resolve, reject) => {
    https
      .get(MAVEN_METADATA_URL, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to fetch Maven metadata: ${res.statusCode}`));
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', async () => {
          try {
            const parsed = await parseStringPromise(data);
            const mavenLatest = parsed.metadata.versioning[0].latest[0];
            resolve(mavenLatest);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  const localVersion = getLocalVersion();
  const mavenVersion = await getMavenLatest();

  console.log('Local Guacamole version:', localVersion);
  console.log('Maven Guacamole version:', mavenVersion);

  if (localVersion === mavenVersion) {
    console.log('No update needed. Already up-to-date.');
    return;
  }

  console.log(`Newer version detected: ${mavenVersion}. Building...`);
  // 1) Build with the new version
  //    We'll assume we are "cd scripts && npm run build-guacamole"
  childProcess.execSync('npm run build-guacamole', {
    cwd: __dirname, // run from scripts folder
    stdio: 'inherit'
  });

  // 2) Commit + push to main
  childProcess.execSync('git config user.name "github-actions[bot]"');
  childProcess.execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
  childProcess.execSync('git add ..', { cwd: __dirname });
  childProcess.execSync(`git commit -m "chore: update to Guacamole ${mavenVersion}"`, { cwd: __dirname });
  childProcess.execSync('git push', { cwd: __dirname });

  console.log('Pushed updated version to main.');
}

main().catch((err) => {
  console.error('check-latest failed:', err);
  process.exit(1);
});
