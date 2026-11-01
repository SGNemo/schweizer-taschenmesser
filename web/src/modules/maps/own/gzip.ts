/** Inflates gzip bytes with the browser's own stream (Node 18+ has it too). Throws where it is missing. */
export async function gunzip(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'undefined') throw new Error('gzip: no inflate');
  const body = new Response(bytes).body;
  if (!body) throw new Error('gzip: no inflate');
  return new Response(body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
