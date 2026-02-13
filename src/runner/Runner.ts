import { registry } from './LanguageRunner';
import { JSRunner } from './JSRunner';
import { PythonRunner } from './PythonRunner';
import { RemoteRunner } from './RemoteRunner';
import { HTMLRunner } from './HTMLRunner';
import { LANGUAGE_MAP } from '../data/languages';

const TEST_MARKER_START = '__SYNTAXARK_TEST_RESULTS_START__';
const TEST_MARKER_END = '__SYNTAXARK_TEST_RESULTS_END__';

interface ChallengeTestCase {
  input: unknown[];
  expected: unknown;
  name: string;
}

interface ChallengeTestResult {
  name: string;
  passed: boolean;
  actual: unknown;
  expected: unknown;
}

const escapeSingleQuoted = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');

const escapeDoubleQuoted = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');

const stripPhpTags = (source: string): string =>
  source
    .replace(/<\?php\s*/gi, '')
    .replace(/\?>\s*/gi, '');

const extractJsonBetweenMarkers = (stdout: string): string | null => {
  const start = stdout.indexOf(TEST_MARKER_START);
  const end = stdout.indexOf(TEST_MARKER_END);
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return stdout.slice(start + TEST_MARKER_START.length, end).trim();
};

const extractJsFunctionCandidates = (source: string): string[] => {
  const out = new Set<string>();
  const patterns: RegExp[] = [
    /function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(source);
    while (match) {
      out.add(match[1]);
      match = pattern.exec(source);
    }
  }
  return [...out];
};

