import * as esbuild from 'esbuild-wasm';

let esbuildInitialized = false;

export const initializeEsbuild = async () => {
  if (esbuildInitialized) return;
  
  try {
    await esbuild.initialize({
      worker: true,
      wasmURL: 'https://unpkg.com/esbuild-wasm@0.27.3/esbuild.wasm',
    });
    esbuildInitialized = true;
  } catch (error: any) {
    if (error.message.includes('already been called')) {
      esbuildInitialized = true;
    } else {
      throw error;
    }
  }
};

export const bundle = async (files: Record<string, string>, entryPoint: string) => {
  await initializeEsbuild();

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'SyntaxArkOutput',
    jsx: 'transform',
    plugins: [
      {
        name: 'http-url',
        setup(build) {
          // Resolve https://... imports
          build.onResolve({ filter: /^https?:\/\// }, args => ({
            path: args.path,
            namespace: 'http-url',
          }));

          // Intercept "bare modules" (react, lodash) and redirect to esm.sh
          build.onResolve({ filter: /^([a-zA-Z0-9_-]+)$/ }, args => {
             return { path: `https://esm.sh/${args.path}`, namespace: 'http-url' };
          });

          // Fetch the content from the CDN
          build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args) => {
            const response = await fetch(args.path);
            const contents = await response.text();
            return { contents, loader: 'js' };
          });
        },
      },
      {
        name: 'vfs-plugin',
        setup(build) {
          // 1. Entry point
          build.onResolve({ filter: new RegExp(`^${entryPoint.replace('.', '\\.')}$`) }, (args) => {
            return { path: args.path, namespace: 'vfs' };
          });

          // 2. Relative paths
          build.onResolve({ filter: /^\.\.?\// }, (args) => {
            const path = args.path.replace(/^\.\//, '');
            return { path, namespace: 'vfs' };
          });

          // 3. Load VFS content
          build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args) => {
            const content = 
              files[args.path] || 
              files[`${args.path}.js`] || 
              files[`${args.path}.mjs`] ||
              files[`${args.path}.ts`] ||
              files[`${args.path}.tsx`] ||
              files[`${args.path}.jsx`];
              
            if (content === undefined) {
              return { errors: [{ text: `File not found in VFS: ${args.path}` }] };
            }
            
            const ext = args.path.split('.').pop();
            const loader = (ext === 'ts' || ext === 'tsx') ? 'tsx' : (ext === 'jsx' ? 'jsx' : 'js');
            return { contents: content, loader };
          });
        },
      },
    ],
  });

  return result.outputFiles[0].text;
};
