import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useFileSystem } from '../../store/useFileSystem';
import { runner } from '../../runner/Runner';

// Simple command history
const history: string[] = [];
let historyIndex = -1;

export const Shell: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shellState = useRef({
    lineBuffer: '',
    cursorPos: 0,
    isSSH: false,
    sshUser: '',
    sshHost: '',
    prompt: '\x1b[1;32m➜\x1b[0m \x1b[1;34m~\x1b[0m '
  });

  const { createNode, deleteNode, createDirectory } = useFileSystem();

  // Helper to write prompt
  const writePrompt = (term: Terminal) => {
    term.write('\r\n' + shellState.current.prompt);
    shellState.current.lineBuffer = '';
    shellState.current.cursorPos = 0;
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 12,
      theme: {
        background: 'transparent',
        foreground: '#a1a1aa',
        cursor: '#3b82f6',
        selectionBackground: 'rgba(59, 130, 246, 0.2)',
        black: '#000000',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#ffffff',
      },
      convertEol: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;36mSyntaxArk Virtual Shell v2.0.0\x1b[0m');
    term.writeln('Type "help" for commands, or "ssh <user>@<host>" to simulate connection.');
    term.write(shellState.current.prompt);

    // Handle input
    term.onData(async (data) => {
      const state = shellState.current;

      switch (data) {
        case '\r': { // Enter
          const cmd = state.lineBuffer.trim();
          if (cmd) {
            history.push(cmd);
            historyIndex = history.length;
            term.write('\r\n');
            await executeCommand(cmd, term);
          }
          writePrompt(term);
          break;
        }
        case '\u007F': // Backspace
          if (state.cursorPos > 0) {
            state.lineBuffer = state.lineBuffer.slice(0, state.cursorPos - 1) + state.lineBuffer.slice(state.cursorPos);
            state.cursorPos--;
            // Clear line and rewrite
            term.write('\r\x1b[K' + state.prompt + state.lineBuffer);
            // Move cursor back to position
            const moveLeft = state.lineBuffer.length - state.cursorPos;
            if (moveLeft > 0) term.write(`\x1b[${moveLeft}D`);
          }
          break;
        case '\x1b[A': // Up Arrow
          if (historyIndex > 0) {
            historyIndex--;
            state.lineBuffer = history[historyIndex];
            state.cursorPos = state.lineBuffer.length;
            term.write('\r\x1b[K' + state.prompt + state.lineBuffer);
          }
          break;
        case '\x1b[B': // Down Arrow
          if (historyIndex < history.length - 1) {
            historyIndex++;
            state.lineBuffer = history[historyIndex];
            state.cursorPos = state.lineBuffer.length;
            term.write('\r\x1b[K' + state.prompt + state.lineBuffer);
          } else {
            historyIndex = history.length;
            state.lineBuffer = '';
            state.cursorPos = 0;
            term.write('\r\x1b[K' + state.prompt);
          }
          break;
        case '\x1b[C': // Right Arrow
          if (state.cursorPos < state.lineBuffer.length) {
            state.cursorPos++;
            term.write(data);
          }
          break;
        case '\x1b[D': // Left Arrow
          if (state.cursorPos > 0) {
            state.cursorPos--;
            term.write(data);
          }
          break;
        default:
          // Normal character input
          if (data.length === 1 && data.charCodeAt(0) >= 32) {
             const buffer = state.lineBuffer;
             const pos = state.cursorPos;
             state.lineBuffer = buffer.slice(0, pos) + data + buffer.slice(pos);
             state.cursorPos++;
             // Write the char, then the rest of the buffer, then move cursor back
             term.write(data + buffer.slice(pos));
             const moveBack = buffer.length - pos;
             if (moveBack > 0) term.write(`\x1b[${moveBack}D`);
          }
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      term.dispose();
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const executeCommand = async (fullCmd: string, term: Terminal) => {
    const parts = fullCmd.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const state = shellState.current;

    // SSH Simulation logic
    if (state.isSSH) {
      if (cmd === 'exit') {
        state.isSSH = false;
        state.prompt = '\x1b[1;32m➜\x1b[0m \x1b[1;34m~\x1b[0m ';
        term.writeln('Connection to ' + state.sshHost + ' closed.');
        return;
      }
      // If in SSH mode, maybe simulate a remote shell or just echo?
      // For now, let's just "pass through" standard commands or show a message
      if (['ls', 'pwd', 'whoami', 'uname'].includes(cmd)) {
         term.writeln(`[Remote ${state.sshHost}] ${cmd}: Permission denied (simulation only)`);
      } else {
         term.writeln(`[Remote] ${fullCmd}`);
      }
      return;
    }

    switch (cmd) {
      case 'help':
        term.writeln('Available Commands:');
        term.writeln('  ssh <user>@<host>   Simulate SSH connection');
        term.writeln('  ls                  List files');
        term.writeln('  mkdir <name>        Create directory');
        term.writeln('  touch <name>        Create file');
        term.writeln('  rm <name>           Remove file');
        term.writeln('  cat <name>          Read file');
        term.writeln('  node <name>         Run JS file');
        term.writeln('  clear               Clear screen');
        term.writeln('  exit                Exit shell (or SSH)');
        break;

      case 'ssh':
        if (args.length === 0) {
          term.writeln('usage: ssh user@hostname');
        } else {
          const target = args[0];
          if (target.includes('@')) {
             const [user, host] = target.split('@');
             term.writeln(`Connecting to ${host} as ${user}...`);
             await new Promise(r => setTimeout(r, 800)); // Fake delay
             term.writeln(`Welcome to ${host} Ubuntu 22.04.2 LTS`);
             state.isSSH = true;
             state.sshUser = user;
             state.sshHost = host;
             state.prompt = `\x1b[1;32m${user}@${host}\x1b[0m:\x1b[1;34m~\x1b[0m$ `;
          } else {
             term.writeln('ssh: use format user@host');
          }
        }
        break;

      case 'ls': {
        const fileNames = Object.values(useFileSystem.getState().nodes)
             .map(n => n.type === 'directory' ? `\x1b[1;34m${n.name}/\x1b[0m` : n.name);
        term.writeln(fileNames.join('  '));
        break;
      }
        
      case 'clear':
        term.clear();
        break;

      case 'mkdir':
        if (!args[0]) term.writeln('mkdir: missing operand');
        else {
          createDirectory(args[0], null);
          term.writeln(`Directory created: ${args[0]}`);
        }
        break;

      case 'touch':
        if (!args[0]) term.writeln('touch: missing operand');
        else {
          createNode(args[0], 'file', null, '');
          term.writeln(`File created: ${args[0]}`);
        }
        break;

      case 'rm':
        if (!args[0]) term.writeln('rm: missing operand');
        else {
           const target = Object.values(useFileSystem.getState().nodes).find(n => n.name === args[0]);
           if (target) {
             deleteNode(target.id);
             term.writeln(`Removed '${args[0]}'`);
           } else {
             term.writeln(`rm: cannot remove '${args[0]}': No such file`);
           }
        }
        break;

      case 'cat':
        if (!args[0]) term.writeln('cat: missing operand');
        else {
           const target = Object.values(useFileSystem.getState().nodes).find(n => n.name === args[0]);
           if (target && target.type === 'file') {
             term.writeln((target.content || '').replace(/\n/g, '\r\n'));
           } else {
             term.writeln(`cat: ${args[0]}: No such file`);
           }
        }
        break;

      case 'node': {
        if (!args[0]) {
            term.writeln('usage: node <filename>');
        } else {
            const file = Object.values(useFileSystem.getState().nodes).find(n => n.name === args[0] && n.type === 'file');
            if (!file) {
               term.writeln(`node: module '${args[0]}' not found`);
            } else {
               term.writeln(`\x1b[2mExecuting ${args[0]}...\x1b[0m`);
               const files: Record<string, string> = {};
               Object.values(useFileSystem.getState().nodes).forEach(n => {
                  if (n.type === 'file') files[n.name] = n.content || '';
               });
               
               // Use runner but capture output
               // We need a way to pipe runner logs to xterm
               // We can use the onLog callback
               await runner.run(files, file.name, (type, content) => {
                  const color = type === 'error' ? '\x1b[31m' : type === 'warn' ? '\x1b[33m' : '\x1b[37m';
                  // Simple formatting
                  term.writeln(`${color}${content.join(' ')}\x1b[0m`);
               });
            }
        }
        break;
      }

      case 'echo':
        term.writeln(args.join(' '));
        break;

      default:
         term.writeln(`\x1b[31m${cmd}: command not found\x1b[0m`);
         term.writeln('Type "help" to see available commands.');
         break;
    }
  };

  return (
    <div ref={terminalRef} className="h-full w-full bg-transparent p-4 font-mono overflow-hidden" />
  );
};
