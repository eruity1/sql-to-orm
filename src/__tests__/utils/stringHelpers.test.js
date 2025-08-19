import { singularize } from "inflection";
import { StringHelpers } from "../../utils/stringHelpers";

jest.mock("inflection");
jest.mock("../../constants", () => ({
  SQL_PATTERNS: {
    REMOVE_CLAUSE: /[.*+?^${}()|[\]\\]/g,
    SUBQUERY_PATTERN: /\([^()]*\bSELECT\b[^()]*\)/gi,
  },
}));

describe("StringHelpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("toModelName", () => {
    test("converts single-word table name to singular camel case", () => {
      singularize.mockImplementation((str) => str);
      const result = StringHelpers.toModelName("users");

      expect(singularize).toHaveBeenCalledWith("users");
      expect(result).toBe("Users");
    });

    test("converts snake_case table name to singular camel case", () => {
      singularize.mockImplementation((str) => str.replace(/s$/, ""));
      const result = StringHelpers.toModelName("user_profiles");

      expect(singularize).toHaveBeenCalledWith("user_profiles");
      expect(result).toBe("UserProfile");
    });

    test("handles already singular table name", () => {
      singularize.mockImplementation((str) => str);
      const result = StringHelpers.toModelName("user");

      expect(singularize).toHaveBeenCalledWith("user");
      expect(result).toBe("User");
    });

    test("handles empty or invalid table name", () => {
      singularize.mockImplementation((str) => str);
      const result = StringHelpers.toModelName("");

      expect(singularize).toHaveBeenCalledWith("");
      expect(result).toBe("");
    });
  });

  describe("removeClause", () => {
    test("removes clause with AND operator", () => {
      const where = 'age = 25 AND name = "John"';
      const clause = "age = 25";
      const result = StringHelpers.removeClause(where, clause);

      expect(result).toBe(' name = "John"');
    });

    test("removes clause with OR operator", () => {
      const where = 'age = 25 OR status = "active"';
      const clause = 'status = "active"';
      const result = StringHelpers.removeClause(where, clause);

      expect(result).toBe("age = 25 ");
    });

    test("removes clause without logical operators", () => {
      const where = 'name = "John"';
      const clause = 'name = "John"';
      const result = StringHelpers.removeClause(where, clause);

      expect(result).toBe(" ");
    });

    test("removes clause with special characters", () => {
      const where = 'email LIKE "%.com" AND status = "active"';
      const clause = 'email LIKE "%.com"';
      const result = StringHelpers.removeClause(where, clause);

      expect(result).toBe(' status = "active"');
    });

    test("handles clause not found in WHERE", () => {
      const where = 'age = 25 AND name = "John"';
      const clause = 'status = "active"';
      const result = StringHelpers.removeClause(where, clause);

      expect(result).toBe('age = 25 AND name = "John"');
    });

    test("handles special characters in clause correctly", () => {
      const where = 'path LIKE "/users/%" AND active = true';
      const clause = 'path LIKE "/users/%"';
      const result = StringHelpers.removeClause(where, clause);

      expect(result).toBe(" active = true");
    });
  });

  describe("hasSubquery", () => {
    test("returns true for subquery", () => {
      const where = "users.id IN (SELECT user_id FROM posts)";
      const result = StringHelpers.hasSubquery(where);

      expect(result).toBe(true);
    });

    test("returns false for no subquery", () => {
      const where = "users.age = 25";
      const result = StringHelpers.hasSubquery(where);

      expect(result).toBe(false);
    });

    test("returns false for empty input", () => {
      const where = "";
      const result = StringHelpers.hasSubquery(where);

      expect(result).toBe(false);
    });

    test("returns false for partial subquery-like string", () => {
      const where = 'posts.title LIKE "SELECT%"';
      const result = StringHelpers.hasSubquery(where);

      expect(result).toBe(false);
    });
  });
});
