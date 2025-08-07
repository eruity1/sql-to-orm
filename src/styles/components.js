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
} from "./mixins";

const attrAsRem = (attr) => (attr || attr === 0 ? `${attr}rem` : null);

export const Flex = styled.div`
  width: 100%;
  display: flex;

  ${width}
  ${height}
  ${padding}
  ${flex}
  ${fontSize}
  ${fontWeight}
`;

export const Text = styled.p`
  color: ${({ $color }) => {
    if ($color) return $color;
  }};

  ${fontSize}
  ${fontWeight}
  ${padding}
  ${margin}
`;

export const SectionHeading = styled.div`
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
`;

export const TextArea = styled.textarea`
  width: 100%;
  height: 16rem;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #374151;
  background-color: #1f2937;
  color: #ffffff;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 0.875rem;
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
`;

export const Grid = styled.div`
  display: grid;

  ${gap}
`;

export const Button = styled.button`
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  background-color: #111827;
  color: #d1d5db;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #1f2937;
  }

  ${textAlign}
  ${fontSize}
`;
