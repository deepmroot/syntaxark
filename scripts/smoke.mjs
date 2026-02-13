import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

const checks = [
  {
    name: 'Main layout exists',
    ok: () => existsSync(resolve(root, 'src/components/Layout/MainLayout.tsx')),
  },
  {
    name: 'Console container exists',
    ok: () => existsSync(resolve(root, 'src/components/Console/ConsoleContainer.tsx')),
  },
  {
    name: 'Collaboration panel exists',
    ok: () => existsSync(resolve(root, 'src/components/Collaborate/CollaboratePanel.tsx')),
  },
  {
    name: 'Shell does not use eval',
    ok: () => !readFileSync(resolve(root, 'src/components/Console/Shell.tsx'), 'utf8').includes('eval('),
  },
  {
    name: 'Main layout mounts output console',
    ok: () => readFileSync(resolve(root, 'src/components/Layout/MainLayout.tsx'), 'utf8').includes('<ConsoleContainer'),
  },
  {
    name: 'Collaboration uses room chat send API',
    ok: () => readFileSync(resolve(root, 'src/components/Collaborate/CollaboratePanel.tsx'), 'utf8').includes('api.rooms.sendMessage'),
  },
  {
    name: 'Collaboration uses whiteboard snapshot API',
    ok: () => readFileSync(resolve(root, 'src/components/Collaborate/CollaboratePanel.tsx'), 'utf8').includes('api.rooms.updateWhiteboardSnapshot'),
  },
];

let failures = 0;
for (const check of checks) {
  const passed = Boolean(check.ok());
  if (passed) {
    console.log(`PASS: ${check.name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${check.name}`);
  }
}

if (failures > 0) {
  console.error(`\nSmoke checks failed: ${failures}`);
  process.exit(1);
}

console.log('\nSmoke checks passed');
