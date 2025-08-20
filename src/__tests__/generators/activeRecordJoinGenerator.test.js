/* eslint-env jest */

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
    AGGREGATE_FUNCTION_PATTERN:
      /^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(DISTINCT\s+)?([^)]+)\s*\)$/i,
    CONDITION_WITH_LOGICAL: /(.+?)(=|!=|>=|<=|>|<)(.+?)(\s+(?:AND|OR)\s+|$)/gi,
    DATE_PATTERN: /^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}(:\d{2})?)?$/,
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
    StringHelpers.hasSubquery.mockImplementation((where) =>
      /\([^()]*\bSELECT\b[^()]*\)/i.test(where)
    );

    ValueParser.parse.mockImplementation((value) => {
      if (!value) return "";

      if (value.startsWith("'") && value.endsWith("'")) {
        return `"${value.slice(1, -1)}"`;
      }
      if (value.startsWith('"') && value.endsWith('"')) {
        return value;
      }
      if (value.toLowerCase() === "null") return "nil";
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
      if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value);
      if (/^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}(:\d{2})?)?$/.test(value)) {
        return `"${value}"`;
      }
      return `"${value}"`;
    });

    ConditionParser.isSimpleEquality.mockImplementation(
      (where) =>
        !/or/i.test(where) &&
        !/\([^)]*SELECT[^)]*\)/gi.test(where) &&
        where
          .replace(/\([^]+\)/g, "")
          .split(/AND/i)
          .every((str) => /(=|!=|>=|<=|>|<)/.test(str.trim()))
    );
    ConditionParser.parseSimpleConditions.mockImplementation((where) => {
      if (/\([^)]*SELECT[^)]*\)/gi.test(where)) return [];
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
        where.match(/(\w+)\s+(NOT\s+)?(I?LIKE)\s+(['"]).*?\4/gi)?.map((m) => {
          const [, field, not, likeOp, , pattern] = m.match(
            /(\w+)\s+(NOT\s+)?(I?LIKE)\s+(['"])(.*?)\4/i
          );
          return { field, not: !!not, pattern, isILike: likeOp === "ILIKE" };
        }) || [],
      in:
        where
          .match(/(\w+)\s+(NOT\s+)?IN\s*\(([^)]*(?:SELECT[^)]*)?[^)]*)\)/gi)
          ?.map((m) => {
            const [, field, not, valuesList] = m.match(
              /(\w+)\s+(NOT\s+)?IN\s*\(([^)]+)\)/i
            );
            if (/SELECT/i.test(valuesList)) return null;
            return {
              field,
              not: !!not,
              values: valuesList
                .split(",")
                .map((v) => ValueParser.parse(v.trim())),
            };
          })
          .filter(Boolean) || [],
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

    test("generates SELECT with table alias and complex WHERE with ILIKE", () => {
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
        where: 'posts.title ILIKE "%test%" AND users.age = 25',
        groupBy: [],
        having: "",
        orderBy: [],
        limit: { count: 10 },
        tables: [{ name: "users", alias: "u" }],
      };

      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [
          {
            field: "posts.title",
            not: false,
            pattern: "%test%",
            isILike: true,
          },
        ],
        in: [],
        between: [],
        null: [],
        simple: [{ field: "users.age", operator: "=", value: 25 }],
      });

      const result = generator.generateSelect(parsed);

      expect(result).toBe(
        'Users.from("users u").left_joins(:p).where("posts.title ILIKE ?", "%test%").where("users.age = ?", 25).limit(10)'
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
        'Users.joins(:posts).left_joins(:comments).where("users.age = ?", 25).group("users.status").having("COUNT(*) > 5").order("posts.created_at DESC").limit(10).offset(5).select("users.name", "posts.title AS post_title")'
      );
    });

    test("generates SELECT with aggregate function", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "COUNT(*)" }],
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
        ],
        where: "users.age > 18",
        groupBy: [],
        having: "",
        orderBy: [],
        limit: null,
        tables: [{ name: "users" }],
      };

      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "users.age", operator: ">", value: 18 },
      ]);

      const result = generator.generateSelect(parsed);

      expect(result).toBe(
        'Users.joins(:posts).where("users.age > ?", 18).count'
      );
    });

    test("generates SELECT with DISTINCT aggregate", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "COUNT(DISTINCT posts.id)" }],
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

      expect(result).toBe('Users.joins(:posts).distinct.count("posts.id")');
    });
  });

  describe("handleSimpleAggregatesWithJoins", () => {
    test("handles COUNT(*)", () => {
      const result = generator.handleSimpleAggregatesWithJoins(
        [{ name: "COUNT(*)" }],
        "users.age > 18",
        [],
        "",
        [],
        null,
        "Users",
        [{ type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" }]
      );

      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "users.age", operator: ">", value: 18 },
      ]);

      expect(result).toBe(
        'Users.joins(:posts).where("users.age > ?", 18).count'
      );
    });

    test("handles COUNT(DISTINCT column)", () => {
      const result = generator.handleSimpleAggregatesWithJoins(
        [{ name: "COUNT(DISTINCT posts.id)" }],
        "",
        [],
        "",
        [],
        null,
        "Users",
        [{ type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" }]
      );

      expect(result).toBe('Users.joins(:posts).distinct.count("posts.id")');
    });

    test("handles SUM(column)", () => {
      const result = generator.handleSimpleAggregatesWithJoins(
        [{ name: "SUM(posts.likes)" }],
        "",
        [],
        "",
        [],
        null,
        "Users",
        [{ type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" }]
      );

      expect(result).toBe('Users.joins(:posts).sum("posts.likes")');
    });

    test("handles AVG(column)", () => {
      const result = generator.handleSimpleAggregatesWithJoins(
        [{ name: "AVG(posts.likes)" }],
        "",
        [],
        "",
        [],
        null,
        "Users",
        [{ type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" }]
      );

      expect(result).toBe('Users.joins(:posts).average("posts.likes")');
    });

    test("handles MIN(column)", () => {
      const result = generator.handleSimpleAggregatesWithJoins(
        [{ name: "MIN(users.age)" }],
        "",
        [],
        "",
        [],
        null,
        "Users",
        [{ type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" }]
      );

      expect(result).toBe('Users.joins(:posts).minimum("users.age")');
    });

    test("handles MAX(column)", () => {
      const result = generator.handleSimpleAggregatesWithJoins(
        [{ name: "MAX(users.age)" }],
        "",
        [],
        "",
        [],
        null,
        "Users",
        [{ type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" }]
      );

      expect(result).toBe('Users.joins(:posts).maximum("users.age")');
    });

    test("returns null for multiple columns", () => {
      const result = generator.handleSimpleAggregatesWithJoins(
        [{ name: "COUNT(*)" }, { name: "SUM(posts.likes)" }],
        "",
        [],
        "",
        [],
        null,
        "Users",
        [{ type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" }]
      );

      expect(result).toBeNull();
    });

    test("returns null for non-aggregate column", () => {
      const result = generator.handleSimpleAggregatesWithJoins(
        [{ name: "name" }],
        "",
        [],
        "",
        [],
        null,
        "Users",
        [{ type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" }]
      );

      expect(result).toBeNull();
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

      expect(result).toBe(".left_joins(:p)");
    });

    test("builds RIGHT JOIN", () => {
      const joins = [
        {
          type: "RIGHT JOIN",
          table: "posts",
          on: "users.id = posts.user_id",
        },
      ];
      const mainTable = "users";

      const result = generator.buildJoins(joins, mainTable);

      expect(result).toBe(
        '.joins("RIGHT JOIN posts ON users.id = posts.user_id")'
      );
    });

    test("builds multiple JOINs", () => {
      const joins = [
        { type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" },
        {
          type: "LEFT JOIN",
          table: "comments",
          on: "posts.id = comments.post_id",
        },
        {
          type: "RIGHT JOIN",
          table: "categories",
          on: "posts.category_id = categories.id",
          alias: "cat",
        },
      ];
      const mainTable = "users";

      const result = generator.buildJoins(joins, mainTable);

      expect(result).toBe(
        '.joins(:posts).left_joins(:comments).joins("RIGHT JOIN categories cat ON posts.category_id = categories.id")'
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

    test("builds complex WHERE clause with ILIKE", () => {
      const where = 'posts.title ILIKE "%test%" AND users.age = 25';
      ConditionParser.isSimpleEquality.mockReturnValue(false);
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [
          {
            field: "posts.title",
            not: false,
            pattern: "%test%",
            isILike: true,
          },
        ],
        in: [],
        between: [],
        null: [],
        simple: [{ field: "users.age", operator: "=", value: 25 }],
      });

      const result = generator.buildWhereWithJoins(where, "users", []);

      expect(result).toBe(
        '.where("posts.title ILIKE ?", "%test%").where("users.age = ?", 25)'
      );
    });

    test("builds complex WHERE clause with NOT ILIKE", () => {
      const where = 'posts.title NOT ILIKE "%test%"';
      ConditionParser.isSimpleEquality.mockReturnValue(false);
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [
          { field: "posts.title", not: true, pattern: "%test%", isILike: true },
        ],
        in: [],
        between: [],
        null: [],
        simple: [],
      });

      const result = generator.buildWhereWithJoins(where, "users", []);

      expect(result).toBe('.where.not("posts.title ILIKE ?", "%test%")');
    });

    test("builds subquery WHERE clause", () => {
      const where =
        "users.id IN (SELECT user_id FROM posts WHERE posts.published = true)";
      const result = generator.buildWhereWithJoins(where, "users", []);

      expect(result).toBe(
        '.where("users.id IN (SELECT user_id FROM posts WHERE posts.published = true)")'
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

      const result = generator.buildSimpleWhereWithJoins(where, "users", []);

      expect(result).toBe(
        '.where("users.age = ? AND posts.published = ?", 25, true)'
      );
    });

    test("builds simple WHERE with unqualified fields", () => {
      const where = "age = 25";
      ConditionParser.parseSimpleConditions.mockReturnValue([
        { field: "age", operator: "=", value: 25 },
      ]);

      const result = generator.buildSimpleWhereWithJoins(where, "users", []);

      expect(result).toBe('.where("users.age = ?", 25)');
    });
  });

  describe("buildComplexWhereWithJoins", () => {
    test("builds complex WHERE with mixed conditions", () => {
      const where =
        "posts.title ILIKE \"%test%\" AND users.status IN ('active', 'pending') AND users.age BETWEEN 18 AND 30 AND posts.deleted_at IS NULL";
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [
          {
            field: "posts.title",
            not: false,
            pattern: "%test%",
            isILike: true,
          },
        ],
        in: [
          {
            field: "users.status",
            not: false,
            values: ['"active"', '"pending"'],
          },
        ],
        between: [{ field: "users.age", not: false, start: 18, end: 30 }],
        null: [{ field: "posts.deleted_at", not: false }],
        simple: [],
      });

      const result = generator.buildComplexWhereWithJoins(where, "users", []);

      expect(result).toBe(
        '.where("posts.title ILIKE ?", "%test%").where("users.status IN (?)", ["active", "pending"]).where("users.age BETWEEN ? AND ?", 18, 30).where("posts.deleted_at IS NULL")'
      );
    });

    test("builds complex WHERE with unqualified fields", () => {
      const where = 'title ILIKE "%test%"';
      ConditionParser.parseComplexConditions.mockReturnValue({
        like: [
          { field: "title", not: false, pattern: "%test%", isILike: true },
        ],
        in: [],
        between: [],
        null: [],
        simple: [],
      });

      const result = generator.buildComplexWhereWithJoins(where, "users", []);

      expect(result).toBe('.where("users.title ILIKE ?", "%test%")');
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

      const result = generator.buildComplexWhereWithJoins(where, "users", []);

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

    test("builds raw WHERE with single condition", () => {
      const where = "users.age >= 21";
      const result = generator.buildRawWhereWithJoins(where);

      expect(result).toBe('.where("users.age >= ?", 21)');
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

    test("builds ORDER BY without table prefixes", () => {
      const orderBy = [{ name: "name", direction: "ASC" }];

      const result = generator.buildOrderByWithJoins(orderBy);

      expect(result).toBe('.order("name ASC")');
    });
  });

  describe("buildSelectWithJoins", () => {
    test("builds SELECT with table prefixes and aliases", () => {
      const columns = [
        { name: "name", table: "users" },
        { name: "title", table: "posts", alias: "post_title" },
      ];
      const mainTable = "users";

      const result = generator.buildSelectWithJoins(columns, mainTable);

      expect(result).toBe('.select("users.name", "posts.title AS post_title")');
    });

    test("builds SELECT with aggregate function", () => {
      const columns = [{ name: "COUNT(*)" }];
      const mainTable = "users";

      const result = generator.buildSelectWithJoins(columns, mainTable);

      expect(result).toBe('.select("COUNT(*)")');
    });

    test("builds SELECT with DISTINCT aggregate", () => {
      const columns = [{ name: "COUNT(DISTINCT posts.id)" }];
      const mainTable = "users";

      const result = generator.buildSelectWithJoins(columns, mainTable);

      expect(result).toBe('.select("COUNT(DISTINCT posts.id)")');
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
      const join = { on: "users.id = posts.user_id", table: "posts" };
      const mainTable = "users";

      const result = generator.isSimpleAssociationJoin(join, mainTable);

      expect(result).toBe(true);
    });

    test("returns false for non-association join", () => {
      const join = { on: "users.name = posts.title", table: "posts" };
      const mainTable = "users";

      const result = generator.isSimpleAssociationJoin(join, mainTable);

      expect(result).toBe(false);
    });

    test("returns true for reverse association join", () => {
      const join = { on: "posts.user_id = users.id", table: "posts" };
      const mainTable = "users";

      const result = generator.isSimpleAssociationJoin(join, mainTable);

      expect(result).toBe(true);
    });
  });

  describe("checkConventionalJoin", () => {
    test("returns true for conventional join (main table id to join table foreign key)", () => {
      const result = generator.checkConventionalJoin(
        "users",
        "id",
        "posts",
        "user_id",
        "users",
        "posts"
      );

      expect(result).toBe(true);
    });

    test("returns true for reverse conventional join", () => {
      const result = generator.checkConventionalJoin(
        "posts",
        "user_id",
        "users",
        "id",
        "users",
        "posts"
      );

      expect(result).toBe(true);
    });

    test("returns false for non-conventional join", () => {
      const result = generator.checkConventionalJoin(
        "users",
        "name",
        "posts",
        "title",
        "users",
        "posts"
      );

      expect(result).toBe(false);
    });
  });
});
