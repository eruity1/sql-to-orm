import { ValueParser } from "../../utils/valueParser";

jest.mock("../../constants", () => ({
  SQL_PATTERNS: {
    VALUE_CLEANUP: /^['"]|['"]$/g,
    NUMBER: /^-?(?:\d+\.?\d*|\.\d+)$/,
  },
}));

describe("ValueParser", () => {
  describe("parse", () => {
    test("parses string literal without quotes", () => {
      const result = ValueParser.parse("active");
      expect(result).toBe('"active"');
    });

    test("parses null value", () => {
      const result = ValueParser.parse("NULL");
      expect(result).toBe("nil");
    });

    test("parses true boolean value", () => {
      const result = ValueParser.parse("true");
      expect(result).toBe(true);
    });

    test("parses false boolean value", () => {
      const result = ValueParser.parse("false");
      expect(result).toBe(false);
    });

    test("parses integer number", () => {
      const result = ValueParser.parse("42");
      expect(result).toBe(42);
    });

    test("parses negative integer number", () => {
      const result = ValueParser.parse("-42");
      expect(result).toBe(-42);
    });

    test("parses decimal number", () => {
      const result = ValueParser.parse("3.14");
      expect(result).toBe(3.14);
    });

    test("handles empty input", () => {
      const result = ValueParser.parse("");
      expect(result).toBe("");
    });
  });
});
