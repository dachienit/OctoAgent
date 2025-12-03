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

async function createHistory() {
    const url = process.env.DIA_HISTORY + "/" + process.env.BRAIN_ID
    try {
        const response = await fetch(url,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token.accessToken}`,
                },
            }
        );

        if (response.status === 200) {
            const historyId = await response.text();
            if (historyId) {
                return historyId;
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

async function generateSpecification(r3SourceCode, additionalRequirement = "", historyID) {
    /*     const __filename = import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : process.cwd());
        const __dirname = dirname(__filename);
        const filePath = path.join(
            __dirname,
            '..',
            'docs',
            'Decomposed AI Architecture.md'
            //'S4_Refactor_Prompt.md'
            //'testcase-prompt.md'
        ); */

    try {
        //let systemMessage = fs.readFile(filePath, 'utf8');
        //systemMessage = systemMessage.replace(/\$\{docs\}/g, docs);
        //systemMessage = systemMessage.replace(/\$\{additionalRequirement\}/g, additionalRequirement);
        //const len = systemMessage.length;
        const systemMessage = `You are an expert SAP ABAP consultant specializing in R3 to S4 HANA conversions.
Your task is to analyze the provided R3 ABAP source code and generate a comprehensive
technical specification for its equivalent functionality in S4 HANA (ABAP 7.5+).
This specification will be used to guide the code conversion and review.

The specification should include:
1.  **Program Purpose:** R3 object type (PROG, INCLUDE, MODULE POOL, CLASS, FUNCTION MODULE, LOGIC CODE BLOCK ONLY). A clear, concise description of what the R3 program does.
2.  **Input/Output Parameters:** Details of all selection screen fields, import/export parameters, internal tables, and their data types.
3.  **Custom objects dependence:** All custom objects dependence and purpose, provide only a brief analysis and a reminder for the user to perform a manual check. Do not change or remove any code sections that call custom object dependencies, as this could seriously affect the results.
4.  **Core Logic/Business Rules:** Step-by-step description of the program's main functionality, including calculations, data processing, and conditional logic.
5.  **Data Objects & Interfaces:** Identify all tables, function modules, BAPIs, classes, or other SAP objects used in R3.
6.  **Performance Considerations:** Any areas in R3 code that might be inefficient in S4 or opportunities for optimization (e.g., parallel processing, better data access patterns). Virtual Data Model: Prioritize using S/4HANA CDS views, APIs, or S/4 tables when querying data, and ensure all field names are accurate and not assumed.
7.  **Error Handling:** How errors are currently handled and how they should be handled in S4. Use SAP S/4HANA standard objects for error handling whenever available. If no SAP S/4HANA standard objects are available, implement the error-handling logic directly in the S/4 refactored object. In this case, you may check sy-subrc after SELECT or other statements as needed. Do NOT create new custom error-handling objects.
8.  **ABAP 7.5+ Specifics:** Highlight any areas where new ABAP 7.5+ syntax or features (e.g., inline declarations, new OPEN SQL, ABAP Objects, CDS views) can be leveraged for cleaner, more efficient S4 code.
9.  **Assumptions/Notes:** Any necessary assumptions made during the analysis or important notes for the S4 developer, and propose their S4 HANA equivalents ABAP OO COMPLIANCE (OO IS MANDATORY) (e.g., replaced FMs by CLASS, new CDS views, simplified data models).

**User-specified additional requirements for this conversion:**
${additionalRequirement}
Provide the specification in a structured, readable markdown format ONLY.
        `;
        const userMessage = `Analyze the following R3 ABAP source code and generate the S4 specification.\n
                             Here is ABAP R3 source code: \n\`\`\`abap\n${r3SourceCode}\n\`\`\`
                            `;
        console.log("Generating S4 Specification...");
        const { result, error } = await callLLM(systemMessage, userMessage, historyID);
        if (error) {
            throw new Error(`Failed to generate specification: ${error.message}`);
        }
        return result;
    } catch (err) {
        console.error('Error:', err);
    }
}

async function callLLM(systemMessage, userMessage, historyID) {
    const body = {
        prompt: userMessage,
        customMessageBehaviour: systemMessage,
        knowledgeBaseId: process.env.BRAIN_ID,
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
export async function ask(userMessage, env) {
    // Return "you just typed" + the user's input
    //return `you just typed ${userMessage}`;

    // Create chat history
    //const historyID = await createHistory();

    // Phase 1: Generate Specification
    //const specification = await generateSpecification(userMessage, "", historyID); // Pass additionalRequirement

    //return specification;

    return env && env.customPrompt ? env.customPrompt : "No Client Secret found";
}
