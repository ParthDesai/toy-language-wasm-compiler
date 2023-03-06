import chalk from 'chalk';
import { Command } from 'commander';
import { Main } from '../language-server/generated/ast';
import { WorldsLanguageMetaData } from '../language-server/generated/module';
import { createWorldsServices } from '../language-server/worlds-module';
import { extractAstNode } from './cli-util';
import { generateWasm } from './generator';
import { parseAndValidate } from './parse-validate';
import { NodeFileSystem } from 'langium/node';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createWorldsServices(NodeFileSystem).Worlds;
    const main = await extractAstNode<Main>(fileName, services);
    const generatedFilePath = generateWasm(main, fileName, opts.destination);
    console.log(chalk.green(`Wasm code generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

export default function(): void {
    const program = new Command();

    program
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        .version(require('../../package.json').version);

    const fileExtensions = WorldsLanguageMetaData.fileExtensions.join(', ');
    program
        .command('generate')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('generates JavaScript code that prints "Hello, {name}!" for each greeting in a source file')
        .action(generateAction);

    program
        .command('parseAndValidate')
        .argument('<file>', 'Source file to parse & validate (ending in ${fileExtensions})')
        .description('Indicates where a program parses & validates successfully, but produces no output code')
        .action(parseAndValidate);

    program.parse(process.argv);
}
