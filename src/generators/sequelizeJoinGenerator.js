import { singularize } from "inflection";

import { BaseGenerator } from "./baseGenerator";
import { StringHelpers } from "../utils/stringHelpers";
import { SQL_PATTERNS } from "../constants";
import { ConditionParser } from "../utils/conditionParser";

export class SequelizeJoinGenerator extends BaseGenerator {
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
    } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    const simpleAggregateResult = this.handleSimpleAggregates(
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

    const options = [];

    const { includes, mainTableColumns } = this.buildIncludesWithAttributes(
      joins,
      columns,
      mainTable
    );
    if (includes.length > 0) {
      options.push(`include: [${includes.join(", ")}]`);
    }

    if (columns[0]?.name !== "*") {
      const attributes = this.buildTableAttributes(mainTableColumns);
      if (attributes) options.push(`attributes: [${attributes}]`);
    }

    if (where) {
      const whereClause = this.buildWhereWithJoins(where, mainTable, joins);
      options.push(`where: ${whereClause}`);
    }

    if (groupBy?.length > 0) {
      const groupClause = this.buildGroupBy(groupBy);
      options.push(`group: [${groupClause}]`);
    }

    if (having) {
      const havingClause = this.buildHaving(having);
      options.push(`having: ${havingClause}`);
    }

    if (orderBy?.length > 0) {
      const orderClause = this.buildOrderBy(orderBy);
      options.push(`order: [${orderClause}]`);
    }

    if (limit) {
      options.push(this.buildLimit(limit));
    }

    return `${modelName}.findAll({${options.join(", ")}})`;
  }

  handleSimpleAggregates(
    columns,
    where,
    groupBy,
    having,
    orderBy,
    limit,
    modelName,
    joins
  ) {
    if (columns.length !== 1 || groupBy || having) return null;

    const column = columns[0];
    const aggMatch = column.name.match(SQL_PATTERNS.AGGREGATE_FUNCTION_PATTERN);
    if (!aggMatch) return null;

    const [, func, distinct, columnName] = aggMatch;
    const funcUpper = func.toUpperCase();
    const cleanColumn = columnName.trim();

    const options = [];

    if (joins?.length > 0) {
      const includes = this.buildBasicIncludes(joins);
      options.push(`include: [${includes.join(", ")}]`);
    }

    if (where) {
      const whereClause = this.buildWhereWithJoins(where, modelName, joins);
      options.push(`where: ${whereClause}`);
    }

    if (orderBy?.length > 0) {
      options.push(`order: [${this.buildOrderBy(orderBy)}]`);
    }
    if (limit) {
      options.push(this.buildLimit(limit));
    }

    const optionsStr = options.length > 0 ? `{ ${options.join(", ")} }` : "";

    switch (funcUpper) {
      case "COUNT":
        if (cleanColumn === "*") {
          return `${modelName}.count(${optionsStr || ""})`;
        } else {
          const columnRef = `"${cleanColumn}"`;
          const countOptions = [...options, `col: ${columnRef}`];
          if (distinct) countOptions.push(`distinct: true`);
          return `${modelName}.count({ ${countOptions.join(", ")} })`;
        }

      case "SUM":
      case "AVG":
      case "MIN":
      case "MAX": {
        const columnRef = `"${cleanColumn}"`;
        const method = funcUpper.toLowerCase();
        return `${modelName}.${method}(${columnRef}${optionsStr ? `, ${optionsStr}` : ""})`;
      }

      default:
        return null;
    }
  }

  generateUpdate(parsed) {
    const { mainTable, joins, where, set } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    if (!set) {
      return `${modelName}.update({}, { where: {} })`;
    }

    const updateHash = set
      .map((item) => `${item.name}: ${this.parseSequelizeValue(item.value)}`)
      .join(", ");

    const options = [];

    if (where) {
      options.push(
        `where: ${this.buildWhereWithJoins(where, mainTable, joins)}`
      );
    } else {
      options.push(`where: {}`);
    }

    if (joins?.length > 0) {
      const includes = this.buildBasicIncludes(joins);
      options.push(`include: [${includes.join(", ")}]`);
    }

    return `${modelName}.update({ ${updateHash} }, { ${options.join(", ")} })`;
  }

  generateDelete(parsed) {
    const { mainTable, joins, where } = parsed;
    const modelName = StringHelpers.toModelName(mainTable);

    const options = [];

    if (where) {
      options.push(
        `where: ${this.buildWhereWithJoins(where, mainTable, joins)}`
      );
    } else {
      options.push(`where: {}`);
    }

    if (joins?.length > 0) {
      const includes = this.buildBasicIncludes(joins);
      options.push(`include: [${includes.join(", ")}]`);
    }

    return `${modelName}.destroy({ ${options.join(", ")} })`;
  }

  buildIncludesWithAttributes(joins, columns, mainTable) {
    if (!joins?.length) {
      return { includes: [], mainTableColumns: columns };
    }

    const includes = [];
    const joinColumnsByTable = new Map();
    const mainTableColumns = [];

    columns.forEach((col) => {
      if (col.table && col.table !== mainTable) {
        if (!joinColumnsByTable.has(col.table)) {
          joinColumnsByTable.set(col.table, []);
        }
        joinColumnsByTable.get(col.table).push(col);
      } else {
        mainTableColumns.push(col);
      }
    });

    joins.forEach((join) => {
      const modelName = StringHelpers.toModelName(join.table);
      const includeObj = { model: modelName };

      if (join.alias) {
        includeObj.as = join.alias;
      }

      const { joinCondition, whereCondition } = this.parseJoinCondition(
        join.on,
        mainTable,
        join.table
      );

      if (whereCondition) {
        includeObj.where = whereCondition;
      }

      const tableKey = join.alias || join.table;
      const joinColumns =
        joinColumnsByTable.get(tableKey) || joinColumnsByTable.get(join.table);

      if (joinColumns?.length > 0) {
        const attributes = this.buildTableAttributes(joinColumns);
        if (attributes) {
          includeObj.attributes = `[${attributes}]`;
        }
      } else {
        includeObj.attributes = `[]`;
      }

      const joinType = join.type.toUpperCase();
      includeObj.required =
        !joinType.includes("LEFT") && !joinType.includes("RIGHT");

      if (
        !this.isSimpleAssociationJoin(join, mainTable) &&
        joinCondition !== join.on
      ) {
        includeObj.on = `{ [Op.and]: [Sequelize.literal("${joinCondition}")] }`;
      }

      const includeProps = Object.entries(includeObj).map(([key, value]) => {
        if (key === "as") return `as: "${value}"`;
        if (key === "attributes") return `attributes: ${value}`;
        if (key === "required") return `required: ${value}`;
        if (key === "where") return `where: ${value}`;
        if (key === "on") return `on: ${value}`;
        return `${key}: ${value}`;
      });

      includes.push(`{ ${includeProps.join(", ")} }`);
    });

    return { includes, mainTableColumns };
  }

  buildBasicIncludes(joins) {
    return joins.map((join) => {
      const modelName = StringHelpers.toModelName(join.table);
      const props = [`model: ${modelName}`];

      if (join.alias) {
        props.push(`as: "${join.alias}"`);
      }

      const joinType = join.type.toUpperCase();
      const required =
        !joinType.includes("LEFT") && !joinType.includes("RIGHT");
      props.push(`required: ${required}`);

      if (!this.isSimpleAssociationJoin(join, join.table)) {
        props.push(`on: { [Op.and]: [Sequelize.literal("${join.on}")] }`);
      }

      return `{ ${props.join(", ")} }`;
    });
  }

  buildTableAttributes(columns) {
    if (!columns?.length) return null;

    const attributes = columns.map((col) => {
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

          sequelizeFunc = distinct
            ? `Sequelize.fn("${funcUpper}", Sequelize.literal("DISTINCT ${cleanColumn}"))`
            : `Sequelize.fn("${funcUpper}", ${columnRef})`;
        }

        return col.alias ? `[${sequelizeFunc}, "${col.alias}"]` : sequelizeFunc;
      }

      return col.alias ? `["${col.name}", "${col.alias}"]` : `"${col.name}"`;
    });

    return attributes.join(", ");
  }

  buildHaving(having) {
    if (!having) return null;

    const havingMatch = having.match(
      /(\w+(?:\.\w+)?|\w+)\s*(>=|<=|>|<|=|!=)\s*(.+)/
    );
    if (havingMatch) {
      const [, field, operator, value] = havingMatch;

      if (!field.includes(".") && !field.includes("(")) {
        const op = this.getSequelizeOperator(operator);
        const parsedValue = this.parseSequelizeValue(value);

        if (operator === "=") {
          return `{ ${field}: ${parsedValue} }`;
        } else {
          return `{ ${field}: { [${op}]: ${parsedValue} } }`;
        }
      }
    }

    return `Sequelize.literal("${having}")`;
  }

  buildWhereWithJoins(where, mainTable, joins) {
    if (this.hasSubquery(where)) {
      return `{ [Op.and]: [Sequelize.literal("${where}")] }`;
    }

    if (/\s+OR\s+/i.test(where)) {
      return this.buildOrConditions(where);
    }

    if (SQL_PATTERNS.COMPLEX_OPERATORS.test(where)) {
      return this.buildComplexWhere(where, mainTable, joins);
    }

    if (
      ConditionParser.isSimpleEquality(where, SQL_PATTERNS.SIMPLE_OPERATORS)
    ) {
      return this.buildSimpleWhere(where, mainTable, joins);
    }

    return `{ [Op.and]: [Sequelize.literal("${where}")] }`;
  }

  buildSimpleWhere(where, mainTable, joins) {
    const parts = ConditionParser.parseSimpleConditions(where);
    const clauses = {};

    parts.forEach((p) => {
      const field = this.resolveField(p.field, mainTable, joins);
      const value = p.value;

      if (p.operator === "=") {
        clauses[field] = value;
      } else {
        const op = this.getSequelizeOperator(p.operator);
        clauses[field] = `{ [${op}]: ${value} }`;
      }
    });

    const clauseStrings = Object.entries(clauses).map(
      ([field, condition]) => `${field}: ${condition}`
    );

    return `{ ${clauseStrings.join(", ")} }`;
  }

  buildComplexWhere(where, mainTable, joins) {
    const conditions = ConditionParser.parseComplexConditions(where);
    const clauses = {};

    const handlers = {
      like: ({ field, not, pattern, isILike }) => {
        const resolvedField = this.resolveField(field, mainTable, joins);
        const op = not
          ? isILike
            ? "Op.notILike"
            : "Op.notLike"
          : isILike
            ? "Op.iLike"
            : "Op.like";
        clauses[resolvedField] = `{ [${op}]: "${pattern}" }`;
      },
      in: ({ field, not, values }) => {
        const resolvedField = this.resolveField(field, mainTable, joins);
        const op = not ? "Op.notIn" : "Op.in";
        clauses[resolvedField] = `{ [${op}]: [${values.join(", ")}] }`;
      },
      between: ({ field, not, start, end }) => {
        const resolvedField = this.resolveField(field, mainTable, joins);
        const op = not ? "Op.notBetween" : "Op.between";
        clauses[resolvedField] = `{ [${op}]: [${start}, ${end}] }`;
      },
      null: ({ field, not }) => {
        const resolvedField = this.resolveField(field, mainTable, joins);
        const op = not ? "Op.ne" : "Op.is";
        clauses[resolvedField] = `{ [${op}]: null }`;
      },
      simple: ({ field, operator, value }) => {
        const resolvedField = this.resolveField(field, mainTable, joins);
        if (operator === "=") {
          clauses[resolvedField] = value;
        } else {
          const op = this.getSequelizeOperator(operator);
          clauses[resolvedField] = `{ [${op}]: ${value} }`;
        }
      },
    };

    Object.entries(conditions).forEach(([type, conditionList]) => {
      if (handlers[type] && Array.isArray(conditionList)) {
        conditionList.forEach(handlers[type]);
      }
    });

    const clauseStrings = Object.entries(clauses).map(
      ([field, condition]) => `${field}: ${condition}`
    );

    return `{ ${clauseStrings.join(", ")} }`;
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

  parseCondition(condition) {
    const match = condition.match(
      /(.+?)(=|!=|>=|<=|>|<)(.+?)(?=\s+(?:AND|OR)|$)/i
    );
    if (!match) return null;

    const [, field, operator, value] = match.map((s) => s.trim());
    const parsedValue = this.parseSequelizeValue(value);
    const fieldName = field.includes(".") ? `"${field}$"` : field;

    return operator === "="
      ? `{ ${fieldName}: ${parsedValue} }`
      : `{ ${fieldName}: { [${this.getSequelizeOperator(operator)}]: ${parsedValue} } }`;
  }

  buildGroupBy(groupBy) {
    return groupBy
      .map((col) =>
        col.table ? `"${col.table}.${col.name}"` : `"${col.name}"`
      )
      .join(", ");
  }

  buildOrderBy(orderBy) {
    return orderBy
      .map((col) => {
        const column = col.table
          ? `Sequelize.col("${col.table}.${col.name}")`
          : `"${col.name}"`;
        return `[${column}, "${col.direction}"]`;
      })
      .join(", ");
  }

  buildLimit(limit) {
    const parts = [`limit: ${limit.count}`];
    if (limit.offset) {
      parts.push(`offset: ${limit.offset}`);
    }
    return parts.join(", ");
  }

  resolveField(field, mainTable, joins) {
    if (!field.includes(".")) return field;

    const [tablePart, fieldPart] = field.split(".");
    if (tablePart === mainTable) return fieldPart;

    const join = joins?.find(
      (j) => j.alias === tablePart || j.table === tablePart
    );
    if (join) {
      const tableAlias = join.alias || join.table;
      return `"${tableAlias}.${fieldPart}$"`;
    }

    return `"${tablePart}.${fieldPart}$"`;
  }

  needsRawQuery(joins) {
    return (
      joins?.some((join) => join && !this.isSimpleAssociationJoin(join)) ||
      false
    );
  }

  isSimpleAssociationJoin(join, mainTable) {
    if (!join?.on) return false;

    try {
      const associationPattern = SQL_PATTERNS.SIMPLE_ASSOCIATION_JOIN;
      const match = join.on.match(associationPattern);
      if (!match) return false;

      const [, table1, col1, table2, col2] = match;
      return this.checkConventionalJoin(
        table1,
        col1,
        table2,
        col2,
        mainTable,
        join.table
      );
    } catch (error) {
      console.error("Error in isSimpleAssociationJoin:", error);
      return false;
    }
  }

  checkConventionalJoin(table1, col1, table2, col2, mainTable, joinTable) {
    const checkPair = (leftTable, leftCol, _, rightCol) => {
      if (leftCol === "id") {
        const expectedForeignKey = `${singularize(leftTable)}_id`;
        return rightCol === expectedForeignKey;
      }
      return false;
    };

    const tablesInvolved = [table1, table2];
    const tablesMatch =
      tablesInvolved.includes(mainTable) || tablesInvolved.includes(joinTable);

    return (
      tablesMatch &&
      (checkPair(table1, col1, table2, col2) ||
        checkPair(table2, col2, table1, col1))
    );
  }

  hasSubquery(where) {
    return SQL_PATTERNS.SUBQUERY_PATTERN.test(where);
  }

  parseSequelizeValue(val) {
    if (!val) return '""';

    const stripped = val.replace(SQL_PATTERNS.VALUE_CLEANUP, "");

    if (stripped.toLowerCase() === "null") return "null";
    if (stripped.toLowerCase() === "true") return true;
    if (stripped.toLowerCase() === "false") return false;
    if (SQL_PATTERNS.NUMBER.test(stripped)) return Number(stripped);

    return `"${stripped}"`;
  }

  parseJoinCondition(joinOn, mainTable, joinTable) {
    const parts = joinOn.split(/\s+AND\s+/i);

    let joinCondition = "";
    const whereConditions = [];

    parts.forEach((part) => {
      const trimmed = part.trim();

      const relationshipMatch = trimmed.match(
        SQL_PATTERNS.SIMPLE_ASSOCIATION_JOIN
      );

      if (relationshipMatch) {
        const [, table1, _, table2] = relationshipMatch;
        if (
          (table1 === mainTable || table1 === joinTable) &&
          (table2 === mainTable || table2 === joinTable)
        ) {
          joinCondition = trimmed;
        } else {
          whereConditions.push(trimmed);
        }
      } else {
        const whereMatch = trimmed.match(
          /^(\w+)\.(\w+)\s*(=|!=|>=|<=|>|<)\s*(.+)$/
        );
        if (whereMatch) {
          const [, table, column, operator, value] = whereMatch;
          if (table === joinTable) {
            if (operator === "=") {
              whereConditions.push(
                `{ ${column}: ${this.parseSequelizeValue(value)} }`
              );
            } else {
              const op = this.getSequelizeOperator(operator);
              whereConditions.push(
                `{ ${column}: { [${op}]: ${this.parseSequelizeValue(value)} } }`
              );
            }
          } else {
            whereConditions.push(trimmed);
          }
        } else {
          whereConditions.push(trimmed);
        }
      }
    });

    if (!joinCondition) {
      joinCondition = parts[0];
      whereConditions.shift();
    }

    let whereCondition = null;
    if (whereConditions.length > 0) {
      const allAreObjects = whereConditions.every((cond) =>
        cond.startsWith("{")
      );

      if (allAreObjects && whereConditions.length === 1) {
        whereCondition = whereConditions[0];
      } else if (allAreObjects && whereConditions.length > 1) {
        whereCondition = `{ [Op.and]: [${whereConditions.join(", ")}] }`;
      } else {
        whereCondition = `Sequelize.literal("${whereConditions.join(" AND ")}")`;
      }
    }

    return { joinCondition, whereCondition };
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
}
