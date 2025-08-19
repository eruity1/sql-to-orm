import { SequelizeGenerator } from "../../generators/sequelizeGenerator";
import { BaseGenerator } from "../../generators/baseGenerator";
import { SequelizeJoinGenerator } from "../../generators/sequelizeJoinGenerator";
import { StringHelpers } from "../../utils/stringHelpers";
import { ValueParser } from "../../utils/valueParser";
import { ConditionParser } from "../../utils/conditionParser";

jest.mock("../../generators/baseGenerator");
jest.mock("../../generators/sequelizeJoinGenerator");
jest.mock("../../utils/stringHelpers");
jest.mock("../../utils/valueParser");
jest.mock("../../utils/conditionParser");
jest.mock("../../constants", () => ({
  SQL_PATTERNS: {
    COMPLEX_OPERATORS:
      /LIKE|NOT LIKE|ILIKE|NOT ILIKE|IN|NOT IN|BETWEEN|IS NULL|IS NOT NULL/i,
    SIMPLE_OPERATORS: /(=|!=|>=|<=|>|<)/,
    AGGREGATE_FUNCTION_PATTERN:
      /^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(DISTINCT\s+)?([^)]+)\s*\)$/i,
    SUBQUERY_PATTERN: /\([^()]*\bSELECT\b[^()]*\)/gi,
    VALUE_CLEANUP: /^['"](.*)['"]$|^`(.*)`$|^\s*|\s*$/g,
    NUMBER: /^-?(?:\d+\.?\d*|\.\d+)$/,
  },
}));

