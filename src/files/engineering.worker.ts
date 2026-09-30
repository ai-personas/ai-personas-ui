import { parseEngineering } from './engineering-parser';
self.onmessage = ({ data }) => {
  try { self.postMessage({ drawing: parseEngineering(data.buffer, data.format) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Could not parse the engineering file.' }); }
};
