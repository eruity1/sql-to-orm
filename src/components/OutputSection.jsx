import { useState } from "react";

import { Lightbulb, Copy, Check } from "lucide-react";
import { Flex, Button, Pre } from "../styles/components";

import { TABS } from "../constants";

const OutputSection = ({ activeTab, setActiveTab, generateOutput }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Flex $column $gap={1} $marginTop={0.5}>
      <Flex $alignItemsCenter $gap={0.5}>
        <Lightbulb size={20} color="#8b5cf6" />
        <Flex $fontSize={1.125} $boldWeight>
          ORM Code
        </Flex>
      </Flex>
      <Flex
        $backgroundColor="#1f2937"
        $borderRadius={0.5}
        $padding={0.25}
        $gap={0.25}
      >
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            $flex={1}
            $customPadding="0.5rem 1rem"
            $borderRadius={0.375}
            $fontSize={0.875}
            $mediumWeight
            $backgroundColor="#1f2937"
            $hoverBackground="#8b5cf6"
            $activeBackground={activeTab === tab.id ? "#581c87" : null}
          >
            {tab.name}
          </Button>
        ))}
      </Flex>
      <div style={{ position: "relative" }}>
        <Pre
          $height={16}
          $padding={1}
          $borderRadius={0.5}
          $overflowAuto
          $fontSize={0.875}
          $backgroundColor="#1f2937"
        >
          <code>{generateOutput()}</code>
        </Pre>
        <Button
          onClick={() => copyToClipboard(generateOutput())}
          title="Copy to clipboard"
          $positionAbsolute
          $top={0.75}
          $right={0.75}
          $padding={0.5}
          $borderRadius={0.375}
          $backgroundColor="#f3f4f6"
          $alignItemsCenter
          $justifyCenter
          $hoverBackground="#e5e7eb"
        >
          {copied ? (
            <Check strokeWidth={3} size={16} color="#34d399" />
          ) : (
            <Copy strokeWidth={3} size={16} color="#9ca3af" />
          )}
        </Button>
      </div>
    </Flex>
  );
};

export default OutputSection;
