import { ActiveRecordGenerator } from "../../generators/activeRecordGenerator";
import { BaseGenerator } from "../../generators/baseGenerator";
import { ActiveRecordJoinGenerator } from "../../generators/activeRecordJoinGenerator";
import { ConditionParser } from "../../utils/conditionParser";
import { ValueParser } from "../../utils/valueParser";
import { StringHelpers } from "../../utils/stringHelpers";

jest.mock("../../generators/baseGenerator");
jest.mock("../../generators/activeRecordJoinGenerator");
jest.mock("../../utils/conditionParser");
jest.mock("../../utils/valueParser");
jest.mock("../../utils/stringHelpers");
jest.mock("../../constants", () => ({
  SQL_PATTERNS: {
    COMPLEX_OPERATORS:
      /LIKE|NOT LIKE|ILIKE|NOT ILIKE|IN|NOT IN|BETWEEN|IS NULL|IS NOT NULL/i,
    WHERE_PATTERN: /(.+?)(=|!=|>=|<=|>|<)(.+?)(\s+(?:AND|OR)\s+|$)/gi,
  },
}));

describe("ActiveRecordGenerator", () => {
  let generator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new ActiveRecordGenerator();

    StringHelpers.toModelName.mockImplementation(
      (table) => table.charAt(0).toUpperCase() + table.slice(1)
    );

    ValueParser.parse.mockImplementation((value) => {
      if (value.startsWith("'") && value.endsWith("'")) {
        return `"${value.slice(1, -1)}"`;
      }
      if (value.toLowerCase() === "null") return "nil";
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
      if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value);
      return `"${value}"`;
    });

    ConditionParser.isSimpleEquality.mockImplementation(
      (where) =>
        !/or/i.test(where) &&
        where
          .replace(/\([^]+\)/g, "")
          .split(/AND/i)
          .every((str) => /(=|!=|>=|<=|>|<)/.test(str.trim()))
    );
    ConditionParser.parseSimpleConditions.mockImplementation((where) => {
      return where
        .split(/\s+AND\s+/i)
        .map((cond) => {
          const match = cond
            .trim()
            .match(/^(\w+(?:\.\w+)?)\s*(=|!=|>=|<=|>|<)\s*(.+)$/);
          if (!match) return null;
          const [, field, operator, value] = match;
          return { field, operator, value: ValueParser.parse(value.trim()) };
        })
        .filter(Boolean);
    });
    ConditionParser.parseComplexConditions.mockImplementation((where) => ({
      like:
        where.match(/(\w+)\s+(NOT\s+)?LIKE\s+(['"]).*?\3/gi)?.map((m) => {
          const [, field, not, , pattern] = m.match(
            /(\w+)\s+(NOT\s+)?LIKE\s+(['"])(.*?)\3/i
          );
          return { field, not: !!not, pattern };
        }) || [],
      in:
        where.match(/(\w+)\s+(NOT\s+)?IN\s*\([^)]+\)/gi)?.map((m) => {
          const [, field, not, valuesList] = m.match(
            /(\w+)\s+(NOT\s+)?IN\s*\(([^)]+)\)/i
          );
          return {
            field,
            not: !!not,
            values: valuesList
              .split(",")
              .map((v) => ValueParser.parse(v.trim())),
          };
        }) || [],
      between:
        where
          .match(
            /(\w+)\s+(NOT\s+)?BETWEEN\s+.+?\s+AND\s+.+?(?=\s+(?:AND|OR)|$)/gi
          )
          ?.map((m) => {
            const [, field, not, start, end] = m.match(
              /(\w+)\s+(NOT\s+)?BETWEEN\s+(.+?)\s+AND\s+(.+?)(?=\s+(?:AND|OR)|$)/i
            );
            return {
              field,
              not: !!not,
              start: ValueParser.parse(start.trim()),
              end: ValueParser.parse(end.trim()),
            };
          }) || [],
      null:
        where.match(/(\w+)\s+IS\s+(NOT\s+)?NULL/gi)?.map((m) => {
          const [, field, not] = m.match(/(\w+)\s+IS\s+(NOT\s+)?NULL/i);
          return { field, not: !!not };
        }) || [],
      simple: ConditionParser.parseSimpleConditions(where),
    }));
  });

  describe("generateQuery", () => {
    test("delegates to ActiveRecordJoinGenerator when joins are present", () => {
      const parsed = {
        joins: [{ table: "posts", condition: "users.id = posts.user_id" }],
        mainTable: "users",
      };
      ActiveRecordJoinGenerator.prototype.generateQuery.mockReturnValue(
        "Users.joins(:posts)"
      );

      const result = generator.generateQuery(parsed);

      expect(
        ActiveRecordJoinGenerator.prototype.generateQuery
      ).toHaveBeenCalledWith(parsed);
      expect(result).toBe("Users.joins(:posts)");
    });

    test("calls super.generateQuery when no joins are present", () => {
      const parsed = { joins: [], mainTable: "users", type: "SELECT" };
      BaseGenerator.prototype.generateQuery.mockReturnValue("Users");

      const result = generator.generateQuery(parsed);

      expect(BaseGenerator.prototype.generateQuery).toHaveBeenCalledWith(
        parsed
      );
      expect(result).toBe("Users");
    });
  });

  describe("generateSelect", () => {
    test("generates basic SELECT query", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "*" }],
        joins: [],
        where: "",
        groupBy: [],
        having: "",
        orderBy: [],
        limit: null,
      };

      const result = generator.generateSelect(parsed);

      expect(result).toBe("Users");
    });

    test("generates SELECT with WHERE, GROUP BY, HAVING, ORDER BY, and LIMIT", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "*" }],
        joins: [],
        where: 'age = 25 AND status = "active"',
        groupBy: [{ name: "status" }],
        having: "COUNT(*) > 10",
        orderBy: [{ name: "age", direction: "DESC" }],
        limit: { count: 10, offset: 5 },
      };

      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "age", operator: "=", value: 25 },
        { field: "status", operator: "=", value: '"active"' },
      ]);

      const result = generator.generateSelect(parsed);

      expect(result).toBe(
        'Users.where(age: 25, status: "active").group(:status).having("COUNT(*) > 10").order(age: :desc).limit(10).offset(5)'
      );
    });

    test("generates SELECT with specific columns", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [
          { name: "name", table: "users" },
          { name: "email", table: "users" },
        ],
        joins: [],
        where: "",
        groupBy: [],
        having: "",
        orderBy: [],
        limit: null,
      };

      const result = generator.generateSelect(parsed);

      expect(result).toBe("Users.select(:name, :email)");
    });
  });

  describe("generateInsert", () => {
    test("generates INSERT query with columns and values", () => {
      const parsed = {
        type: "INSERT",
        mainTable: "users",
        columns: [{ name: "name" }, { name: "email" }],
        values: ["'John Doe'", "'john@example.com'"],
      };

      const result = generator.generateInsert(parsed);

      expect(result).toBe(
        'Users.create!(name: "John Doe", email: "john@example.com")'
      );
    });

    test("generates INSERT query without columns or values", () => {
      const parsed = {
        type: "INSERT",
        mainTable: "users",
        columns: [],
        values: [],
      };

      const result = generator.generateInsert(parsed);

      expect(result).toBe("Users.create!()");
    });

    test("handles null columns or values", () => {
      const parsed = {
        type: "INSERT",
        mainTable: "users",
        columns: null,
        values: null,
      };

      const result = generator.generateInsert(parsed);

      expect(result).toBe("Users.create!()");
    });
  });

  describe("generateUpdate", () => {
    test("generates UPDATE query with SET and WHERE", () => {
      const parsed = {
        type: "UPDATE",
        mainTable: "users",
        set: [{ name: "status", value: "'inactive'" }],
        where: "id = 1",
      };

      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "id", operator: "=", value: 1 },
      ]);

      const result = generator.generateUpdate(parsed);

      expect(result).toBe('Users.where(id: 1).update_all(status: "inactive")');
    });

    test("generates UPDATE query without SET", () => {
      const parsed = {
        type: "UPDATE",
        mainTable: "users",
        set: [],
        where: "",
      };

      const result = generator.generateUpdate(parsed);

      expect(result).toBe("Users.update_all()");
    });

    test("handles SET with column object", () => {
      const parsed = {
        type: "UPDATE",
        mainTable: "users",
        set: [{ column: { name: "status" }, value: "'inactive'" }],
        where: "",
      };

      const result = generator.generateUpdate(parsed);

      expect(result).toBe('Users.update_all(status: "inactive")');
    });
  });

  describe("generateDelete", () => {
    test("generates DELETE query with WHERE", () => {
      const parsed = {
        type: "DELETE",
        mainTable: "users",
        where: 'status = "inactive"',
      };

      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "status", operator: "=", value: '"inactive"' },
      ]);

      const result = generator.generateDelete(parsed);

      expect(result).toBe('Users.where(status: "inactive").destroy_all');
    });

    test("generates DELETE query without WHERE", () => {
      const parsed = {
        type: "DELETE",
        mainTable: "users",
        where: "",
      };

      const result = generator.generateDelete(parsed);

      expect(result).toBe("Users.destroy_all");
    });
  });

  describe("buildWhere", () => {
    test("builds simple WHERE clause", () => {
      const where = 'age = 25 AND status = "active"';
      ConditionParser.isSimpleEquality.mockReturnValue(true);
      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "age", operator: "=", value: 25 },
        { field: "status", operator: "=", value: '"active"' },
      ]);

      const result = generator.buildWhere(where);

      expect(result).toBe('.where(age: 25, status: "active")');
    });

    test("builds complex WHERE clause with LIKE", () => {
      const where = 'name LIKE "%John%"';
      ConditionParser.isSimpleEquality.mockReturnValue(false);
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [{ field: "name", not: false, pattern: "%John%" }],
        in: [],
        between: [],
        null: [],
        simple: [],
      });

      const result = generator.buildWhere(where);

      expect(result).toBe('.where("name LIKE ?", "%John%")');
    });

    test("builds complex WHERE clause with mixed conditions", () => {
      const where =
        'name LIKE "%John%" AND age = 25 AND salary BETWEEN 50000 AND 100000';
      ConditionParser.isSimpleEquality.mockReturnValue(false);
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [{ field: "name", not: false, pattern: "%John%" }],
        in: [],
        between: [{ field: "salary", not: false, start: 50000, end: 100000 }],
        null: [],
        simple: [{ field: "age", operator: "=", value: 25 }],
      });

      const result = generator.buildWhere(where);

      expect(result).toBe(
        '.where("name LIKE ?", "%John%").where(salary: 50000..100000).where(age: 25)'
      );
    });

    test("builds raw WHERE clause for unsupported operators", () => {
      const where = "age >= 25 AND age < 18";
      ConditionParser.isSimpleEquality.mockReturnValue(false);
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [],
        in: [],
        between: [],
        null: [],
        simple: [],
      });

      const result = generator.buildWhere(where);

      expect(result).toBe('.where("age >= ? AND age < ?", 25, 18)');
    });
  });

  describe("buildComplexWhere", () => {
    test("builds clause with all condition types", () => {
      const where =
        'name LIKE "%John%" AND status IN ("active", "pending") AND age BETWEEN 18 AND 30 AND deleted_at IS NULL';
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [{ field: "name", not: false, pattern: "%John%" }],
        in: [
          { field: "status", not: false, values: ['"active"', '"pending"'] },
        ],
        between: [{ field: "age", not: false, start: 18, end: 30 }],
        null: [{ field: "deleted_at", not: false }],
        simple: [],
      });

      const result = generator.buildComplexWhere(where);

      expect(result).toBe(
        '.where("name LIKE ?", "%John%").where(status: ["active", "pending"]).where(age: 18..30).where(deleted_at: nil)'
      );
    });

    test("handles empty condition types", () => {
      const where = "age = 25";
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [],
        in: [],
        between: [],
        null: [],
        simple: [{ field: "age", operator: "=", value: 25 }],
      });

      const result = generator.buildComplexWhere(where);

      expect(result).toBe(".where(age: 25)");
    });

    test("returns empty string for no conditions", () => {
      const where = "";
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [],
        in: [],
        between: [],
        null: [],
        simple: [],
      });

      const result = generator.buildComplexWhere(where);

      expect(result).toBe("");
    });
  });

  describe("buildSimpleWhere", () => {
    test("builds simple WHERE with equality and inequality", () => {
      const where = 'age = 25 AND status != "inactive" AND salary > 50000';
      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "age", operator: "=", value: 25 },
        { field: "status", operator: "!=", value: '"inactive"' },
        { field: "salary", operator: ">", value: 50000 },
      ]);

      const result = generator.buildSimpleWhere(where);

      expect(result).toBe(
        '.where(age: 25).where.not(status: "inactive").where("salary > ?", 50000)'
      );
    });

    test("handles single equality condition", () => {
      const where = "id = 1";
      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "id", operator: "=", value: 1 },
      ]);

      const result = generator.buildSimpleWhere(where);

      expect(result).toBe(".where(id: 1)");
    });
  });

  describe("buildRawWhere", () => {
    test("builds raw WHERE with multiple conditions and logical operators", () => {
      const where = "age >= 25 AND age < 18";
      const result = generator.buildRawWhere(where);

      expect(result).toBe('.where("age >= ? AND age < ?", 25, 18)');
    });

    test("handles single condition in raw WHERE", () => {
      const where = "id = 1";
      const result = generator.buildRawWhere(where);

      expect(result).toBe('.where("id = ?", 1)');
    });

    test("handles malformed WHERE clause", () => {
      const where = "invalid condition";
      const result = generator.buildRawWhere(where);

      expect(result).toBe('.where("", )');
    });
  });

  describe("buildGroupBy", () => {
    test("builds GROUP BY clause", () => {
      const groupBy = [{ name: "status" }, { name: "department" }];

      const result = generator.buildGroupBy(groupBy);

      expect(result).toBe(".group(:status, :department)");
    });

    test("handles single GROUP BY column", () => {
      const groupBy = [{ name: "status" }];

      const result = generator.buildGroupBy(groupBy);

      expect(result).toBe(".group(:status)");
    });
  });

  describe("buildOrderBy", () => {
    test("builds ORDER BY clause", () => {
      const orderBy = [
        { name: "age", direction: "DESC" },
        { name: "name", direction: "ASC" },
      ];

      const result = generator.buildOrderBy(orderBy);

      expect(result).toBe(".order(age: :desc, name: :asc)");
    });
  });

  describe("buildSelect", () => {
    test("handles single column", () => {
      const columns = [{ name: "name", table: "users" }];
      const mainTable = "users";

      const result = generator.buildSelect(columns, mainTable);

      expect(result).toBe(".select(:name)");
    });
  });

  describe("buildLimit", () => {
    test("builds LIMIT clause with offset", () => {
      const limit = { count: 10, offset: 5 };

      const result = generator.buildLimit(limit);

      expect(result).toBe(".limit(10).offset(5)");
    });

    test("builds LIMIT clause without offset", () => {
      const limit = { count: 10 };

      const result = generator.buildLimit(limit);

      expect(result).toBe(".limit(10)");
    });
  });
});
