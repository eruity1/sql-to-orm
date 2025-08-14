import { useState, useCallback } from "react";

// Components
import InputSection from "./components/InputSection";
import OutputSection from "./components/OutputSection";

// Styles
import { Flex } from "./styles/components";
import GlobalStyle from "./styles/GlobalStyle";

// Helpers
import sqlParser from "./utils/sqlParser";
import generateSequelize from "./utils/generateSequelize";
import { ORM_MAPPINGS } from "./constants";
import { ActiveRecordGenerator } from "./generators/activeRecordGenerator";

function App() {
  const [sqlInput, setsqlInput] = useState("");
  const [activeTab, setActiveTab] = useState("activerecord");

  const generateOutput = useCallback(() => {
    if (!sqlInput.trim()) return;

    const parsedQuery = sqlParser(sqlInput);
    switch (activeTab) {
      case ORM_MAPPINGS.ACTIVE_RECORD:
        const activeRecordGenerator = new ActiveRecordGenerator();
        return activeRecordGenerator.generateQuery(parsedQuery);
      case ORM_MAPPINGS.SEQUELIZE:
        return generateSequelize(parsedQuery);
    }
  });

  return (
    <>
      <GlobalStyle />
      <Flex $minHeight="100vh">
        <Flex $maxWidth={80} $padding={1.5} $gap={0.75} $column>
          <InputSection sqlInput={sqlInput} setSqlInput={setsqlInput} />
          <OutputSection
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            generateOutput={generateOutput}
          />
        </Flex>
      </Flex>
    </>
  );
}

export default App;
