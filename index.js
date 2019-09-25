#!/usr/bin/env node

const path = require('path');
const git = require('simple-git')();
const shell = require('shelljs')
const tmp = require('tmp');
const command = require('commander');
const fs = require('fs');
const pkg = require('./package.json');
const inquirer = require('inquirer');

let name;
const templateRepo = 'https://github.com/JBKLabs/example-react-project';

const run = (message, cb) => (...args) => new Promise(async (resolve) => {
  console.log(`${message} ...`);
  cb(...args, (result) => {
    console.log('\tdone.');
    resolve(result);
  });
}); 

const createProjectDirectory = (name) => {
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
};

const cloneExampleProject = run('cloning example project', (cb) => {
  tmp.dir({ unsafeCleanup: true }, (err, tmpPath, cleanupCallback) => {
    if (err) {
      throw err;
    }

    const branchName = command.branch;

    git.clone(templateRepo, tmpPath, () => {
      const result = {
        path: tmpPath,
        clear: cleanupCallback
      }

      if (branchName) {
        git.cwd(tmpPath).checkout(branchName, () => {
          console.log(`checking out branch ${branchName} ...`);
          cb(result);
        });
      } else {
        cb(result);
      }
    });
  });
});

const replaceToken = (tempPath, [key, value]) => {
  if (key && value) {
    shell.ls('-RA', `${tempPath}`).forEach((file) => {
      try {
        shell.sed('-i',`<% ${key} %>`, value.toString(), path.join(tempPath, file));
      } catch {}
    });
  }
}

const renderTemplate = run('rendering template', (template, projectPath, options, cb) => {
  shell.rm('-rf', path.join(template.path, './.git'));
  Object.entries(options).forEach(o => replaceToken(template.path, o));
  shell.cp('-rf', `${template.path}/*`, projectPath);
  shell.cp('-rf', `${template.path}/.*`, projectPath);
  template.clear();
  cb();
});

const prepareProject = run('preparing project', (projectPath, options, cb) => {
  shell.cd(projectPath);

  if (options.initializeGit && shell.exec('git init').code !== 0) {
    shell.echo('Error: git init failed');
    shell.exit(1);
  }

  console.log('installing dependencies ...')

  if (shell.exec('npm i').code !== 0) {
    shell.echo('Error: npm install failed');
    shell.exit(1);
  }

  cb();
});

const promptUser = (projectPath) => new Promise((resolve) => {
  const gitPrompt = !fs.existsSync(`${projectPath}/.git`)
    ? [{
      type: 'confirm',
      message: 'Would you like to initialize git?',
      name: 'initializeGit'
    }] : [];

  inquirer.prompt([
    { 
      type: "input",
      message: "Enter your project name:",
      name: "projectName"
    },
    ...gitPrompt
  ])
  .then(resolve);
})

command
  .version(pkg.version)
  .arguments('<directoryName>')
  .option('-b, --branch [branch]', 'example-react-project branch name')
  .action(async (directoryName) => {
    name = directoryName;
    const projectPath = name ? `./${name}` : '.';
    createProjectDirectory(name);
    const options = await promptUser(projectPath);
    const template = await cloneExampleProject();
    await renderTemplate(template, projectPath, options);
    await prepareProject(projectPath, options);
  });

command.parse(process.argv);

if(typeof name === 'undefined') {
  console.error('Directory name is required.');
  process.exit(1);
}