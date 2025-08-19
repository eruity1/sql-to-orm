import Example from "./Example";
import { Flex } from "../styles/components";
import { EXAMPLES } from "../constants";

const Examples = ({ setSqlInput, showExamples }) => {
  return (
    <Flex $column $gap={0.5}>
      {EXAMPLES.map((example, idx) => (
        <Example
          key={idx}
          example={example}
          setSqlInput={setSqlInput}
          showExamples={showExamples}
        />
      ))}
    </Flex>
  );
};

export default Examples;
