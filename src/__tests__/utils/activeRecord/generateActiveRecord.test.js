import sqlParser from "../../../utils/sqlParser";
import generateActiveRecord from "../../../utils/activeRecord/generateActiveRecord";

describe("generateActiveRecord", () => {
  test("generates simple SELECT", () => {
    const sql = "SELECT id, name FROM users WHERE age = 30";
    const parsed = sqlParser(sql);
    const result = generateActiveRecord(parsed);
    expect(result).toBe("User.where(age: 30).select(:id, :name)");
  });

  test("generates INSERT", () => {
    const sql =
      "INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')";
    const parsed = sqlParser(sql);
    const result = generateActiveRecord(parsed);
    expect(result).toBe(
      'User.create!(name: "John Doe", email: "john@example.com")'
    );
  });

  test("generates UPDATE", () => {
    const sql =
      "UPDATE products SET price = 99.99, stock = 10 WHERE type = 'electronics'";
    const parsed = sqlParser(sql);
    const result = generateActiveRecord(parsed);
    expect(result).toBe(
      'Product.where(type: "electronics").update_all(price: 99.99, stock: 10)'
    );
  });

  test("generates DELETE", () => {
    const sql = "DELETE FROM orders WHERE shipped_at IS NULL";
    const parsed = sqlParser(sql);
    const result = generateActiveRecord(parsed);
    expect(result).toBe("Order.where(shipped_at: nil).destroy_all");
  });

  test("generates complex WHERE with LIKE, IN, BETWEEN", () => {
    const sql =
      "SELECT name FROM users WHERE name LIKE '%John%' AND id IN (1, 2, 3) AND age BETWEEN 20 AND 30";
    const parsed = sqlParser(sql);
    const result = generateActiveRecord(parsed);
    expect(result).toBe(
      'User.where("name LIKE ?", "%John%").where(id: [1, 2, 3]).where(age: 20..30).select(:name)'
    );
  });

  test("generates SELECT with GROUP BY, HAVING, ORDER BY, LIMIT", () => {
    const sql =
      "SELECT user_id FROM posts GROUP BY user_id HAVING COUNT(*) > 1 ORDER BY user_id DESC LIMIT 10 OFFSET 5";
    const parsed = sqlParser(sql);
    const result = generateActiveRecord(parsed);
    expect(result).toBe(
      'Post.group(:user_id).having("COUNT(*) > 1").order(user_id: :desc).limit(10).offset(5).select(:user_id)'
    );
  });

  test("generates SELECT with column aliases", () => {
    const sql = "SELECT name AS full_name, email AS user_email FROM users";
    const parsed = sqlParser(sql);
    const result = generateActiveRecord(parsed);
    expect(result).toBe(
      'User.select("name AS full_name", "email AS user_email")'
    );
  });

  test("handles empty WHERE", () => {
    const sql = "SELECT * FROM teams";
    const parsed = sqlParser(sql);
    const result = generateActiveRecord(parsed);
    expect(result).toBe("Team");
  });

  test("returns fallback for UNKNOWN type", () => {
    const parsed = { type: "UNKNOWN", mainTable: "table" };
    const result = generateActiveRecord(parsed);
    expect(result).toBe("# Could not parse this SQL query");
  });

  test("handles malformed WHERE", () => {
    const sql = "SELECT id FROM users WHERE";
    const parsed = sqlParser(sql);
    const result = generateActiveRecord(parsed);
    expect(result).toBe("User.select(:id)");
  });
});
