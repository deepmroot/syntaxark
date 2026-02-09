export interface TestCase {
  input: any[];
  expected: any;
  name: string;
}

export interface Challenge {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  initialCode: string;
  testCases: TestCase[];
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    description: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.',
    initialCode: `function twoSum(nums, target) {
  // Write your code here
}`,
    testCases: [
      { name: 'Example 1', input: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { name: 'Example 2', input: [[3, 2, 4], 6], expected: [1, 2] },
      { name: 'Example 3', input: [[3, 3], 6], expected: [0, 1] },
    ],
  },
  {
    id: 'palindrome-number',
    title: 'Palindrome Number',
    difficulty: 'Easy',
    description: 'Given an integer `x`, return `true` if `x` is a palindrome, and `false` otherwise.',
    initialCode: `function isPalindrome(x) {
  // Write your code here
}`,
    testCases: [
      { name: 'Example 1', input: [121], expected: true },
      { name: 'Example 2', input: [-121], expected: false },
      { name: 'Example 3', input: [10], expected: false },
    ],
  },
];