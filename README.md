# SQL to Sequelize Converter

A Single Page Application (SPA) that converts SQL queries into Sequelize queries, running entirely in the browser with a client-side database. Built with React, styled-components, and a custom SQL parser.

## Features

- Converts SQL `SELECT`, `INSERT`, `UPDATE`, and `DELETE` queries to Active Record and Sequelize syntax.
- Supports `WHERE` clauses with operators (`=`, `!=`, `>`, `<`, `>=`, `<=`) and `AND`/`OR` conditions.
- Responsive UI with toggleable example queries.

## Demo

Try it live at: [Here](https://sqltoorm.netlify.app/)

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm (v9 or higher)

### Installation

1.  Clone the repository:

    ```
    git clone https://github.com/eruity1/sql-to-orm.git
    cd sql-to-orm
    ```

2.  Install dependencies:

    ```
    npm install
    ```

3.  Start the development server:

    ```
    npm run dev
    ```

### Building for Production

```
npm run build
```

The static assets will be generated in the `build/` folder (or `dist/` if using Vite).

### Running Tests

```
npm test
```

## Usage

1.  Enter a SQL query in the input textarea (e.g., `SELECT * FROM users WHERE name = 'Fred'`).
2.  The app parses the query and displays the equivalent Active Record or Sequelize query.
3.  Toggle the "Examples" button to view sample queries.
4.  Results are displayed securely, with input validation to prevent malicious queries.

### Supported SQL Queries

- `SELECT`: Retrieve data (e.g., `SELECT name, age FROM users WHERE age >= 18`)
- `INSERT`: Add data (e.g., `INSERT INTO users (name, age) VALUES ('Alice', 30)`)
- `UPDATE`: Modify data (e.g., `UPDATE users SET name = 'Bob' WHERE id = 1`)
- `DELETE`: Remove data (e.g., `DELETE FROM users WHERE age < 18`)

## Contributing

Contributions welcome! Please follow these steps:

1.  **Fork the Repository**:
    - Click "Fork" on the repository page to create your own copy.

2.  **Create a Branch**:

    ```
    git checkout -b your-feature-name
    ```

3.  **Make Changes**:
    - Add tests for new features or bug fixes.
    - Ensure all tests pass (`npm test`).

4.  **Commit Changes**:

    ```
    git commit -m "Add your-feature-name"
    ```

5.  **Push to Your Fork**:

    ```
    git push origin your-feature-name
    ```

6.  **Open a Pull Request**:
    - Go to the original repository and create a pull request from your branch.
    - Provide a clear description of your changes and reference any related issues.

### Code Style Guidelines

- Follow React best practices (e.g., functional components, hooks).
- Avoid introducing dependencies that could affect client-side performance.

### Security Guidelines for Contributors

## Issues

Found a bug or have a feature request? Open an issue on the [Issues page]https://github.com/eruity1/sql-to-orm/issues).

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/eruity1/sql-to-orm/blob/main/LICENSE) file for details.

## Acknowledgments

- Built with [React](https://reactjs.org/), [styled-components](https://styled-components.com/), and [lucide-react](https://lucide.dev/).
- Deployed on [Netlify](https://www.netlify.com/).
