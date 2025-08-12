import { Code2 } from "lucide-react";
import { Button, Flex, Grid, Text, TextArea } from "../styles/components";

const EXAMPLE_QUERIES = [
  "SELECT * FROM users WHERE name = 'Fred'",
  "SELECT * FROM users WHERE name = 'Fred' AND age = 25",
  "SELECT * FROM users WHERE age > 18 AND team = 'nuggets' OR team = 'jazz'",
  "INSERT INTO users (name, age) VALUES ('Bob', 30)",
  "UPDATE users SET name = 'Bob', age = 31 WHERE id = 1",
  "DELETE FROM users WHERE id = 1",
];

const InputSection = ({ sqlInput, setSqlInput }) => {
  return (
    <Flex $column $gap={1}>
      <Flex $alignItemsCenter $justifyBetween>
        <Flex $alignItemsCenter $gap={0.5}>
          <Code2 size={20} color="#3b82f6" />
          <Flex $fontSize={1.125} $boldWeight>
            SQL Query
          </Flex>
        </Flex>
      </Flex>
      <Flex $column $gap={0.5}>
        <TextArea
          name="SQL Input"
          value={sqlInput}
          onChange={(e) => setSqlInput(e.target.value)}
          placeholder="Paste your SQL query here..."
          $height={19.75}
          $padding={1}
          $backgroundColor="#1f2937"
          $borderRadius={0.5}
          $fontSize={0.875}
        />
        <Flex $column $gap={0.5}>
          <Text $fontSize={0.875} $color="#d1d5db">
            Try these examples
          </Text>
          <Grid $gap={0.5}>
            {EXAMPLE_QUERIES.map((query, idx) => (
              <Button
                key={idx}
                onClick={() => setSqlInput(query)}
                $textAlignLeft
                $fontSize={0.875}
                $customPadding="0.25rem 0.75rem"
                $borderRadius={0.5}
                $backgroundColor="#1f2937"
                $hoverBackground="#1e3a8a"
              >
                {query.length > 80 ? `${query.substring(0, 80)}...` : query}
              </Button>
            ))}
          </Grid>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default InputSection;
