import chalk from 'chalk';
import { NodeFileSystem } from 'langium/node';
import { createWorldsServices } from '../language-server/worlds-module';
import { extractDocument } from './cli-util';

/**
 * Parse and validate a program written in our language.
 * Verifies that no lexer or parser errors occur.
 * Implicitly also checks for validation errors while extracting the document
 *
 * @param fileName Program to validate
 */
export async function parseAndValidate(fileName: string): Promise<void> {
    // retrieve the services for our language
    const services = createWorldsServices(NodeFileSystem).Worlds;
    // extract a document for our program
    const document = await extractDocument(fileName, services);
    // extract the parse result details
    const parseResult = document.parseResult;
    // verify no lexer, parser, or general diagnostic errors show up
    if (parseResult.lexerErrors.length === 0 && 
        parseResult.parserErrors.length === 0
    ) {
        console.log(chalk.green(`Parsed and validated ${fileName} successfully!`));
    } else {
        console.log(chalk.red(`Failed to parse and validate ${fileName}!`));
    }
}