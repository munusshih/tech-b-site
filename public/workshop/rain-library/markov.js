import { RiTa } from "https://esm.sh/rita@4.1.0?bundle";

// These are the examples RiTa can learn from.
const corpus = [
  "The rain library opens at dusk.",
  "The rain library opens when it rains.",
  "The rain library closes at dawn.",
  "The train library closes at noon.",
  "The library lends maps to people who miss the bus.",
  "The rain library lends books to people who missed the bus.",
].join(" ");

// Compare 2 and 3. At 3, each prediction uses two previous tokens.
const model = RiTa.markov(2, { disableInputChecks: true });
model.addText(corpus);

const output = document.querySelector("#result");
document.querySelector("#sample").addEventListener("click", () => {
  // RiTa handles the transition table and sampling.
  output.textContent = model.generate({ numSentences: 1 });
});
