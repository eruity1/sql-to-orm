import { BaseGenerator } from "./baseGenerator";
import { SequelizeJoinGenerator } from "./sequelizeJoinGenerator";
import { ConditionParser } from "../utils/conditionParser";
import { StringHelpers } from "../utils/stringHelpers";
import { SQL_PATTERNS } from "../constants";

export class SequelizeGenerator extends BaseGenerator {
  generateQuery(parsed) {
    const { joins } = parsed;

    if (joins && joins.length > 0) {
      return new SequelizeJoinGenerator().generateQuery(parsed);
    }

    return super.generateQuery(parsed);
  }

  generateSelect(parsed) {
    const { columns, where, mainTable, groupBy, having, orderBy, limit } =
      parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    const simpleAggregateResult = this.handleSimpleAggregates(
      columns,
      where,
      groupBy,
      having,
      orderBy,
      limit,
      modelName
    );
    if (simpleAggregateResult) {
      return simpleAggregateResult;
    }

    let query = `${modelName}.findAll({`;
    const options = [];

    if (columns[0]?.name !== "*") {
      const attributes = this.buildAttributes(columns, mainTable);
      if (attributes) options.push(`attributes: [${attributes}]`);
    }

    if (where) {
      const whereClause = this.buildWhere(where);
      options.push(`where: ${whereClause}`);
    }

    if (groupBy && groupBy.length > 0) {
      const groupClause = this.buildGroupBy(groupBy);
      options.push(`group: [${groupClause}]`);
    }

    if (having) {
      options.push(`having: Sequelize.literal("${having}")`);
    }

    if (orderBy && orderBy.length > 0) {
      const orderClause = this.buildOrderBy(orderBy);
      options.push(`order: [${orderClause}]`);
    }

    if (limit) {
      const limitClause = this.buildLimit(limit);
      options.push(limitClause);
    }

    query += options.join(", ") + "})";
    return query;
  }

  handleSimpleAggregates(
    columns,
    where,
    groupBy,
    having,
    orderBy,
    limit,
    modelName
  ) {
    if (columns.length !== 1 || groupBy || having) {
      return null;
    }

    const column = columns[0];
    // FIXED: The column.name might be "COUNT(*)" directly, so we need to match that
    const aggMatch = column.name.match(SQL_PATTERNS.AGGREGATE_FUNCTION_PATTERN);

    if (!aggMatch) {
      return null;
    }

    const [, func, distinct, columnName] = aggMatch;
    const funcUpper = func.toUpperCase();
    const cleanColumn = columnName.trim();

    let baseQuery = modelName;
    let options = [];

    if (where) {
      const whereClause = this.buildWhere(where);
      options.push(`where: ${whereClause}`);
    }

    if (orderBy && orderBy.length > 0) {
      const orderClause = this.buildOrderBy(orderBy);
      options.push(`order: [${orderClause}]`);
    }

    if (limit) {
      const limitClause = this.buildLimit(limit);
      options.push(limitClause);
    }

    const optionsStr = options.length > 0 ? `{ ${options.join(", ")} }` : "";

    switch (funcUpper) {
      case "COUNT":
        if (cleanColumn === "*") {
          return options.length > 0
            ? `${baseQuery}.count(${optionsStr})`
            : `${baseQuery}.count()`;
        } else if (distinct) {
          const countOptions = [
            ...options,
            `distinct: true`,
            `col: "${cleanColumn}"`,
          ];
          return `${baseQuery}.count({ ${countOptions.join(", ")} })`;
        } else {
          const countOptions = [...options, `col: "${cleanColumn}"`];
          return `${baseQuery}.count({ ${countOptions.join(", ")} })`;
        }

      case "SUM":
        return `${baseQuery}.sum("${cleanColumn}"${options.length > 0 ? `, ${optionsStr}` : ""})`;

      case "AVG":
        return `${baseQuery}.avg("${cleanColumn}"${options.length > 0 ? `, ${optionsStr}` : ""})`;

      case "MIN":
        return `${baseQuery}.min("${cleanColumn}"${options.length > 0 ? `, ${optionsStr}` : ""})`;

      case "MAX":
        return `${baseQuery}.max("${cleanColumn}"${options.length > 0 ? `, ${optionsStr}` : ""})`;

      default:
        return null;
    }
  }

  generateInsert(parsed) {
    const { columns, values, mainTable } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    if (!values || !columns) {
      return `${modelName}.create({})`;
    }

    const attributes = columns.reduce((acc, col, idx) => {
      const key = col.name;
      const value = this.parseSequelizeValue(values[idx]);
      acc += `${acc ? ", " : ""}${key}: ${value}`;
      return acc;
    }, "");

    return `${modelName}.create({ ${attributes} })`;
  }

