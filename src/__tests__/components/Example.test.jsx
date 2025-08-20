/* eslint-env jest */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Example from "../../components/Example";

jest.mock("../../styles/components", () => ({
  Flex: ({
    children,
    $column,
    $gap,
    $backgroundColor,
    $borderRadius,
    $padding,
    ...props
  }) => (
    <div
      data-testid="flex"
      style={{
        display: $column ? "flex" : undefined,
        flexDirection: $column ? "column" : undefined,
        gap: $gap ? `${$gap}rem` : undefined,
        backgroundColor: $backgroundColor,
        borderRadius: $borderRadius ? `${$borderRadius}rem` : undefined,
        padding: $padding ? `${$padding}rem` : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  ),
  Text: ({ children, $fontSize, $color, $lightWeight, ...props }) => (
    <p
      data-testid="text"
      style={{
        fontSize: $fontSize ? `${$fontSize}rem` : undefined,
        color: $color,
        fontWeight: $lightWeight ? "lighter" : undefined,
      }}
      {...props}
    >
      {children}
    </p>
  ),
}));

describe("Example", () => {
  const mockSetSqlInput = jest.fn();
  const mockShowExamples = jest.fn();
  const example = {
    name: "Select users by name",
    description: "Selects all the users with given name in the database",
    sql: "SELECT * FROM users WHERE name = 'Bob'",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders example name, description, and SQL query", () => {
    render(
      <Example
        example={example}
        setSqlInput={mockSetSqlInput}
        showExamples={mockShowExamples}
      />
    );

    expect(screen.getByTestId("flex")).toBeInTheDocument();
    expect(screen.getAllByTestId("text")[0]).toHaveTextContent(
      "Select users by name"
    );
    expect(screen.getAllByTestId("text")[1]).toHaveTextContent(
      "Selects all the users with given name in the database"
    );
    expect(
      screen.getByText("SELECT * FROM users WHERE name = 'Bob'")
    ).toBeInTheDocument();
  });

  test("applies correct styles to Flex and Text components", () => {
    render(
      <Example
        example={example}
        setSqlInput={mockSetSqlInput}
        showExamples={mockShowExamples}
      />
    );

    const flex = screen.getByTestId("flex");
    expect(flex).toHaveStyle({
      display: "flex",
      flexDirection: "column",
      gap: "0.375rem",
      backgroundColor: "#374151",
      borderRadius: "0.25rem",
      padding: "0.375rem",
    });

    const descriptionText = screen.getAllByTestId("text")[1];
    expect(descriptionText).toHaveStyle({
      fontSize: "0.675rem",
      color: "#939593",
      fontWeight: "lighter",
    });

    const sqlCode = screen.getByText("SELECT * FROM users WHERE name = 'Bob'");
    expect(sqlCode).toHaveStyle({ color: "#3b82f6" });
  });

  test("calls setSqlInput and showExamples on click", () => {
    render(
      <Example
        example={example}
        setSqlInput={mockSetSqlInput}
        showExamples={mockShowExamples}
      />
    );

    const flex = screen.getByTestId("flex");
    fireEvent.click(flex);

    expect(mockSetSqlInput).toHaveBeenCalledWith(
      "SELECT * FROM users WHERE name = 'Bob'"
    );
    expect(mockShowExamples).toHaveBeenCalledWith(false);
  });
});
