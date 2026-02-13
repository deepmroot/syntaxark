export interface LanguageConfig {
  name: string;
  pistonRuntime: string;
  pistonVersion: string;
  monacoLanguage: string;
  template: string;
  color: string;
}

export const LANGUAGE_MAP: Record<string, LanguageConfig> = {
  // WEB
  'js': { 
    name: 'JavaScript', 
    pistonRuntime: 'javascript', 
    pistonVersion: '18.15.0', 
    monacoLanguage: 'javascript', 
    template: `/**\n * SyntaxArk JavaScript Playground\n */\n\nfunction greet(name) {\n  console.log(\`Hello, \${name}!\`);\n}\n\ngreet("Developer");\n`, 
    color: '#f7df1e' 
  },
  'mjs': { 
    name: 'JavaScript Module', 
    pistonRuntime: 'javascript', 
    pistonVersion: '18.15.0', 
    monacoLanguage: 'javascript', 
    template: `/**\n * SyntaxArk ES Module\n */\n\nexport function greet(name) {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet("Module Developer"));\n`, 
    color: '#f7df1e' 
  },
  'ts': { 
    name: 'TypeScript', 
    pistonRuntime: 'typescript', 
    pistonVersion: '5.0.3', 
    monacoLanguage: 'typescript', 
    template: `/**\n * SyntaxArk TypeScript Playground\n */\n\ninterface User {\n  id: number;\n  name: string;\n}\n\nconst user: User = {\n  id: 1,\n  name: "SyntaxArk User"\n};\n\nconsole.log(\`User: \${user.name} (ID: \${user.id})\`);\n`, 
    color: '#3178c6' 
  },
  'tsx': { 
    name: 'React (TSX)', 
    pistonRuntime: 'typescript', 
    pistonVersion: '5.0.3', 
    monacoLanguage: 'typescript', 
    template: `import React from 'react';\nimport { createRoot } from 'react-dom/client';\n\nconst App = () => {\n  return (\n    <div style={{ padding: 20, fontFamily: 'sans-serif', color: 'white' }}>\n      <h1>Hello from React! ⚛️</h1>\n      <p>Try editing this file.</p>\n    </div>\n  );\n};\n\nconst root = createRoot(document.getElementById('root'));\nroot.render(<App />);\n`, 
    color: '#61dafb' 
  },
  'jsx': { 
    name: 'React (JSX)', 
    pistonRuntime: 'javascript', 
    pistonVersion: '18.15.0', 
    monacoLanguage: 'javascript', 
    template: `import React from 'react';\nimport { createRoot } from 'react-dom/client';\n\nconst App = () => {\n  return (\n    <div style={{ padding: 20, fontFamily: 'sans-serif', color: 'white' }}>\n      <h1>Hello from React! ⚛️</h1>\n    </div>\n  );\n};\n\nconst root = createRoot(document.getElementById('root'));\nroot.render(<App />);\n`, 
    color: '#61dafb' 
  },
  'html': { 
    name: 'HTML', 
    pistonRuntime: '', 
    pistonVersion: '', 
    monacoLanguage: 'html', 
    template: `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>SyntaxArk Document</title>\n    <style>\n        body {\n            font-family: sans-serif;\n            display: flex;\n            justify-content: center;\n            align-items: center;\n            height: 100vh;\n            background: #1e1e1e;\n            color: white;\n        }\n    </style>\n</head>\n<body>\n    <h1>Hello from SyntaxArk!</h1>\n</body>\n</html>`, 
    color: '#e34c26' 
  },
  'css': { 
    name: 'CSS', 
    pistonRuntime: '', 
    pistonVersion: '', 
    monacoLanguage: 'css', 
    template: `/* Modern CSS Reset */\n* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  background-color: #1e1e1e;\n  color: #fff;\n  font-family: system-ui, -apple-system, sans-serif;\n}`, 
    color: '#563d7c' 
  },

  // DATA
  'json': { 
    name: 'JSON', 
    pistonRuntime: '', 
    pistonVersion: '', 
    monacoLanguage: 'json', 
    template: `{\n  "project": "SyntaxArk",\n  "version": "1.1.0",\n  "features": [\n    "VFS",\n    "Multi-language",\n    "Remote Execution"\n  ]\n}`, 
    color: '#292929' 
  },
  'md': { 
    name: 'Markdown', 
    pistonRuntime: '', 
    pistonVersion: '', 
    monacoLanguage: 'markdown', 
    template: `# 🚀 New Project\n\nThis is your new project file. You can write documentation here.\n\n### Tasks:\n- [ ] Write logic\n- [ ] Run tests\n- [ ] Deploy`, 
    color: '#083fa1' 
  },
  'sql': {
    name: 'SQL',
    pistonRuntime: '',
    pistonVersion: '',
    monacoLanguage: 'sql',
    template: `CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT);\nINSERT INTO users(name) VALUES ('Ada'), ('Linus');\nSELECT * FROM users;\n`,
    color: '#336791'
  },

  // SYSTEMS & BACKEND
  'py': { 
    name: 'Python', 
    pistonRuntime: 'python', 
    pistonVersion: '3.10.0', 
    monacoLanguage: 'python', 
    template: `def main():\n    msg = "Hello from Python!"\n    print(f"{msg}")\n\nif __name__ == "__main__":\n    main()`, 
    color: '#3776ab' 
  },
  'java': { 
    name: 'Java', 
    pistonRuntime: 'java', 
    pistonVersion: '15.0.2', 
    monacoLanguage: 'java', 
    template: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java World!");\n        \n        // Example loop\n        for (int i = 1; i <= 5; i++) {\n            System.out.println("Count: " + i);\n        }\n    }\n}`, 
    color: '#b07219' 
  },
  'cpp': { 
    name: 'C++', 
    pistonRuntime: 'cpp', 
    pistonVersion: '10.2.0', 
    monacoLanguage: 'cpp', 
    template: `#include <iostream>\n#include <vector>\n#include <string>\n\nint main() {\n    std::vector<std::string> msgs = {"Hello", "from", "C++"};\n    \n    for (const auto& word : msgs) {\n        std::cout << word << " ";\n    }\n    std::cout << std::endl;\n    \n    return 0;\n}`, 
    color: '#f34b7d' 
  },
  'c': { 
    name: 'C', 
    pistonRuntime: 'c', 
    pistonVersion: '10.2.0', 
    monacoLanguage: 'c', 
    template: `#include <stdio.h>\n\nint main() {\n    printf("Hello from C!\\n");\n    return 0;\n}`, 
    color: '#555555' 
  },
  'rs': { 
    name: 'Rust', 
    pistonRuntime: 'rust', 
    pistonVersion: '1.68.2', 
    monacoLanguage: 'rust', 
    template: `fn main() {\n    let name = "Rustacean";\n    println!("Hello, {}!", name);\n    \n    // Simple vector\n    let nums = vec![1, 2, 3];\n    println!("Numbers: {:?}", nums);\n}`, 
    color: '#dea584' 
  },
  'go': { 
    name: 'Go', 
    pistonRuntime: 'go', 
    pistonVersion: '1.16.2', 
    monacoLanguage: 'go', 
    template: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, Go!")\n    \n    slice := []int{10, 20, 30}\n    fmt.Printf("Data: %v\\n", slice)\n}`, 
    color: '#00add8' 
  },
  'cs': { 
    name: 'C#', 
    pistonRuntime: 'csharp', 
    pistonVersion: '6.12.0', 
    monacoLanguage: 'csharp', 
    template: `using System;\nusing System.Collections.Generic;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from C#!");\n        \n        var list = new List<string> { "One", "Two", "Three" };\n        foreach (var item in list) {\n            Console.WriteLine(item);\n        }\n    }\n}`, 
    color: '#178600' 
  },
  'php': { 
    name: 'PHP', 
    pistonRuntime: 'php', 
    pistonVersion: '8.2.3', 
    monacoLanguage: 'php', 
    template: `<?php\n\n$greeting = "Hello from PHP!";\necho $greeting . PHP_EOL;\n\n$data = ["Apples", "Oranges", "Grapes"];\nprint_r($data);\n`, 
    color: '#4f5d95' 
  },
  'rb': { 
    name: 'Ruby', 
    pistonRuntime: 'ruby', 
    pistonVersion: '3.0.1', 
    monacoLanguage: 'ruby', 
    template: `def greet(name)\n  puts "Hello, #{name}!"\nend\n\ngreet("Rubyist")\n\n[1, 2, 3].each { |n| puts "Num: #{n}" }`, 
    color: '#701516' 
  },
  'swift': { 
    name: 'Swift', 
    pistonRuntime: 'swift', 
    pistonVersion: '5.3.3', 
    monacoLanguage: 'swift', 
    template: `import Foundation\n\nprint("Hello from Swift!")\n\nlet names = ["Alice", "Bob"]\nfor name in names {\n    print("Hi, \\(name)")\n}`, 
    color: '#f05138' 
  },
  'kt': { 
    name: 'Kotlin', 
    pistonRuntime: 'kotlin', 
    pistonVersion: '1.8.20', 
    monacoLanguage: 'kotlin', 
    template: `fun main() {\n    println("Hello, Kotlin!")\n    \n    val items = listOf("Kotlin", "Android")\n    for (item in items) {\n        println("Learning $item")\n    }\n}`, 
    color: '#a97bff' 
  },
  'dart': {
    name: 'Dart',
    pistonRuntime: 'dart',
    pistonVersion: '2.19.6',
    monacoLanguage: 'dart',
    template: `void main() {\n  print('Hello from Dart!');\n}\n`,
    color: '#00b4ab'
  },
  'lua': { 
    name: 'Lua', 
    pistonRuntime: 'lua', 
    pistonVersion: '5.4.4', 
    monacoLanguage: 'lua', 
    template: `function greet(name)\n  print("Hello, " .. name)\nend\n\ngreet("Lua")`, 
    color: '#000080' 
  },
  'r': { 
    name: 'R', 
    pistonRuntime: 'r', 
    pistonVersion: '4.1.1', 
    monacoLanguage: 'r', 
    template: `message <- "Hello from R!"\nprint(message)\n\nx <- c(1, 2, 3, 4, 5)\nprint(mean(x))`, 
    color: '#198ce7' 
  },
  'sh': { 
    name: 'Bash', 
    pistonRuntime: 'bash', 
    pistonVersion: '5.2.0', 
    monacoLanguage: 'shell', 
    template: `#!/bin/bash\n\necho "Hello from the Shell!"\n\nNAME="User"\necho "Current user: $NAME"\necho "Date: $(date)"`, 
    color: '#89e051' 
  }
};
