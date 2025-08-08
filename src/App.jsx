import { useState } from "react";
import InputSection from "./components/InputSection";
import OutputSection from "./components/OutputSection";
import { Flex } from "./styles/components";
import GlobalStyle from "./styles/GlobalStyle";

function App() {
  const [sqlInput, setsqlInput] = useState("");
  const [activeTab, setActiveTab] = useState("activerecord");

  return (
    <>
      <GlobalStyle />
      <Flex $minHeight="100vh">
        <Flex $maxWidth={80} $padding={1.5} $gap={0.75}>
          <InputSection sqlInput={sqlInput} setSqlInput={setsqlInput} />
          <OutputSection activeTab={activeTab} setActiveTab={setActiveTab} />
        </Flex>
      </Flex>
    </>
  );
}

export default App;
