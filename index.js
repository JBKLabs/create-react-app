#!/usr/bin/env node

const path = require('path');
const git = require('simple-git')();
const shell = require('shelljs')
const tmp = require('tmp');
const command = require('commander');
const fs = require('fs');
const pkg = require('./package.json');

let name;
const templateRepo = 'https://mitregitlab0.jbknowledge.com/jbklabs/example-react-project.git';

const run = (message, cb) => (...args) => new Promise(async (resolve) => {
  console.log(`${message} ...`);
  cb(...args, (result) => {
    console.log('\tdone.');
    resolve(result);
  });
}); 

const createProjectDirectory = run('building project directory', (name, cb) => {
  if (name !== '.') {
    try {
      fs.mkdirSync(name);
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw new Error(`That directory already exists. Try running from within ${name}/ as 'create-react-app .'`);
      } else {
        throw error;
      }
    }
  }
  cb();
});

const cloneExampleProject = run('cloning example project', (cb) => {
  tmp.dir({ unsafeCleanup: true }, (err, tmpPath, cleanupCallback) => {
    if (err) {
      throw err;
    }

    git.clone(templateRepo, tmpPath, () => {
      cb({
        path: tmpPath,
        clear: cleanupCallback
      });
    });
  });
});

const renderTemplate = run('rendering template', (template, projectPath, cb) => {
  shell.rm('-rf', path.join(template.path, './.git'));
  // replace template strings
  shell.cp('-rf', `${template.path}/*`, projectPath);
  shell.cp('-rf', `${template.path}/.*`, projectPath);
  template.clear();
  cb();
});

const prepareProject = run('preparing project', (projectPath, cb) => {
  shell.cd(projectPath);
  if (shell.exec('npm i').code !== 0) {
    shell.echo('Error: npm install failed');
    shell.exit(1);
  }
  cb();
});

command
  .version(pkg.version)
  .arguments('<projectName>')
  .action(async (projectName) => {
    name = projectName;
    const projectPath = name ? `./${name}` : '.';
    await createProjectDirectory(name);
    const template = await cloneExampleProject();
    await renderTemplate(template, projectPath);
    await prepareProject(projectPath);
  });

command.parse(process.argv);

if(typeof name === 'undefined') {
  console.error('Project name is required.');
  process.exit(1);
}