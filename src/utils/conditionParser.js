import { SQL_PATTERNS } from "../constants";
import { StringHelpers } from "./stringHelpers";
import { ValueParser } from "./valueParser";

export class ConditionParser {
  static isSimpleEquality(expression, regex = SQL_PATTERNS.SIMPLE_OPERATORS) {
    return (
      !/or/i.test(expression) &&
      expression
        .replace(/\([^]+\)/g, "")
        .split(/AND/i)
        .every((str) => regex.test(str.trim()))
    );
  }

  static parseSimpleConditions(where) {
    return where
      .split(/\s+AND\s+/i)
      .map((cond) => {
        const trimmed = cond.trim();
        const match = trimmed.match(SQL_PATTERNS.SIMPLE_PATTERN);
        if (!match) return null;

        const [, field, operator, value] = match;
        return {
          field: field.trim(),
          operator,
          value: ValueParser.parse(value.trim()),
        };
      })
      .filter(Boolean);
  }

  static parseComplexConditions(where) {
    const conditions = {
      like: [],
      in: [],
      between: [],
      null: [],
      simple: [],
    };

    let remainingWhere = where;

    for (const match of where.matchAll(SQL_PATTERNS.LIKE_PATTERN)) {
      const [fullMatch, field, not, _, pattern] = match;
      conditions.like.push({ field, not: !!not, pattern });
      remainingWhere = StringHelpers.removeClause(remainingWhere, fullMatch);
    }

    for (const match of where.matchAll(SQL_PATTERNS.IN_PATTERN)) {
      const [fullMatch, field, not, valuesList] = match;
      const values = valuesList
        .split(",")
        .map((v) => ValueParser.parse(v.trim()));
      conditions.in.push({ field, not: !!not, values });
      remainingWhere = remainingWhere.replace(fullMatch, "");
    }

    for (const match of where.matchAll(SQL_PATTERNS.BETWEEN_PATTERN)) {
      const [fullMatch, field, not, start, end] = match;
      conditions.between.push({
        field,
        not: !!not,
        start: ValueParser.parse(start.trim()),
        end: ValueParser.parse(end.trim()),
      });
      remainingWhere = remainingWhere.replace(fullMatch, "");
    }

    for (const match of where.matchAll(SQL_PATTERNS.NULL_PATTERN)) {
      const [fullMatch, field, not] = match;
      conditions.null.push({ field, not: !!not });
      remainingWhere = remainingWhere.replace(fullMatch, "");
    }

    const remaining = remainingWhere.trim().replace(/^\s*(AND|OR)\s*/i, "");
    if (remaining) {
      conditions.simple = this.parseSimpleConditions(remaining);
    }

    return conditions;
  }
}
