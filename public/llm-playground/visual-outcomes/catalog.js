export const outcomes = [
  {
    id: "notice",
    letter: "A",
    title: "How to professionally say…",
    library: "GSAP + typography",
    concepts: [
      ["prompting", "Prompting"],
      ["temperature", "Sampling"],
      ["structured-output", "Structured outputs"],
    ],
    intro:
      "Write the note you probably shouldn’t send. The Department of Shared Concerns will turn it into a professionally unnecessary announcement, complete with a subject line and an air of institutional importance. The complaint should still be recognizable underneath all that courtesy. Try asking for a committee and see how much authority the same small annoyance can acquire.",
    prompt:
      "Stop leaving your dirty dishes in the studio sink. I am not your parent and I want to wash my mug without touching your ancient pasta.",
    action: "Make it professional",
    steps: [
      "**Your complaint supplies the situation; the prompt supplies the performance.** `generateNotice` sends your note as a `user` message. Its `system` message asks for an office circular that keeps the original grievance while changing its register. The selected level changes those instructions, from restrained politeness to an unnecessarily elaborate committee announcement.",
      "**We ask for writing that the layout can actually use.** `prose` first asks for the announcement itself. A second, smaller `structured` request gives it a subject, headline, and closing. Keeping the prose and layout fields separate makes the task easier for a small local model. `noticeSchema` describes the complete result that the page saves. The model writes the circular; CSS sets its type, spacing, rules, and stamp. The Department of Shared Concerns is our fictional institution, and its official-looking form is part of the joke.",
      "**One run produces one announcement.** Sampling allows the wording to vary when you submit the same note again. GSAP gives the new circular a brief entrance, then stops moving it. Earlier versions stay in the session record, so you can compare how a change in instructions affected the same complaint.",
      "**Read it against what you actually wrote.** Did politeness clarify the request or hide it? Did the model invent a policy, a punishment, or an event? Try a more personal grievance and inspect how official language changes who seems entitled to speak. The download button saves an editable HTML copy of the current circular.",
    ],
    starter: { notices: [] },
  },
  {
    id: "oracle",
    letter: "B",
    title: "An oracle that remembers you",
    library: "p5.js + p5.brush",
    concepts: [
      ["memory", "Memory"],
      ["structured-output", "Structured outputs"],
    ],
    intro:
      "Tell the oracle what’s on your mind. It will offer a horoscope-style reading, a small ritual, and a painted card to keep. Come back with another entry and it can draw on the note it kept from your last visit. The more familiar it seems, the more interesting it becomes to ask where that familiarity came from: you can read and edit its memory before the next reading.",
    prompt:
      "I keep saying yes to things and then getting annoyed that I have no time for my own work. Today I need to finish something small instead of starting over.",
    action: "Read my day",
    steps: [
      "**A check-in gives the oracle something to recognize.** `generateOracle` sends your entry, today’s date, and the editable memory to the local model. Its instructions ask for a symbolic reading grounded in what you wrote, with a small, doable ritual. This is a piece of reflective fiction, rather than a prediction based on celestial data.",
      "**The response includes a painting instruction as well as words.** We ask for the reading first, then give the model smaller requests for a title and painting choices, a ritual, and a factual memory note. `oracleSchema` describes the completed card, with a motif chosen from `growth`, `orbit`, and `tides`. The model chooses that motif and a palette. Our p5.js sketch interprets those choices using p5.brush’s watercolor fills and pencil strokes; it never runs code written by the model.",
      "**The painting has a repeatable composition.** A seed made from the entry and date keeps the marks stable when you reopen a card. `brush.instance(p)` connects the library to the p5 sketch, and the drawing happens on a WebGL canvas. The marks are made by the drawing program; they aren’t an image retrieved from a model or a claim to have pictured your future.",
      "**The next visit includes a note from this one.** The separate `oracle_memory` request returns a `remember` field, which becomes the browser’s saved memory after the whole card is complete. Compare that note with your entry: has an interpretation accidentally become a fact about you? Edit it before asking again, or use “Forget memory.” Earlier cards are kept separately, so forgetting can remove the context used for the next request without pretending the old cards disappeared.",
    ],
    starter: { memory: "", readings: [] },
  },
  {
    id: "archive",
    letter: "C",
    title: "An exhibition that argues its case",
    library: "Met Open Access API + rough-notation",
    concepts: [
      ["rag", "Retrieval and grounding"],
      ["multi-agent", "Multiple roles"],
    ],
    intro:
      "Choose a few real collection objects and ask a small curatorial team to make an exhibition from them. The curator needs a reason for these works to be together. A researcher challenges claims the records don’t support, and an editor turns the proposal into an introduction and connected labels. Take out an important object and try again: does the argument change, or does the writing simply make the next selection sound inevitable?",
    action: "Make the exhibition",
    steps: [
      "**First, we choose what the team is allowed to know.** `collection.json` holds twelve public-domain object records from the Met, with links to their images and original catalogue entries. We use the same starting collection each time so that changing your question or leaving out an object gives you something clear to compare. Click a thumbnail to leave an object out, and add a curatorial question if you have one. Only the included titles, makers, dates, and materials enter the model’s context. The text model receives those records, not the images you can see.",
      "**A curator proposes a relationship between three objects.** `generateArchive` first selects three object IDs with a structured request. We check those IDs, then give the curator only those three records to develop its argument. The researcher and editor receive that same selection, so an object left out of the exhibition should also stay out of the wall text. A useful proposal explains why these particular objects belong together, rather than repeating the search term three times.",
      "**A researcher reads the proposal against the same records.** The researcher receives a separate request asking which claims need removing or qualifying. The editor then receives the proposal, the researcher’s response, and the original records. It writes the introduction first, then receives one focused writing request for each label. JavaScript keeps the curator’s selected IDs attached to those labels, so the editor cannot accidentally swap works while writing. These are separate jobs assigned to the same local model, so the review still needs your judgment.",
      "**The program hangs the works and keeps the editorial record.** `validateExhibition` checks the references, and JavaScript reads the highlighted fact directly from the original record. rough-notation marks that fact beside each label. Open the editorial record to compare the curator, researcher, and editor. Then remove an object or change the question and see whether the revised exhibition earns its new argument.",
    ],
    starter: {
      topic: "Twelve objects from the Met",
      objects: [],
      excluded: [],
      exhibitions: [],
    },
  },
  {
    id: "clock",
    letter: "D",
    title: "An alarm clock you have to convince",
    library: "Tone.js + a browser timer",
    concepts: [
      ["tool-calling", "Tool calling"],
      ["agents", "Feedback and negotiation"],
    ],
    intro:
      "The alarm is awake, and unfortunately it has opinions. Give it your best excuse for staying in bed. It can grant a short snooze, ask a follow-up, or play a small protest if you’ve enabled sound. You can always get up or silence it yourself. The provotype asks what happens when an ordinary object starts treating a simple button press as something you need to justify.",
    prompt:
      "I was up late finishing my work. Five more minutes would make me a much more pleasant person.",
    action: "Plead my case",
    steps: [
      "**Your excuse becomes a turn in a conversation with an object.** `generateClock` sends the clock’s actual timer state, your message, and recent turns to the model. The clock is instructed to be comically officious. It can respond to an earlier exchange because the application sends that exchange again, rather than because the model remembers it on its own.",
      "**The clock has three actions it can actually take.** `clockTools` describes `grant_snooze`, `ask_reason`, and `sound_protest`. The model must request one action with valid arguments. `executeClockTool` checks the name and arguments before doing anything; written promises to grant time don’t alter the timer. If a small model writes dialogue instead of a call, a short routing request lets it choose a function, and the server is asked for a native call to that function. If the server still cannot produce native tool syntax, we request a structured argument object and validate it against the same function schema before dispatching it. The action log records which path was used; ordinary dialogue never executes an action.",
      "**JavaScript owns time and sound.** A valid snooze stores an expiry time using `Date.now()`, and the display counts down to that moment. A protest requests one of two short synthesized phrases. Tone.js only plays it after you explicitly enable sound, and the stop control always works. This runs in the page, so closing it ends the toy; it doesn’t set a system alarm.",
      "**The result returns to the model as feedback.** We append the actual receipt as a `tool` message, then ask for the clock’s short reply. If it asked a question, your next excuse continues that exchange. The visible action log lets you compare the clock’s words with what its tools really did. “I’m up” ends the negotiation without asking the model for permission.",
    ],
    starter: {
      until: null,
      awake: false,
      turns: [],
      receipts: [],
      message:
        "Your application for five more minutes is now being considered.",
    },
  },
];
