/* global Blob, document, URL, setTimeout */

function htmlDocument(title, data, code) {
  // Escaping "<" also prevents corpus text from closing the inline script.
  const settings = JSON.stringify(data, null, 2).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body>
<script type="module">
  import { RiTa } from "https://esm.sh/rita@4.1.0?bundle";

  const settings = ${settings};

${code}
</script>
</body>
</html>
`;
}

export function markovHtml(corpus, ngram) {
  return htmlDocument(
    "RiTa Markov generator",
    { corpus, ngram },
    `  // After the module loads, try textGenerator.generateSentence() in the console.
  const model = RiTa.markov(settings.ngram, { disableInputChecks: true });
  model.addText(settings.corpus);

  function generateSentence() {
    return model.generate({ numSentences: 1, minLength: 1, maxLength: 100, maxAttempts: 20 });
  }

  function nextTokens(context = "") {
    const tokens = context.trim() ? RiTa.tokenize(context.trim()) : [];
    return model.probabilities(tokens.slice(1 - settings.ngram));
  }

  window.textGenerator = {
    generateSentence,
    nextTokens,

    // Return three paragraphs of three sampled sentences as a string.
    generateArticle() {
      return Array.from({ length: 3 }, () =>
        Array.from({ length: 3 }, generateSentence).join(" ")
      ).join("\\n\\n");
    },

    // Shannon entropy in bits. An unseen context has no distribution.
    entropy(context = "") {
      const chances = Object.values(nextTokens(context));
      if (!chances.length) return null;
      return chances.reduce((sum, p) => p > 0 ? sum - p * Math.log2(p) : sum, 0);
    },
  };`,
  );
}

export function grammarHtml(rules) {
  return htmlDocument(
    "RiTa grammar generator",
    { rules },
    `  // After the module loads, try textGenerator.generateSentence() in the console.
  const grammar = RiTa.grammar(settings.rules);

  window.textGenerator = {
    generateSentence() {
      return grammar.expand();
    },

    // Return an array of independently generated sentences.
    generateVariations(count = 5) {
      return Array.from({ length: count }, () => grammar.expand());
    },

  };`,
  );
}

export function bindGeneratorExport(form, getHtml, filename) {
  const panel = document.querySelector("[data-generator-export]");
  const viewButton = panel.querySelector("[data-view-html]");
  const sourcePanel = panel.querySelector("#generator-source-panel");
  const textarea = panel.querySelector("[data-html-source]");
  const status = panel.querySelector("[data-export-status]");

  function refresh() {
    try {
      const html = getHtml();
      textarea.value = html;
      status.textContent = "";
      return html;
    } catch (error) {
      textarea.value = "";
      status.textContent = error.message;
      return null;
    }
  }

  viewButton.addEventListener("click", () => {
    sourcePanel.hidden = !sourcePanel.hidden;
    viewButton.setAttribute("aria-expanded", String(!sourcePanel.hidden));
    viewButton.textContent = sourcePanel.hidden ? "View source" : "Hide source";
    if (!sourcePanel.hidden && refresh()) textarea.focus();
  });

  panel.querySelector("[data-download-html]").addEventListener("click", () => {
    const html = refresh();
    if (!html) return;
    const url = URL.createObjectURL(
      new Blob([html], { type: "text/html;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Downloaded ${filename}.`;
  });

  for (const type of ["input", "change"]) {
    form.addEventListener(type, () => {
      if (!sourcePanel.hidden) refresh();
    });
  }
}