describe("SequelizeGenerator", () => {
  let generator;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new SequelizeGenerator();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    StringHelpers.toModelName.mockImplementation(
      (table) => table.charAt(0).toUpperCase() + table.slice(1)
    );

    ValueParser.parse.mockImplementation((value) => {
      if (value.startsWith("'") && value.endsWith("'")) {
        return `"${value.slice(1, -1)}"`;
      }
      if (value.toLowerCase() === "null") return "null";
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
      if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value);
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

    ConditionParser.parseSimpleConditions.mockImplementation(
      (where, schema = {}) => {
        if (/\([^)]*SELECT[^)]*\)/gi.test(where)) return [];
        return where
          .split(/\s+AND\s+/i)
          .map((cond) => {
            const match = cond
              .trim()
              .match(/^(\w+(?:\.\w+)?)\s*(=|!=|>=|<=|>|<)\s*(.+)$/);
            if (!match) return null;
            let [, field, operator, value] = match;
            let table = null;
            let fieldName = field;
            if (!field.includes(".")) {
              if (schema[field] && schema[field].table) {
                table = schema[field].table;
                field = `${table}.${field}`;
              }
            } else {
              [table, fieldName] = field.split(".");
            }
            return {
              table,
              field,
              fieldName,
              operator,
              value: ValueParser.parse(value.trim()),
            };
          })
          .filter(Boolean);
      }
    );

    ConditionParser.parseComplexConditions.mockImplementation(
      (where, schema = {}) => ({
        like:
          where.match(/(\w+)\s+(NOT\s+)?(I?LIKE)\s+(['"]).*?\4/gi)?.map((m) => {
            const [, field, not, likeOp, , pattern] = m.match(
              /(\w+)\s+(NOT\s+)?(I?LIKE)\s+(['"])(.*?)\4/i
            );
            let table = null;
            let fieldName = field;
            if (!field.includes(".")) {
              if (schema[field] && schema[field].table) {
                table = schema[field].table;
                field = `${table}.${field}`;
              }
            } else {
              [table, fieldName] = field.split(".");
            }
            return {
              table,
              field,
              fieldName,
              not: !!not,
              pattern,
              isILike: likeOp === "ILIKE",
            };
          }) || [],
        in:
          where
            .match(/(\w+)\s+(NOT\s+)?IN\s*\(([^)]*(?:SELECT[^)]*)?[^)]*)\)/gi)
            ?.map((m) => {
              const [, field, not, valuesList] = m.match(
                /(\w+)\s+(NOT\s+)?IN\s*\(([^)]+)\)/i
              );
              if (/SELECT/i.test(valuesList)) return null;
              let table = null;
              let fieldName = field;
              if (!field.includes(".")) {
                if (schema[field] && schema[field].table) {
                  table = schema[field].table;
                  field = `${table}.${field}`;
                }
              } else {
                [table, fieldName] = field.split(".");
              }
              return {
                table,
                field,
                fieldName,
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
              let table = null;
              let fieldName = field;
              if (!field.includes(".")) {
                if (schema[field] && schema[field].table) {
                  table = schema[field].table;
                  field = `${table}.${field}`;
                }
              } else {
                [table, fieldName] = field.split(".");
              }
              return {
                table,
                field,
                fieldName,
                not: !!not,
                start: ValueParser.parse(start.trim()),
                end: ValueParser.parse(end.trim()),
              };
            }) || [],
        null:
          where.match(/(\w+)\s+IS\s+(NOT\s+)?NULL/gi)?.map((m) => {
            const [, field, not] = m.match(/(\w+)\s+IS\s+(NOT\s+)?NULL/i);
            let table = null;
            let fieldName = field;
            if (!field.includes(".")) {
              if (schema[field] && schema[field].table) {
                table = schema[field].table;
                field = `${table}.${field}`;
              }
            } else {
              [table, fieldName] = field.split(".");
            }
            return { table, field, fieldName, not: !!not };
          }) || [],
        simple: ConditionParser.parseSimpleConditions(where, schema),
      })
    );
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("generateQuery", () => {
    test("delegates to SequelizeJoinGenerator when joins are present", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        joins: [
          {
            type: "INNER JOIN",
            table: "posts",
            on: "users.id = posts.user_id",
          },
        ],
      };
      const mockJoinResult = "Users.findAll({ include: [{ model: Posts }] })";
      SequelizeJoinGenerator.mockImplementation(() => ({
        generateQuery: jest.fn().mockReturnValue(mockJoinResult),
      }));

      const result = generator.generateQuery(parsed);

      expect(SequelizeJoinGenerator).toHaveBeenCalled();
      expect(result).toBe(mockJoinResult);
    });

    test("calls super.generateQuery when no joins are present", () => {
      const parsed = { type: "SELECT", mainTable: "users" };
      const mockSuperResult = "Users.findAll({})";
      BaseGenerator.prototype.generateQuery.mockReturnValue(mockSuperResult);

      const result = generator.generateQuery(parsed);

      expect(BaseGenerator.prototype.generateQuery).toHaveBeenCalledWith(
        parsed
      );
      expect(result).toBe(mockSuperResult);
    });
  });

  describe("generateSelect", () => {
    test("generates simple SELECT with all columns", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "*" }],
        where: "",
        groupBy: [],
        having: "",
        orderBy: [],
        limit: null,
      };

      const result = generator.generateSelect(parsed);

      expect(result).toBe("Users.findAll({})");
    });

    test("generates SELECT with specific columns", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "name" }, { name: "age" }],
        where: "",
        groupBy: [],
        having: "",
        orderBy: [],
        limit: null,
      };

      const result = generator.generateSelect(parsed);

      expect(result).toBe('Users.findAll({attributes: ["name", "age"]})');
    });

    test("generates SELECT with all clauses", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "name" }],
        where: "age = 25 AND status = 'active'",
        groupBy: [{ name: "status" }],
        having: "COUNT(*) > 5",
        orderBy: [{ name: "name", direction: "ASC" }],
        limit: { count: 10, offset: 5 },
        schema: { age: { table: "users" }, status: { table: "users" } },
      };

      const result = generator.generateSelect(parsed);

      expect(result).toBe(
        'Users.findAll({attributes: ["name"], where: { age: 25, status: "active" }, group: ["status"], having: Sequelize.literal("COUNT(*) > 5"), order: [["name", "ASC"]], limit: 10, offset: 5})'
      );
    });

    test("generates SELECT with unqualified fields using schema", () => {
      const parsed = {
        type: "SELECT",
        mainTable: "users",
        columns: [{ name: "*" }],
        where: "age = 25",
        groupBy: [],
        having: "",
        orderBy: [],
        limit: null,
        schema: { age: { table: "users" } },
      };

      const result = generator.generateSelect(parsed);

      expect(result).toBe("Users.findAll({where: { age: 25 }})");
    });
  });

  describe("generateInsert", () => {
    test("generates INSERT with values", () => {
      const parsed = {
        type: "INSERT",
        mainTable: "users",
        columns: [{ name: "name" }, { name: "age" }],
        values: ["John", "30"],
      };

      const result = generator.generateInsert(parsed);

      expect(result).toBe('Users.create({ name: "John", age: 30 })');
    });

    test("generates INSERT with null and boolean values", () => {
      const parsed = {
        type: "INSERT",
        mainTable: "users",
        columns: [{ name: "name" }, { name: "active" }, { name: "email" }],
        values: ["John", "true", "NULL"],
      };

      const result = generator.generateInsert(parsed);

      expect(result).toBe(
        'Users.create({ name: "John", active: true, email: null })'
      );
    });
  });

  describe("generateUpdate", () => {
    test("generates UPDATE with SET and WHERE", () => {
      const parsed = {
        type: "UPDATE",
        mainTable: "users",
        set: [{ name: "status", value: "active" }],
        where: "age = 25",
        schema: { age: { table: "users" } },
      };

      const result = generator.generateUpdate(parsed);

      expect(result).toBe(
        'Users.update({ status: "active" }, { where: { age: 25 } })'
      );
    });

    test("generates UPDATE with complex WHERE", () => {
      const parsed = {
        type: "UPDATE",
        mainTable: "users",
        set: [{ name: "status", value: "active" }],
        where: "age BETWEEN 18 AND 30 AND name LIKE 'J%'",
        schema: { age: { table: "users" }, name: { table: "users" } },
      };

      const result = generator.generateUpdate(parsed);

      expect(result).toBe(
        'Users.update({ status: "active" }, { where: { name: { [Op.like]: "J%" }, age: { [Op.between]: [18, 30] } } })'
      );
    });
  });

  describe("generateDelete", () => {
    test("generates DELETE with WHERE", () => {
      const parsed = {
        type: "DELETE",
        mainTable: "users",
        where: "age < 18",
        schema: { age: { table: "users" } },
      };

      const result = generator.generateDelete(parsed);

      expect(result).toBe("Users.destroy({ where: { age: { [Op.lt]: 18 } } })");
    });
  });

  describe("buildWhere", () => {
    test("builds simple WHERE clause", () => {
      const where = "age = 25 AND status = 'active'";
      const result = generator.buildWhere(where);

      expect(result).toBe('{ age: 25, status: "active" }');
    });

    test("builds complex WHERE clause with mixed conditions", () => {
      const where =
        "age BETWEEN 18 AND 30 AND name LIKE 'J%' AND deleted_at IS NULL";
      const result = generator.buildWhere(where);

      expect(result).toBe(
        '{ name: { [Op.like]: "J%" }, age: { [Op.between]: [18, 30] }, deleted_at: { [Op.is]: null } }'
      );
    });

    test("builds subquery WHERE clause", () => {
      const where = "id IN (SELECT user_id FROM posts WHERE published = true)";
      const result = generator.buildWhere(where);

      expect(result).toBe(
        'Sequelize.literal("id IN (SELECT user_id FROM posts WHERE published = true)")'
      );
    });
  });

  describe("buildSubqueryWhere", () => {
    test("builds subquery WHERE clause", () => {
      const where = "id IN (SELECT user_id FROM posts)";
      const result = generator.buildSubqueryWhere(where);

      expect(result).toBe(
        'Sequelize.literal("id IN (SELECT user_id FROM posts)")'
      );
    });
  });

  describe("buildComplexWhere", () => {
    test("builds complex WHERE with mixed conditions", () => {
      const where =
        "age BETWEEN 18 AND 30 AND name LIKE 'J%' AND status IN ('active', 'pending') AND deleted_at IS NULL";
      const result = generator.buildComplexWhere(where);

      expect(result).toBe(
        '{ name: { [Op.like]: "J%" }, status: { [Op.in]: ["active", "pending"] }, age: { [Op.between]: [18, 30] }, deleted_at: { [Op.is]: null } }'
      );
    });

    test("builds complex WHERE with NOT conditions", () => {
      const where = "name NOT LIKE 'J%' AND age NOT IN (18, 19)";
      const result = generator.buildComplexWhere(where);

      expect(result).toBe(
        '{ name: { [Op.notLike]: "J%" }, age: { [Op.notIn]: [18, 19] } }'
      );
    });
  });

  describe("buildSimpleWhere", () => {
    test("builds simple WHERE with multiple conditions", () => {
      const where = "age = 25 AND status = 'active'";
      const result = generator.buildSimpleWhere(where);

      expect(result).toBe('{ age: 25, status: "active" }');
    });

    test("builds simple WHERE with inequality", () => {
      const where = "age != 18";
      const result = generator.buildSimpleWhere(where);

      expect(result).toBe("{ age: { [Op.ne]: 18 } }");
    });
  });

  describe("buildRawWhere", () => {
    test("builds raw WHERE with multiple conditions", () => {
      const where = "age >= 21 AND status = active";
      const result = generator.buildRawWhere(where);

      expect(result).toBe(
        '{ [Op.and]: [{ age: { [Op.gte]: 21 } }, { status: "active" }] }'
      );
    });

    test("builds raw WHERE with OR conditions", () => {
      const where = "age >= 21 OR status = inactive";
      const result = generator.buildRawWhere(where);

      expect(result).toBe(
        '{ [Op.or]: [{ age: { [Op.gte]: 21 } }, { status: "inactive" }] }'
      );
    });
  });

  describe("buildAttributes", () => {
    test("builds attributes with simple columns", () => {
      const columns = [{ name: "name" }, { name: "age" }];
      const mainTable = "users";

      const result = generator.buildAttributes(columns, mainTable);

      expect(result).toBe('"name", "age"');
    });

    test("builds attributes with aliases", () => {
      const columns = [{ name: "name", alias: "user_name" }];
      const mainTable = "users";

      const result = generator.buildAttributes(columns, mainTable);

      expect(result).toBe('["name", "user_name"]');
    });

    test("builds attributes with aggregate function", () => {
      const columns = [{ name: "COUNT(*)" }];
      const mainTable = "users";

      const result = generator.buildAttributes(columns, mainTable);

      expect(result).toBe('Sequelize.fn("COUNT", Sequelize.literal("*"))');
    });

    test("builds attributes with DISTINCT aggregate", () => {
      const columns = [{ name: "COUNT(DISTINCT id)" }];
      const mainTable = "users";

      const result = generator.buildAttributes(columns, mainTable);

      expect(result).toBe(
        'Sequelize.fn("COUNT", Sequelize.literal("DISTINCT id"))'
      );
    });
  });

  describe("buildGroupBy", () => {
    test("builds GROUP BY with table prefixes", () => {
      const groupBy = [{ name: "status", table: "users" }];
      const result = generator.buildGroupBy(groupBy);

      expect(result).toBe('"users.status"');
    });

    test("builds GROUP BY without table prefixes", () => {
      const groupBy = [{ name: "status" }];
      const result = generator.buildGroupBy(groupBy);

      expect(result).toBe('"status"');
    });
  });

  describe("buildOrderBy", () => {
    test("builds ORDER BY with table prefixes", () => {
      const orderBy = [{ name: "name", table: "users", direction: "ASC" }];
      const result = generator.buildOrderBy(orderBy);

      expect(result).toBe('["users.name", "ASC"]');
    });

    test("builds ORDER BY without table prefixes", () => {
      const orderBy = [{ name: "name", direction: "ASC" }];
      const result = generator.buildOrderBy(orderBy);

      expect(result).toBe('["name", "ASC"]');
    });
  });

  describe("buildLimit", () => {
    test("builds LIMIT with offset", () => {
      const limit = { count: 10, offset: 5 };
      const result = generator.buildLimit(limit);

      expect(result).toBe("limit: 10, offset: 5");
    });

    test("builds LIMIT without offset", () => {
      const limit = { count: 10 };
      const result = generator.buildLimit(limit);

      expect(result).toBe("limit: 10");
    });
  });

  describe("parseSequelizeValue", () => {
    test("parses string value", () => {
      const result = generator.parseSequelizeValue("John");
      expect(result).toBe('"John"');
    });

    test("parses null value", () => {
      const result = generator.parseSequelizeValue("NULL");
      expect(result).toBe("null");
    });

    test("parses boolean true", () => {
      const result = generator.parseSequelizeValue("true");
      expect(result).toBe(true);
    });

    test("parses boolean false", () => {
      const result = generator.parseSequelizeValue("false");
      expect(result).toBe(false);
    });

    test("parses number", () => {
      const result = generator.parseSequelizeValue("123.45");
      expect(result).toBe(123.45);
    });
  });

  describe("getSequelizeOperator", () => {
    test("maps = to Op.eq", () => {
      const result = generator.getSequelizeOperator("=");
      expect(result).toBe("Op.eq");
    });

    test("maps != to Op.ne", () => {
      const result = generator.getSequelizeOperator("!=");
      expect(result).toBe("Op.ne");
    });

    test("maps >= to Op.gte", () => {
      const result = generator.getSequelizeOperator(">=");
      expect(result).toBe("Op.gte");
    });

    test("maps <= to Op.lte", () => {
      const result = generator.getSequelizeOperator("<=");
      expect(result).toBe("Op.lte");
    });

    test("maps > to Op.gt", () => {
      const result = generator.getSequelizeOperator(">");
      expect(result).toBe("Op.gt");
    });

    test("maps < to Op.lt", () => {
      const result = generator.getSequelizeOperator("<");
      expect(result).toBe("Op.lt");
    });
  });
});
