import { singularize } from "inflection";

import { BaseGenerator } from "./baseGenerator";
import { StringHelpers } from "../utils/stringHelpers";
import { ValueParser } from "../utils/valueParser";
import { SQL_PATTERNS } from "../constants";
import { ConditionParser } from "../utils/conditionParser";

export class ActiveRecordJoinGenerator extends BaseGenerator {
  generateSelect(parsed) {
    const {
      columns,
      where,
      mainTable,
      groupBy,
      having,
      orderBy,
      limit,
      joins,
      tables,
    } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    let query = modelName;

    const mainTableInfo = tables && tables[0];
    if (mainTableInfo && mainTableInfo.alias) {
      query += `.from("${mainTable} ${mainTableInfo.alias}")`;
    }

    query += this.buildJoins(joins, mainTable);

    if (where) {
      query += this.buildWhereWithJoins(where, mainTable, joins);
    }

    if (groupBy && groupBy.length > 0) {
      query += this.buildGroupByWithJoins(groupBy, mainTable);
    }

    if (having) {
      query += `.having("${having}")`;
    }

    if (orderBy && orderBy.length > 0) {
      query += this.buildOrderByWithJoins(orderBy);
    }

    if (limit) {
      query += this.buildLimit(limit);
    }

    if (columns[0]?.name !== "*") {
      query += this.buildSelectWithJoins(columns, mainTable);
    }

    return query;
  }

  generateUpdate(parsed) {
    const { mainTable, joins, where, set, tables } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    if (!set) {
      return `${modelName}.joins(...).update_all()`;
    }

    let query = modelName;

    const mainTableInfo = tables && tables[0];
    if (mainTableInfo && mainTableInfo.alias) {
      query += `.from("${mainTable} ${mainTableInfo.alias}")`;
    }

    query += this.buildJoins(joins, mainTable);

    if (where) {
      query += this.buildWhereWithJoins(where, mainTable, joins);
    }

    const updateHash = set.reduce((acc, item) => {
      const key = item.name;
      const val = ValueParser.parse(item.value);
      acc += `${acc ? ", " : ""}${key}: ${val}`;
      return acc;
    }, "");

    query += `.update_all(${updateHash})`;
    return query;
  }

  generateDelete(parsed) {
    const { mainTable, joins, where, tables } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    let query = modelName;

    const mainTableInfo = tables && tables[0];
    if (mainTableInfo && mainTableInfo.alias) {
      query += `.from("${mainTable} ${mainTableInfo.alias}")`;
    }

    query += this.buildJoins(joins, mainTable);

    if (where) {
      query += this.buildWhereWithJoins(where, mainTable, joins);
    }

    return query + `.destroy_all`;
  }

  buildJoins(joins, mainTable) {
    return joins
      .map((join) => {
        if (this.isSimpleAssociationJoin(join, mainTable)) {
          if (join.table) {
            return `.joins(:${join.table})`;
          }
        }

        const joinTypeUpper = join.type.toUpperCase();
        const alias = join.alias ? ` ${join.alias}` : "";
        return `.joins("${joinTypeUpper} ${join.table}${alias} ON ${join.on}")`;
      })
      .join("");
  }

  buildWhereWithJoins(where, mainTable, joins) {
    const hasComplexOperators = SQL_PATTERNS.COMPLEX_OPERATORS.test(where);

    if (hasComplexOperators) {
      return this.buildComplexWhereWithJoins(where, mainTable, joins);
    }

    if (
      ConditionParser.isSimpleEquality(where, SQL_PATTERNS.SIMPLE_OPERATORS)
    ) {
      return this.buildSimpleWhereWithJoins(where, mainTable, joins);
    }

    return this.buildRawWhereWithJoins(where);
  }

  buildSimpleWhereWithJoins(where) {
    const parts = ConditionParser.parseSimpleConditions(where);

    const allConditions = parts
      .map((p) => `${p.field} ${p.operator} ?`)
      .join(" AND ");
    const allParams = parts.map((p) => p.value).join(", ");

    return `.where("${allConditions}", ${allParams})`;
  }

  buildComplexWhereWithJoins(where) {
    const conditions = ConditionParser.parseComplexConditions(where);
    const clauses = [];

    conditions.like.forEach(({ field, not, pattern }) => {
      const method = not ? "where.not" : "where";
      clauses.push(`${method}("${field} LIKE ?", "${pattern}")`);
    });

    conditions.in.forEach(({ field, not, values }) => {
      const method = not ? "where.not" : "where";
      const valuesList = values.join(", ");
      clauses.push(`${method}("${field}": [${valuesList}])`);
    });

    conditions.simple.forEach(({ field, operator, value }) => {
      if (operator === "=") {
        clauses.push(`where("${field}": ${value})`);
      } else if (operator === "!=") {
        clauses.push(`where.not("${field}": ${value})`);
      } else {
        clauses.push(`where("${field} ${operator} ?", ${value})`);
      }
    });

    return clauses.length > 0 ? "." + clauses.join(".") : "";
  }

  buildRawWhereWithJoins(where) {
    const placeholders = [];
    const pattern =
      /(\w+(?:\.\w+)?)\s*(=|!=|>=|<=|>|<)\s*([^AND|OR]+?)(\s+(?:AND|OR)\s+|$)/gi;
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

  buildGroupByWithJoins(groupBy, mainTable) {
    const groupCols = groupBy
      .map((col) => {
        if (col.table) {
          return `"${col.table}.${col.name}"`;
        }
        return `"${mainTable}.${col.name}"`;
      })
      .join(", ");
    return `.group(${groupCols})`;
  }

  buildOrderByWithJoins(orderBy) {
    const orderCols = orderBy.map((col) => {
      const columnRef = col.table ? `${col.table}.${col.name}` : col.name;
      return `"${columnRef} ${col.direction}"`;
    });
    return `.order(${orderCols.join(", ")})`;
  }

  buildSelectWithJoins(columns) {
    const selectCols = columns
      .map((col) => {
        let columnRef = col.name;

        if (col.table) {
          columnRef = `${col.table}.${col.name}`;
        }

        if (col.alias) {
          return `"${columnRef} AS ${col.alias}"`;
        }
        return `"${columnRef}"`;
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

  isSimpleAssociationJoin(join, mainTable) {
    const match = join.on.match(SQL_PATTERNS.SIMPLE_ASSOCIATION_JOIN);
    if (!match) return false;

    const [, table1, col1, table2, col2] = match;
    const mainSingular = singularize(mainTable);

    return (
      (table1 === mainTable &&
        col1 === "id" &&
        col2 === `${mainSingular}_id`) ||
      (table2 === mainTable && col2 === "id" && col1 === `${mainSingular}_id`)
    );
  }

  guessAssociation(joinTable) {
    return singularize(joinTable);
  }
}
