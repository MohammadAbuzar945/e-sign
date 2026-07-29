const MAX_BROADCAST_HTML_LENGTH = 100_000;

const extractBodyHtml = (html: string) => {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  if (bodyMatch?.[1]) {
    return bodyMatch[1];
  }

  return html;
};

/**
 * Lightweight sanitisation for admin-authored broadcast HTML.
 * Strips executable / embedding surfaces while preserving formatting markup.
 */
export const sanitizeResellerBroadcastHtml = (rawHtml: string) => {
  const trimmed = rawHtml.trim();

  if (!trimmed) {
    throw new Error('HTML body is required');
  }

  if (trimmed.length > MAX_BROADCAST_HTML_LENGTH) {
    throw new Error('HTML body is too large');
  }

  let html = extractBodyHtml(trimmed);

  html = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(iframe|object|embed|form|link|meta|base|svg|math)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '$1=$2#$2')
    .replace(/(href|src)\s*=\s*javascript:[^\s>]*/gi, '$1="#"');

  return html.trim();
};

export const stripHtmlToPlainText = (html: string) => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
