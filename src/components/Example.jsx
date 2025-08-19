import { Flex, Text } from "../styles/components";

const Example = ({ example, setSqlInput, showExamples }) => {
  const { name, description, sql } = example;

  const selectExample = () => {
    setSqlInput(sql);
    showExamples(false);
  };

  return (
    <Flex
      $column
      $gap={0.375}
      $backgroundColor="#374151"
      $hoverBackground="#435064"
      $borderRadius={0.25}
      $padding={0.375}
      onClick={selectExample}
    >
      <Text>{name}</Text>
      <Text $fontSize={0.675} $color="#939593" $lightWeight>
        {description}
      </Text>
      <code style={{ color: "#3b82f6" }}>{sql}</code>
    </Flex>
  );
};

export default Example;
