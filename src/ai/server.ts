
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {textEmbeddingGecko} from '@genkit-ai/google-genai';

// This is a server-safe instance of Genkit, using the full plugins.
// It is used by server-side code like Server Actions.
export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: ['v1', 'v1beta'],
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
