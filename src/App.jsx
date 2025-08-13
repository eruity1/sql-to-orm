import { useState, useCallback } from "react";

// Components
import InputSection from "./components/InputSection";
import OutputSection from "./components/OutputSection";

// Styles
import { Flex } from "./styles/components";
import GlobalStyle from "./styles/GlobalStyle";

// Helpers
import sqlParser from "./utils/sqlParser";
import generateActiveRecord from "./utils/activeRecord/generateActiveRecord";
import generateActiveRecordWithJoins from "./utils/activeRecord/generateActiveRecordJoins";
import generateSequelize from "./utils/generateSequelize";

function App() {
  const [sqlInput, setsqlInput] = useState("");
  const [activeTab, setActiveTab] = useState("activerecord");

  const generateOutput = useCallback(() => {
    if (!sqlInput.trim()) return;

    const parsedQuery = sqlParser(sqlInput);
    switch (activeTab) {
      case "activerecord":
        if (parsedQuery.joins && parsedQuery.joins.length > 0) {
          return generateActiveRecordWithJoins(parsedQuery);
        } else {
          return generateActiveRecord(parsedQuery);
        }
      case "sequelize":
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
