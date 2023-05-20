#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface Parameters {
  [key: string]: any;
}

class Rmrkreator {
  public run(parameters: Parameters): void {
    // Your implementation here
    console.log('Running with parameters:', parameters);
  }
}

function main(): void {
  const argv = yargs(hideBin(process.argv))
    .scriptName('rmrkreator')
    .usage('$0 <command> [options]')
    .command(
      'run',
      'Execute the Rmrkreator CLI tool',
      (yargs) => {
        // Add your desired options here
        yargs.option('example', {
          alias: 'e',
          type: 'string',
          description: 'An example option',
        });
      },
      (argv) => {
        const parameters: Parameters = argv;
        const rmrkreator = new Rmrkreator();
        rmrkreator.run(parameters);
      }
    )
    .demandCommand(1, 'You must provide a valid command')
    .help()
    .alias('help', 'h')
    .argv;
}

main();
