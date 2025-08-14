import { BaseGenerator } from "./baseGenerator";
import { ActiveRecordJoinGenerator } from "./activeRecordJoinGenerator";

import { ConditionParser } from "../utils/conditionParser";
import { ValueParser } from "../utils/valueParser";
import { StringHelpers } from "../utils/stringHelpers";
import { SQL_PATTERNS } from "../constants";

export class ActiveRecordGenerator extends BaseGenerator {
  generateQuery(parsed) {
    const { joins } = parsed;

    if (joins && joins.length > 0) {
      return new ActiveRecordJoinGenerator().generateQuery(parsed);
    }

    return super.generateQuery(parsed);
  }

  generateSelect(parsed) {
    const { columns, where, mainTable, groupBy, having, orderBy, limit } =
      parsed;

    const modelName = StringHelpers.toModelName(mainTable);

    let query = modelName;

    if (where) {
      query += this.buildWhere(where);
    }

    if (groupBy && groupBy.length > 0) {
      query += this.buildGroupBy(groupBy);
    }

    if (having) {
      query += `.having("${having}")`;
    }

    if (orderBy && orderBy.length > 0) {
      query += this.buildOrderBy(orderBy);
    }

    if (limit) {
      query += this.buildLimit(limit);
    }

    if (columns[0]?.name !== "*") {
      query += this.buildSelect(columns, mainTable);
    }

    return query;
  }

  generateInsert(parsed) {
    const { columns, values, mainTable } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    if (!values || !columns) {
      return `${modelName}.create!()`;
    }

    const attributes = columns.reduce((acc, col, idx) => {
      const key = col.name;
      const value = ValueParser.parse(values[idx]);
      acc += `${acc ? ", " : ""}${key}: ${value}`;
      return acc;
    }, "");

    return `${modelName}.create!(${attributes})`;
  }

  generateUpdate(parsed) {
    const { set, where, mainTable } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    if (!set) {
      return `${modelName}.update_all()`;
    }

    let query = modelName;

    if (where) {
      query += this.buildWhere(where);
    }

    const updateHash = set.reduce((acc, item) => {
      const key = item.column?.name || item.name;
      const val = ValueParser.parse(item.value);
      acc += `${acc ? ", " : ""}${key}: ${val}`;
      return acc;
    }, "");

    return `${query}.update_all(${updateHash})`;
  }

  generateDelete(parsed) {
    const { where, mainTable } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    let query = modelName;

    if (where) {
      query += this.buildWhere(where);
    }

    return `${query}.destroy_all`;
  }

  buildWhere(where) {
    const hasComplexOperators = SQL_PATTERNS.COMPLEX_OPERATORS.test(where);

    if (hasComplexOperators) {
      return this.buildComplexWhere(where);
    }

    if (ConditionParser.isSimpleEquality(where)) {
      return this.buildSimpleWhere(where);
    }

    return this.buildRawWhere(where);
  }

  buildComplexWhere(where) {
    const conditions = ConditionParser.parseComplexConditions(where);
    const clauses = [];

    conditions.like.forEach(({ field, not, pattern }) => {
      const method = not ? "where.not" : "where";
      clauses.push(`${method}("${field} LIKE ?", "${pattern}")`);
    });

    conditions.in.forEach(({ field, not, values }) => {
      const method = not ? "where.not" : "where";
      const valuesList = values.join(", ");
      clauses.push(`${method}(${field}: [${valuesList}])`);
    });

    conditions.between.forEach(({ field, not, start, end }) => {
      if (not) {
        clauses.push(`where.not(${field}: ${start}..${end})`);
      } else {
        clauses.push(`where(${field}: ${start}..${end})`);
      }
    });

    conditions.null.forEach(({ field, not }) => {
      if (not) {
        clauses.push(`where.not(${field}: nil)`);
      } else {
        clauses.push(`where(${field}: nil)`);
      }
    });

    conditions.simple.forEach(({ field, operator, value }) => {
      if (operator === "=") {
        clauses.push(`where(${field}: ${value})`);
      } else if (operator === "!=") {
        clauses.push(`where.not(${field}: ${value})`);
      } else {
        clauses.push(`where("${field} ${operator} ?", ${value})`);
      }
    });

    return clauses.length > 0 ? "." + clauses.join(".") : "";
  }

  buildSimpleWhere(where) {
    const parts = ConditionParser.parseSimpleConditions(where);

    const equals = parts.filter((p) => p.operator === "=");
    const notEquals = parts.filter((p) => p.operator === "!=");
    const others = parts.filter((p) => !["=", "!="].includes(p.operator));

    const clauses = [];

    if (equals.length) {
      const hash = equals.map((e) => `${e.field}: ${e.value}`).join(", ");
      clauses.push(`where(${hash})`);
    }

    if (notEquals.length) {
      const hash = notEquals.map((e) => `${e.field}: ${e.value}`).join(", ");
      clauses.push(`where.not(${hash})`);
    }

    if (others.length) {
      const raw = others.map((e) => `${e.field} ${e.operator} ?`).join(" AND ");
      const params = others.map((e) => e.value).join(", ");
      clauses.push(`where("${raw}", ${params})`);
    }

    return "." + clauses.join(".");
  }

  buildRawWhere(where) {
    const placeholders = [];
    const pattern = SQL_PATTERNS.WHERE_PATTERN;
    let sql = "";

    const matches = [...where.matchAll(pattern)];
    for (const match of matches) {
      const [_, field, operator, val, logical] = match;
      const parsedVal = ValueParser.parse(val.trim());
      placeholders.push(parsedVal);
      sql += `${field.trim()} ${operator} ?${logical || ""}`;
    }

    return `.where("${sql}", ${placeholders.join(", ")})`;
  }

  buildGroupBy(groupBy) {
    const groupCols = groupBy.map((col) => `:${col.name}`).join(", ");
    return `.group(${groupCols})`;
  }

  buildOrderBy(orderBy) {
    const orderCols = orderBy.map((col) => {
      return `${col.name}: :${col.direction.toLowerCase()}`;
    });
    return `.order(${orderCols.join(", ")})`;
  }

  buildSelect(columns, mainTable) {
    const selectCols = columns
      .map((col) => {
        if (col.alias) {
          return `"${col.name} AS ${col.alias}"`;
        }
        if (col.table && col.table !== mainTable) {
          return `"${col.table}.${col.name}"`;
        }
        return `:${col.name}`;
      })
      .join(", ");

    return `.select(${selectCols})`;
  }

  buildLimit(limit) {
    if (limit.offset) {
      return `.limit(${limit.count}).offset(${limit.offset})`;
    }
    return `.limit(${limit.count})`;
  }
}