  generateUpdate(parsed) {
    const { set, where, mainTable } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    if (!set) {
      return `${modelName}.update({}, { where: {} })`;
    }

    const updateHash = set.reduce((acc, item) => {
      const key = item.column?.name || item.name;
      const val = this.parseSequelizeValue(item.value);
      acc += `${acc ? ", " : ""}${key}: ${val}`;
      return acc;
    }, "");

    const whereClause = where ? this.buildWhere(where) : "{}";
    return `${modelName}.update({ ${updateHash} }, { where: ${whereClause} })`;
  }

  generateDelete(parsed) {
    const { where, mainTable } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    const whereClause = where ? this.buildWhere(where) : "{}";
    return `${modelName}.destroy({ where: ${whereClause} })`;
  }

  buildWhere(where) {
    if (this.hasSubquery(where)) {
      return this.buildSubqueryWhere(where);
    }

    if (/\s+OR\s+/i.test(where)) {
      return this.buildOrConditions(where);
    }

    const hasComplexOperators = SQL_PATTERNS.COMPLEX_OPERATORS.test(where);

    if (hasComplexOperators) {
      return this.buildComplexWhere(where);
    }

    if (ConditionParser.isSimpleEquality(where)) {
      return this.buildSimpleWhere(where);
    }

    return this.buildRawWhere(where);
  }

  hasSubquery(where) {
    return SQL_PATTERNS.SUBQUERY_PATTERN.test(where);
  }

  buildSubqueryWhere(where) {
    return `Sequelize.literal("${where}")`;
  }

  buildComplexWhere(where) {
    const conditions = ConditionParser.parseComplexConditions(where);
    const clauses = {};

    conditions.like.forEach(({ field, not, pattern, isILike }) => {
      const op = not
        ? isILike
          ? "Op.notILike"
          : "Op.notLike"
        : isILike
          ? "Op.iLike"
          : "Op.like";
      clauses[field] = `{ [${op}]: "${pattern}" }`;
    });

    conditions.in.forEach(({ field, not, values }) => {
      const op = not ? "Op.notIn" : "Op.in";
      const valuesList = values.join(", ");
      clauses[field] = `{ [${op}]: [${valuesList}] }`;
    });

    conditions.between.forEach(({ field, not, start, end }) => {
      const op = not ? "Op.notBetween" : "Op.between";
      clauses[field] = `{ [${op}]: [${start}, ${end}] }`;
    });

    conditions.null.forEach(({ field, not }) => {
      const op = not ? "Op.ne" : "Op.is";
      clauses[field] = `{ [${op}]: null }`;
    });

    conditions.simple.forEach(({ field, operator, value }) => {
      if (operator === "=") {
        clauses[field] = value;
      } else if (operator === "!=") {
        clauses[field] = `{ [Op.ne]: ${value} }`;
      } else {
        const op = this.getSequelizeOperator(operator);
        clauses[field] = `{ [${op}]: ${value} }`;
      }
    });

    const clauseStrings = Object.entries(clauses).map(([field, condition]) => {
      return `${field}: ${condition}`;
    });

    return `{ ${clauseStrings.join(", ")} }`;
  }

  buildSimpleWhere(where) {
    const parts = ConditionParser.parseSimpleConditions(where);

    const clauseStrings = parts.map((p) => {
      if (p.operator === "=") {
        return `${p.field}: ${p.value}`;
      } else if (p.operator === "!=") {
        return `${p.field}: { [Op.ne]: ${p.value} }`;
      } else {
        const op = this.getSequelizeOperator(p.operator);
        return `${p.field}: { [${op}]: ${p.value} }`;
      }
    });

    return `{ ${clauseStrings.join(", ")} }`;
  }

  buildRawWhere(where) {
    const orGroups = where.split(/\s+OR\s+/i).map((group) => group.trim());
    let sql = [];

    for (const group of orGroups) {
      const andConditions = group
        .split(/\s+AND\s+/i)
        .map((cond) => cond.trim());
      const andClauses = [];

      for (const cond of andConditions) {
        const match = cond.match(
          /(.+?)(=|!=|>=|<=|>|<)(.+?)(?=\s+(?:AND|OR)|$)/i
        );
        if (!match) continue;

        const [, field, operator, value] = match.map((s) => s.trim());
        const parsedValue = this.parseSequelizeValue(value);
        if (operator === "=") {
          andClauses.push(`${field}: ${parsedValue}`);
        } else {
          const op = this.getSequelizeOperator(operator);
          andClauses.push(`${field}: { [${op}]: ${parsedValue} }`);
        }
      }

      if (andClauses.length === 1) {
        sql.push(`{ ${andClauses[0]} }`);
      } else if (andClauses.length > 1) {
        sql.push(
          `{ [Op.and]: [${andClauses.map((clause) => `{ ${clause} }`).join(", ")}] }`
        );
      }
    }

    if (sql.length === 1) {
      return sql[0];
    } else if (sql.length > 1) {
      return `{ [Op.or]: [${sql.join(", ")}] }`;
    }

    return "{}";
  }

