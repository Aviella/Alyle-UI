import * as chokidar from 'chokidar';
import { promises } from 'fs';
import { mdToHtml } from '../html-loader/loader';
import { createHash } from 'crypto';
import chalk from 'chalk';

const { writeFile, readFile } = promises;

const watcher = chokidar.watch('./src/**/*.md');


const start = async () => {
  console.log(chalk.green('Markdown to Html\nWatching...'));

  watcher.on('all', async (ev, path, stats) => {
    if (stats && stats.isFile) {
      const htmlPath = `${path.slice(0, path.length - 2)}html`;
      const file = await readFile(path).catch(() => null);
      const htmlFile = await readFile(htmlPath).catch(() => null);
      let html = mdToHtml(file!.toString('utf8'));
      html = `<!-- Do not edit this file`
        + ` because it is automatically generated. -->\n${html}`;


      if (!htmlFile || sha1(htmlFile.toString('utf8')) !== sha1(html)) {
        writeFile(htmlPath, html);
        console.log(chalk.greenBright(`Updated: `) + htmlPath);
      }
    }
  });

};

try {
  start().catch((err) => {
    console.error(`Error\n${err}`);
    process.exit(1);
  });
} catch (err) {
  console.error(`Error\n${err}`);
  process.exit(1);
}

function sha1(input: string) {
  return createHash('sha1').update(input).digest('hex');
}
