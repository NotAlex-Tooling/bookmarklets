// Minifies bookmarklet source and wraps it as a draggable javascript: URI.
import { minify } from 'terser';

// Returns the input code, minified and percent-encoded with a javascript: prefix.
export async function generateBookmarklet(code: string): Promise<string> {
	const result = await minify(code, { mangle: { toplevel: false } });
	const minified = result.code || code;
	return `javascript:${encodeURIComponent(minified)}`;
}
