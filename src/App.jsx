import { useState, useCallback } from "react";

// Components
import InputSection from "./components/InputSection";
import OutputSection from "./components/OutputSection";

// Styles
import { Flex } from "./styles/components";
import GlobalStyle from "./styles/GlobalStyle";

// Helpers
import sqlParser from "./utils/sqlParser";
import generateActiveRecord from "./utils/generateActiveRecord";

function App() {
  const [sqlInput, setsqlInput] = useState("");
  const [activeTab, setActiveTab] = useState("activerecord");

  const generateOutput = useCallback(() => {
    if (!sqlInput.trim()) return;

    const parsedQuery = sqlParser(sqlInput);
    switch (activeTab) {
      case "activerecord":
        return generateActiveRecord(parsedQuery);
    }
  });

  return (
    <>
      <GlobalStyle />
      <Flex $minHeight="100vh">
        <Flex $maxWidth={80} $padding={1.5} $gap={0.75}>
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
