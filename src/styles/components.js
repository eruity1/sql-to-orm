import styled from "styled-components";

export const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex: 1;
  transition: all 0.3s ease;
`;

export const Main = styled.div`
  max-width: 80rem;
  margin: 0 auto;
  padding: 1.5rem;
`;

export const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  color: #fffff;
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

export const ExamplesSection = styled.div`
  display: flex;
  flex-dircetion: column;
  gap: 0.5rem;
`;

export const ExamplesLabel = styled.p`
  font-size: 0.875rem;
  color: #d1d5db;
  margin: 0;
`;

export const Grid = styled.div`
  display: grid;
  gap: 0.5rem;
`;

export const Button = styled.button`
  padding: 0.25 0.75rem;
  border-radius: 0.5rem;
  text-align: eft;
  font-size: 0.875rem;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  background-color: #111827;
  color: #d1d5db;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #1f2937;
  }
`;
