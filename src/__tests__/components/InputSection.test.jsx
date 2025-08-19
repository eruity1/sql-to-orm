import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import InputSection from "../../components/InputSection";

jest.mock("lucide-react", () => ({
  ChevronDown: ({ style }) => (
    <div data-testid="chevron-down" style={style}>
      ChevronDown
    </div>
  ),
  Code2: ({ size, color }) => (
    <div
      data-testid="code2-icon"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      Code2
    </div>
  ),
}));

jest.mock("../../styles/components", () => ({
  Flex: ({
    children,
    $column,
    $height,
    $gap,
    $marginTop,
    $alignItemsCenter,
    $fontSize,
    $boldWeight,
    $backgroundColor,
    $borderRadius,
    $padding,
    $overflowScroll,
    $justifyBetween,
    ...props
  }) => (
    <div
      data-testid="flex"
      style={{
        display: $column ? "flex" : undefined,
        height: $height ? `${$height}rem` : undefined,
        flexDirection: $column ? "column" : undefined,
        gap: $gap ? `${$gap}rem` : undefined,
        marginTop: $marginTop ? `${$marginTop}rem` : undefined,
        alignItems: $alignItemsCenter ? "center" : undefined,
        fontSize: $fontSize ? `${$fontSize}rem` : undefined,
        fontWeight: $boldWeight ? "bold" : undefined,
        backgroundColor: $backgroundColor,
        borderRadius: $borderRadius ? `${$borderRadius}rem` : undefined,
        padding: $padding ? `${$padding}rem` : undefined,
        overflow: $overflowScroll ? "scroll" : undefined,
        justifyContent: $justifyBetween ? "space-between" : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  ),
  Button: ({
    children,
    $flex,
    $alignItemsCenter,
    $padding,
    $color,
    $borderRadius,
    $fontSize,
    $boldWeight,
    $backgroundColor,
    $hoverBackground,
    ...props
  }) => (
    <button
      data-testid="button"
      style={{
        flex: $flex,
        color: $color ? $color : undefined,
        alignItems: $alignItemsCenter ? "center" : undefined,
        padding: $padding || ($padding ? `${$padding}rem` : undefined),
        borderRadius: $borderRadius ? `${$borderRadius}rem` : undefined,
        fontSize: $fontSize ? `${$fontSize}rem` : undefined,
        fontWeight: $boldWeight ? "600" : undefined,
        backgroundColor: $hoverBackground || undefined,
      }}
      {...props}
    >
      {children}
    </button>
  ),
  TextArea: ({
    value,
    onChange,
    placeholder,
    $height,
    $padding,
    $backgroundColor,
    $borderRadius,
    $fontSize,
    ...props
  }) => (
    <textarea
      data-testid="textarea"
      style={{
        height: $height ? `${$height}rem` : undefined,
        padding: $padding || ($padding ? `${$padding}rem` : undefined),
        borderRadius: $borderRadius ? `${$borderRadius}rem` : undefined,
        fontSize: $fontSize ? `${$fontSize}rem` : undefined,
      }}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...props}
    />
  ),
}));

jest.mock("../../components/Examples", () => ({ showExamples }) => (
  <div data-testid="examples">
    Examples Component
    <button data-testid="close-examples" onClick={() => showExamples(false)}>
      Close
    </button>
  </div>
));

describe("InputSection", () => {
  const mockSetSqlInput = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders header with Code2 icon, SQL Query text, and Examples button", () => {
    render(<InputSection sqlInput="" setSqlInput={mockSetSqlInput} />);

    expect(screen.getByTestId("code2-icon")).toBeInTheDocument();
    expect(screen.getByText("SQL Query")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toHaveTextContent("Examples");
    expect(screen.getByTestId("chevron-down")).toBeInTheDocument();
  });

  test("renders TextArea when showExamples is false", () => {
    render(
      <InputSection
        sqlInput="SELECT * FROM users"
        setSqlInput={mockSetSqlInput}
      />
    );

    const textarea = screen.getByTestId("textarea");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("SELECT * FROM users");
    expect(textarea).toHaveAttribute(
      "placeholder",
      "Paste your SQL query here..."
    );
    expect(screen.queryByTestId("examples")).not.toBeInTheDocument();
  });

  test("renders Examples component when showExamples is true", () => {
    render(<InputSection sqlInput="" setSqlInput={mockSetSqlInput} />);
    fireEvent.click(screen.getByTestId("button"));

    expect(screen.getByTestId("examples")).toBeInTheDocument();
    expect(screen.getByText("Examples Component")).toBeInTheDocument();
    expect(screen.queryByTestId("textarea")).not.toBeInTheDocument();
  });

  test("toggles between TextArea and Examples when Examples button is clicked", () => {
    render(<InputSection sqlInput="" setSqlInput={mockSetSqlInput} />);

    expect(screen.getByTestId("textarea")).toBeInTheDocument();
    expect(screen.queryByTestId("examples")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button"));
    expect(screen.getByTestId("examples")).toBeInTheDocument();
    expect(screen.queryByTestId("textarea")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button"));
    expect(screen.getByTestId("textarea")).toBeInTheDocument();
    expect(screen.queryByTestId("examples")).not.toBeInTheDocument();
  });

  test("rotates ChevronDown icon when showExamples changes", () => {
    render(<InputSection sqlInput="" setSqlInput={mockSetSqlInput} />);

    const chevron = screen.getByTestId("chevron-down");
    expect(chevron).toHaveStyle({ rotate: "" });

    fireEvent.click(screen.getByTestId("button"));
    expect(chevron).toHaveStyle({ rotate: "180deg" });
  });

  test("calls setSqlInput when TextArea value changes", () => {
    render(<InputSection sqlInput="" setSqlInput={mockSetSqlInput} />);

    const textarea = screen.getByTestId("textarea");
    fireEvent.change(textarea, { target: { value: "SELECT name FROM users" } });

    expect(mockSetSqlInput).toHaveBeenCalledWith("SELECT name FROM users");
  });

  test("closes Examples when close button is clicked in Examples component", () => {
    render(<InputSection sqlInput="" setSqlInput={mockSetSqlInput} />);

    fireEvent.click(screen.getByTestId("button"));
    expect(screen.getByTestId("examples")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("close-examples"));
    expect(screen.getByTestId("textarea")).toBeInTheDocument();
    expect(screen.queryByTestId("examples")).not.toBeInTheDocument();
  });
});
