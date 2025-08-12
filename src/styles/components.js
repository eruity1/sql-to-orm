import styled from "styled-components";
import {
  width,
  height,
  padding,
  margin,
  flex,
  fontSize,
  fontWeight,
  gap,
  textAlign,
  borderRadius,
  backgroundColor,
  position,
  overflow,
} from "./mixins";

export const Flex = styled.div`
  width: 100%;
  display: flex;

  ${width}
  ${height}
  ${padding}
  ${margin}
  ${flex}
  ${fontSize}
  ${fontWeight}
  ${borderRadius}
  ${backgroundColor}
  ${position}
`;

export const Text = styled.p`
  color: ${({ $color }) => {
    if ($color) return $color;
  }};
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;

  ${fontSize}
  ${fontWeight}
  ${padding}
  ${margin}
`;

export const TextArea = styled.textarea`
  width: 100%;
  border: 1px solid #374151;
  color: #ffffff;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  resize: none;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px #60a5fa;
  }

  &::placeholder {
    color: #9ca3af;
  }

  ${height}
  ${padding}
  ${backgroundColor}
  ${borderRadius}
  ${fontSize}
`;

export const Grid = styled.div`
  display: grid;

  ${gap}
`;

export const Button = styled.button`
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  color: #d1d5db;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;

  ${textAlign}
  ${fontSize}
  ${padding}
  ${borderRadius}
  ${backgroundColor}
  ${flex}

  background-color: ${({ $activeBackground }) => {
    if ($activeBackground) return $activeBackground;
  }};
`;

export const Pre = styled.pre`
  width: 100%;
  border: 1px solid #374151;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;

  ${height}
  ${margin}
  ${padding}
  ${borderRadius}
  ${fontSize}
  ${backgroundColor}
  ${overflow}
`;
