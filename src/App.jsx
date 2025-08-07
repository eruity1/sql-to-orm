import { useState } from "react";
import InputSection from "./components/InputSection";
import { Flex } from "./styles/components";
import GlobalStyle from "./styles/GlobalStyle";

function App() {
  const [sqlInput, setsqlInput] = useState("");

  return (
    <>
      <GlobalStyle />
      <Flex $minHeight="100vh">
        <Flex $padding={1.5}>
          <InputSection sqlInput={sqlInput} setSqlInput={setsqlInput} />
        </Flex>
      </Flex>
    </>
  );
}

export default App;
