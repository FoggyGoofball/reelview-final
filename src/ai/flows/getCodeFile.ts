'use server';
/**
 * @fileOverview A simple flow for retrieving the content of a project file.
 *
 * - getCodeFile - A function that returns the content of a file at a given path.
 */

import { ai } from '@/ai/server';
import { z } from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';

// Define the schema for the flow's input (a file path).
const GetCodeFileInputSchema = z.object({
  filePath: z.string().describe('The relative path to the file from the project root.'),
});
type GetCodeFileInput = z.infer<typeof GetCodeFileInputSchema>;

// Define the schema for the flow's output (the file content).
const GetCodeFileOutputSchema = z.object({
  content: z.string().describe('The content of the requested file.'),
});
type GetCodeFileOutput = z.infer<typeof GetCodeFileOutputSchema>;

/**
 * A Genkit flow that securely reads and returns the content of a specified project file.
 * It prevents directory traversal attacks by resolving the path and ensuring it stays
 * within the project directory.
 *
 * @param {GetCodeFileInput} input - The input object containing the file path.
 * @returns {Promise<GetCodeFileOutput>} A promise that resolves with the file's content.
 */
const getCodeFileFlow = ai.defineFlow(
  {
    name: 'getCodeFileFlow',
    inputSchema: GetCodeFileInputSchema,
    outputSchema: GetCodeFileOutputSchema,
  },
  async ({ filePath }) => {
    const projectRoot = process.cwd();
    const absolutePath = path.resolve(projectRoot, filePath);

    // Security check: Ensure the resolved path is still within the project directory.
    if (!absolutePath.startsWith(projectRoot)) {
      throw new Error('Access denied: File path is outside the project directory.');
    }

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      return { content };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }
);

/**
 * Exported server action that clients can call to get file content.
 * @param {string} filePath - The relative path to the file.
 * @returns {Promise<string>} The content of the file.
 */
export async function getCodeFile(filePath: string): Promise<string> {
    const result = await getCodeFileFlow({ filePath });
    return result.content;
}
