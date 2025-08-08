import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  line-height: 1.5;
  background-color: #111827;
  color: #ffffff;
  transition: background-color 0.3s ease, color 0.3s ease;
}
`;

export default GlobalStyle;
