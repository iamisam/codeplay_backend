// This is a mock database of problems and their test cases.
// In a real application, this would come from your MySQL database.

// Judge0 Language IDs:
// C++: 54
// Java: 62
// Python: 71

const problemStore = {
  "two-sum": {
    title: "Two Sum",
    testCases: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
      { input: "nums = [3,3], target = 6", output: "[0,1]" },
    ],
    // We need to provide a simple function signature for Judge0
    boilerPlate: {
      54: "#include <vector>\n\nclass Solution {\npublic:\n    std::vector<int> twoSum(std::vector<int>& nums, int target) {\n        // Your code here\n    }\n};",
      62: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Your code here\n    }\n}",
      71: "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        # Your code here\n        pass",
    },
  },
  // You would add more problems here...
  "reverse-string": {
    title: "Reverse String",
    testCases: [
      { input: 's = ["h","e","l","l","o"]', output: '["o","l","l","e","h"]' },
      {
        input: 's = ["H","a","n","n","a","h"]',
        output: '["h","a","n","n","a","H"]',
      },
    ],
    boilerPlate: {
      71: 'class Solution:\n    def reverseString(self, s: List[str]) -> None:\n        """\n        Do not return anything, modify s in-place instead.\n        """\n        # Your code here\n        pass',
    },
  },
};

export const getProblemBySlug = (slug) => {
  return problemStore[slug] || null;
};
