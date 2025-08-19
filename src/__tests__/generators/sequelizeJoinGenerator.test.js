import { SequelizeJoinGenerator } from "../../generators/sequelizeJoinGenerator";
import { StringHelpers } from "../../utils/stringHelpers";
import { ConditionParser } from "../../utils/conditionParser";

jest.mock("../../generators/baseGenerator");
jest.mock("../../utils/stringHelpers");
jest.mock("../../utils/conditionParser");
jest.mock("../../constants", () => ({
  SQL_PATTERNS: {
    COMPLEX_OPERATORS:
      /LIKE|NOT LIKE|ILIKE|NOT ILIKE|IN|NOT IN|BETWEEN|IS NULL|IS NOT NULL/i,
    SIMPLE_OPERATORS: /(=|!=|>=|<=|>|<)/,
    AGGREGATE_FUNCTION_PATTERN:
      /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(DISTINCT\s+)?([^)]+)\s*\)/i,
    SUBQUERY_PATTERN: /\([^()]*\bSELECT\b[^()]*\)/gi,
    VALUE_CLEANUP: /^['"](.*)['"]$|^`(.*)`$|^\s*|\s*$/g,
    NUMBER: /^-?(?:\d+\.?\d*|\.\d+)$/,
    SIMPLE_ASSOCIATION_JOIN: /^(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)$/,
  },
}));

