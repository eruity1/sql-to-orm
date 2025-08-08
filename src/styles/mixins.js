import { css } from "styled-components";

const attrAsRem = (attr) => (attr || attr === 0 ? `${attr}rem` : null);

export const width = css`
  width: ${({ $width, $maxWidth, $minWidth, $fitContent }) => {
    const widthType = typeof $width;

    if ($fitContent) return "fit-content";
    if ($width && widthType === "string") {
      return $width;
    } else if ($width && widthType === "number") {
      return attrAsRem(width);
    } else if (!$width && ($maxWidth || $minWidth)) {
      return "100%";
    }
  }};
  max-width: ${({ $maxWidth }) =>
    $maxWidth &&
    css`
      max-width: ${attrAsRem($maxWidth)};
    `};
  min-width: ${({ $minWidth }) => {
    const minWidthType = typeof $minWidth;

    if ($minWidth && minWidthType === "string") {
      return $minWidth;
    } else if ($minWidth && minWidthType === "number") {
      return attrAsRem($minWidth);
    }
  }};
`;

export const height = css`
  height: ${({ $height }) => {
    const heightType = typeof $height;
    if ($height && heightType === "string") {
      return $height;
    } else if ($height && heightType === "number") {
      return attrAsRem($height);
    }
  }};
  max-height: ${({ $maxHeight }) => {
    const heightType = typeof $maxHeight;
    if ($maxHeight && heightType === "number") return attrAsRem($maxHeight);
    return $maxHeight;
  }};
  min-height: ${({ $minHeight }) => {
    const minHeightType = typeof $minHeight;

    if ($minHeight && minHeightType === "string") {
      return $minHeight;
    } else if ($minHeight && minHeightType === "number") {
      return attrAsRem($minHeight);
    }
  }};
`;

export const padding = css`
  padding: ${({ $padding, $customPadding }) => {
    if ($padding) return attrAsRem($padding);
    if ($customPadding) return $customPadding;
  }};
  padding-bottom: ${({ $paddingBottom }) => attrAsRem($paddingBottom)};
  padding-top: ${({ $paddingTop }) => attrAsRem($paddingTop)};
  padding-left: ${({ $paddingLeft }) => attrAsRem($paddingLeft)};
  padding-right: ${({ $paddingRight }) => attrAsRem($paddingRight)};
`;

export const margin = css`
  margin: ${({ $margin }) => attrAsRem($margin)};
  margin-bottom: ${({ $marginBottom }) => attrAsRem($marginBottom)};
  margin-top: ${({ $marginTop }) => attrAsRem($marginTop)};
  margin-left: ${({ $marginLeft }) => attrAsRem($marginLeft)};
  margin-right: ${({ $marginRight }) => attrAsRem($marginRight)};
`;

export const flex = css`
  display: flex;
  flex-direction: ${({
    $direction,
    $row,
    $column,
    $rowReverse,
    $columnReverse,
  }) => {
    if ($direction) return $direction;
    if ($row) return "row";
    if ($column) return "column";
    if ($rowReverse) return "row-reverse";
    if ($columnReverse) return "column-reverse";
  }};
  flex: ${({ $flex }) => $flex};
  align-self: ${({
    $alignSelfStart,
    $alignSelfCenter,
    $alignSelfEnd,
    $alignSelfStretch,
  }) => {
    if ($alignSelfStart) return "flex-start";
    if ($alignSelfCenter) return "center";
    if ($alignSelfEnd) return "flex-end";
    if ($alignSelfStretch) return "stretch";
  }};
  align-items: ${({
    $alignItems,
    $alignItemsStart,
    $alignItemsCenter,
    $alignItemsEnd,
    $alignItemsBaseline,
    $alignItemsStretch,
  }) => {
    if ($alignItemsBaseline) return "baseline";
    if ($alignItems) return $alignItems;
    if ($alignItemsStart) return "flex-start";
    if ($alignItemsCenter) return "center";
    if ($alignItemsEnd) return "flex-end";
    if ($alignItemsStretch) return "stretch";
  }};
  align-content: ${({
    alignContent,
    alignContentStart,
    alignContentEnd,
    alignContentCenter,
    alignContentBetween,
    alignContentAround,
  }) => {
    if (alignContent) return alignContent;
    if (alignContentStart) return "flex-start";
    if (alignContentEnd) return "flex-end";
    if (alignContentCenter) return "center";
    if (alignContentBetween) return "space-between";
    if (alignContentAround) return "space-around";
  }};
  justify-content: ${({
    $justifyContent,
    $justifyStart,
    $justifyCenter,
    $justifyEnd,
    $justifyBetween,
    $justifyEvenly,
    $justifyAround,
  }) => {
    if ($justifyContent) return $justifyContent;
    if ($justifyStart) return "flex-start";
    if ($justifyCenter) return "center";
    if ($justifyEnd) return "flex-end";
    if ($justifyBetween) return "space-between";
    if ($justifyEvenly) return "space-evenly";
    if ($justifyAround) return "space-around";
  }};
  flex-wrap: ${({ $flexWrap, $flexNoWrap, $flexWrapReverse }) => {
    if ($flexWrap) return "wrap";
    if ($flexNoWrap) return "nowrap";
    if ($flexWrapReverse) return "wrap-reverse";
  }};
  gap: ${({ $gap }) => attrAsRem($gap)};
`;

export const gap = css`
  gap: ${({ $gap }) => attrAsRem($gap)};
`;

export const fontSize = css`
  font-size: ${({ $fontSize }) => attrAsRem($fontSize)};
`;

export const fontWeight = css`
  font-weight: ${({
    $fontWeight,
    $lightWeight,
    $mediumWeight,
    $boldWeight,
  }) => {
    if ($fontWeight) return $fontWeight;
    if ($lightWeight) return 400;
    if ($mediumWeight) return 500;
    if ($boldWeight) return 600;
  }};
`;

export const textAlign = css`
  text-align: ${({ $textAlignCenter, $textAlignLeft, $textAlignRight }) => {
    if ($textAlignCenter) return "center";
    if ($textAlignLeft) return "left";
    if ($textAlignRight) return "right";
  }};
`;

export const borderRadius = css`
  border-radius: ${({ $borderRadius, $borderRadiusRound }) => {
    if ($borderRadiusRound) return "100%";
    if ($borderRadius) return attrAsRem($borderRadius);
  }};
`;

export const backgroundColor = css`
  background-color: ${({ $backgroundColor }) => {
    if ($backgroundColor) return $backgroundColor;
  }};
  &:hover {
    background-color: ${({ $hoverBackground }) => {
      if ($hoverBackground) return $hoverBackground;
    }};
  }
`;

export const position = css`
  position: ${({
    $position,
    $positionRelative,
    $positionAbsolute,
    $positionFixed,
  }) => {
    if ($position) return $position;
    if ($positionRelative) return "relative";
    if ($positionAbsolute) return "absolute";
    if ($positionFixed) return "fixed";
  }};
  top: ${({ $top }) => attrAsRem($top)};
  bottom: ${({ $bottom }) => attrAsRem($bottom)};
  right: ${({ $right }) => attrAsRem($right)};
  left: ${({ $left }) => attrAsRem($left)};
`;

export const overflow = css`
  overflow-y: ${({ $overflow, $overflowAuto, $overflowHidden }) => {
    if ($overflow) return $overflow;
    if ($overflowAuto) return "auto";
    if ($overflowHidden) return "hidden";
  }};
`;
