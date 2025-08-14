import { ActiveRecordJoinGenerator } from "../../generators/activeRecordJoinGenerator";
import { StringHelpers } from "../../utils/stringHelpers";
import { ValueParser } from "../../utils/valueParser";
import { ConditionParser } from "../../utils/conditionParser";
import { singularize } from "inflection";

jest.mock("../../generators/baseGenerator");
jest.mock("../../utils/stringHelpers");
jest.mock("../../utils/valueParser");
jest.mock("../../utils/conditionParser");
jest.mock("../../constants", () => ({
  SQL_PATTERNS: {
    COMPLEX_OPERATORS:
      /LIKE|NOT LIKE|ILIKE|NOT ILIKE|IN|NOT IN|BETWEEN|IS NULL|IS NOT NULL/i,
    SIMPLE_OPERATORS: /(=|!=|>=|<=|>|<)/,
    SIMPLE_ASSOCIATION_JOIN: /^(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)$/,
  },
}));
jest.mock("inflection");

describe("ActiveRecordJoinGenerator", () => {
  let generator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new ActiveRecordJoinGenerator();

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

    singularize.mockImplementation((str) => str.replace(/s$/, ""));
  });

  describe("generateSelect", () => {
    test("generates SELECT with simple JOIN", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "*" }],
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
        ],
        where: "",
        groupBy: [],
        having: "",
        orderBy: [],
        limit: null,
        tables: [{ name: "users" }],
      };

      const result = generator.generateSelect(parsed);

      expect(result).toBe("Users.joins(:posts)");
    });

    test("generates SELECT with table alias and complex WHERE", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "*" }],
        joins: [
          {
            type: "LEFT JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
            alias: "p",
          },
        ],
        where: 'posts.title LIKE "%test%" AND users.age = 25',
        groupBy: [],
        having: "",
        orderBy: [],
        limit: { count: 10 },
        tables: [{ name: "users", alias: "u" }],
      };

      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [{ field: "posts.title", not: false, pattern: "%test%" }],
        in: [],
        between: [],
        null: [],
        simple: [{ field: "users.age", operator: "=", value: 25 }],
      });

      const result = generator.generateSelect(parsed);

      expect(result).toBe(
        'Users.from("users u").joins(:posts).where("posts.title LIKE ?", "%test%").where("users.age": 25).limit(10)'
      );
    });

    test("generates SELECT with multiple JOINs and all clauses", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [
          { name: "name", table: "users" },
          { name: "title", table: "posts", alias: "post_title" },
        ],
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
          {
            type: "LEFT JOIN",
            table: "comments",
            on: "posts.id = comments.post_id",
          },
        ],
        where: "users.age = 25",
        groupBy: [{ name: "status", table: "users" }],
        having: "COUNT(*) > 5",
        orderBy: [{ name: "created_at", table: "posts", direction: "DESC" }],
        limit: { count: 10, offset: 5 },
        tables: [{ name: "users" }],
      };

      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "users.age", operator: "=", value: 25 },
      ]);

      const result = generator.generateSelect(parsed);

      expect(result).toBe(
        'Users.joins(:posts).joins("LEFT JOIN comments ON posts.id = comments.post_id").where("users.age = ?", 25).group("users.status").having("COUNT(*) > 5").order("posts.created_at DESC").limit(10).offset(5).select("users.name", "posts.title AS post_title")'
      );
    });
  });

  describe("generateUpdate", () => {
    test("generates UPDATE with JOIN and SET", () => {
      const parsed = {
        type: "UPDATE",
        mainTable: "users",
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
        ],
        set: [{ name: "status", value: "'inactive'" }],
        where: "posts.published = true",
        tables: [{ name: "users" }],
      };

      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "posts.published", operator: "=", value: true },
      ]);

      const result = generator.generateUpdate(parsed);

      expect(result).toBe(
        'Users.joins(:posts).where("posts.published = ?", true).update_all(status: "inactive")'
      );
    });

    test("generates UPDATE with table alias", () => {
      const parsed = {
        type: "UPDATE",
        mainTable: "users",
        joins: [
          {
            type: "LEFT JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
            alias: "p",
          },
        ],
        set: [{ name: "status", value: "'active'" }],
        where: "",
        tables: [{ name: "users", alias: "u" }],
      };

      const result = generator.generateUpdate(parsed);

      expect(result).toBe(
        'Users.from("users u").joins(:posts).update_all(status: "active")'
      );
    });
  });

  describe("generateDelete", () => {
    test("generates DELETE with JOIN and WHERE", () => {
      const parsed = {
        type: "DELETE",
        mainTable: "users",
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
        ],
        where: "posts.published = false",
        tables: [{ name: "users" }],
      };

      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "posts.published", operator: "=", value: false },
      ]);

      const result = generator.generateDelete(parsed);

      expect(result).toBe(
        'Users.joins(:posts).where("posts.published = ?", false).destroy_all'
      );
    });
  });

  describe("buildJoins", () => {
    test("builds simple association JOIN", () => {
      const joins = [
        { type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" },
      ];
      const mainTable = "users";

      const result = generator.buildJoins(joins, mainTable);

      expect(result).toBe(".joins(:posts)");
    });

    test("builds explicit JOIN with alias", () => {
      const joins = [
        {
          type: "LEFT JOIN",
          table: "posts",
          on: "users.id = posts.user_id",
          alias: "p",
        },
      ];
      const mainTable = "users";

      const result = generator.buildJoins(joins, mainTable);

      expect(result).toBe(".joins(:posts)");
    });

    test("builds multiple JOINs", () => {
      const joins = [
        { type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" },
        {
          type: "LEFT JOIN",
          table: "comments",
          on: "posts.id = comments.post_id",
        },
      ];
      const mainTable = "users";

      const result = generator.buildJoins(joins, mainTable);

      expect(result).toBe(
        '.joins(:posts).joins("LEFT JOIN comments ON posts.id = comments.post_id")'
      );
    });
  });

  describe("buildWhereWithJoins", () => {
    test("builds simple WHERE clause", () => {
      const where = "users.age = 25 AND posts.published = true";
      ConditionParser.isSimpleEquality.mockReturnValue(true);
      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "users.age", operator: "=", value: 25 },
        { field: "posts.published", operator: "=", value: true },
      ]);

      const result = generator.buildWhereWithJoins(where, "users", []);

      expect(result).toBe(
        '.where("users.age = ? AND posts.published = ?", 25, true)'
      );
    });

    test("builds complex WHERE clause", () => {
      const where = 'posts.title LIKE "%test%" AND users.age = 25';
      ConditionParser.isSimpleEquality.mockReturnValue(false);
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [{ field: "posts.title", not: false, pattern: "%test%" }],
        in: [],
        between: [],
        null: [],
        simple: [{ field: "users.age", operator: "=", value: 25 }],
      });

      const result = generator.buildWhereWithJoins(where, "users", []);

      expect(result).toBe(
        '.where("posts.title LIKE ?", "%test%").where("users.age": 25)'
      );
    });

    test("builds raw WHERE clause", () => {
      const where = "users.age >= 21";
      ConditionParser.isSimpleEquality.mockReturnValue(false);
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [],
        in: [],
        between: [],
        null: [],
        simple: [],
      });

      const result = generator.buildWhereWithJoins(where, "users", []);

      expect(result).toBe('.where("users.age >= ?", 21)');
    });
  });

  describe("buildSimpleWhereWithJoins", () => {
    test("builds simple WHERE with multiple conditions", () => {
      const where = "users.age = 25 AND posts.published = true";
      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "users.age", operator: "=", value: 25 },
        { field: "posts.published", operator: "=", value: true },
      ]);

      const result = generator.buildSimpleWhereWithJoins(where);

      expect(result).toBe(
        '.where("users.age = ? AND posts.published = ?", 25, true)'
      );
    });
  });

  describe("buildComplexWhereWithJoins", () => {
    test("builds complex WHERE with mixed conditions", () => {
      const where = 'posts.title LIKE "%test%" AND users.age = 25';
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [{ field: "posts.title", not: false, pattern: "%test%" }],
        in: [],
        between: [],
        null: [],
        simple: [{ field: "users.age", operator: "=", value: 25 }],
      });

      const result = generator.buildComplexWhereWithJoins(where);

      expect(result).toBe(
        '.where("posts.title LIKE ?", "%test%").where("users.age": 25)'
      );
    });

    test("handles empty conditions", () => {
      const where = "";
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [],
        in: [],
        between: [],
        null: [],
        simple: [],
      });

      const result = generator.buildComplexWhereWithJoins(where);

      expect(result).toBe("");
    });
  });

  describe("buildRawWhereWithJoins", () => {
    test("builds raw WHERE with multiple conditions", () => {
      const where = "users.age >= 21 AND posts.likes < 2000";
      const result = generator.buildRawWhereWithJoins(where);

      expect(result).toBe(
        '.where("users.age >= ? AND posts.likes < ?", 21, 2000)'
      );
    });
  });

  describe("buildGroupByWithJoins", () => {
    test("builds GROUP BY with table prefixes", () => {
      const groupBy = [
        { name: "status", table: "users" },
        { name: "category", table: "posts" },
      ];
      const mainTable = "users";

      const result = generator.buildGroupByWithJoins(groupBy, mainTable);

      expect(result).toBe('.group("users.status", "posts.category")');
    });

    test("builds GROUP BY without table prefixes", () => {
      const groupBy = [{ name: "status" }];
      const mainTable = "users";

      const result = generator.buildGroupByWithJoins(groupBy, mainTable);

      expect(result).toBe('.group("users.status")');
    });
  });

  describe("buildOrderByWithJoins", () => {
    test("builds ORDER BY with table prefixes", () => {
      const orderBy = [
        { name: "created_at", table: "posts", direction: "DESC" },
        { name: "name", table: "users", direction: "ASC" },
      ];

      const result = generator.buildOrderByWithJoins(orderBy);

      expect(result).toBe('.order("posts.created_at DESC", "users.name ASC")');
    });
  });

  describe("buildSelectWithJoins", () => {
    test("builds SELECT with table prefixes and aliases", () => {
      const columns = [
        { name: "name", table: "users" },
        { name: "title", table: "posts", alias: "post_title" },
      ];

      const result = generator.buildSelectWithJoins(columns);

      expect(result).toBe('.select("users.name", "posts.title AS post_title")');
    });
  });

  describe("buildLimit", () => {
    test("builds LIMIT with offset", () => {
      const limit = { count: 10, offset: 5 };

      const result = generator.buildLimit(limit);

      expect(result).toBe(".limit(10).offset(5)");
    });

    test("builds LIMIT without offset", () => {
      const limit = { count: 10 };

      const result = generator.buildLimit(limit);

      expect(result).toBe(".limit(10)");
    });
  });

  describe("isSimpleAssociationJoin", () => {
    test("returns true for simple association join", () => {
      const join = { on: "users.id = posts.user_id" };
      const mainTable = "users";

      const result = generator.isSimpleAssociationJoin(join, mainTable);

      expect(result).toBe(true);
    });

    test("returns false for non-association join", () => {
      const join = { on: "users.name = posts.title" };
      const mainTable = "users";

      const result = generator.isSimpleAssociationJoin(join, mainTable);

      expect(result).toBe(false);
    });
  });

  describe("guessAssociation", () => {
    test("returns singularized association name", () => {
      singularize.mockReturnValue("post");

      const result = generator.guessAssociation("posts");

      expect(singularize).toHaveBeenCalledWith("posts");
      expect(result).toBe("post");
    });
  });
});
