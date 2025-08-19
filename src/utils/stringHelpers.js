import { singularize } from "inflection";
import { SQL_PATTERNS } from "../constants";

export class StringHelpers {
  static toModelName(tableName) {
    const singular = singularize(tableName);
    return singular
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  }

  static removeClause(where, clause) {
    const escaped = clause.replace(SQL_PATTERNS.REMOVE_CLAUSE, "\\$&");
    const pattern = new RegExp(
      `\\s*(AND|OR)?\\s*${escaped}\\s*(AND|OR)?\\s*`,
      "i"
    );
    return where.replace(pattern, " ");
  }

  static hasSubquery(where) {
    return SQL_PATTERNS.SUBQUERY_PATTERN.test(where);
  }
}
