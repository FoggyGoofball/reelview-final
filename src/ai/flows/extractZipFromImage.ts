'use server';
/**
 * @fileOverview A flow for extracting files from a zip archive that has been embedded in a JPEG image.
 *
 * - extractZipFromImage - A function that takes a JPEG data URI and returns the contents of the embedded zip.
 */

import { ai } from '@/ai/server';
import { z } from 'genkit';
import JSZip from 'jszip';

// Define the schema for the flow's input (a data URI).
const ExtractZipInputSchema = z.object({
  imageDataUri: z.string().describe("A JPEG image file encoded as a data URI, which contains an embedded zip archive."),
});
type ExtractZipInput = z.infer<typeof ExtractZipInputSchema>;

// Define the schema for a single extracted file.
const ExtractedFileSchema = z.object({
  fileName: z.string().describe("The name of the file within the archive."),
  content: z.string().describe("The text content of the file."),
});

// Define the schema for the flow's output (an array of extracted files).
const ExtractZipOutputSchema = z.object({
  files: z.array(ExtractedFileSchema).describe("An array of files extracted from the zip archive."),
});
type ExtractZipOutput = z.infer<typeof ExtractZipOutputSchema>;

/**
 * A Genkit flow that decodes a Base64 data URI, loads it as a zip archive using JSZip,
 * and extracts the text content of all files contained within.
 *
 * @param {ExtractZipInput} input - The input object containing the image data URI.
 * @returns {Promise<ExtractZipOutput>} A promise that resolves with the extracted files.
 */
const extractZipFromImageFlow = ai.defineFlow(
  {
    name: 'extractZipFromImageFlow',
    inputSchema: ExtractZipInputSchema,
    outputSchema: ExtractZipOutputSchema,
  },
  async ({ imageDataUri }) => {
    try {
      // 1. Decode the Base64 data URI
      const base64Data = imageDataUri.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid data URI: No Base64 data found.');
      }
      
      const zip = new JSZip();
      
      // 2. Load the binary data into JSZip
      await zip.loadAsync(base64Data, { base64: true });

      const extractedFiles: z.infer<typeof ExtractedFileSchema>[] = [];

      // 3. Iterate over each file in the zip and extract its content
      for (const fileName in zip.files) {
        if (!zip.files[fileName].dir) {
          const content = await zip.files[fileName].async('string');
          extractedFiles.push({ fileName, content });
        }
      }

      return { files: extractedFiles };

    } catch (error: any) {
      console.error('Failed to extract zip from image:', error);
      throw new Error(`Failed to process zip data: ${error.message}`);
    }
  }
);


/**
 * Exported server action that clients can call to extract files from an image.
 * @param {string} imageDataUri - The data URI of the JPEG containing the zip data.
 * @returns {Promise<ExtractZipOutput>} A promise that resolves to the list of extracted files.
 */
export async function extractZipFromImage(imageDataUri: string): Promise<ExtractZipOutput> {
    const result = await extractZipFromImageFlow({ imageDataUri });
    return result;
}
