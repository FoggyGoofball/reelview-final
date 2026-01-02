
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {textEmbeddingGecko} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: ['v1', 'v1beta'],
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
