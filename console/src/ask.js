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
import { readFile } from 'fs/promises';
import { dirname } from 'path';

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

async function chat(inputMessage, additionalRequirement = "", brainId) {
    try {
        const { result, error } = await callLLM(additionalRequirement, inputMessage, brainId);
        if (error) {
            throw new Error(`Failed to generate specification: ${error.message}`);
        }
        return result;
    } catch (err) {
    console.error('Error:', err);
    }
}

async function generateSpecification(inputMessage, additionalRequirement = "", brainId) {
    const __filename = import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : process.cwd());
    const __dirname = dirname(__filename);
    const filePath = path.join(__dirname, '..', 'docs', 'analysis.md');
    const docsPath = path.join(__dirname, '..', 'docs', 'index.txt');

    try {
        let systemMessage = await fs.readFile(filePath, 'utf8');
        let docs = await fs.readFile(docsPath, 'utf8');
        systemMessage = systemMessage.replace(/\$\{docs\}/g, docs);
        systemMessage = systemMessage.replace(/\$\{additionalRequirement\}/g, additionalRequirement);
        const userMessage = `Analyze the following R3 ABAP source code and generate the S4 specification.\n ${inputMessage}`;
        console.log("Generating S4 Specification...");
        const { result, error } = await callLLM(systemMessage, userMessage, brainId);
        if (error) {
            throw new Error(`Failed to generate specification: ${error.message}`);
        }
        return result;
    } catch (err) {
        console.error('Error:', err);
    }
}

async function convertCodeToS4(inputMessage, additionalRequirement = "", brainId) {
    const __filename = import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : process.cwd());
    const __dirname = dirname(__filename);
    const filePath = path.join(__dirname, '..', 'docs', 'refactor.md');
    try {
        let systemMessage = await fs.readFile(filePath, 'utf8');
        systemMessage = systemMessage.replace(/\$\{additionalRequirement\}/g, additionalRequirement);
        const userMessage = `OK, base on this Technical Specification, please do the refactor R3 code to S4 ABAP 7.5+ with new syntax, check and fix syntax error if any.\n ${inputMessage}`;
        console.log("Converting R3 Code to S4...");
        try {
            const { result, error } = await callLLM(systemMessage, userMessage, brainId);
        if (error) {
            throw new Error(`Failed to convert code: ${error.message}`);
        }
        if (result) {
            return result;
        } else {
            return '';
        }
    } catch (err) {
        console.error('Error:', err);
    }
    } catch (err) {
        console.error('Error:', err);
    }
}

async function callLLM(systemMessage, userMessage, brainId) {
    const body = {
        prompt: userMessage,
        customMessageBehaviour: systemMessage,
        knowledgeBaseId: brainId,
        chatHistoryId: historyID,
        useGptKnowledge: true
    };

    try {
        const response = await fetch(process.env.DIA_CHAT_RAG,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token.accessToken}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(body)
            }
        );

        if (response.status === 200) {
            const chat = await response.json();
            if (chat.result) {
                return { result: chat.result, history: '' };
            } else {
                return { error: { message: "LLM response was empty or malformed." } };
            }
        } else {
            const errorText = await response.text();
            console.error(`LLM API Error ${response.status}: ${errorText}`);
            return { error: { message: `LLM API Error: ${response.statusText} - ${errorText}` } };
        }
    } catch (error) {
        console.error(`Network or parsing error during LLM call: ${error.message}`);
        return { error: { message: `Network or parsing error during LLM call: ${error.message}` } };
    }
}

/**
 * Main function to handle user messages and return response.
 * @param {string} userMessage - The message from the user.
 * @returns {Promise<string>} - The response message.
 */
export async function ask(option, userMessage, env) {
    let impGuideLine = '<b>Here is implementation guidelines:\n</b> abc';
    const brainId = (env && env.brainId) ? env.brainId : process.env.BRAIN_ID;
    if (option === 'analyze') {
        return await generateSpecification(userMessage, env.customPrompt || "", brainId);
    }else if(option === 'refactor'){
        //const s4Code = await convertCodeToS4(userMessage, env.customPrompt || "", brainId);
        //const s4CodeJson = parseDirtyJson(s4Code);
        return impGuideLine;
    }else{
        return await chat(userMessage, env.customPrompt || "", brainId);
    }
}
