import { Code2 } from "lucide-react";
import {
  Button,
  ExamplesLabel,
  ExamplesSection,
  Grid,
  Section,
  SectionHeader,
  SectionHeading,
  SectionTitle,
  TextArea,
} from "../styles/components";

const EXAMPLE_QUERIES = ["SELECT * FROM users WHERE age > 18"];

const InputSection = ({ sqlInput, setSqlInput }) => {
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <Code2 size={20} color="#3b82f6" />
          <SectionHeading>SQL Query</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <div>
        <TextArea
          value={sqlInput}
          onChange={(e) => setSqlInput(e.target.value)}
          placeholder="Paste your SQL query here..."
        />
        <ExamplesSection>
          <ExamplesLabel>Try these examples</ExamplesLabel>
          <Grid>
            {EXAMPLE_QUERIES.map((query, idx) => (
              <Button key={idx} onClick={() => setSqlInput(query)}>
                {query.length > 80 ? `${query.substring(0, 80)}...` : query}
              </Button>
            ))}
          </Grid>
        </ExamplesSection>
      </div>
    </Section>
  );
};

export default InputSection;
