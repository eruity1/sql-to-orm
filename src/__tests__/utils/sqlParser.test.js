import sqlParser from "../../utils/sqlParser";

describe("sqlParser", () => {
  test("parses simple SELECT", () => {
    const sql = "SELECT id, name FROM users WHERE age = 30";
    const result = sqlParser(sql);
    expect(result).toEqual({
      type: "SELECT",
      tables: [{ name: "users", type: "main", alias: null }],
      columns: [
        { name: "id", table: null, alias: null },
        { name: "name", table: null, alias: null },
      ],
      joins: [],
      where: "age = 30",
      values: null,
      set: null,
      groupBy: null,
      having: null,
      orderBy: null,
      limit: null,
      mainTable: "users",
    });
  });

  test("parses SELECT with JOIN", () => {
    const sql =
      "SELECT users.name, posts.title FROM users INNER JOIN posts ON users.id = posts.user_id WHERE posts.created_at > '2023-01-01'";
    const result = sqlParser(sql);
    expect(result.type).toBe("SELECT");
    expect(result.mainTable).toBe("users");
    expect(result.columns).toEqual([
      { name: "name", table: "users", alias: null },
      { name: "title", table: "posts", alias: null },
    ]);
    expect(result.joins).toEqual([
      {
        type: "INNER JOIN",
        table: "posts",
        alias: null,
        on: "users.id = posts.user_id",
      },
    ]);
    expect(result.where).toBe("posts.created_at > '2023-01-01'");
  });

  test("parses INSERT", () => {
    const sql =
      "INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')";
    const result = sqlParser(sql);
    expect(result).toMatchObject({
      type: "INSERT",
      mainTable: "users",
      columns: [
        { name: "name", table: null, alias: null },
        { name: "email", table: null, alias: null },
      ],
      values: ["'John Doe'", "'john@example.com'"],
    });
  });

  test("parses UPDATE", () => {
    const sql = "UPDATE products SET price = 99.99, stock = 10 WHERE id = 1";
    const result = sqlParser(sql);
    expect(result).toMatchObject({
      type: "UPDATE",
      mainTable: "products",
      set: [
        { name: "price", value: "99.99" },
        { name: "stock", value: "10" },
      ],
      where: "id = 1",
    });
  });

  test("parses DELETE", () => {
    const sql = "DELETE FROM orders WHERE shipped_at IS NULL";
    const result = sqlParser(sql);
    expect(result).toMatchObject({
      type: "DELETE",
      mainTable: "orders",
      where: "shipped_at IS NULL",
    });
  });

  test("parses GROUP BY, HAVING, ORDER BY, LIMIT", () => {
    const sql =
      "SELECT user_id FROM posts GROUP BY user_id HAVING COUNT(*) > 1 ORDER BY user_id DESC LIMIT 10 OFFSET 5";
    const result = sqlParser(sql);
    expect(result.groupBy).toEqual([{ name: "user_id", table: null }]);
    expect(result.having).toBe("COUNT(*) > 1");
    expect(result.orderBy).toEqual([
      { name: "user_id", table: null, direction: "DESC" },
    ]);
    expect(result.limit).toEqual({ count: 10, offset: 5 });
  });

  test("parses SELECT with column aliases", () => {
    const sql = "SELECT name AS full_name, email AS user_email FROM users";
    const result = sqlParser(sql);
    expect(result.columns).toEqual([
      { name: "name", table: null, alias: "full_name" },
      { name: "email", table: null, alias: "user_email" },
    ]);
  });

  test("handles empty WHERE", () => {
    const sql = "SELECT * FROM categories";
    const result = sqlParser(sql);
    expect(result.where).toBe("");
  });

  test("returns UNKNOWN for invalid SQL", () => {
    const sql = "INVALID QUERY";
    const result = sqlParser(sql);
    expect(result.type).toBe("UNKNOWN");
    expect(result.mainTable).toBe("table");
  });
});
