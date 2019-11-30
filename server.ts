// These are important and needed before anything else
import 'zone.js/dist/zone-node';
import 'reflect-metadata';

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const { ensureDirSync } = require('fs-extra');
const { enableProdMode } = require('@angular/core');
// Faster server renders w/ Prod mode (dev mode never needed)
enableProdMode();
const { renderModuleFactory } = require('@angular/platform-server');

// Import module map for lazy loading
// import { provideModuleMap } from '@nguniversal/module-map-ngfactory-loader';


const rootDir = process.cwd();

const PRE_RENDER_CONFIG = require(join(rootDir, '.prerender.conf.json'));

const BROWSER_FOLDER = join(rootDir, `${PRE_RENDER_CONFIG['browserPath']}`);
const SERVER_FOLDER = join(rootDir, `${PRE_RENDER_CONFIG['serverPath']}`);

// * NOTE :: leave this as require() since this file is built Dynamically from webpack
const { AppServerModuleNgFactory, ngExpressEngine, provideModuleMap, LAZY_MODULE_MAP } = require(SERVER_FOLDER);

// Load the index.html file containing referances to your application bundle.
const INDEX = readFileSync(join(BROWSER_FOLDER, 'index.html'), 'utf8');
const PATHS = () => {
  return new Promise<string[]>((resolve, reject) => {
    const paths = PRE_RENDER_CONFIG['paths'];
    if (paths) {
      resolve(paths);
    } else {
      reject('Configuration was not found');
    }
  });
};

console.log('ite', provideModuleMap);

/** Build */
function build() {
  const ROUTES: {
    route: string,
    file: string,
  }[] = [];
  /** Read routes */
  PATHS()
  .then((json) => {
    /** Creating routes */
    json.forEach(route => {
      ROUTES.push(transformUrl(route));
    });

    let previousRender = Promise.resolve();
    // Iterate each route path
    ROUTES.forEach(route => {
      const fullPath = join(BROWSER_FOLDER, route.route);

      // Make sure the directory structure is there
      if (!existsSync(fullPath)) {
        ensureDirSync(fullPath);
      }
      /** Writes rendered HTML to index.html, replacing the file if it already exists. */
      previousRender = previousRender.then(_ => {
        console.log(LAZY_MODULE_MAP);
        console.time(`${route.file}`);
        return renderModuleFactory(AppServerModuleNgFactory, {
          document: INDEX,
          url: join('/', route.route),
          extraProviders: [
            provideModuleMap(LAZY_MODULE_MAP)
          ]
        });
      }).then(html => {
        console.timeEnd(`${route.file}`);
        writeFileSync(join(BROWSER_FOLDER, `${route.file}`), html);
      });
    });
  });
}

build();

/** Get directory & file name from string */
export function transformUrl(url: string) {
  const toRoute = (str: string) => str.split('/').filter(item => !!item).join('/');
  const file = toRoute(join(url, 'index.html'));
  const route = toRoute(url);
  return { route, file };
}
