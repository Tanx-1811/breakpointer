/** A short, stable, non-cryptographic hash (djb2) for tagging frames. */
export function shortHash(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return (hash >>> 0).toString(36);
}
