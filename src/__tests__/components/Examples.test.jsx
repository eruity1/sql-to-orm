/* eslint-env jest */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Examples from "../../components/Examples";

jest.mock("../../styles/components", () => ({
  Flex: ({ children, $column, $gap, ...props }) => (
    <div
      data-testid="flex"
      style={{
        display: $column ? "flex" : undefined,
        flexDirection: $column ? "column" : undefined,
        gap: $gap ? `${$gap}rem` : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  ),
}));

jest.mock(
  "../../components/Example",
  () =>
    ({ example, setSqlInput, showExamples }) => (
      <div
        data-testid={`example-${example.name}`}
        onClick={() => {
          setSqlInput(example.sql);
          showExamples(false);
        }}
      >
        {example.name} - {example.sql}
      </div>
    )
);

jest.mock("../../constants", () => ({
  EXAMPLES: [
    {
      name: "Select Users",
      description: "Fetches all users",
      sql: "SELECT * FROM users",
    },
    {
      name: "Select Orders",
      description: "Fetches all orders",
      sql: "SELECT * FROM orders",
    },
  ],
}));

describe("Examples", () => {
  const mockSetSqlInput = jest.fn();
  const mockShowExamples = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders Flex container with correct styles", () => {
    render(
      <Examples setSqlInput={mockSetSqlInput} showExamples={mockShowExamples} />
    );
    const flex = screen.getByTestId("flex");
    expect(flex).toBeInTheDocument();
    expect(flex).toHaveStyle({
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
    });
  });

  test("renders Example components for each item in EXAMPLES", () => {
    render(
      <Examples setSqlInput={mockSetSqlInput} showExamples={mockShowExamples} />
    );
    expect(screen.getByTestId("example-Select Users")).toBeInTheDocument();
    expect(screen.getByTestId("example-Select Orders")).toBeInTheDocument();
    expect(
      screen.getByText("Select Users - SELECT * FROM users")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Select Orders - SELECT * FROM orders")
    ).toBeInTheDocument();
  });

  test("clicking an Example calls setSqlInput and showExamples", () => {
    render(
      <Examples setSqlInput={mockSetSqlInput} showExamples={mockShowExamples} />
    );
    const exampleUsers = screen.getByTestId("example-Select Users");
    fireEvent.click(exampleUsers);
    expect(mockSetSqlInput).toHaveBeenCalledWith("SELECT * FROM users");
    expect(mockShowExamples).toHaveBeenCalledWith(false);

    const exampleOrders = screen.getByTestId("example-Select Orders");
    fireEvent.click(exampleOrders);
    expect(mockSetSqlInput).toHaveBeenCalledWith("SELECT * FROM orders");
    expect(mockShowExamples).toHaveBeenCalledWith(false);
  });
});
