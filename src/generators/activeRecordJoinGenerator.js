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

    const simpleAggregateResult = this.handleSimpleAggregatesWithJoins(
      columns,
      where,
      groupBy,
      having,
      orderBy,
      limit,
      modelName,
      joins
    );
    if (simpleAggregateResult) {
      return simpleAggregateResult;
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

  handleSimpleAggregatesWithJoins(
    columns,
    where,
    groupBy,
    having,
    orderBy,
    limit,
    modelName,
    joins
  ) {
    if (columns.length !== 1 || groupBy?.length > 0 || having) {
      return null;
    }

    const column = columns[0];
    const aggMatch = column.name.match(SQL_PATTERNS.AGGREGATE_FUNCTION_PATTERN);

    if (!aggMatch) {
      return null;
    }

    const [, func, distinct, columnName] = aggMatch;
    const funcUpper = func.toUpperCase();
    const cleanColumn = columnName.trim();

    let query = modelName;

    query += this.buildJoins(joins, modelName);

    if (where) {
      query += this.buildWhereWithJoins(where, modelName, joins);
    }

    if (orderBy && orderBy.length > 0) {
      query += this.buildOrderByWithJoins(orderBy);
    }

    if (limit) {
      query += this.buildLimit(limit);
    }

    switch (funcUpper) {
      case "COUNT":
        if (cleanColumn === "*") {
          return query + ".count";
        } else if (distinct) {
          const columnSymbol = cleanColumn.includes(".")
            ? `"${cleanColumn}"`
            : `:${cleanColumn}`;
          return query + `.distinct.count(${columnSymbol})`;
        } else {
          const columnSymbol = cleanColumn.includes(".")
            ? `"${cleanColumn}"`
            : `:${cleanColumn}`;
          return query + `.count(${columnSymbol})`;
        }
      case "SUM":
        const sumColumn = cleanColumn.includes(".")
          ? `"${cleanColumn}"`
          : `:${cleanColumn}`;
        return (
          query +
          (distinct ? `.distinct.sum(${sumColumn})` : `.sum(${sumColumn})`)
        );
      case "AVG":
        const avgColumn = cleanColumn.includes(".")
          ? `"${cleanColumn}"`
          : `:${cleanColumn}`;
        return query + `.average(${avgColumn})`;
      case "MIN":
        const minColumn = cleanColumn.includes(".")
          ? `"${cleanColumn}"`
          : `:${cleanColumn}`;
        return query + `.minimum(${minColumn})`;
      case "MAX":
        const maxColumn = cleanColumn.includes(".")
          ? `"${cleanColumn}"`
          : `:${cleanColumn}`;
        return query + `.maximum(${maxColumn})`;
      default:
        return null;
    }
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
    const innerJoins = [];
    const leftJoins = [];
    const rightJoins = [];
    const complexJoins = [];

    joins.forEach((join) => {
      const joinTypeUpper = join.type.toUpperCase();
      const isSimpleAssoc = this.isSimpleAssociationJoin(join, mainTable);

      if (isSimpleAssoc) {
        const association = join.alias || join.table;

        if (joinTypeUpper === "INNER JOIN" || joinTypeUpper === "JOIN") {
          innerJoins.push(association);
        } else if (
          joinTypeUpper === "LEFT JOIN" ||
          joinTypeUpper === "LEFT OUTER JOIN"
        ) {
          leftJoins.push(association);
        } else if (
          joinTypeUpper === "RIGHT JOIN" ||
          joinTypeUpper === "RIGHT OUTER JOIN"
        ) {
          rightJoins.push({ association, join });
        } else {
          complexJoins.push(join);
        }
      } else {
        complexJoins.push(join);
      }
    });

    let joinQuery = "";

    if (innerJoins.length > 0) {
      const joinSymbols = innerJoins.map((assoc) => `:${assoc}`).join(", ");
      joinQuery += `.joins(${joinSymbols})`;
    }

    if (leftJoins.length > 0) {
      const joinSymbols = leftJoins.map((assoc) => `:${assoc}`).join(", ");
      joinQuery += `.left_joins(${joinSymbols})`;
    }

    rightJoins.forEach(({ join }) => {
      const alias = join.alias ? ` ${join.alias}` : "";
      joinQuery += `.joins("RIGHT JOIN ${join.table}${alias} ON ${join.on}")`;
    });

    complexJoins.forEach((join) => {
      const joinTypeUpper = join.type.toUpperCase();
      const alias = join.alias ? ` ${join.alias}` : "";
      joinQuery += `.joins("${joinTypeUpper} ${join.table}${alias} ON ${join.on}")`;
    });

    return joinQuery;
  }

  buildWhereWithJoins(where, mainTable, joins) {
    if (this.hasSubquery(where)) {
      return this.buildSubqueryWhere(where);
    }

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

  hasSubquery(where) {
    return SQL_PATTERNS.SUBQUERY_PATTERN.test(where);
  }

  buildSubqueryWhere(where) {
    return `.where("${where}")`;
  }

  buildSimpleWhereWithJoins(where, mainTable) {
    const parts = ConditionParser.parseSimpleConditions(where);

    const allConditions = parts
      .map((p) => {
        const field = p.field.includes(".")
          ? p.field
          : `${mainTable}.${p.field}`;
        return `${field} ${p.operator} ?`;
      })
      .join(" AND ");
    const allParams = parts.map((p) => p.value).join(", ");

    return `.where("${allConditions}", ${allParams})`;
  }

  buildComplexWhereWithJoins(where, mainTable) {
    const conditions = ConditionParser.parseComplexConditions(where);
    const clauses = [];

    conditions.like.forEach(({ field, not, pattern, isILike }) => {
      const method = not ? "where.not" : "where";
      const operator = isILike ? "ILIKE" : "LIKE";
      const fieldRef = field.includes(".") ? field : `${mainTable}.${field}`;
      clauses.push(`${method}("${fieldRef} ${operator} ?", "${pattern}")`);
    });

    conditions.in.forEach(({ field, not, values }) => {
      const method = not ? "where.not" : "where";
      const fieldRef = field.includes(".") ? field : `${mainTable}.${field}`;
      const valuesList = values.join(", ");
      clauses.push(`${method}("${fieldRef} IN (?)", [${valuesList}])`);
    });

    conditions.between.forEach(({ field, not, start, end }) => {
      const fieldRef = field.includes(".") ? field : `${mainTable}.${field}`;
      if (not) {
        clauses.push(
          `where.not("${fieldRef} BETWEEN ? AND ?", ${start}, ${end})`
        );
      } else {
        clauses.push(`where("${fieldRef} BETWEEN ? AND ?", ${start}, ${end})`);
      }
    });

    conditions.null.forEach(({ field, not }) => {
      const fieldRef = field.includes(".") ? field : `${mainTable}.${field}`;
      if (not) {
        clauses.push(`where.not("${fieldRef} IS NULL")`);
      } else {
        clauses.push(`where("${fieldRef} IS NULL")`);
      }
    });

    conditions.simple.forEach(({ field, operator, value }) => {
      const fieldRef = field.includes(".") ? field : `${mainTable}.${field}`;
      if (operator === "=") {
        clauses.push(`where("${fieldRef} = ?", ${value})`);
      } else if (operator === "!=") {
        clauses.push(`where.not("${fieldRef} = ?", ${value})`);
      } else {
        clauses.push(`where("${fieldRef} ${operator} ?", ${value})`);
      }
    });

    return clauses.length > 0 ? "." + clauses.join(".") : "";
  }

  buildRawWhereWithJoins(where) {
    const placeholders = [];
    let sql = "";

    const matches = [...where.matchAll(SQL_PATTERNS.CONDITION_WITH_LOGICAL)];
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
        const aggMatch = col.name.match(
          SQL_PATTERNS.AGGREGATE_FUNCTION_PATTERN
        );
        if (aggMatch) {
          const [, func, distinct, column] = aggMatch;
          const cleanColumn = column.trim();

          if (cleanColumn === "*" && func.toUpperCase() === "COUNT") {
            return distinct ? '"COUNT(DISTINCT *)"' : '"COUNT(*)"';
          }

          let columnRef = cleanColumn;
          if (cleanColumn.includes(".")) {
            columnRef = cleanColumn;
          }

          const distinctPart = distinct ? "DISTINCT " : "";
          return `"${func.toUpperCase()}(${distinctPart}${columnRef})"`;
        }

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

    const isConventional = this.checkConventionalJoin(
      table1,
      col1,
      table2,
      col2,
      mainTable,
      join.table
    );

    return isConventional;
  }

  checkConventionalJoin(table1, col1, table2, col2, mainTable, joinTable) {
    const checkPair = (leftTable, leftCol, rightCol) => {
      if (leftCol === "id") {
        const expectedForeignKey = `${singularize(leftTable)}_id`;
        return rightCol === expectedForeignKey;
      }
      return false;
    };

    const tablesInvolved = [table1, table2];
    const tablesMatch =
      (tablesInvolved.includes(mainTable) &&
        tablesInvolved.includes(joinTable)) ||
      tablesInvolved.includes(mainTable) ||
      tablesInvolved.includes(joinTable);

    if (!tablesMatch) {
      return false;
    }

    const isValid =
      checkPair(table1, col1, col2) || checkPair(table2, col2, col1);

    return isValid;
  }
}
