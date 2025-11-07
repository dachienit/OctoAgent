import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

var docs = "";
try {
    docs = fs.readFileSync(path.resolve(`${__dirname}/../docs/index.txt`), 'utf8');
} catch (err) {
    console.error(`Error reading documentation file: ${err.message}`);
}

async function callLLM(systemMessage, userMessage, history = []) {
    const body = {
        prompt: userMessage,
        knowledgeBaseId: process.env.BRAIN_ID,
        useGptKnowledge: true
    };

    try {
        const response = await fetch(process.env.DIA_CHAT_RAG,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token.accessToken}`,
                    "Content-Type": "application/json"  ,
                    "Accept": "application/json"
                },
                body: JSON.stringify(body)
            }
        );

        if (response.status === 200) {
            const chat = await response.json();
            let raw = chat.result;
            raw = raw.replace(/^```json\s*/i, '').replace(/```$/i, '');
            const parsed = JSON.parse(raw);
            const assistantMessage = parsed.converted_code;
            if (assistantMessage) {
                return { result: assistantMessage, history: '' };
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
 * Phase 1: LLM reads R3 source code and creates a detailed S4 specification.
 * @param {string} r3SourceCode - The R3 ABAP source code.
 * @param {string} [additionalRequirement=""] - User-specified additional requirements.
 * @returns {Promise<string>} - The generated S4 specification.
 */
async function generateSpecification(r3SourceCode, additionalRequirement = "") {
    const systemMessage = `
        You are an expert SAP ABAP consultant specializing in R3 to S4 HANA conversions.
        Your task is to analyze the provided R3 ABAP source code and generate a comprehensive
        technical specification for its equivalent functionality in S4 HANA (ABAP 7.5+).
        This specification will be used to guide the code conversion and review.
        Refer to the following SAP technical knowledge for context:
        ${docs}

        The specification should include:
        1.  **Program Purpose:** A clear, concise description of what the R3 program does.
        2.  **Input/Output Parameters:** Details of all selection screen fields, import/export parameters, internal tables, and their data types.
        3.  **Core Logic/Business Rules:** Step-by-step description of the program's main functionality, including calculations, data processing, and conditional logic.
        4.  **Data Objects & Interfaces:** Identify all tables, function modules, BAPIs, classes, or other SAP objects used in R3, and propose their S4 HANA equivalents (e.g., replaced FMs, new CDS views, simplified data models).
        5.  **Performance Considerations:** Any areas in R3 code that might be inefficient in S4 or opportunities for optimization (e.g., parallel processing, better data access patterns).
        6.  **Error Handling:** How errors are currently handled and how they should be handled in S4.
        7.  **ABAP 7.5+ Specifics:** Highlight any areas where new ABAP 7.5+ syntax or features (e.g., inline declarations, new OPEN SQL, ABAP Objects, CDS views) can be leveraged for cleaner, more efficient S4 code.
        8.  **Assumptions/Notes:** Any necessary assumptions made during the analysis or important notes for the S4 developer.

        ${additionalRequirement ? `**User-specified additional requirements for this conversion:**\n${additionalRequirement}\n` : ''}
        Provide the specification in a structured, readable markdown format.
    `;
    const userMessage = `Analyze the following R3 ABAP source code and generate the S4 specification:\n\`\`\`abap\n${r3SourceCode}\n\`\`\``;

    console.log("Generating S4 Specification...");
    const { result, error } = await callLLM(systemMessage, userMessage);
    if (error) {
        throw new Error(`Failed to generate specification: ${error.message}`);
    }
    return result.content;
}

/**
 * Phase 2: LLM converts R3 code to S4 code based on the specification.
 * @param {string} r3SourceCode - The original R3 ABAP source code.
 * @param {string} s4Specification - The S4 technical specification.
 * @param {string} [additionalRequirement=""] - User-specified additional requirements.
 * @returns {Promise<string>} - The generated S4 ABAP code.
 */
async function convertCodeToS4(r3SourceCode, s4Specification, additionalRequirement = "") {
    const userMessage = `
        ${r3SourceCode}
    `;

    console.log("Converting R3 Code to S4...");
    const { result, error } = await callLLM('', userMessage);
    if (error) {
        throw new Error(`Failed to convert code: ${error.message}`);
    }
    if (result){
        return result;
    } else {
        return '';
    }
}

/**
 * Phase 3: LLM reviews the new S4 code based on the specification and provides corrections.
 * @param {string} s4GeneratedCode - The newly generated S4 ABAP code.
 * @param {string} s4Specification - The S4 technical specification.
 * @param {string} r3SourceCode - The original R3 ABAP source code (for full context during review).
 * @param {string} [additionalRequirement=""] - User-specified additional requirements.
 * @returns {Promise<{reviewReport: string, needsCorrection: boolean}>} - A review report and a flag indicating if corrections are needed.
 */
async function reviewAndCorrectCode(s4GeneratedCode, s4Specification, r3SourceCode, additionalRequirement = "") {
 const systemMessage = `
     You are a meticulous SAP ABAP Quality Assurance expert specializing in S4 HANA code reviews and R3 to S4 conversion validation.
     Your task is to rigorously review the provided S4 ABAP code against the original R3 source code and the S4 technical specification.
     Identify any logical errors, syntax issues (for ABAP 7.5+), performance bottlenecks, deviations from the specification,
     or missed opportunities for leveraging modern ABAP features.
     Refer to the following SAP technical knowledge for context:
     ${docs}

     ${additionalRequirement ? `**Consider the following user-specified requirements during your review:**\n${additionalRequirement}\n` : ''}
     Provide a detailed review report. For each identified issue, clearly state:
     *   **Issue Type:** (e.g., "Logical Error", "Syntax Error", "Performance Bottleneck", "Specification Mismatch", "Modern ABAP Opportunity")
     *   **Description:** Explain the problem concisely.
     *   **Line(s):** Indicate approximate line numbers or relevant code snippets.
     *   **Proposed Correction/Improvement:** Provide a precise suggestion for how to fix or improve the code. If it's a code change, provide the exact corrected code snippet.

     At the end of your report, include a "Summary" section indicating whether the code needs further correction ("YES" or "NO") and a brief justification.
     Example format:
     ---
     ## Code Review Report
     ...
     ---
     ## Summary
     Needs Correction: YES
     Justification: ...
     ---
 `;

 const userMessage = `
     Review the following S4 ABAP code against the original R3 code and the S4 specification.

     **Original R3 ABAP Code:**
     \`\`\`abap\n${r3SourceCode}\n\`\`\`

     **Generated S4 ABAP Code (for review):**
     \`\`\`abap\n${s4GeneratedCode}\n\`\`\`

     **S4 Technical Specification:**
     \`\`\`\n${s4Specification}\n\`\`\`

     Provide a detailed code review report as per your instructions.
 `;

 console.log("Reviewing S4 Code...");
 const { result, error } = await callLLM(systemMessage, userMessage);
 if (error) {
     throw new Error(`Failed to review code: ${error.message}`);
 }

 const reviewReport = result.content;
 const needsCorrectionMatch = reviewReport.match(/Needs Correction:\s*(YES|NO)/i);
 const needsCorrection = needsCorrectionMatch && needsCorrectionMatch[1].toUpperCase() === 'YES';

 return { reviewReport, needsCorrection };
}

/**
 * Orchestrates the R3 to S4 code conversion workflow using LLMs.
 * @param {string} r3SourceCode - The R3 ABAP source code to be converted.
 * @param {string} [additionalRequirement=""] - User-specified additional requirements for the conversion.
 * @param {Array<Object>} history - An array to maintain the overall conversation history (optional).
 * @returns {Promise<Object>} - An object containing the final S4 code, review report, and history.
 */
export async function llmService(r3SourceCode, additionalRequirement = "", history = []) { // Changed signature
 let currentHistory = [...history];

 try {
    currentHistory.push({"role": "user", "content": `Please start the R3 to S4 conversion process for the following R3 code:\n\`\`\`abap\n${r3SourceCode}\n\`\`\`\nAdditional requirements: ${additionalRequirement}`});

     // Convert Code
    let s4Code = await convertCodeToS4(r3SourceCode, '', ''); // Pass additionalRequirement
    currentHistory.push({"role": "assistant", "content": `**Initial S4 Code Conversion:**\n\`\`\`abap\n${s4Code}\n\`\`\``});
    console.log("Initial S4 Code Converted successfully.");

    return {
        result: {
            finalS4Code: s4Code
            //finalReviewReport: finalReviewResult.reviewReport,
            //specification: specification,
            //warning: `Max review iterations (${MAX_REVIEW_ITERATIONS}) reached. Manual review recommended.`
        },
        history: currentHistory
    };
    } catch (error) {
        console.error(`Error in R3 to S4 conversion workflow: ${error.message}`);
        currentHistory.push({"role": "assistant", "content": `Error during conversion: ${error.message}`});
        return { error: { message: `R3 to S4 conversion workflow failed: ${error.message}` }, history: currentHistory };
    }
}