  buildAttributes(columns, mainTable) {
    const selectedColumns = columns.map((col) => {
      const aggMatch = col.name.match(SQL_PATTERNS.AGGREGATE_FUNCTION_PATTERN);
      if (aggMatch) {
        const [, func, distinct, column] = aggMatch;
        const cleanColumn = column.trim();
        const funcUpper = func.toUpperCase();

        let sequelizeFunc;
        if (cleanColumn === "*" && funcUpper === "COUNT") {
          sequelizeFunc = distinct
            ? `Sequelize.fn("COUNT", Sequelize.literal("DISTINCT *"))`
            : `Sequelize.fn("COUNT", Sequelize.literal("*"))`;
        } else {
          const columnRef = cleanColumn.includes(".")
            ? `Sequelize.col("${cleanColumn}")`
            : `Sequelize.col("${cleanColumn}")`;

          if (distinct) {
            sequelizeFunc = `Sequelize.fn("${funcUpper}", Sequelize.literal("DISTINCT ${cleanColumn}"))`;
          } else {
            sequelizeFunc = `Sequelize.fn("${funcUpper}", ${columnRef})`;
          }
        }

        if (col.alias) {
          return `[${sequelizeFunc}, "${col.alias}"]`;
        }
        return sequelizeFunc;
      }

      if (col.table && col.table !== mainTable) {
        if (col.alias) {
          return `[Sequelize.col("${col.table}.${col.name}"), "${col.alias}"]`;
        }
        return `Sequelize.col("${col.table}.${col.name}")`;
      }

      if (col.alias) {
        return `["${col.name}", "${col.alias}"]`;
      }
      return `"${col.name}"`;
    });

    return selectedColumns.length > 0 ? selectedColumns.join(", ") : null;
  }

  buildOrConditions(where) {
    const orGroups = where.split(/\s+OR\s+/i).map((group) => group.trim());
    const orClauses = [];

    for (const group of orGroups) {
      if (group.includes(" AND ")) {
        const andConditions = group
          .split(/\s+AND\s+/i)
          .map((cond) => cond.trim());
        const andClauses = andConditions
          .map((cond) => this.parseCondition(cond))
          .filter(Boolean);

        if (andClauses.length === 1) {
          orClauses.push(andClauses[0]);
        } else if (andClauses.length > 1) {
          orClauses.push(`{ [Op.and]: [${andClauses.join(", ")}] }`);
        }
      } else {
        const clause = this.parseCondition(group);
        if (clause) orClauses.push(clause);
      }
    }

    return orClauses.length === 1
      ? orClauses[0]
      : `{ [Op.or]: [${orClauses.join(", ")}] }`;
  }

  buildGroupBy(groupBy) {
    return groupBy
      .map((col) => {
        if (col.table) {
          return `"${col.table}.${col.name}"`;
        }
        return `"${col.name}"`;
      })
      .join(", ");
  }

  buildOrderBy(orderBy) {
    const orderCols = orderBy.map((col) => {
      if (col.table) {
        return `["${col.table}.${col.name}", "${col.direction}"]`;
      }
      return `["${col.name}", "${col.direction}"]`;
    });
    return orderCols.join(", ");
  }

  buildLimit(limit) {
    if (limit.offset) {
      return `limit: ${limit.count}, offset: ${limit.offset}`;
    }
    return `limit: ${limit.count}`;
  }

  parseSequelizeValue(val) {
    if (!val) return "";

    const stripped = val.replace(SQL_PATTERNS.VALUE_CLEANUP, "");

    if (stripped.toLowerCase() === "null") return "null";
    if (stripped.toLowerCase() === "true") return true;
    if (stripped.toLowerCase() === "false") return false;
    if (SQL_PATTERNS.NUMBER.test(stripped)) return Number(stripped);

    return `"${stripped}"`;
  }

  getSequelizeOperator(operator) {
    const opMap = {
      "!=": "Op.ne",
      ">=": "Op.gte",
      "<=": "Op.lte",
      ">": "Op.gt",
      "<": "Op.lt",
    };
    return opMap[operator] || "Op.eq";
  }

  parseCondition(condition) {
    const match = condition.match(
      /(.+?)(=|!=|>=|<=|>|<)(.+?)(?=\s+(?:AND|OR)|$)/i
    );
    if (!match) return null;

    const [, field, operator, value] = match.map((s) => s.trim());
    const parsedValue = this.parseSequelizeValue(value);

    return operator === "="
      ? `{ ${field}: ${parsedValue} }`
      : `{ ${field}: { [${this.getSequelizeOperator(operator)}]: ${parsedValue} } }`;
  }
}
