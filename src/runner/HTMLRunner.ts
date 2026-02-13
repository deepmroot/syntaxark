import type { ILanguageRunner, ExecutionResult } from './LanguageRunner';

export class HTMLRunner implements ILanguageRunner {
  supports(extension: string): boolean {
    return ['html', 'htm'].includes(extension);
  }

  async run(
    files: Record<string, string>, 
    entryPoint: string, 
    onLog: (type: 'log' | 'error' | 'warn' | 'info', content: any[]) => void,
    onRender?: (code: string) => void
  ): Promise<ExecutionResult> {
    const start = performance.now();
    
    try {
      let content = files[entryPoint];
      if (!content) {
        throw new Error(`File not found: ${entryPoint}`);
      }

      // 1. Resolve local dependencies (CSS/JS) from VFS
      // Replace <script src="...">
      content = content.replace(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (match, src) => {
        if (!src.startsWith('http') && files[src]) {
          const blob = new Blob([files[src]], { type: 'application/javascript' });
          return `<script src="${URL.createObjectURL(blob)}"></script>`;
        }
        return match;
      });

      // Auto-inject jQuery if not present and common jQuery patterns are found, 
      // or just for convenience in this environment.
      if (!content.includes('jquery') && (content.includes('$') || content.includes('jQuery'))) {
        const jqueryScript = '<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>';
        if (content.includes('<head>')) {
          content = content.replace('<head>', `<head>\n    ${jqueryScript}`);
        } else if (content.includes('<body>')) {
          content = content.replace('<body>', `<body>\n    ${jqueryScript}`);
        } else {
          content = jqueryScript + '\n' + content;
        }
      }

      // Replace <link href="...">
      content = content.replace(/<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi, (match, href) => {
        if (!href.startsWith('http') && files[href]) {
          const blob = new Blob([files[href]], { type: 'text/css' });
          return `<link rel="stylesheet" href="${URL.createObjectURL(blob)}">`;
        }
        return match;
      });

      // 2. Simple injection to handle server_echo.php or other local simulated files
      // We can inject a script that intercepts fetch/XMLHttpRequest
      const injection = `
        <script>
          (function() {
            const originalFetch = window.fetch;
            window.fetch = async (url, options) => {
              if (url.includes('server_echo.php')) {
                const params = new URLSearchParams(url.split('?')[1]);
                const msg = params.get('message') || 'No message';
                return new Response(msg, { status: 200 });
              }
              return originalFetch(url, options);
            };

            // Also mock jQuery's $.get if it's used
            const mockJQuery = () => {
              if (window.jQuery) {
                const originalGet = window.jQuery.get;
                window.jQuery.get = function(url, data, success) {
                  if (typeof url === 'string' && url.includes('server_echo.php')) {
                    const msg = (data && data.message) ? data.message : 'No message';
                    if (typeof success === 'function') success(msg);
                    return {
                      done: (cb) => { if (typeof cb === 'function') cb(msg); return this; },
                      fail: () => { return this; }
                    };
                  }
                  return originalGet.apply(this, arguments);
                };
              } else {
                setTimeout(mockJQuery, 50);
              }
            };
            mockJQuery();
          })();
        </script>
      `;

      // Insert injection before </body> or at the end
      if (content.includes('</body>')) {
        content = content.replace('</body>', `${injection}</body>`);
      } else {
        content += injection;
      }

      if (onRender) {
        onRender(content);
      }

      const end = performance.now();
      return {
        stdout: ['Rendering HTML preview...'],
        stderr: [],
        duration: end - start
      };
    } catch (err: any) {
      onLog('error', [err.message]);
      return {
        stdout: [],
        stderr: [err.message],
        duration: 0,
        error: err.message
      };
    }
  }
}
