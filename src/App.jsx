import { useState, useCallback } from "react";
import InputSection from "./components/InputSection";
import { Container, Main } from "./styles/components";

function App() {
  const [sqlInput, setsqlInput] = useState("");

  return (
    <Container>
      <Main>
        <InputSection sqlInput={sqlInput} setSqlInput={setsqlInput} />
      </Main>
    </Container>
  );
}

export default App;
