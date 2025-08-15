import { SQL_PATTERNS } from "../constants";
import { StringHelpers } from "./stringHelpers";
import { ValueParser } from "./valueParser";

export class ConditionParser {
  static isSimpleEquality(expression, regex = SQL_PATTERNS.SIMPLE_OPERATORS) {
    if (this.hasSubquery(expression)) {
      return false;
    }

    return (
      !/or/i.test(expression) &&
      expression
        .replace(/\([^)]*\)/g, "")
        .split(/AND/i)
        .every((str) => regex.test(str.trim()))
    );
  }

  static hasSubquery(expression) {
    return SQL_PATTERNS.SUBQUERY_PATTERN.test(expression);
  }

  static parseSimpleConditions(where) {
    if (this.hasSubquery(where)) {
      return [];
    }

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

    for (const match of where.matchAll(SQL_PATTERNS.ILIKE_PATTERN)) {
      const [fullMatch, field, not, _, pattern] = match;
      conditions.like.push({ field, not: !!not, pattern, isILike: true });
      remainingWhere = StringHelpers.removeClause(remainingWhere, fullMatch);
    }

    for (const match of remainingWhere.matchAll(SQL_PATTERNS.LIKE_PATTERN)) {
      const [fullMatch, field, not, _, pattern] = match;
      conditions.like.push({ field, not: !!not, pattern, isILike: false });
      remainingWhere = StringHelpers.removeClause(remainingWhere, fullMatch);
    }

    for (const match of where.matchAll(SQL_PATTERNS.IN_PATTERN)) {
      const [fullMatch, field, not, valuesList] = match;

      if (/SELECT/i.test(valuesList)) {
        continue;
      }

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
    if (remaining && !this.hasSubquery(remaining)) {
      conditions.simple = this.parseSimpleConditions(remaining);
    }

    return conditions;
  }

  static extractSubqueries(where) {
    const subqueries = [];

    for (const match of where.matchAll(SQL_PATTERNS.IN_PATTERN_WITH_SUBQUERY)) {
      const [fullMatch, field, not, subquery] = match;
      subqueries.push({
        field,
        not: !!not,
        subquery: subquery.trim(),
        fullMatch,
      });
    }

    return subqueries;
  }
}
