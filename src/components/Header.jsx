import { Database, Github } from "lucide-react";
import { Flex, Link, Text } from "../styles/components";

const Header = () => {
  return (
    <Flex $justifyBetween>
      <Flex $gap={0.875}>
        <Database color="#eab308" />
        <Flex $column $alignItemsStart>
          <Flex $fontSize={1.25} $boldWeight>
            SQL To ORM
          </Flex>
          <Text $fontSize={0.675} $color="#939593" $lightWeight>
            Convert SQL queries to ORM code
          </Text>
        </Flex>
      </Flex>
      <Flex $justifyEnd $alignItemsCenter>
        <Link
          href="https://github.com/eruity1/sql-to-orm"
          target="_blank"
          title="Contribute on GitHub"
          $color="#939593"
          $hoverColor="#c7c7c7"
        >
          <Github />
        </Link>
      </Flex>
    </Flex>
  );
};

export default Header;
