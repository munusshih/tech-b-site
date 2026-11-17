import alice from "@/content/markov/alice-rabbit-hole.txt?raw";
import aesop from "@/content/markov/aesop-fables.txt?raw";
import frankenstein from "@/content/markov/frankenstein-letters.txt?raw";
import whitman from "@/content/markov/crossing-brooklyn-ferry.txt?raw";
import dickinson from "@/content/markov/dickinson-poems.txt?raw";

export const markovSources = [
  {
    title: "Alice’s Adventures in Wonderland (chapter 1)",
    author: "Lewis Carroll",
    text: alice,
    url: "https://www.gutenberg.org/ebooks/11",
  },
  {
    title: "Aesop’s Fables (nine fables)",
    author: "Translated by V. S. Vernon Jones",
    text: aesop,
    url: "https://www.gutenberg.org/ebooks/11339",
  },
  {
    title: "Frankenstein (letters 1–3)",
    author: "Mary Shelley",
    text: frankenstein,
    url: "https://www.gutenberg.org/ebooks/84",
  },
  {
    title: "Crossing Brooklyn Ferry",
    author: "Walt Whitman",
    text: whitman,
    url: "https://www.gutenberg.org/ebooks/1322",
  },
  {
    title: "Three poems, including “Hope”",
    author: "Emily Dickinson",
    text: dickinson,
    url: "https://www.gutenberg.org/ebooks/2679",
  },
];
