export const SQL_PATTERNS = {
  SIMPLE_OPERATORS: /(=|!=|>=|<=|>|<)/,
  COMPLEX_OPERATORS:
    /LIKE|NOT LIKE|ILIKE|NOT ILIKE|IN|NOT IN|BETWEEN|IS NULL|IS NOT NULL/i,

  WHERE_PATTERN: /(.+?)(=|!=|>=|<=|>|<)(.+?)(\s+(?:AND|OR)\s+|$)/gi,
  LIKE_PATTERN: /(\w+(?:\.\w+)?)\s+(NOT\s+)?LIKE\s+(['"])(.*?)\3/gi,
  ILIKE_PATTERN: /(\w+(?:\.\w+)?)\s+(NOT\s+)?ILIKE\s+(['"])(.*?)\3/gi,
  IN_PATTERN:
    /(\w+(?:\.\w+)?)\s+(NOT\s+)?IN\s*\(([^)]*(?:SELECT[^)]*)?[^)]*)\)/gi,
  IN_PATTERN_WITH_SUBQUERY:
    /(\w+(?:\.\w+)?)\s+(NOT\s+)?IN\s*\(([^)]*SELECT[^)]*)\)/gi,
  BETWEEN_PATTERN:
    /(\w+(?:\.\w+)?)\s+(NOT\s+)?BETWEEN\s+(.+?)\s+AND\s+(.+?)(?=\s+(?:AND|OR)|$)/gi,
  NULL_PATTERN: /(\w+(?:\.\w+)?)\s+IS\s+(NOT\s+)?NULL/gi,
  SIMPLE_PATTERN: /^(\w+(?:\.\w+)?)\s*(=|!=|>=|<=|>|<)\s*(.+)$/,
  CONDITION_WITH_LOGICAL:
    /(\w+(?:\.\w+)?)\s*(=|!=|>=|<=|>|<)\s*([^AND|OR]+?)(\s+(?:AND|OR)\s+|$)/gi,

  JOIN_PATTERN:
    /((?:inner\s+|left\s+(?:outer\s+)?|right\s+(?:outer\s+)?|full\s+(?:outer\s+)?|cross\s+)?join)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:(?:as\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s+)?on\s+(.+?)(?=\s+(?:inner\s+|left\s+|right\s+|full\s+|cross\s+)?join|\s+where|\s+group\s+by|\s+order\s+by|\s+having|\s+limit|;|$)/gi,
  SIMPLE_ASSOCIATION_JOIN: /^(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)$/,

  TABLE_FROM:
    /from\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:(?:as\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?\s*(?:inner|left|right|full|cross|where|group|order|having|limit|;|$)/i,
  TABLE_UPDATE: /update\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
  TABLE_INTO: /into\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,

  COLUMN_AS: /^(.+?)\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i,

  VALUE_CLEANUP: /^['"]|['"]$/g,
  NUMBER: /^-?(?:\d+\.?\d*|\.\d+)$/,
  REMOVE_CLAUSE: /[.*+?^${}()|[\]\\]/g,

  SELECT_COLUMNS: /select\s+(.*?)\s+from/i,
  INSERT_COLUMNS: /insert\s+into\s+\w+\s*\((.*?)\)\s*values/i,
  VALUES_CLAUSE: /values\s*\((.*?)\)/i,
  SET_CLAUSE: /set\s+(.+?)(?=\s+where|;|$)/i,
  WHERE_CLAUSE:
    /\bwhere\b\s+(.+?)(?=\s+\b(order\s+by|group\s+by|having|limit)\b|;|$)/i,
  GROUP_BY_CLAUSE:
    /group\s+by\s+(.+?)(?=\s+having|\s+order\s+by|\s+limit|;|$)/i,
  HAVING_CLAUSE: /having\s+(.+?)(?=\s+order\s+by|\s+limit|;|$)/i,
  ORDER_BY_CLAUSE: /order\s+by\s+(.+?)(?=\s+limit|;|$)/i,
  LIMIT_CLAUSE: /limit\s+(\d+)(?:\s+offset\s+(\d+))?/i,

  SUBQUERY_PATTERN: /\([^)]*SELECT[^)]*\)/gi,

  AGGREGATE_FUNCTION_PATTERN:
    /^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(DISTINCT\s+)?([^)]+)\s*\)$/i,
};

export const QUERY_TYPES = {
  SELECT: "SELECT",
  INSERT: "INSERT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
};

export const ORM_MAPPINGS = {
  ACTIVE_RECORD: "activerecord",
  SEQUELIZE: "sequelize",
};

export const TABS = [
  { id: ORM_MAPPINGS.ACTIVE_RECORD, name: "ActiveRecord", lang: "ruby" },
  { id: ORM_MAPPINGS.SEQUELIZE, name: "Sequelize", lang: "javascript" },
];

export const EXAMPLES = [
  {
    name: "Select All Users",
    description: "Basic SELECT query to fetch all users",
    sql: "SELECT * FROM users",
  },
  {
    name: "Find User by ID",
    description: "SELECT with WHERE condition",
    sql: "SELECT * FROM users WHERE id = 1",
  },
  {
    name: "Users with Posts (JOIN)",
    description: "INNER JOIN to get users with their posts",
    sql: "SELECT users.name, posts.title FROM users INNER JOIN posts ON users.id = posts.user_id",
  },
  {
    name: "Active Users Subquery",
    description: "Subquery to find users with recent posts",
    sql: "SELECT * FROM users WHERE id IN (SELECT user_id FROM posts WHERE created_at > 2023-01-01)",
  },
  {
    name: "Get Recent Posts",
    description: "SELECT with ORDER BY and LIMIT",
    sql: "SELECT title, content FROM posts ORDER BY created_at DESC LIMIT 10",
  },
  {
    name: "Create New User",
    description: "INSERT query to add a new record",
    sql: "INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')",
  },
  {
    name: "Update User Email",
    description: "UPDATE query with WHERE condition",
    sql: "UPDATE users SET email = 'newemail@example.com' WHERE id = 1",
  },
  {
    name: "Delete Inactive Users",
    description: "DELETE query with WHERE condition",
    sql: "DELETE FROM users WHERE active = false",
  },
  {
    name: "Left Join with Filter",
    description: "LEFT JOIN with WHERE and ORDER BY",
    sql: "SELECT users.name, posts.title FROM users LEFT JOIN posts ON users.id = posts.user_id WHERE users.active = true ORDER BY users.name LIMIT 10",
  },
];
