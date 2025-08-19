import { ConditionParser } from "../../utils/conditionParser";
import { StringHelpers } from "../../utils/stringHelpers";
import { ValueParser } from "../../utils/valueParser";

jest.mock("../../utils/stringHelpers");
jest.mock("../../utils/valueParser");
jest.mock("../../constants", () => ({
  SQL_PATTERNS: {
    SIMPLE_OPERATORS: /(=|!=|>=|<=|>|<)/,
    SIMPLE_PATTERN: /^(\w+(?:\.\w+)?)\s*(=|!=|>=|<=|>|<)\s*(.+)$/,
    LIKE_PATTERN: /(\w+(?:\.\w+)?)\s+(NOT\s+)?LIKE\s+(['"])(.*?)\3/gi,
    ILIKE_PATTERN: /(\w+(?:\.\w+)?)\s+(NOT\s+)?ILIKE\s+(['"])(.*?)\3/gi,
    IN_PATTERN: /(\w+(?:\.\w+)?)\s+(NOT\s+)?IN\s*\(([^)]+)\)/gi,
    IN_PATTERN_WITH_SUBQUERY:
      /(\w+(?:\.\w+)?)\s+(NOT\s+)?IN\s*\(([^()]*\bSELECT\b[^()]*)\)/gi,
    BETWEEN_PATTERN:
      /(\w+(?:\.\w+)?)\s+(NOT\s+)?BETWEEN\s+(.+?)\s+AND\s+(.+?)(?=\s+(?:AND|OR)|$)/gi,
    NULL_PATTERN: /(\w+(?:\.\w+)?)\s+IS\s+(NOT\s+)?NULL/gi,
    SUBQUERY_PATTERN: /\([^()]*\bSELECT\b[^()]*\)/gi,
  },
}));

describe("ConditionParser", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    ValueParser.parse.mockImplementation((value) => {
      if (value === "NULL") return "nil";
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
      if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value);
      return `"${value.replace(/^['"]|['"]$/g, "")}"`;
    });

    StringHelpers.removeClause.mockImplementation((where, clause) => {
      const pattern = new RegExp(
        `\\s*(AND|OR)?\\s*${clause.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(AND|OR)?\\s*`,
        "i"
      );
      return where.replace(pattern, " ").trim();
    });
  });

  describe("hasSubquery", () => {
    test("returns true for expression with subquery", () => {
      const expression = "id IN (SELECT user_id FROM posts)";
      const result = ConditionParser.hasSubquery(expression);
      expect(result).toBe(true);
    });

    test("returns false for expression without subquery", () => {
      const expression = 'age = 25 AND status = "active"';
      const result = ConditionParser.hasSubquery(expression);
      expect(result).toBe(false);
    });

    test("returns false for empty expression", () => {
      const expression = "";
      const result = ConditionParser.hasSubquery(expression);
      expect(result).toBe(false);
    });
  });

  describe("isSimpleEquality", () => {
    test("returns true for simple equality conditions", () => {
      const expression = 'age = 25 AND status = "active"';
      const result = ConditionParser.isSimpleEquality(expression);
      expect(result).toBe(true);
    });

    test("returns true for simple comparison operators", () => {
      const expression = "age >= 18 AND salary < 100000";
      const result = ConditionParser.isSimpleEquality(expression);
      expect(result).toBe(true);
    });

    test("returns false for OR operator", () => {
      const expression = 'age = 25 OR status = "active"';
      const result = ConditionParser.isSimpleEquality(expression);
      expect(result).toBe(false);
    });

    test("returns false for complex operators", () => {
      const expression = 'name LIKE "%John%" AND age = 25';
      const result = ConditionParser.isSimpleEquality(expression);
      expect(result).toBe(false);
    });

    test("returns false for subquery", () => {
      const expression = "id IN (SELECT user_id FROM posts)";
      const result = ConditionParser.isSimpleEquality(expression);
      expect(result).toBe(false);
    });

    test("returns true for single condition", () => {
      const expression = "id = 1";
      const result = ConditionParser.isSimpleEquality(expression);
      expect(result).toBe(true);
    });

    test("returns false for empty expression", () => {
      const expression = "";
      const result = ConditionParser.isSimpleEquality(expression);
      expect(result).toBe(false);
    });
  });

  describe("parseSimpleConditions", () => {
    test("parses simple equality conditions", () => {
      const where = 'age = 25 AND status = "active"';
      const result = ConditionParser.parseSimpleConditions(where);

      expect(result).toEqual([
        { field: "age", operator: "=", value: 25 },
        { field: "status", operator: "=", value: '"active"' },
      ]);
      expect(ValueParser.parse).toHaveBeenCalledWith("25");
      expect(ValueParser.parse).toHaveBeenCalledWith('"active"');
    });

    test("parses conditions with different operators", () => {
      const where = "age >= 18 AND salary != 100000";
      const result = ConditionParser.parseSimpleConditions(where);

      expect(result).toEqual([
        { field: "age", operator: ">=", value: 18 },
        { field: "salary", operator: "!=", value: 100000 },
      ]);
    });

    test("filters out invalid conditions", () => {
      const where = 'age = 25 AND invalid AND status = "active"';
      const result = ConditionParser.parseSimpleConditions(where);

      expect(result).toEqual([
        { field: "age", operator: "=", value: 25 },
        { field: "status", operator: "=", value: '"active"' },
      ]);
    });

    test("handles single condition", () => {
      const where = "id = 1";
      const result = ConditionParser.parseSimpleConditions(where);

      expect(result).toEqual([{ field: "id", operator: "=", value: 1 }]);
    });

    test("returns empty array for subquery", () => {
      const where = "id IN (SELECT user_id FROM posts)";
      const result = ConditionParser.parseSimpleConditions(where);

      expect(result).toEqual([]);
    });

    test("returns empty array for empty input", () => {
      const where = "";
      const result = ConditionParser.parseSimpleConditions(where);

      expect(result).toEqual([]);
    });
  });

  describe("parseComplexConditions", () => {
    test("parses LIKE condition", () => {
      const where = 'name LIKE "%John%" AND age = 25';
      const result = ConditionParser.parseComplexConditions(where);

      expect(result).toEqual({
        like: [
          { field: "name", not: false, pattern: "%John%", isILike: false },
        ],
        in: [],
        between: [],
        null: [],
        simple: [{ field: "age", operator: "=", value: 25 }],
      });
      expect(StringHelpers.removeClause).toHaveBeenCalledWith(
        where,
        'name LIKE "%John%"'
      );
      expect(ValueParser.parse).toHaveBeenCalledWith("25");
    });

    test("parses ILIKE condition", () => {
      const where = 'name ILIKE "%John%" AND age = 25';
      const result = ConditionParser.parseComplexConditions(where);

      expect(result).toEqual({
        like: [{ field: "name", not: false, pattern: "%John%", isILike: true }],
        in: [],
        between: [],
        null: [],
        simple: [{ field: "age", operator: "=", value: 25 }],
      });
      expect(StringHelpers.removeClause).toHaveBeenCalledWith(
        where,
        'name ILIKE "%John%"'
      );
      expect(ValueParser.parse).toHaveBeenCalledWith("25");
    });

    test("parses NOT ILIKE condition", () => {
      const where = 'email NOT ILIKE "%.com"';
      const result = ConditionParser.parseComplexConditions(where);

      expect(result).toEqual({
        like: [{ field: "email", not: true, pattern: "%.com", isILike: true }],
        in: [],
        between: [],
        null: [],
        simple: [],
      });
      expect(StringHelpers.removeClause).toHaveBeenCalledWith(
        where,
        'email NOT ILIKE "%.com"'
      );
    });

    test("parses IN condition without subquery", () => {
      const where = 'status IN ("active", "pending")';
      const result = ConditionParser.parseComplexConditions(where);

      expect(result).toEqual({
        like: [],
        in: [
          { field: "status", not: false, values: ['"active"', '"pending"'] },
        ],
        between: [],
        null: [],
        simple: [],
      });
      expect(ValueParser.parse).toHaveBeenCalledWith('"active"');
      expect(ValueParser.parse).toHaveBeenCalledWith('"pending"');
    });

    test("parses BETWEEN condition", () => {
      const where = "age BETWEEN 18 AND 30";
      const result = ConditionParser.parseComplexConditions(where);

      expect(result).toEqual({
        like: [],
        in: [],
        between: [{ field: "age", not: false, start: 18, end: 30 }],
        null: [],
        simple: [],
      });
      expect(ValueParser.parse).toHaveBeenCalledWith("18");
      expect(ValueParser.parse).toHaveBeenCalledWith("30");
    });

    test("parses IS NULL condition", () => {
      const where = "deleted_at IS NULL";
      const result = ConditionParser.parseComplexConditions(where);

      expect(result).toEqual({
        like: [],
        in: [],
        between: [],
        null: [{ field: "deleted_at", not: false }],
        simple: [],
      });
    });

    test("parses IS NOT NULL condition", () => {
      const where = "updated_at IS NOT NULL";
      const result = ConditionParser.parseComplexConditions(where);

      expect(result).toEqual({
        like: [],
        in: [],
        between: [],
        null: [{ field: "updated_at", not: true }],
        simple: [],
      });
    });

    test("parses mixed conditions with ILIKE and simple", () => {
      const where =
        'name ILIKE "%John%" AND age BETWEEN 18 AND 30 AND status = "active"';
      const result = ConditionParser.parseComplexConditions(where);

      expect(result).toEqual({
        like: [{ field: "name", not: false, pattern: "%John%", isILike: true }],
        in: [],
        between: [{ field: "age", not: false, start: 18, end: 30 }],
        null: [],
        simple: [{ field: "status", operator: "=", value: '"active"' }],
      });
      expect(StringHelpers.removeClause).toHaveBeenCalledWith(
        expect.any(String),
        'name ILIKE "%John%"'
      );
      expect(ValueParser.parse).toHaveBeenCalledWith("18");
      expect(ValueParser.parse).toHaveBeenCalledWith("30");
      expect(ValueParser.parse).toHaveBeenCalledWith('"active"');
    });

    test("handles empty input", () => {
      const where = "";
      const result = ConditionParser.parseComplexConditions(where);

      expect(result).toEqual({
        like: [],
        in: [],
        between: [],
        null: [],
        simple: [],
      });
    });

    test("handles only simple conditions", () => {
      const where = 'age = 25 AND status = "active"';
      const result = ConditionParser.parseComplexConditions(where);

      expect(result).toEqual({
        like: [],
        in: [],
        between: [],
        null: [],
        simple: [
          { field: "age", operator: "=", value: 25 },
          { field: "status", operator: "=", value: '"active"' },
        ],
      });
    });
  });

  describe("extractSubqueries", () => {
    test("extracts IN subquery", () => {
      const where = "id IN (SELECT user_id FROM posts WHERE published = true)";
      const result = ConditionParser.extractSubqueries(where);

      expect(result).toEqual([
        {
          field: "id",
          not: false,
          subquery: "SELECT user_id FROM posts WHERE published = true",
          fullMatch: "id IN (SELECT user_id FROM posts WHERE published = true)",
        },
      ]);
    });

    test("extracts NOT IN subquery", () => {
      const where = "id NOT IN (SELECT user_id FROM posts)";
      const result = ConditionParser.extractSubqueries(where);

      expect(result).toEqual([
        {
          field: "id",
          not: true,
          subquery: "SELECT user_id FROM posts",
          fullMatch: "id NOT IN (SELECT user_id FROM posts)",
        },
      ]);
    });

    test("extracts multiple subqueries", () => {
      const where =
        "id IN (SELECT user_id FROM posts) AND dept_id IN (SELECT dept_id FROM departments)";
      const result = ConditionParser.extractSubqueries(where);

      expect(result).toEqual([
        {
          field: "id",
          not: false,
          subquery: "SELECT user_id FROM posts",
          fullMatch: "id IN (SELECT user_id FROM posts)",
        },
        {
          field: "dept_id",
          not: false,
          subquery: "SELECT dept_id FROM departments",
          fullMatch: "dept_id IN (SELECT dept_id FROM departments)",
        },
      ]);
    });

    test("returns empty array for no subqueries", () => {
      const where = 'age = 25 AND status = "active"';
      const result = ConditionParser.extractSubqueries(where);

      expect(result).toEqual([]);
    });

    test("returns empty array for empty input", () => {
      const where = "";
      const result = ConditionParser.extractSubqueries(where);

      expect(result).toEqual([]);
    });
  });
});