describe("SequelizeJoinGenerator", () => {
  let generator;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new SequelizeJoinGenerator();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    StringHelpers.toModelName.mockImplementation(
      (table) => table.charAt(0).toUpperCase() + table.slice(1)
    );

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
          return {
            field,
            operator,
            value: generator.parseSequelizeValue(value.trim()),
          };
        })
        .filter(Boolean);
    });

    ConditionParser.parseComplexConditions.mockImplementation((where) => ({
      like:
        where
          .match(/(\w+(?:\.\w+)?)\s+(NOT\s+)?(I?LIKE)\s+(['"]).*?\4/gi)
          ?.map((m) => {
            const [, field, not, likeOp, , pattern] = m.match(
              /(\w+(?:\.\w+)?)\s+(NOT\s+)?(I?LIKE)\s+(['"])(.*?)\4/i
            );
            return { field, not: !!not, pattern, isILike: likeOp === "ILIKE" };
          }) || [],
      in:
        where
          .match(
            /(\w+(?:\.\w+)?)\s+(NOT\s+)?IN\s*\(([^)]*(?:SELECT[^)]*)?[^)]*)\)/gi
          )
          ?.map((m) => {
            const [, field, not, valuesList] = m.match(
              /(\w+(?:\.\w+)?)\s+(NOT\s+)?IN\s*\(([^)]+)\)/i
            );
            if (/SELECT/i.test(valuesList)) return null;
            return {
              field,
              not: !!not,
              values: valuesList
                .split(",")
                .map((v) => generator.parseSequelizeValue(v.trim())),
            };
          })
          .filter(Boolean) || [],
      between:
        where
          .match(
            /(\w+(?:\.\w+)?)\s+(NOT\s+)?BETWEEN\s+.+?\s+AND\s+.+?(?=\s+(?:AND|OR)|$)/gi
          )
          ?.map((m) => {
            const [, field, not, start, end] = m.match(
              /(\w+(?:\.\w+)?)\s+(NOT\s+)?BETWEEN\s+(.+?)\s+AND\s+(.+?)(?=\s+(?:AND|OR)|$)/i
            );
            return {
              field,
              not: !!not,
              start: generator.parseSequelizeValue(start.trim()),
              end: generator.parseSequelizeValue(end.trim()),
            };
          }) || [],
      null:
        where.match(/(\w+(?:\.\w+)?)\s+IS\s+(NOT\s+)?NULL/gi)?.map((m) => {
          const [, field, not] = m.match(
            /(\w+(?:\.\w+)?)\s+IS\s+(NOT\s+)?NULL/i
          );
          return { field, not: !!not };
        }) || [],
      simple: ConditionParser.parseSimpleConditions(where),
    }));
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("generateSelect", () => {
    test("generates SELECT with simple join", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "*" }],
        where: "",
        groupBy: [],
        having: "",
        orderBy: [],
        limit: null,
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
        ],
      };

      const result = generator.generateSelect(parsed);

      expect(result).toBe(
        "Users.findAll({include: [{ model: Posts, attributes: [], required: true }]})"
      );
    });

    test("generates SELECT with specific columns and join", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [
          { name: "name", table: "users" },
          { name: "title", table: "posts" },
        ],
        where: "users.age = 25",
        groupBy: [],
        having: "",
        orderBy: [],
        limit: null,
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
        ],
      };

      const result = generator.generateSelect(parsed);

      expect(result).toBe(
        'Users.findAll({include: [{ model: Posts, attributes: ["title"], required: true }], attributes: ["name"], where: { age: 25 }})'
      );
    });

    test("generates SELECT with all clauses and join", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "name", table: "users" }],
        where: "users.age = 25 AND posts.active = true",
        groupBy: [{ name: "name", table: "users" }],
        having: "COUNT(*) > 5",
        orderBy: [{ name: "name", table: "users", direction: "ASC" }],
        limit: { count: 10, offset: 5 },
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
        ],
      };

      const result = generator.generateSelect(parsed);

      expect(result).toBe(
        'Users.findAll({include: [{ model: Posts, attributes: [], required: true }], attributes: ["name"], where: { age: 25, "posts.active$": true }, group: ["users.name"], having: Sequelize.literal("COUNT(*) > 5"), order: [[Sequelize.col("users.name"), "ASC"]], limit: 10, offset: 5})'
      );
    });
  });

  describe("generateUpdate", () => {
    test("generates UPDATE with join and where", () => {
      const parsed = {
        type: "UPDATE",
        mainTable: "users",
        set: [{ name: "status", value: "active" }],
        where: "users.age = 25",
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
        ],
      };

      const result = generator.generateUpdate(parsed);

      expect(result).toBe(
        'Users.update({ status: "active" }, { where: { age: 25 }, include: [{ model: Posts, required: true }] })'
      );
    });
  });

  describe("generateDelete", () => {
    test("generates DELETE with join and where", () => {
      const parsed = {
        type: "DELETE",
        mainTable: "users",
        where: "users.age < 18",
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
        ],
      };

      const result = generator.generateDelete(parsed);

      expect(result).toBe(
        "Users.destroy({ where: { age: { [Op.lt]: 18 } }, include: [{ model: Posts, required: true }] })"
      );
    });

    test("generates DELETE without joins or where", () => {
      const parsed = {
        type: "DELETE",
        mainTable: "users",
        where: "",
        joins: [],
      };

      const result = generator.generateDelete(parsed);

      expect(result).toBe("Users.destroy({ where: {} })");
    });
  });

  describe("buildIncludesWithAttributes", () => {
    test("builds includes with main table and join table columns", () => {
      const joins = [
        { type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" },
      ];
      const columns = [
        { name: "name", table: "users" },
        { name: "title", table: "posts" },
      ];
      const mainTable = "users";

      const result = generator.buildIncludesWithAttributes(
        joins,
        columns,
        mainTable
      );

      expect(result).toEqual({
        includes: ['{ model: Posts, attributes: ["title"], required: true }'],
        mainTableColumns: [{ name: "name", table: "users" }],
      });
    });
  });

  describe("buildTableAttributes", () => {
    test("builds attributes with simple columns", () => {
      const columns = [{ name: "name" }, { name: "age" }];

      const result = generator.buildTableAttributes(columns);

      expect(result).toBe('"name", "age"');
    });

    test("builds attributes with aggregate function", () => {
      const columns = [{ name: "COUNT(*)" }];

      const result = generator.buildTableAttributes(columns);

      expect(result).toBe('Sequelize.fn("COUNT", Sequelize.literal("*"))');
    });

    test("builds attributes with DISTINCT aggregate and alias", () => {
      const columns = [{ name: "COUNT(DISTINCT id)", alias: "total" }];

      const result = generator.buildTableAttributes(columns);

      expect(result).toBe(
        '[Sequelize.fn("COUNT", Sequelize.literal("DISTINCT id")), "total"]'
      );
    });
  });

  describe("buildHaving", () => {
    test("builds simple having clause", () => {
      const having = "COUNT(*) > 5";

      const result = generator.buildHaving(having);

      expect(result).toBe('Sequelize.literal("COUNT(*) > 5")');
    });

    test("builds having with field and operator", () => {
      const having = "age >= 18";

      const result = generator.buildHaving(having);

      expect(result).toBe("{ age: { [Op.gte]: 18 } }");
    });
  });

  describe("buildWhereWithJoins", () => {
    test("builds simple where with join", () => {
      const where = "users.age = 25 AND posts.active = true";
      const mainTable = "users";
      const joins = [
        { type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" },
      ];

      const result = generator.buildWhereWithJoins(where, mainTable, joins);

      expect(result).toBe('{ age: 25, "posts.active$": true }');
    });

    test("builds complex where with join", () => {
      const where = "users.age BETWEEN 18 AND 30 AND posts.title LIKE 'test%'";
      const mainTable = "users";
      const joins = [
        { type: "INNER JOIN", table: "posts", on: "users.id = posts.user_id" },
      ];

      const result = generator.buildWhereWithJoins(where, mainTable, joins);

      expect(result).toBe(
        '{ "posts.title$": { [Op.like]: "test%" }, age: { [Op.between]: [18, 30] } }'
      );
    });
  });

  describe("resolveField", () => {
    test("resolves main table field", () => {
      const field = "users.age";
      const mainTable = "users";
      const joins = [];

      const result = generator.resolveField(field, mainTable, joins);

      expect(result).toBe("age");
    });

    test("resolves join table field with alias", () => {
      const field = "p.status";
      const mainTable = "users";
      const joins = [
        {
          type: "INNER JOIN",
          table: "posts",
          alias: "p",
          on: "users.id = p.user_id",
        },
      ];

      const result = generator.resolveField(field, mainTable, joins);

      expect(result).toBe('"p.status$"');
    });
  });

  describe("isSimpleAssociationJoin", () => {
    test("returns true for conventional join", () => {
      const join = { on: "users.id = posts.user_id" };
      const mainTable = "users";

      const result = generator.isSimpleAssociationJoin(join, mainTable);

      expect(result).toBe(true);
    });

    test("returns false for non-conventional join", () => {
      const join = { on: "users.name = posts.title" };
      const mainTable = "users";

      const result = generator.isSimpleAssociationJoin(join, mainTable);

      expect(result).toBe(false);
    });
  });

  describe("parseJoinCondition", () => {
    test("parses join with where condition", () => {
      const joinOn = "users.id = posts.user_id AND posts.favorites = 1000";
      const mainTable = "users";
      const joinTable = "posts";

      const result = generator.parseJoinCondition(joinOn, mainTable, joinTable);

      expect(result).toEqual({
        joinCondition: "users.id = posts.user_id",
        whereCondition: "{ favorites: 1000 }",
      });
    });

    test("parses complex join condition", () => {
      const joinOn = "users.id = posts.user_id AND posts.like_count != 16";
      const mainTable = "users";
      const joinTable = "posts";

      const result = generator.parseJoinCondition(joinOn, mainTable, joinTable);

      expect(result).toEqual({
        joinCondition: "users.id = posts.user_id",
        whereCondition: "{ like_count: { [Op.ne]: 16 } }",
      });
    });
  });
});