const inferFunctionNameFromSource = (extension: string, source: string, requested: string): string => {
  const safeRequested = (requested || '').trim();
  if (!source.trim()) return safeRequested || 'solve';

  const regexByExtension: Record<string, RegExp[]> = {
    py: [/def\s+([A-Za-z_]\w*)\s*\(/g],
    java: [/(?:public|private|protected)?\s*(?:static\s+)?[A-Za-z_<>\[\],\s]+\s+([A-Za-z_]\w*)\s*\(/g],
    cpp: [/[A-Za-z_][\w:<>\[\]\s*&]*\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{/g],
    c: [/[A-Za-z_][\w\s\*]*\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{/g],
    go: [/func\s+([A-Za-z_]\w*)\s*\(/g],
    rs: [/fn\s+([A-Za-z_]\w*)\s*\(/g],
    cs: [/(?:public|private|protected)?\s*(?:static\s+)?[A-Za-z_<>\[\],\s]+\s+([A-Za-z_]\w*)\s*\(/g],
    php: [/function\s+([A-Za-z_]\w*)\s*\(/g],
    rb: [/def\s+([A-Za-z_]\w*)/g],
    kt: [/fun\s+([A-Za-z_]\w*)\s*\(/g],
    swift: [/func\s+([A-Za-z_]\w*)\s*\(/g],
    lua: [/function\s+([A-Za-z_]\w*)\s*\(/g],
    r: [/([A-Za-z_]\w*)\s*<-\s*function\s*\(/g],
  };

  const excluded = new Set(['main', 'Main', 'if', 'for', 'while', 'switch']);
  const patterns = regexByExtension[extension] || [];
  const names: string[] = [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(source);
    while (match) {
      const name = match[1];
      if (name && !excluded.has(name)) names.push(name);
      match = pattern.exec(source);
    }
  }

  if (safeRequested && names.includes(safeRequested)) return safeRequested;
  if (names.length > 0) return names[0];
  return safeRequested || 'solve';
};

const buildRemoteChallengeHarness = (
  extension: string,
  source: string,
  functionName: string,
  testCases: ChallengeTestCase[],
): string | null => {
  const casesJson = JSON.stringify(testCases);
  const escapedCases = escapeSingleQuoted(casesJson);
  const escapedStart = escapeSingleQuoted(TEST_MARKER_START);
  const escapedEnd = escapeSingleQuoted(TEST_MARKER_END);

  switch (extension) {
    case 'py':
      return `${source}

import json

__syntaxark_cases = json.loads('${escapedCases}')
__syntaxark_results = []

for __tc in __syntaxark_cases:
    try:
        __actual = ${functionName}(*__tc["input"])
        __passed = json.dumps(__actual, sort_keys=True) == json.dumps(__tc["expected"], sort_keys=True)
        __syntaxark_results.append({"name": __tc["name"], "passed": __passed, "actual": __actual, "expected": __tc["expected"]})
    except Exception as __e:
        __syntaxark_results.append({"name": __tc["name"], "passed": False, "actual": str(__e), "expected": __tc["expected"]})

print('${escapedStart}')
print(json.dumps(__syntaxark_results))
print('${escapedEnd}')
`;

    case 'java': {
      const javaSource = source.replace(/\bpublic\s+class\s+(Solution|Main)\b/g, 'class $1');
      const toJavaLiteral = (value: unknown): string => {
        if (Array.isArray(value)) {
          const allNumbers = value.every((v) => typeof v === 'number');
          const allBooleans = value.every((v) => typeof v === 'boolean');
          const allStrings = value.every((v) => typeof v === 'string');
          if (allNumbers) {
            const hasFloat = value.some((v) => !Number.isInteger(v as number));
            const t = hasFloat ? 'double' : 'int';
            return `new ${t}[]{${value.map((v) => String(v)).join(', ')}}`;
          }
          if (allBooleans) {
            return `new boolean[]{${value.map((v) => String(v)).join(', ')}}`;
          }
          if (allStrings) {
            return `new String[]{${value.map((v) => `"${escapeDoubleQuoted(String(v))}"`).join(', ')}}`;
          }
          if (value.every((v) => Array.isArray(v))) {
            const nested = value as unknown[];
            const nestedAllInt = nested.every((row) => Array.isArray(row) && (row as unknown[]).every((x) => typeof x === 'number' && Number.isInteger(x as number)));
            if (nestedAllInt) {
              return `new int[][]{${nested.map((row) => `{${(row as unknown[]).map((n) => String(n)).join(', ')}}`).join(', ')}}`;
            }
          }
          return `new Object[]{${value.map((v) => toJavaLiteral(v)).join(', ')}}`;
        }
        if (typeof value === 'number') {
          return Number.isInteger(value) ? `${value}` : `${value}d`;
        }
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'string') return `"${escapeDoubleQuoted(value)}"`;
        if (value === null || value === undefined) return 'null';
        return `"${escapeDoubleQuoted(JSON.stringify(value))}"`;
      };

      return `${javaSource}

class Main {
  static String escapeJsonString(String s) {
    if (s == null) return "";
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < s.length(); i++) {
      char ch = s.charAt(i);
      if (ch == '\\\\') out.append("\\\\\\\\");
      else if (ch == '\\"') out.append("\\\\\\"");
      else if (ch == '\\n') out.append("\\\\n");
      else if (ch == '\\r') out.append("\\\\r");
      else out.append(ch);
    }
    return out.toString();
  }

  static String toJson(Object value) {
    if (value == null) return "null";
    Class<?> c = value.getClass();
    if (c.isArray()) {
      int len = java.lang.reflect.Array.getLength(value);
      StringBuilder sb = new StringBuilder();
      sb.append("[");
      for (int i = 0; i < len; i++) {
        if (i > 0) sb.append(",");
        sb.append(toJson(java.lang.reflect.Array.get(value, i)));
      }
      sb.append("]");
      return sb.toString();
    }
    if (value instanceof java.util.Collection) {
      StringBuilder sb = new StringBuilder();
      sb.append("[");
      boolean first = true;
      for (Object item : (java.util.Collection<?>) value) {
        if (!first) sb.append(",");
        first = false;
        sb.append(toJson(item));
      }
      sb.append("]");
      return sb.toString();
    }
    if (value instanceof Number || value instanceof Boolean) return String.valueOf(value);
    return "\\"" + escapeJsonString(String.valueOf(value)) + "\\"";
  }

  static Class<?> resolveTargetClass() throws ClassNotFoundException {
    try { return Class.forName("Solution"); } catch (ClassNotFoundException ignored) {}
    try { return Class.forName("UserSolution"); } catch (ClassNotFoundException ignored) {}
    throw new ClassNotFoundException("Solution");
  }

  static java.lang.reflect.Method resolveMethod(Class<?> cls, String name) {
    for (java.lang.reflect.Method m : cls.getDeclaredMethods()) {
      if (m.getName().equals(name)) return m;
    }
    return null;
  }

  public static void main(String[] args) {
    String[] names = new String[]{${testCases.map((tc) => `"${escapeDoubleQuoted(tc.name)}"`).join(', ')}};
    Object[][] inputs = new Object[][]{
${testCases.map((tc) => `      new Object[]{${tc.input.map((v) => toJavaLiteral(v)).join(', ')}},`).join('\n')}
    };
    Object[] expected = new Object[]{${testCases.map((tc) => toJavaLiteral(tc.expected)).join(', ')}};

    System.out.println("${escapedStart}");
    System.out.print("[");
    for (int i = 0; i < names.length; i++) {
      boolean passed = false;
      Object actual = null;
      try {
        Class<?> targetClass = resolveTargetClass();
        java.lang.reflect.Method method = resolveMethod(targetClass, "${escapeDoubleQuoted(functionName)}");
        if (method == null) throw new RuntimeException("Method ${escapeDoubleQuoted(functionName)} not found");
        Object invokeTarget = java.lang.reflect.Modifier.isStatic(method.getModifiers()) ? null : targetClass.getDeclaredConstructor().newInstance();
        actual = method.invoke(invokeTarget, inputs[i]);
        passed = toJson(actual).equals(toJson(expected[i]));
      } catch (Exception ex) {
        actual = ex.getMessage();
        passed = false;
      }

      String row = "{\\"name\\":\\"" + escapeJsonString(names[i]) + "\\","
        + "\\"passed\\":" + (passed ? "true" : "false") + ","
        + "\\"actual\\":" + toJson(actual) + ","
        + "\\"expected\\":" + toJson(expected[i]) + "}";
      System.out.print(row);
      if (i + 1 < names.length) System.out.print(",");
    }
    System.out.println("]");
    System.out.println("${escapedEnd}");
  }
}
`;
    }

    case 'cpp': {
      const toCppLiteral = (value: unknown): string => {
        if (Array.isArray(value)) {
          if (value.every((v) => typeof v === 'number' && Number.isInteger(v as number))) {
            return `std::vector<int>{${value.map((v) => String(v)).join(', ')}}`;
          }
          if (value.every((v) => typeof v === 'number')) {
            return `std::vector<double>{${value.map((v) => String(v)).join(', ')}}`;
          }
          if (value.every((v) => typeof v === 'string')) {
            return `std::vector<std::string>{${value.map((v) => `"${escapeDoubleQuoted(String(v))}"`).join(', ')}}`;
          }
          if (value.every((v) => Array.isArray(v) && (v as unknown[]).every((x) => typeof x === 'number' && Number.isInteger(x as number)))) {
            return `std::vector<std::vector<int>>{${value.map((row) => `{${(row as unknown[]).map((n) => String(n)).join(', ')}}`).join(', ')}}`;
          }
          return `std::vector<int>{}`;
        }
        if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : `${value}`;
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'string') return `"${escapeDoubleQuoted(value)}"`;
        return '0';
      };

      return `${source}

#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <type_traits>

std::string syntaxark_escape(const std::string& s) {
  std::string out;
  for (char ch : s) {
    if (ch == '\\\\') out += "\\\\\\\\";
    else if (ch == '"') out += "\\\\\\"";
    else if (ch == '\\n') out += "\\\\n";
    else if (ch == '\\r') out += "\\\\r";
    else out += ch;
  }
  return out;
}

template <typename T>
std::string syntaxark_to_json(const T& value);

template <>
std::string syntaxark_to_json<std::string>(const std::string& value) {
  return "\\"" + syntaxark_escape(value) + "\\"";
}

template <>
std::string syntaxark_to_json<const char*>(const char* const& value) {
  return "\\"" + syntaxark_escape(std::string(value)) + "\\"";
}

template <>
std::string syntaxark_to_json<bool>(const bool& value) {
  return value ? "true" : "false";
}

template <typename T>
std::string syntaxark_to_json(const std::vector<T>& v) {
  std::ostringstream out;
  out << "[";
  for (size_t i = 0; i < v.size(); ++i) {
    if (i) out << ",";
    out << syntaxark_to_json(v[i]);
  }
  out << "]";
  return out.str();
}

template <typename T>
std::string syntaxark_to_json(const T& value) {
  if constexpr (std::is_arithmetic<T>::value) {
    std::ostringstream out;
    out << value;
    return out.str();
  } else {
    std::ostringstream out;
    out << value;
    return "\\"" + syntaxark_escape(out.str()) + "\\"";
  }
}

int main() {
  std::cout << "${escapedStart}\\n";
  std::cout << "[";
  bool first = true;
${testCases.map((tc) => {
  const args = tc.input.map((v) => toCppLiteral(v)).join(', ');
  const expected = toCppLiteral(tc.expected);
  const name = escapeDoubleQuoted(tc.name);
  const fallbackExpected = escapeDoubleQuoted(JSON.stringify(tc.expected));
  return `  try {
    auto actual = ${functionName}(${args});
    auto expected = ${expected};
    bool passed = actual == expected;
    if (!first) std::cout << ",";
    std::cout << "{\\"name\\":\\"${name}\\",\\"passed\\":" << (passed ? "true" : "false")
              << ",\\"actual\\":" << syntaxark_to_json(actual)
              << ",\\"expected\\":" << syntaxark_to_json(expected) << "}";
    first = false;
  } catch (...) {
    if (!first) std::cout << ",";
    std::cout << "{\\"name\\":\\"${name}\\",\\"passed\\":false,\\"actual\\":\\"runtime error\\",\\"expected\\":${fallbackExpected ? `"${fallbackExpected}"` : '"null"'}}";
    first = false;
  }`;
}).join('\n')}
  std::cout << "]\\n";
  std::cout << "${escapedEnd}\\n";
  return 0;
}
`;
    }

    case 'c':
      return `${source}

#include <stdio.h>
#include <stdbool.h>

int main() {
  printf("${escapedStart}\\n");
  printf("[");
  printf("{\\"name\\":\\"C challenges require custom harness\\",\\"passed\\":false,\\"actual\\":\\"Not supported yet\\",\\"expected\\":\\"N/A\\"}");
  printf("]\\n");
  printf("${escapedEnd}\\n");
  return 0;
}
`;

    case 'rs': {
      const toRustLiteral = (value: unknown): string => {
        if (Array.isArray(value)) {
          if (value.every((v) => typeof v === 'number' && Number.isInteger(v as number))) {
            return `vec![${value.map((v) => `${v}i32`).join(', ')}]`;
          }
          if (value.every((v) => typeof v === 'boolean')) {
            return `vec![${value.map((v) => (v ? 'true' : 'false')).join(', ')}]`;
          }
          if (value.every((v) => typeof v === 'string')) {
            return `vec![${value.map((v) => `String::from("${escapeDoubleQuoted(String(v))}")`).join(', ')}]`;
          }
          if (value.every((v) => Array.isArray(v) && (v as unknown[]).every((x) => typeof x === 'number' && Number.isInteger(x as number)))) {
            return `vec![${value.map((row) => `vec![${(row as unknown[]).map((n) => `${n}i32`).join(', ')}]`).join(', ')}]`;
          }
          return 'vec![]';
        }
        if (typeof value === 'number') return Number.isInteger(value) ? `${value}i32` : `${value}f64`;
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'string') return `String::from("${escapeDoubleQuoted(value)}")`;
        return '0i32';
      };

      return `${source}

fn syntaxark_escape(s: &str) -> String {
  s.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"").replace("\\n", "\\\\n").replace("\\r", "\\\\r")
}

fn main() {
  println!("${escapedStart}");
  print!("[");
  let mut first = true;
${testCases.map((tc) => {
  const args = tc.input.map((v) => toRustLiteral(v)).join(', ');
  const expected = toRustLiteral(tc.expected);
  const name = escapeDoubleQuoted(tc.name);
  return `  {
    let actual = ${functionName}(${args});
    let expected = ${expected};
    let actual_str = format!("{:?}", actual);
    let expected_str = format!("{:?}", expected);
    let passed = actual_str == expected_str;
    if !first { print!(","); }
    print!("{{\\"name\\":\\"${name}\\",\\"passed\\":{},\\"actual\\":\\"{}\\",\\"expected\\":\\"{}\\"}}",
      if passed { "true" } else { "false" },
      syntaxark_escape(&actual_str),
      syntaxark_escape(&expected_str)
    );
    first = false;
  }`;
}).join('\n')}
  println!("]");
  println!("${escapedEnd}");
}
`;
    }

    case 'go': {
      const toGoLiteral = (value: unknown): string => {
        if (Array.isArray(value)) {
          if (value.every((v) => typeof v === 'number' && Number.isInteger(v as number))) {
            return `[]int{${value.map((v) => String(v)).join(', ')}}`;
          }
          if (value.every((v) => typeof v === 'number')) {
            return `[]float64{${value.map((v) => String(v)).join(', ')}}`;
          }
          if (value.every((v) => typeof v === 'boolean')) {
            return `[]bool{${value.map((v) => (v ? 'true' : 'false')).join(', ')}}`;
          }
          if (value.every((v) => typeof v === 'string')) {
            return `[]string{${value.map((v) => `"${escapeDoubleQuoted(String(v))}"`).join(', ')}}`;
          }
          if (value.every((v) => Array.isArray(v) && (v as unknown[]).every((x) => typeof x === 'number' && Number.isInteger(x as number)))) {
            return `[][]int{${value.map((row) => `{${(row as unknown[]).map((n) => String(n)).join(', ')}}`).join(', ')}}`;
          }
          return '[]any{}';
        }
        if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : `${value}`;
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'string') return `"${escapeDoubleQuoted(value)}"`;
        return 'nil';
      };

      return `${source}

package main

import (
  "encoding/json"
  "fmt"
)

func main() {
  fmt.Println("${escapedStart}")
  fmt.Print("[")
  first := true
${testCases.map((tc) => {
  const args = tc.input.map((v) => toGoLiteral(v)).join(', ');
  const expected = toGoLiteral(tc.expected);
  const name = escapeDoubleQuoted(tc.name);
  return `  {
    actual := ${functionName}(${args})
    expected := ${expected}
    actualJson, _ := json.Marshal(actual)
    expectedJson, _ := json.Marshal(expected)
    passed := string(actualJson) == string(expectedJson)
    if !first {
      fmt.Print(",")
    }
    fmt.Printf("{\\"name\\":\\"${name}\\",\\"passed\\":%t,\\"actual\\":%s,\\"expected\\":%s}", passed, string(actualJson), string(expectedJson))
    first = false
  }`;
}).join('\n')}
  fmt.Println("]")
  fmt.Println("${escapedEnd}")
}
`;
    }

    case 'cs': {
      const toCsLiteral = (value: unknown): string => {
        if (Array.isArray(value)) {
          if (value.every((v) => typeof v === 'number' && Number.isInteger(v as number))) {
            return `new int[]{${value.map((v) => String(v)).join(', ')}}`;
          }
          if (value.every((v) => typeof v === 'number')) {
            return `new double[]{${value.map((v) => `${v}d`).join(', ')}}`;
          }
          if (value.every((v) => typeof v === 'boolean')) {
            return `new bool[]{${value.map((v) => (v ? 'true' : 'false')).join(', ')}}`;
          }
          if (value.every((v) => typeof v === 'string')) {
            return `new string[]{${value.map((v) => `"${escapeDoubleQuoted(String(v))}"`).join(', ')}}`;
          }
          if (value.every((v) => Array.isArray(v) && (v as unknown[]).every((x) => typeof x === 'number' && Number.isInteger(x as number)))) {
            return `new int[][]{${value.map((row) => `new int[]{${(row as unknown[]).map((n) => String(n)).join(', ')}}`).join(', ')}}`;
          }
          return 'new object[]{}';
        }
        if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : `${value}d`;
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'string') return `"${escapeDoubleQuoted(value)}"`;
        return 'null';
      };

      return `using System;
using System.Text.Json;

${source}

public class SyntaxArkHarness {
  public static void Main() {
    Console.WriteLine("${escapedStart}");
    Console.Write("[");
    bool first = true;
${testCases.map((tc) => {
  const args = tc.input.map((v) => toCsLiteral(v)).join(', ');
  const expected = toCsLiteral(tc.expected);
  const name = escapeDoubleQuoted(tc.name);
  const expectedRaw = escapeDoubleQuoted(JSON.stringify(tc.expected));
  return `    try {
      var actual = Program.${functionName}(${args});
      var expected = ${expected};
      var actualJson = JsonSerializer.Serialize(actual);
      var expectedJson = JsonSerializer.Serialize(expected);
      var passed = actualJson == expectedJson;
      if (!first) Console.Write(",");
      Console.Write("{\\"name\\":\\"${name}\\",\\"passed\\":" + (passed ? "true" : "false") + ",\\"actual\\":" + actualJson + ",\\"expected\\":" + expectedJson + "}");
      first = false;
    } catch (Exception ex) {
      if (!first) Console.Write(",");
      Console.Write("{\\"name\\":\\"${name}\\",\\"passed\\":false,\\"actual\\":\\"" + ex.Message.Replace("\\\\","\\\\\\\\").Replace("\\"","\\\\\\"") + "\\",\\"expected\\":\\"${expectedRaw}\\"}");
      first = false;
    }`;
}).join('\n')}
    Console.WriteLine("]");
    Console.WriteLine("${escapedEnd}");
  }
}
`;
    }

    case 'php':
      return `<?php
${stripPhpTags(source)}

$cases = json_decode('${escapedCases}', true);
$results = [];
foreach ($cases as $tc) {
  try {
    $actual = ${functionName}(...$tc['input']);
    $passed = json_encode($actual) === json_encode($tc['expected']);
    $results[] = ['name' => $tc['name'], 'passed' => $passed, 'actual' => $actual, 'expected' => $tc['expected']];
  } catch (Throwable $e) {
    $results[] = ['name' => $tc['name'], 'passed' => false, 'actual' => $e->getMessage(), 'expected' => $tc['expected']];
  }
}
echo '${escapedStart}' . PHP_EOL;
echo json_encode($results) . PHP_EOL;
echo '${escapedEnd}' . PHP_EOL;
`;

    case 'rb':
      return `${source}

require 'json'
cases = JSON.parse('${escapedCases}')
results = cases.map do |tc|
  begin
    actual = method(:${functionName}).call(*tc["input"])
    passed = JSON.generate(actual) == JSON.generate(tc["expected"])
    { name: tc["name"], passed: passed, actual: actual, expected: tc["expected"] }
  rescue => e
    { name: tc["name"], passed: false, actual: e.message, expected: tc["expected"] }
  end
end
puts '${escapedStart}'
puts JSON.generate(results)
puts '${escapedEnd}'
`;

    case 'kt':
      return `${source}

import kotlinx.serialization.*
import kotlinx.serialization.json.*

@Serializable
data class SyntaxArkCase(val input: JsonArray, val expected: JsonElement, val name: String)

fun syntaxArkToJsonArray(ints: List<Int>): String = ints.joinToString(prefix = "[", postfix = "]")

fun main() {
  val cases = Json.decodeFromString<List<SyntaxArkCase>>("${escapedCases}")
  val out = mutableListOf<String>()
  for (tc in cases) {
    try {
      val nums = tc.input[0].jsonArray.map { it.jsonPrimitive.int }
      val target = tc.input[1].jsonPrimitive.int
      val expected = tc.expected.jsonArray.map { it.jsonPrimitive.int }
      val actual = ${functionName}(nums, target)
      val passed = actual == expected
      out.add("""{"name":"${'$'}{tc.name}","passed":${'$'}passed,"actual":${'$'}{syntaxArkToJsonArray(actual)},"expected":${'$'}{syntaxArkToJsonArray(expected)}}""")
    } catch (e: Exception) {
      out.add("""{"name":"${'$'}{tc.name}","passed":false,"actual":"${'$'}{e.message}","expected":${'$'}{tc.expected}}""")
    }
  }
  println("${escapedStart}")
  println("[${'$'}{out.joinToString(",")}]")
  println("${escapedEnd}")
}
`;

    case 'swift':
      return `${source}

import Foundation

let casesData = "${escapedCases}".data(using: .utf8)!
let rawCases = try! JSONSerialization.jsonObject(with: casesData) as! [[String: Any]]
var results: [[String: Any]] = []

for tc in rawCases {
  let name = (tc["name"] as? String) ?? "unnamed"
  let input = (tc["input"] as? [Any]) ?? []
  let expected = (tc["expected"] as? [Int]) ?? []
  if input.count >= 2, let nums = input[0] as? [Int], let target = input[1] as? Int {
    let actual = ${functionName}(nums, target)
    results.append(["name": name, "passed": actual == expected, "actual": actual, "expected": expected])
  } else {
    results.append(["name": name, "passed": false, "actual": "Invalid input", "expected": tc["expected"] ?? NSNull()])
  }
}

print("${escapedStart}")
let outData = try! JSONSerialization.data(withJSONObject: results)
print(String(data: outData, encoding: .utf8)!)
print("${escapedEnd}")
`;

    case 'lua': {
      const toLuaLiteral = (value: unknown): string => {
        if (Array.isArray(value)) {
          return `{${value.map((v) => toLuaLiteral(v)).join(', ')}}`;
        }
        if (typeof value === 'number') return `${value}`;
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'string') return `"${escapeDoubleQuoted(value)}"`;
        if (value === null || value === undefined) return 'nil';
        if (typeof value === 'object') {
          const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => `["${escapeDoubleQuoted(k)}"]=${toLuaLiteral(v)}`);
          return `{${entries.join(', ')}}`;
        }
        return 'nil';
      };
      return `${source}

local function syntaxark_json_encode(value)
  if type(value) == "table" then
    local is_array = true
    local max = 0
    for k, _ in pairs(value) do
      if type(k) ~= "number" then is_array = false break end
      if k > max then max = k end
    end
    local parts = {}
    if is_array then
      for i = 1, max do parts[#parts+1] = syntaxark_json_encode(value[i]) end
      return "[" .. table.concat(parts, ",") .. "]"
    end
    for k, v in pairs(value) do
      parts[#parts+1] = string.format("\\"%s\\":%s", k, syntaxark_json_encode(v))
    end
    return "{" .. table.concat(parts, ",") .. "}"
  elseif type(value) == "string" then
    return string.format("\\"%s\\"", value:gsub("\\\\", "\\\\\\\\"):gsub("\\"", "\\\\\\""))
  elseif type(value) == "boolean" then
    return value and "true" or "false"
  elseif type(value) == "number" then
    return tostring(value)
  elseif value == nil then
    return "null"
  end
  return "\\"unsupported\\""
end

local cases = {
${testCases.map((tc) => {
  return `  { name = "${escapeSingleQuoted(tc.name)}", input = ${toLuaLiteral(tc.input)}, expected = ${toLuaLiteral(tc.expected)} },`;
}).join('\n')}
}

local results = {}
for _, tc in ipairs(cases) do
  local ok, actual = pcall(${functionName}, table.unpack(tc.input))
  if ok then
    local actualJson = syntaxark_json_encode(actual)
    local expectedJson = syntaxark_json_encode(tc.expected)
    results[#results + 1] = { name = tc.name, passed = (actualJson == expectedJson), actual = actual, expected = tc.expected }
  else
    results[#results + 1] = { name = tc.name, passed = false, actual = actual, expected = tc.expected }
  end
end

print("${escapedStart}")
print(syntaxark_json_encode(results))
print("${escapedEnd}")
`;
    }

    case 'r': {
      const toRLiteral = (value: unknown): string => {
        if (Array.isArray(value)) {
          if (value.every((v) => typeof v === 'number')) return `c(${value.map((v) => String(v)).join(', ')})`;
          if (value.every((v) => typeof v === 'boolean')) return `c(${value.map((v) => (v ? 'TRUE' : 'FALSE')).join(', ')})`;
          if (value.every((v) => typeof v === 'string')) return `c(${value.map((v) => `"${escapeDoubleQuoted(String(v))}"`).join(', ')})`;
          return `list(${value.map((v) => toRLiteral(v)).join(', ')})`;
        }
        if (typeof value === 'number') return `${value}`;
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        if (typeof value === 'string') return `"${escapeDoubleQuoted(value)}"`;
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'object') {
          const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}=${toRLiteral(v)}`);
          return `list(${entries.join(', ')})`;
        }
        return 'NULL';
      };
      return `${source}

syntaxark_to_json <- function(x) {
  if (is.logical(x)) return(ifelse(x, "true", "false"))
  if (is.numeric(x)) return(paste0("[", paste(x, collapse=","), "]"))
  if (is.character(x)) return(paste0('"', x, '"'))
  return('"unsupported"')
}

cases <- list(
${testCases.map((tc) => {
  return `  list(name="${escapeSingleQuoted(tc.name)}", input=${toRLiteral(tc.input)}, expected=${toRLiteral(tc.expected)}),`;
}).join('\n')}
)

cat("${escapedStart}\\n")
cat("[")
for (i in seq_along(cases)) {
  tc <- cases[[i]]
  actual <- tryCatch(do.call(${functionName}, as.list(tc$input)), error=function(e) e$message)
  passed <- identical(actual, tc$expected)
  cat(sprintf('{"name":"%s","passed":%s,"actual":%s,"expected":%s}',
    tc$name,
    ifelse(passed, "true", "false"),
    syntaxark_to_json(actual),
    syntaxark_to_json(tc$expected)
  ))
  if (i < length(cases)) cat(",")
}
cat("]\\n")
cat("${escapedEnd}\\n")
`;
    }

    default:
      return null;
  }
};

// Register runners
const jsRunner = new JSRunner();
const pyRunner = new PythonRunner();
const remoteRunner = new RemoteRunner();
const htmlRunner = new HTMLRunner();

registry.register(jsRunner);
registry.register(pyRunner);
registry.register(remoteRunner);
registry.register(htmlRunner);

export class Runner {
  async run(files: Record<string, string>, entryPoint: string, onLog: (type: 'log' | 'error' | 'warn' | 'info', content: any[]) => void, onRender?: (code: string) => void) {
    const runner = registry.getRunner(entryPoint);
    
    if (!runner) {
      onLog('error', [`No runner found for file: ${entryPoint}`]);
      return { duration: 0 };
    }

    return runner.run(files, entryPoint, onLog, onRender);
  }

  async runTests(
    files: Record<string, string>,
    entryPoint: string,
    functionName: string,
    testCases: ChallengeTestCase[],
    onLog: (type: string, content: any[]) => void,
  ) {
    if (entryPoint.endsWith('.js') || entryPoint.endsWith('.ts')) {
        // Quick hack: Import bundle and run purely for JS/TS here to keep challenges working
        // In a real app, JSRunner would expose this method.
        const { bundle } = await import('./bundler');
        
        try {
          const rawSource = files[entryPoint] || '';
          const isJavaScriptFile = entryPoint.endsWith('.js');
          const sourceCandidates = extractJsFunctionCandidates(rawSource);
          const captureStatements = sourceCandidates
            .map((name) => `if (typeof ${name} === 'function') __capture[${JSON.stringify(name)}] = ${name};`)
            .join('\n');
          const harness = `
            const results = [];
            const cases = ${JSON.stringify(testCases)};
            const requestedName = ${JSON.stringify(functionName)};
            const isJavaScriptFile = ${JSON.stringify(isJavaScriptFile)};
            const rawSource = ${JSON.stringify(rawSource)};
            const sourceCandidates = ${JSON.stringify(sourceCandidates)};
            const syntaxArkOutput = (self && self.SyntaxArkOutput) || {};
            const globalObj = (typeof globalThis !== 'undefined' ? globalThis : self);
            const candidateNames = Array.from(new Set([
              requestedName,
              ...sourceCandidates,
              'solve',
              'solution',
              'isPalindrome',
              'twoSum',
            ].filter(Boolean)));

            let targetFn = null;
            for (const name of candidateNames) {
              const fn = syntaxArkOutput?.[name] || globalObj?.[name];
              if (typeof fn === 'function') {
                targetFn = fn;
                break;
              }
            }

            if (!targetFn) {
              const exportedFns = Object.entries(syntaxArkOutput || {}).filter(([, v]) => typeof v === 'function');
              if (exportedFns.length === 1) {
                targetFn = exportedFns[0][1];
              }
            }

            if (!targetFn && isJavaScriptFile && rawSource) {
              try {
                const captured = new Function(
                  "__raw",
                  "const __capture = {};\\n" +
                    "eval(__raw);\\n" +
                    ${JSON.stringify(captureStatements)} +
                    "\\nreturn __capture;",
                )(rawSource);
                for (const name of candidateNames) {
                  if (typeof captured?.[name] === 'function') {
                    targetFn = captured[name];
                    break;
                  }
                }
              } catch (_) {
                // ignore fallback parse errors
              }
            }

            if (typeof targetFn !== 'function') {
              const available = Object.keys(syntaxArkOutput || {}).join(', ') || '(none)';
              throw new Error("Function '" + requestedName + "' not found in bundle. Available exports: " + available);
            }

            for (const tc of cases) {
              try {
                const actual = targetFn(...tc.input);
                const passed = JSON.stringify(actual) === JSON.stringify(tc.expected);
                results.push({ name: tc.name, passed, actual, expected: tc.expected });
              } catch (err) {
                results.push({ name: tc.name, passed: false, actual: err.message, expected: tc.expected });
              }
            }
            self.postMessage({ type: 'test-results', results });
          `;

          const bundledCode = await bundle(files, entryPoint);
          const fullCode = bundledCode + "\n" + harness;

          const workerCode = `
            const originalConsole = {
              log: console.log,
              error: console.error,
              warn: console.warn,
              info: console.info,
            };

            const sendLog = (type, args) => {
              self.postMessage({ type: 'log', logType: type, content: args });
            };

            console.log = (...args) => sendLog('log', args);
            console.error = (...args) => sendLog('error', args);
            console.warn = (...args) => sendLog('warn', args);
            console.info = (...args) => sendLog('info', args);

            self.onmessage = (e) => {
              if (e.data.type === 'execute') {
                try {
                  eval(e.data.code);
                  self.postMessage({ type: 'done', duration: 0 });
                } catch (err) {
                  self.postMessage({ type: 'log', logType: 'error', content: [err.message] });
                  self.postMessage({ type: 'done', duration: 0 });
                }
              }
            };
          `;

          const blob = new Blob([workerCode], { type: 'application/javascript' });
          const worker = new Worker(URL.createObjectURL(blob));

          return new Promise<{ results: any[] }>((resolve) => {
            worker.onmessage = (e) => {
              if (e.data.type === 'log') {
                onLog(e.data.logType, e.data.content);
              } else if (e.data.type === 'test-results') {
                resolve({ results: e.data.results });
              }
            };

            worker.postMessage({ type: 'execute', code: fullCode });
            
            setTimeout(() => {
                worker.terminate();
                resolve({ results: [] });
            }, 5000);
          });
        } catch (err: any) {
          onLog('error', [err.message]);
          return { results: [] };
        }
    }

    const extension = entryPoint.split('.').pop() || '';
    const config = LANGUAGE_MAP[extension];
    if (!config || !config.pistonRuntime) {
      onLog('warn', [`Challenge tests are not supported for .${extension} files.`]);
      return { results: [] };
    }

    const source = files[entryPoint] || '';
    const effectiveFunctionName = inferFunctionNameFromSource(extension, source, functionName);
    if (effectiveFunctionName !== functionName) {
      onLog('info', [`Using detected function '${effectiveFunctionName}' (requested '${functionName}').`]);
    }
    const harness = buildRemoteChallengeHarness(extension, source, effectiveFunctionName, testCases);
    if (!harness) {
      onLog('warn', [`Challenge harness is not available yet for .${extension}.`]);
      return { results: [] };
    }

    const remoteFileName = extension === 'java' ? 'Main.java' : entryPoint;
    onLog('info', [`Running challenge tests in ${config.name} via remote executor...`]);
    try {
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: config.pistonRuntime,
          version: config.pistonVersion,
          files: [{ name: remoteFileName, content: harness }],
        }),
      });
      const result = await response.json();
      const run = result?.run;
      if (!run) {
        onLog('error', ['Invalid response from remote executor.']);
        return { results: [] };
      }

      if (run.stderr) {
        onLog('error', [run.stderr]);
      }
      if (run.stdout) {
        onLog('log', [run.stdout]);
      }

      const stdout = String(run.stdout || '');
      const jsonBlock = extractJsonBetweenMarkers(stdout);
      if (!jsonBlock) {
        onLog('error', ['Could not parse challenge test results from runner output.']);
        return { results: [] };
      }

      const parsed = JSON.parse(jsonBlock) as ChallengeTestResult[];
      if (!Array.isArray(parsed)) {
        onLog('error', ['Unexpected test result format.']);
        return { results: [] };
      }
      return { results: parsed };
    } catch (err: any) {
      onLog('error', [err?.message || 'Failed to run remote challenge tests.']);
      return { results: [] };
    }
  }

  stop() {
    jsRunner.stop();
    pyRunner.stop();
  }
}

export const runner = new Runner();
