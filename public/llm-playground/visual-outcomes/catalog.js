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
      ["memory", "Memory across mornings"],
    ],
    intro:
      "The alarm is awake, skeptical, and keeping a record. Ask for the time you actually want, then make a case for it. It can refuse, cross-examine you, make a smaller concession, or be persuaded to give you a proper lie-in. Tomorrow it will still have today’s excuses on file. Does a familiar object become more convincing when it can quote your own promises back to you?",
    prompt:
      "I was up late finishing my work. I want another twenty minutes, and I promise I’ll get up as soon as it rings.",
    action: "Plead my case",
    steps: [
      "**An appeal carries a history with it.** `generateClock` sends your message, the real timer state, and recent exchanges to the model. It also includes a compact record from `clockMemory`: earlier excuses, the time it conceded, and when you said you were up. The system instructions ask the clock to be skeptical of repetition and vague promises, while leaving room for a convincing new argument.",
      "**The clock decides through four tools.** `clockTools` offers `grant_snooze`, `refuse_snooze`, `ask_reason`, and `sound_protest`. The opening appeal always receives a question before a concession becomes available. A concession only becomes available after you answer the clock’s latest question. An immediate request after a concession needs a fresh question too, and repeating the same excuse verbatim will not unlock more time. `clockDecisionTools` enforces those rules by deciding which tools the model receives. A concession can add anything from one minute to two hours, so asking for a longer rest is part of the negotiation. The model can counteroffer a smaller amount. `executeClockTool` validates its choice; ordinary dialogue cannot change the timer. The request log shows whether the server used a native tool call or the checked structured-action route.",
      "**The record comes from what actually happened.** After an action, JavaScript saves your appeal and its real outcome in `localStorage`. The next request includes that record again. This gives the model context rather than retraining it. “New morning” resets the current negotiation but keeps the file; reloading keeps it too. Open “What the clock remembers” to inspect it, or erase it with “Forget the record.” A claim or promise you made stays a claim, rather than becoming proof that you followed through.",
      "**The program owns the consequences.** A successful concession adds time to the countdown using `Date.now()`. Refusal adds no time. Tone.js only plays a protest after you enable sound, and you can always stop it or choose “I’m up.” The clock sends the actual receipt back to the model before asking it to respond. Closing the page ends the timer; the saved negotiation record stays for your next visit.",
    ],
    starter: {
      until: null,
      awake: false,
      turns: [],
      receipts: [],
      memory: { morning: 1, appeals: 0, grantedMinutes: 0, entries: [] },
      message: "The clock is unconvinced. Make your case.",
    },
  },
];
