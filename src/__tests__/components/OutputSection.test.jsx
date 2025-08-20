/* eslint-env jest */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import OutputSection from "../../components/OutputSection";

jest.mock("lucide-react", () => ({
  Lightbulb: ({ size, color }) => (
    <div
      data-testid="lightbulb-icon"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      Lightbulb
    </div>
  ),
  Copy: ({ size, color, strokeWidth }) => (
    <div
      data-testid="copy-icon"
      style={{ width: size, height: size, backgroundColor: color, strokeWidth }}
    >
      Copy
    </div>
  ),
  Check: ({ size, color, strokeWidth }) => (
    <div
      data-testid="check-icon"
      style={{ width: size, height: size, backgroundColor: color, strokeWidth }}
    >
      Check
    </div>
  ),
}));

jest.mock("../../styles/components", () => ({
  Flex: ({
    children,
    $column,
    $gap,
    $marginTop,
    $alignItemsCenter,
    $fontSize,
    $boldWeight,
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
        marginTop: $marginTop ? `${$marginTop}rem` : undefined,
        alignItems: $alignItemsCenter ? "center" : undefined,
        fontSize: $fontSize ? `${$fontSize}rem` : undefined,
        fontWeight: $boldWeight ? "bold" : undefined,
        backgroundColor: $backgroundColor,
        borderRadius: $borderRadius ? `${$borderRadius}rem` : undefined,
        padding: $padding ? `${$padding}rem` : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  ),
  Button: ({
    children,
    $flex,
    $customPadding,
    $borderRadius,
    $fontSize,
    $mediumWeight,
    $backgroundColor,
    $activeBackground,
    $positionAbsolute,
    $top,
    $right,
    $padding,
    $alignItemsCenter,
    $justifyCenter,
    ...props
  }) => (
    <button
      data-testid="button"
      style={{
        flex: $flex,
        padding: $customPadding || ($padding ? `${$padding}rem` : undefined),
        borderRadius: $borderRadius ? `${$borderRadius}rem` : undefined,
        fontSize: $fontSize ? `${$fontSize}rem` : undefined,
        fontWeight: $mediumWeight ? "500" : undefined,
        backgroundColor: $activeBackground || $backgroundColor,
        position: $positionAbsolute ? "absolute" : undefined,
        top: $top ? `${$top}rem` : undefined,
        right: $right ? `${$right}rem` : undefined,
        alignItems: $alignItemsCenter ? "center" : undefined,
        justifyContent: $justifyCenter ? "center" : undefined,
      }}
      {...props}
    >
      {children}
    </button>
  ),
  Pre: ({
    children,
    $height,
    $padding,
    $borderRadius,
    $overflowAuto,
    $fontSize,
    $backgroundColor,
    ...props
  }) => (
    <pre
      data-testid="pre"
      style={{
        height: $height ? `${$height}rem` : undefined,
        padding: $padding ? `${$padding}rem` : undefined,
        borderRadius: $borderRadius ? `${$borderRadius}rem` : undefined,
        overflow: $overflowAuto ? "auto" : undefined,
        fontSize: $fontSize ? `${$fontSize}rem` : undefined,
        backgroundColor: $backgroundColor,
      }}
      {...props}
    >
      {children}
    </pre>
  ),
}));

jest.mock("../../constants", () => ({
  TABS: [
    { id: "sequelize", name: "Sequelize" },
    { id: "activerecord", name: "ActiveRecord" },
  ],
}));

const mockClipboardWriteText = jest.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockClipboardWriteText,
  },
});

describe("OutputSection", () => {
  const mockSetActiveTab = jest.fn();
  const mockGenerateOutput = jest.fn(
    () => 'const User = sequelize.define("User", {});'
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders header with Lightbulb icon and ORM Code text", () => {
    render(
      <OutputSection
        activeTab="sequelize"
        setActiveTab={mockSetActiveTab}
        generateOutput={mockGenerateOutput}
      />
    );
    expect(screen.getByTestId("lightbulb-icon")).toBeInTheDocument();
    expect(screen.getByText("ORM Code")).toBeInTheDocument();
  });

  test("renders tabs with correct names and active state", () => {
    render(
      <OutputSection
        activeTab="sequelize"
        setActiveTab={mockSetActiveTab}
        generateOutput={mockGenerateOutput}
      />
    );
    const buttons = screen.getAllByTestId("button");
    expect(buttons).toHaveLength(3);
    expect(screen.getByText("Sequelize")).toBeInTheDocument();
    expect(screen.getByText("ActiveRecord")).toBeInTheDocument();
    expect(buttons[0]).toHaveStyle({ backgroundColor: "#581c87" });
    expect(buttons[1]).toHaveStyle({ backgroundColor: "#1f2937" });
  });

  test("calls setActiveTab when a tab is clicked", () => {
    render(
      <OutputSection
        activeTab="sequelize"
        setActiveTab={mockSetActiveTab}
        generateOutput={mockGenerateOutput}
      />
    );
    const activeRecordButton = screen.getByText("ActiveRecord");
    fireEvent.click(activeRecordButton);
    expect(mockSetActiveTab).toHaveBeenCalledWith("activerecord");
  });

  test("renders Pre with output from generateOutput", () => {
    render(
      <OutputSection
        activeTab="sequelize"
        setActiveTab={mockSetActiveTab}
        generateOutput={mockGenerateOutput}
      />
    );
    const pre = screen.getByTestId("pre");
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent('const User = sequelize.define("User", {});');
    expect(pre).toHaveStyle({
      height: "16rem",
      padding: "1rem",
      borderRadius: "0.5rem",
      overflow: "auto",
      fontSize: "0.875rem",
      backgroundColor: "#1f2937",
    });
  });

  test("applies correct styles to copy button", () => {
    render(
      <OutputSection
        activeTab="sequelize"
        setActiveTab={mockSetActiveTab}
        generateOutput={mockGenerateOutput}
      />
    );
    const copyButton = screen
      .getAllByTestId("button")
      .find((button) => button.title === "Copy to clipboard");
    expect(copyButton).toHaveStyle({
      position: "absolute",
      top: "0.75rem",
      right: "0.75rem",
      padding: "0.5rem",
      borderRadius: "0.375rem",
      backgroundColor: "#f3f4f6",
    });
  });
});
