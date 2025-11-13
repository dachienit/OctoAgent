import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { llmService } from "./llm.js"; // Your LLM service
import { Marked, marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import path from 'node:path';
import fs from 'node:fs/promises'; // Use promises-based fs for async operations
import stripAnsi from 'strip-ansi'; // Make sure this import is correct
import axios from 'axios';
import { promises } from "node:dns";
import { fileURLToPath } from 'url';

marked.use(markedTerminal());
/**
 * Basic HTML template for the combined report.
 * @param {string} title - The title for the HTML page.
 * @param {string} bodyContent - The HTML content generated from markdown.
 * @returns {string} The complete HTML string.
 */
function createHtmlReport(title, bodyContent) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; margin: 20px; background-color: #f4f4f4; color: #333; }
        .container { max-width: 1000px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h1, h2, h3, h4, h5, h6 { color: #0056b3; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; }
        pre { background-color: #eee; padding: 10px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }
        code { font-family: monospace; background-color: #e0e0e0; padding: 2px 4px; border-radius: 3px; }
        blockquote { border-left: 4px solid #ccc; padding-left: 10px; color: #666; margin: 15px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        ${bodyContent}
    </div>
</body>
</html>`;
}

/**
 * Prompts the user for the R3 source code folder path.
 * @returns {Promise<string>} The absolute path to the R3 source code folder.
 */
async function promptR3FolderPath(tracker, issueKey, specRe) {
    if(issueKey === 'mRefactor'){
        const answers = await inquirer.prompt([
            /* {
                type: "input",
                name: "r3FolderPath",
                message: chalk.blue("Enter the absolute path to the R3 source code folder:"),
                validate: async (input) => {
                    try {
                        const stats = await fs.stat(input);
                        if (stats.isDirectory()) {
                            return true;
                        }
                        return "Path is not a directory. Please enter a valid folder path.";
                    } catch (error) {
                        return `Invalid path or directory not found: ${error.message}`;
                    }
                }
            },
            {
                type: "input",
                name: "outputFolderPath",
                message: chalk.blue("Enter the absolute path for the S4 converted code output folder (will be created if it doesn't exist):"),
                default: (answers) => path.join(answers.r3FolderPath, 's4_converted_code') // Default to a subfolder
            }, */
            {
                type: "input",
                name: "additionalRequirements",
                message: chalk.blue("Enter any specific requirements for the S4 conversion. Leave blank if none:"),
                default: ""
            }
        ]);
        return {
            tracker: '',
            issueKey: issueKey,
            r3FolderPath: 'C:\\Users\\IYH1HC\\Desktop\\AI\\OctoAgent\\package\\R3Code', 
            outputFolderPath: 'C:\\Users\\IYH1HC\\Desktop\\AI\\OctoAgent\\package\\S4Code',
            additionalRequirements: answers.additionalRequirements.trim()
        };
    }else{ 
        return { 
                tracker,
                issueKey,
                r3FolderPath: path.resolve(path.join(`${tracker}`, `${issueKey}`, "R3Code")),
                outputFolderPath: path.resolve(path.join(`${tracker}`, `${issueKey}`, "S4Code")),
                additionalRequirements: specRe 
            }; 
    }
}

/**
 * Main function to orchestrate the R3 to S4 conversion process.
 */
export async function ask() {

    console.log(chalk.green("\n--- R3 to S4 ABAP Code Converter ---"));
    console.log(chalk.yellow("This tool will convert ABAP files from a specified R3 folder to S4 ABAP 7.5+.\n"));

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const packageDir = path.dirname(__dirname);
    const r3FolderPath = path.join(packageDir, 'R3Code');
    const outputFolderPath = path.join(packageDir, 'S4Code');

    let spinner = ora(`Reading files from ${chalk.cyan(r3FolderPath)}`).start();

    try{
        await fs.mkdir(outputFolderPath, { recursive: true }); // Ensure output folder exists
        spinner.succeed(chalk.green(`Output folder created/ensured: ${chalk.cyan(outputFolderPath)}`));

        const files = await fs.readdir(r3FolderPath);
        const abapFiles = files.filter(file => file.endsWith('.abap') || file.endsWith('.txt') || file.endsWith('.prog') || file.endsWith('.incl')); // Filter for common ABAP extensions
        if (abapFiles.length === 0) {
            logCallback(`❌ No ABAP source code files found in https://rb-tracker.bosch.com/tracker19/browse/${issueKey} . Looking for .abap, .txt, .prog, .incl extensions.`);
            spinner.info(chalk.yellow(`No ABAP source code files found in ${r3FolderPath}. Looking for .abap, .txt, .prog, .incl extensions.`));
            return; }

        console.log(chalk.blue(`Found ${abapFiles.length} ABAP file(s) for conversion.`));
        
        for (const file of abapFiles) {
            const fullPath = path.join(r3FolderPath, file);
            let fileSpinner = ora(`Processing ${chalk.magenta(file)}`).start();
            try{
                const r3SourceCode = await fs.readFile(fullPath, 'utf8');
                fileSpinner.text = `Converting ${chalk.magenta(file)} to S4...`;
                const llmResponse = await llmService(r3SourceCode,'', []);
                if (llmResponse.error) {
                    fileSpinner.fail(chalk.red(`Failed to convert ${file}: ${llmResponse.error.message}`));
                    console.error(llmResponse.error); // Log full error details
                    continue; // Move to the next file
                }
                const { finalS4Code } = llmResponse.result;
                const outputFileName = `${path.basename(file, path.extname(file))}_S4${path.extname(file)}`;
                const outputFilePath = path.join(outputFolderPath, outputFileName);
                await fs.writeFile(outputFilePath, finalS4Code, 'utf8');
                fileSpinner.succeed(chalk.green(`Converted ${file} and saved to ${chalk.cyan(outputFilePath)}`));
            } catch (error) {
                fileSpinner.fail(chalk.red(`Error processing ${file}: ${error.message}`));
                console.error(error); // Log detailed error
            }
        }
    }catch (error){
        spinner.fail(chalk.red(`An error occurred during file operations: ${error.message}`));
        console.error(error); // Log detailed error
    } finally {
        if (spinner.isSpinning) { // Ensure spinner is stopped even on unhandled errors
            spinner.stop();
        }
    }
}
