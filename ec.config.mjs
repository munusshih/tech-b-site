import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { defineEcConfig } from "astro-expressive-code";

const paper = "#f2effc";
const ink = "#182f36";
const purple = "#6f56bb";
const purpleBar = "#e1daf2";

export default defineEcConfig({
  themes: ["github-light"],
  useDarkModeMediaQuery: false,
  useStyleReset: true,
  plugins: [pluginLineNumbers()],
  frames: {
    showCopyToClipboardButton: true,
  },
  defaultProps: {
    frame: "code",
    showLineNumbers: true,
    title: "Code",
    overridesByLang: {
      "js,javascript": { title: "JavaScript" },
      "ts,typescript": { title: "TypeScript" },
      html: { title: "HTML" },
      css: { title: "CSS" },
      "bash,sh,shell,zsh": { title: "Shell" },
      json: { title: "JSON" },
    },
  },
  styleOverrides: {
    borderColor: ink,
    borderRadius: "0px",
    borderWidth: "1px",
    codeBackground: paper,
    codeForeground: ink,
    codeFontSize: "1rem",
    codeLineHeight: "1.55",
    codePaddingBlock: "1rem",
    codePaddingInline: "0.85rem",
    gutterBorderColor: purple,
    uiFontSize: "1rem",
    uiFontWeight: "600",
    uiLineHeight: "1.2",
    uiPaddingBlock: "0.65rem",
    uiPaddingInline: "0.8rem",
    frames: {
      frameBoxShadowCssValue: "none",
      editorBackground: paper,
      editorTabBarBackground: purpleBar,
      editorTabBarBorderColor: ink,
      editorTabBarBorderBottomColor: ink,
      editorActiveTabBackground: purpleBar,
      editorActiveTabForeground: ink,
      editorActiveTabBorderColor: ink,
      editorActiveTabIndicatorHeight: "0px",
      editorActiveTabIndicatorTopColor: "transparent",
      editorActiveTabIndicatorBottomColor: "transparent",
      editorTabBorderRadius: "0px",
      editorTabsMarginInlineStart: "0px",
      editorTabsMarginBlockStart: "0px",
      terminalBackground: paper,
      terminalTitlebarBackground: purpleBar,
      terminalTitlebarForeground: ink,
      terminalTitlebarBorderBottomColor: ink,
      terminalTitlebarDotsForeground: purple,
      terminalTitlebarDotsOpacity: "0.7",
      inlineButtonForeground: ink,
      inlineButtonBackground: purple,
      inlineButtonBackgroundIdleOpacity: "0.06",
      inlineButtonBackgroundHoverOrFocusOpacity: "0.16",
      inlineButtonBackgroundActiveOpacity: "0.24",
      inlineButtonBorder: ink,
    },
    lineNumbers: {
      foreground: purple,
      highlightForeground: ink,
    },
  },
});
