import { useState } from "react";
import { ChevronDown, Code2 } from "lucide-react";
import DOMPurify from "dompurify";

import { Button, Flex, TextArea } from "../styles/components";
import Examples from "./Examples";

const InputSection = ({ sqlInput, setSqlInput }) => {
  const [showExamples, setShowExamples] = useState(false);

  const sanitizeAndSetInput = (sql) => {
    const sanitizedSql = DOMPurify.sanitize(sql);
    setSqlInput(sanitizedSql);
  };

  const showExamplesHandler = () => setShowExamples((prev) => !prev);

  const renderMainContent = () => {
    if (showExamples) {
      return (
        <Examples setSqlInput={setSqlInput} showExamples={setShowExamples} />
      );
    } else {
      return (
        <TextArea
          name="SQL Input"
          value={sqlInput}
          onChange={(e) => sanitizeAndSetInput(e.target.value)}
          placeholder="Paste your SQL query here..."
          $height={19.75}
          $padding={1}
          $backgroundColor="#1f2937"
          $borderRadius={0.5}
          $fontSize={0.875}
        />
      );
    }
  };

  return (
    <Flex $column $gap={1}>
      <Flex $alignItemsCenter $justifyBetween>
        <Flex $justifyBetween>
          <Flex $alignItemsCenter $gap={0.5}>
            <Code2 size={20} color="#3b82f6" />
            <Flex $fontSize={1.125} $boldWeight>
              SQL Query
            </Flex>
          </Flex>
          <Button
            $color="#3d82f6"
            $borderRadius={0.25}
            $padding={0.75}
            $alignItemsCenter
            $boldWeight
            $hoverBackground="#1f2937"
            onClick={showExamplesHandler}
          >
            Examples
            <ChevronDown
              style={{
                paddingLeft: "2px",
                rotate: showExamples ? "180deg" : "",
                transition: "rotate 0.25s ease-in-out",
              }}
            />
          </Button>
        </Flex>
      </Flex>
      <Flex $column $gap={0.5} $height={20} $overflowScroll>
        {renderMainContent()}
      </Flex>
    </Flex>
  );
};

export default InputSection;
