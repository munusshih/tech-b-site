import { roles } from "./examples/multi-agent.js";
export const lessons = [
  {
    slug: "prompting",
    concept: "Prompting",
    title: "What do instructions change?",
    description: "Change instructions while keeping the same message.",
    level: "Beginner",
    needs: "Local chat model",
    explain:
      "The model receives two pieces of text: instructions about how to respond, and your message. Compare the same message with and without the instructions.",
    flow: "system message → user message → local model → reply",
    first:
      "Compare the same project description with and without the visitor-focused instructions. Then change the audience to a six-year-old.",
    change:
      "Try removing the role entirely. Does the model still follow the requested length?",
    reflect: "Does a confident voice make the answer more trustworthy?",
    defaults: {
      prompt:
        "Make this project description easier to understand: “An embodied participatory interface that interrogates the temporality of urban ecological encounters through situated sonic interventions.” The actual project is a park bench that plays recordings of birds heard nearby.",
      instructions:
        "You are helping a student explain their project at an open studio. Write two welcoming sentences for a visitor who has never studied design. Say what they can do with the bench. Use the supplied facts; do not invent features.",
    },
    mechanism:
      "Two requests, using the same model, message, and temperature. Only the system instructions change.",
    observe:
      "Which version tells a visitor what they can actually do? Check that simplifying the language has not added features that do not exist.",
    action: "Compare with and without instructions",
    finalLabel: "With your instructions",
    paragraphs: [
      "Prompting is the simplest way to work with a language model: send it a message and describe the response you want. Here, you’re turning a jargon-heavy project statement into an invitation someone can understand at an open studio. Compare what happens when you specify the audience, length, and facts to keep.",
    ],
    reading: [
      {
        label: "Llama’s chat-completion API",
        href: "https://llama.app/docs/api",
      },
      {
        label: "System messages in Ollama",
        href: "https://docs.ollama.com/modelfile#system",
      },
    ],
    noteLabel: "How does it work?",
    noteSteps: [
      "**We start with the project description you’ve been given.** The example describes a bench that plays recordings of nearby birds, but its opening sentence hides that idea behind academic language. When you run it, we send this description to your local model and ask for a clearer version. The first `ask(ctx, messages)` call contains only a `user` message, so you can see how the model approaches the task without the extra instructions.",
      "**Then we send the same message with some guidance.** This time, a `system` message asks for two welcoming sentences for an open-studio visitor. It also tells the model to explain what someone can do with the bench and to keep to the supplied facts. Both requests use the same model and temperature. Giving the second request an audience and a purpose is the change we’re trying to observe.",
      "**Read the two replies as if you were visiting the exhibition.** Which one helps you understand the project? Check whether either reply adds something the description never mentioned, such as a button, a sensor, or a way to record your own sounds. An instruction to keep to the facts can help, but it doesn’t check the reply for us.",
      "**Change the audience and run the comparison again.** Try explaining the bench to a six-year-old, or to someone deciding whether to exhibit it. Keep the project description the same so you can see what your instructions change. The code uses our `ask` helper to send these messages; the model isn’t being retrained when you edit them.",
    ],
  },
  {
    slug: "temperature",
    concept: "Temperature",
    title: "What does temperature change?",
    description: "Same prompt, three temperatures, side by side.",
    level: "Beginner",
    needs: "Local chat model",
    explain:
      "Write the same short installation message at three temperatures and compare variation and constraint-following.",
    flow: "one prompt → three model calls → compare variations",
    first:
      "Compare the three messages. Do they all invite the visitor to wave, and do they stay within 12 words?",
    change:
      "Repeat without editing the prompt, then adjust one temperature. Compare clarity as well as novelty.",
    reflect: "When might repetition be more useful than surprise?",
    defaults: {
      prompt:
        "Rewrite “ERROR: NO INPUT DETECTED” as a warm, slightly playful message for a motion-controlled installation. Tell the visitor to wave to wake it up. One sentence, at most 12 words. No apologies or technical jargon. Return only the message.",
    },
    mechanism:
      "JavaScript makes three separate requests in a loop, one per temperature below. Each request produces one answer. The model, prompt, and reply limit stay the same.",
    observe:
      "The word count comes from JavaScript; the requested 12-word limit is an instruction, not a guarantee.",
    action: "Compare three temperatures",
    finalLabel: "Comparison",
    paragraphs: [
      "Temperature changes how strongly a language model favors likely next tokens. Lower values usually produce more predictable continuations; higher ones allow less likely choices. Here, you’re writing a short message for an installation that needs a visitor to wave. Compare the phrasing, but also check whether each version still gives the right instruction.",
    ],
    reading: [
      {
        label: "Sampling parameters in Ollama",
        href: "https://docs.ollama.com/modelfile#valid-parameters-and-values",
      },
    ],
    noteLabel: "How does it work?",
    noteSteps: [
      "**We give all three requests the same writing task.** Here, an installation needs to invite someone to wave instead of displaying “ERROR: NO INPUT DETECTED.” The prompt asks for one warm sentence with no more than twelve words. Before running it, think about what a visitor would need to understand in order to take the next step.",
      "**The program sends that prompt three times.** A `for...of` loop calls `ask` once for each value in `temperatures`, taken from the three settings in the form. Temperature affects how strongly the model favors likely next tokens as it writes. Lower values usually make its choices more predictable; higher values allow less likely choices. The three replies appear because our code makes three requests, not because temperature produces several answers by itself.",
      "**We display each reply and count its words.** After the response arrives, `text(reply)` extracts its words and `split(/\\s+/)` separates them so JavaScript can count them. The twelve-word limit is still an instruction in the prompt, so the model may go over it. Read for meaning as well as length: does the message actually tell someone to wave, and would they understand why?",
      "**Run it again before drawing a conclusion.** You may get different wording at the same temperature, and one unusual response doesn’t tell us much about a setting. After a few runs, change one value and compare again. Look for a setting that suits this interaction: a surprising phrase is only useful here if it still helps someone use the installation.",
    ],
  },
  {
    slug: "structured-output",
    concept: "Structured outputs",
    title: "Can a messy announcement become an event card?",
    description:
      "Extract an event’s details and use the fields to build an interface.",
    level: "Beginner",
    needs: "Chat server with JSON Schema support",
    explain:
      "Paste an informal event announcement. Compare a text extraction with validated JSON, then see the same JSON fields populate an event card.",
    flow: "announcement → JSON Schema → validate → event card",
    first:
      "Change the announcement’s time or location and watch the event card update. Remove the location entirely: it should show “Not provided,” not an invented venue.",
    change:
      "Remove the date or venue, run again, and inspect how the empty field appears in the event card.",
    reflect:
      "Which details should the interface ask someone to confirm before publishing?",
    defaults: {
      prompt:
        "hey! we’re doing a Repair & Remix night on November 27, 2026, 6–8 pm in the print studio, room 204. bring a broken small object and we’ll try to give it a second life. free, no experience needed. can someone make a clean event listing out of this?",
    },
    mechanism:
      "Two requests extract the same event details: first as text, then with a JSON Schema. JavaScript validates title, date, time, and location, then uses those fields to render an event card.",
    observe:
      "The card is assembled by JavaScript, not drawn by the model. Missing details should stay missing. A valid schema does not prove the extracted date or location is correct.",
    action: "Make an event card",
    finalLabel: "Event card + JSON",
    paragraphs: [
      "Imagine someone sends you a messy event announcement and you want to put it on your website. A paragraph still leaves you copying the date, time, and venue by hand. Structured output gives your code named fields it can use directly. Here, those fields become an event card.",
    ],
    reading: [
      {
        label: "Structured outputs with a local model",
        href: "https://docs.ollama.com/capabilities/structured-outputs",
      },
    ],
    noteLabel: "How does it work?",
    noteSteps: [
      "**We begin with an announcement written like a message to a friend.** It includes an event name, a date, a time, and a room, mixed in with other details. The program first asks the model to extract that information without requiring a particular response format. This gives you an ordinary text reply to compare with the next attempt.",
      "**Then we give the model a form to fill in.** The second request passes a JSON Schema through `response_format`, describing four named fields: `title`, `date`, `time`, and `location`. Each field must contain text. The local server receives this schema alongside the messages. The announcement and extraction instructions stay the same; we’re changing the shape the reply must take.",
      "**Our code checks the reply before using it.** `JSON.parse` turns the reply into an object, and our field checks make sure the expected values are strings, without extra fields. JavaScript then places those values into the event card. The model supplies the text for the fields; the card’s appearance comes from the interface we’ve built.",
      "**Compare the card with the original announcement.** A response can have the right structure and still copy a time incorrectly. Try removing the room from the announcement and run it again. We ask for an empty string when information is missing, which the card displays as “Not provided.” Check that the model leaves the gap visible instead of inventing a venue.",
    ],
  },
  {
    slug: "tool-calling",
    concept: "Tool calling",
    title: "Let a model use your cost calculator",
    description: "Translate a materials request into a real calculation.",
    level: "Intermediate",
    needs: "Tool-capable local chat model",
    explain:
      "The model extracts quantities from a materials request and calls a JavaScript function with fixed prices. The function produces the receipt.",
    flow: "shopping request → tool arguments → calculator → receipt → explanation",
    first:
      "Run the $20 budget check, then remove two batteries and compare the receipt.",
    change:
      "Change quantities or budget. Check which values come from the model and which come from your function.",
    reflect: "Who decides which actions the model is allowed to take?",
    defaults: {
      prompt:
        "For my light-up cardboard prototype I need three cardboard sheets, one roll of tape, six LEDs, and six coin-cell batteries. Can I afford this?",
      budget: 20,
    },
    mechanism:
      "One model request selects arguments, JavaScript calculates, and a second model request explains the returned result.",
    observe:
      "Verify extracted quantities before trusting the sum. These are fictional classroom prices, not live product prices.",
    action: "Calculate materials",
    finalLabel: "What the total means",
    paragraphs: [
      "Suppose someone describes a prototype’s shopping list in ordinary language. A model can identify the items and quantities, but your program should own the prices and arithmetic. Here, the model requests our cost-calculator function, and JavaScript returns an itemized total and the amount left in your budget.",
    ],
    reading: [
      {
        label: "Tool calling and returning tool results",
        href: "https://docs.ollama.com/capabilities/tool-calling",
      },
    ],
    noteLabel: "How does it work?",
    noteSteps: [
      "**We send your shopping list with a description of the calculator.** You can ask for materials in ordinary language, such as “three cardboard sheets and six LEDs.” The model also receives a tool definition explaining which material IDs and quantities our calculator accepts. This example asks it to use that tool to price your request.",
      "**The model turns your sentence into arguments for the function.** Its reply should contain a tool call with items and quantities, rather than a total it calculated itself. Our program checks `reply.tool_calls`, verifies the function name, and uses `JSON.parse` to read the arguments. This is a useful place to look for mistakes: did “six batteries” become a quantity of six?",
      "**JavaScript works out the actual cost.** `calculateCost` checks the material IDs and quantities, looks up the fixed classroom prices in `materials`, and adds the costs in cents. It compares that total with your budget and displays an itemized receipt. These are fictional prices built into the example; we aren’t looking up products online.",
      "**We send the receipt back so the model can explain it.** We append the result to `history` as a `tool` message, then call `ask` again so the model can explain whether the purchase fits your budget. Compare that explanation with the receipt. Then remove two batteries and run it again. If the quantities were read correctly, you should be able to follow the change all the way from your sentence to the new total.",
    ],
  },
  {
    slug: "rag",
    concept: "RAG",
    title: "Ask a studio handbook",
    description: "Retrieve the right passages, then answer from them.",
    level: "Beginner",
    needs: "Chat model; embedding model optional",
    explain:
      "Find passages in a fictional studio handbook using keywords or embeddings, then use those passages to answer a booking question.",
    flow: "question → retrieve passages → add context → sourced answer",
    first:
      "Run keyword retrieval, then compare both methods with the same question. The semantic options need an embedding model.",
    change:
      "Change the risograph booking rule. Does the answer follow the updated source?",
    reflect: "What happens to knowledge that the retriever cannot find?",
    defaults: {
      prompt:
        "I need to make a booklet in two ink colors. What should I prepare and who do I book with?",
      documents:
        "A: The laser cutter requires an induction before your first booking. Book a 30-minute slot through the workshop desk.\nB: The risograph is available for two-color zines. Bring a print-ready PDF and book through the print technician.\nC: The audio booth has microphones and a recorder. Reserve it through the equipment desk; no induction is required.\nD: Scrap cardboard and fabric are free to use from the reuse shelves. No booking is needed.",
      retrieval: "keyword",
    },
    mechanism:
      "Keyword retrieval runs in JavaScript. Semantic retrieval makes one embedding request. One chat request answers using the selected passages.",
    observe:
      "Inspect the passages before the answer. In Compare both, the answer uses semantic results.",
    action: "Retrieve and answer",
    finalLabel: "Answer from selected passages",
    paragraphs: [
      "When you ask this model how to book the risograph, where would that information come from? It might have encountered general information about risograph printing during training, but that doesn’t give it our studio’s booking rules. In this example, we supply those rules ourselves. [RAG](https://arxiv.org/pdf/2005.11401) stands for retrieval-augmented generation: the program searches a collection of documents, puts selected passages into the message sent to the model, and asks it to answer using that material. Think of handing someone a few pages from a handbook along with your question. Which pages you hand them will affect what they can tell you.",
    ],
    reading: [
      {
        label: "The original RAG paper, Lewis et al.",
        href: "https://arxiv.org/pdf/2005.11401",
      },
    ],
    noteLabel: "How does it work?",
    noteSteps: [
      "**First, we need something to search.** The handbook in the box is our source material. When you press “Retrieve and answer,” `documents(ctx.documents)` turns each nonempty line into a separate passage. You can change any of these rules yourself. For now, we’re working with this small, fictional handbook, so you can see exactly what information is available.",
      "**Then we look for passages related to your question.** `keywords` checks for words that appear in both the question and the handbook. But what if you ask about a “booklet” and the relevant passage says “zine”? Semantic search offers another way to make that connection: `semantic` asks an embedding model to represent each text as a list of numbers, which `cosine` compares for similarity. Try both methods and look at what each one finds. Related wording can help us find a passage, but we still have to read it to know whether it’s useful.",
      "**We put the selected passages into a message for the chat model.** `grounded(ctx, selected)` puts your question into that message too, with a number beside each source so the answer can refer back to it. In semantic mode, we use the top three matches. If you choose “Compare both,” you’ll see both rankings, but the answer uses the semantic results. This selection matters: a booking rule that doesn’t get retrieved won’t be part of the context we send. If keyword search finds no matches at all, the program tells you and stops before asking the model.",
      "**Now the model has something to answer from.** We ask it to use the supplied passages, cite their numbers, and say when they don’t contain enough information. This is where it writes the response you see. We haven’t retrained it or given it a permanent memory of the handbook; we’ve included some reading material with this particular question. Those instructions also don’t guarantee a correct answer, so check whether the cited passage actually supports what the model says.",
      "**Try changing the booking rule to see the whole process again.** Make the risograph passage say that bookings go through the workshop desk, then ask the same question. Look at the retrieved passages first, and then read the answer. Did the updated rule reach the model? Did it use that rule correctly? If something went wrong, those two questions help you work out where it happened. You can open the request log to see exactly which sources were sent.",
    ],
  },
  {
    slug: "agents",
    concept: "Agents",
    title: "Test, revise, and test a floor plan",
    description:
      "A local agent repairs a layout using feedback from a checker.",
    level: "Intermediate",
    needs: "Local chat server with JSON Schema support",
    explain:
      "An agent submits floor-plan coordinates to a local geometric checker and revises them from the returned issues. No internet is needed.",
    flow: "propose positions → check → read errors → revise → pass or stop",
    first:
      "Allow one round to see the broken starting plan, then allow three to give it a chance to repair it.",
    change:
      "Change the starting coordinates. Watch whether each tested revision actually fixes the checker’s issues.",
    reflect: "What should happen when a model never decides it is finished?",
    defaults: {
      prompt:
        "Test this starting layout first: listening at (0, 0), table at (4, 3), wall at (6, 0). The room is 8 × 6 metres. Listening is 2 × 2, table is 3 × 2, and wall is 2 × 1. Keep the entrance zone (0–2, 0–2) empty, keep all stations inside, and avoid overlaps. After checking, revise the positions to fix any failures. Coordinates start at the top left; no rotation.",
      rounds: 3,
    },
    mechanism:
      "At most three checked attempts, followed by one model request to describe the last tested result. It stops early on a pass.",
    observe:
      "A failed final check stays visible as a failure. The checker covers bounds, overlaps, and the entrance zone only.",
    action: "Run layout agent",
    finalLabel: "Agent’s handoff",
    paragraphs: [
      "An agent can use feedback to change its next action. Here, it arranges a toy exhibition floor instead of searching the web. The starting positions deliberately contain problems. The model submits positions to a local checker, reads the specific failures, and can try a revised layout. You see each tested plan, not just a confident final suggestion.",
    ],
    reading: [
      {
        label: "Agents, tools, and stopping conditions",
        href: "https://www.anthropic.com/research/building-effective-agents",
      },
      {
        label: "Implementing tool loops",
        href: "https://docs.ollama.com/capabilities/tool-calling",
      },
    ],
    noteLabel: "How does it work?",
    noteSteps: [
      "**We give the model a room and some starting positions.** The brief describes three stations inside an eight-by-six-metre exhibition space. Its starting layout deliberately needs work. We ask the model to submit those positions first, so the example begins with something concrete to check rather than a promise that it has designed a good layout.",
      "**The model submits coordinates that our code can inspect.** Each call to `ask` uses `layoutSchema` to name the stations and their positions in a JSON response. JavaScript passes those coordinates to `checkLayout`, which checks whether the stations stay inside the room, overlap each other, or block the reserved entrance zone. You can see the tested arrangement and the issues found in each round.",
      "**We give the checker’s feedback back to the model.** We append the result to `history`. If the layout fails, the next call to `ask` receives the previous attempt and its specific problems. The model can move the stations and submit another arrangement. This repeated exchange is the agent loop in this example: its next action can respond to what happened when the previous one was tested.",
      "**The program decides when the attempts stop.** When `checked.valid` is true, `break` ends the loop early. Otherwise, it stops at the number of rounds you allowed, up to three, and asks the model to describe the last tested result. A failed final layout remains marked as a failure, even if the model sounds pleased with its work.",
      "**Try one round, then give it more time.** With one round you can inspect the starting problem; with three you can see whether feedback helps it repair the arrangement. Read the actual checks before trusting a pass. Our checker only covers room boundaries, overlaps, and the entrance zone. It doesn’t establish whether this would be an accessible or safe exhibition in a real space.",
    ],
  },
  {
    slug: "web-search",
    concept: "Web search",
    title: "What happens between search and an answer?",
    description: "Search Wikipedia or a local SearXNG instance.",
    level: "Intermediate",
    needs: "Internet; optional self-hosted SearXNG",
    explain:
      "Searching and generating are separate steps. This example searches Wikipedia first, shows the source snippets, then sends them to your local model.",
    flow: "query → information API → source snippets → local model",
    first:
      "Look up Isotype as a reference for designing a set of public-information icons. Check which claims in the answer actually appear in the retrieved snippets.",
    change:
      "Ask a question not covered by the returned snippets. Does the answer admit the gap?",
    reflect: "How does the search provider shape the answer?",
    defaults: {
      prompt: "Isotype pictogram visual education Otto Neurath",
      provider: "wikipedia",
    },
    mechanism:
      "One information API request retrieves snippets. One local chat request turns those snippets into an answer. Unlike tool calling, the program chooses to search before asking the model.",
    observe:
      "Search snippets are incomplete. The model should acknowledge missing information rather than fill gaps. SearXNG is an optional alternative requiring a local instance.",
    action: "Search, then answer",
    finalLabel: "Answer from search snippets",
    paragraphs: [
      "A language model’s response and an internet search result come from different systems. Search retrieves documents or snippets; a model generates text. You can combine them while keeping model inference local. Only the information request needs to go online.",
    ],
    reading: [
      {
        label: "Wikipedia search API and examples",
        href: "https://www.mediawiki.org/wiki/API:Search",
      },
      {
        label: "SearXNG search API",
        href: "https://docs.searxng.org/dev/search_api.html",
      },
    ],
    noteLabel: "How does it work?",
    noteSteps: [
      "**Your question goes to a search service first.** `searchWikipedia(ctx.prompt, ctx)` sends the words in the box to Wikipedia’s search API. The model doesn’t decide whether to search; our code always does that before asking for an answer. This part needs an internet connection, even though the chat model is running on your computer.",
      "**We collect short snippets from the results.** Each result includes a title, a link, and some text. Those snippets become the source material for the answer. The program hasn’t opened every linked page and read it in full, so a relevant result may still leave out something you need to know.",
      "**We give those snippets to your local model.** `grounded(ctx, sources)` builds the next request from the retrieved sources and your question, along with instructions to answer from the sources and cite their numbers. The model writes its response from that supplied context. Search retrieves the material; the local model turns it into an answer.",
      "**Follow the answer back to its sources.** Try the Isotype query and check whether the snippets support what the model says about visual education. Open a source link when a claim needs more context. You can also ask about something the snippets don’t cover and see whether the answer acknowledges the gap.",
    ],
  },
  {
    slug: "memory",
    concept: "Memory",
    title: "Where does the memory live?",
    description: "Save a model-written summary in this browser.",
    level: "Beginner",
    needs: "Local chat model + browser storage",
    explain:
      "A fresh model request has no memory of this page. The application saves a short summary and sends it with your next message. You can read, correct, or erase that summary.",
    flow: "load summary → add to prompt → reply → summarize → save",
    first:
      "Send this installation brief. Then use “Ask a follow-up” to request materials and a first test. Does the answer retain the budget and interaction constraints? Forget the summary and compare.",
    change: "Correct the summary manually. Ask a question again and compare.",
    reflect:
      "What should an application remember, forget, or let someone correct?",
    defaults: {
      prompt:
        "I’m making a screen-free sound installation for the open studio. My budget is $40, I have two days, and I can borrow one speaker. I want visitors to interact without speaking. Suggest one simple direction and keep these constraints for our next message.",
    },
    mechanism:
      "Each send makes two requests: one to answer using the current summary, then another to update the summary. Only the summary persists in this browser; it is not stored inside the model.",
    observe:
      "Compare the saved summary before and after sending. Model-written summaries can introduce mistakes. Edit or forget it and see how the next answer changes.",
    action: "Send and update the summary",
    finalLabel: "Reply",
    paragraphs: [
      "A model does not automatically remember an earlier request. An application creates continuity by sending previous messages, a summary, or selected facts with the next request. Keeping that context outside the model makes it possible to inspect, edit, and forget what has been saved.",
    ],
    reading: [
      {
        label: "How browser localStorage persists data",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage",
      },
      {
        label: "Sending message history to a local model",
        href: "https://llama.app/docs/api",
      },
    ],
    noteLabel: "How does it work?",
    noteSteps: [
      "**We read the summary saved by this page.** On your first visit, there may be nothing there. After you’ve used the example, the browser can hold a short note about your project in `localStorage`. You can read that note in the editable summary field. It’s the application keeping this information, rather than the model quietly remembering an earlier conversation.",
      "**We send that summary alongside your new message.** `ask` receives both pieces of text in one request and returns a reply, which `text` extracts from the response. For the installation brief, that might mean keeping the forty-dollar budget and the two-day deadline in view when suggesting materials. Check whether those constraints actually survive into the answer.",
      "**A second request updates the note for next time.** We give the model the previous summary, your new message, and its reply, and ask for a short updated summary. `ctx.saveMemory(summary)` writes that summary to the browser’s `localStorage` for the next request. We aren’t storing the whole conversation here, so details can be dropped or summarized incorrectly.",
      "**Look at what the application decided to keep.** Compare the summaries shown before and after sending. Did a suggestion from the model accidentally become something you supposedly decided? Correct the summary and use “Save edited summary,” or choose “Forget summary” to remove it. Then ask a follow-up and compare what happens when the next request includes different context.",
    ],
  },
  {
    slug: "multi-agent",
    concept: "Multi-agent systems",
    title: "Give a proposal two specialist reviews",
    description: "Designer → independent reviewers → producer.",
    level: "Intermediate",
    needs: "Local chat server with JSON Schema support",
    explain:
      "Four roles collaborate: a designer, two independent specialist reviewers, and a producer who synthesizes their feedback.",
    flow: "brief → proposal → parallel specialist reviews → revised build plan",
    first:
      "Compare the first proposal with the final plan. Trace one concrete improvement back to each reviewer.",
    change:
      "Edit the fabrication reviewer to prioritize repair and reuse. Check whether the final materials change.",
    reflect: "Does adding more voices make a process more accountable?",
    defaults: {
      prompt:
        "Design a token-voting station for an open studio. Twenty visitors give anonymous feedback by dropping a token into one of three colored cardboard cups on a standing-height table. We have cups, tokens, scrap cardboard, and $15 for extras. Make a concrete proposal, then improve it for people who cannot distinguish colors or reach the table. Visitors should not need a phone or write anything.",
    },
    mechanism:
      "Four model requests: one draft, two independent reviews in parallel, one synthesis with both reviews.",
    observe:
      "Specialization and explicit handoffs can improve a draft, but the roles share a model and can share its blind spots.",
    action: "Run the design team",
    finalLabel: "4. Producer’s revised build plan",
    paragraphs: [
      "A useful multi-agent workflow gives different roles different jobs and passes their work between them. Here, a designer proposes a visitor-feedback station. An accessibility reviewer and a fabrication reviewer independently inspect the same draft. A producer receives both reviews and turns their findings into a revised build plan.",
    ],
    reading: [
      {
        label: "Prompt chaining and evaluator–optimizer workflows",
        href: "https://www.anthropic.com/research/building-effective-agents",
      },
    ],
    noteLabel: "How does it work?",
    noteSteps: [
      '**One role makes a proposal from your brief.** `requestRole(ctx, "writer", ...)` asks the local model to act as a designer and describe the materials, setup, and visitor action for the token-voting station. Those named fields keep the proposal specific enough for the next roles to review. You can inspect this first version before reading any feedback.',
      "**Two reviewers inspect that same proposal separately.** One looks at participation and accessibility; the other looks at fabrication and supplies. `Promise.all` starts both `requestRole` calls together, and neither reviewer receives the other’s response. Each has its own instructions and returns an issue with a suggested change, so the two concerns have room to be considered separately.",
      '**A producer receives the proposal and both reviews.** `requestRole(ctx, "editor", ...)` gives this final role the original brief too, so it can weigh the feedback against what you asked for. We ask it for a revised build plan, the visitor action, what it took from each reviewer, and what still needs testing. Across the whole exercise, that makes four requests to the same local model.',
      "**Trace a revision back to the feedback that caused it.** If the final station no longer relies on color alone, was that something the accessibility review raised? Did a construction concern change how the cups are attached? The useful thing to inspect is whether the handoffs changed the proposal in a way you can explain. Giving the model several roles doesn’t make those roles independent experts.",
      "**Change one reviewer’s priorities and compare again.** For example, ask the fabrication reviewer to prioritize repair and reused materials. Keep the brief the same, then look for that priority in its review and in the producer’s final plan. If the feedback disappears during the handoff, you’ve found a part of the workflow that needs attention.",
    ],
    roleFields: [
      {
        name: "writer",
        label: "Designer",
        value: roles.writer,
      },
      {
        name: "critic",
        label: "Accessibility reviewer",
        value: roles.critic,
      },
      {
        name: "fabricator",
        label: "Fabrication reviewer",
        value: roles.fabricator,
      },
      {
        name: "editor",
        label: "Producer",
        value: roles.editor,
      },
    ],
  },
  {
    slug: "mcp",
    concept: "MCP",
    title: "Discover and call an MCP tool in the browser",
    description:
      "A real MCP client and a tiny server, linked inside this page.",
    level: "Advanced",
    needs: "Local chat model; MCP demo runs in the browser",
    explain:
      "The browser connects an MCP client and a small archive server using the official SDK. It discovers the tool schema, offers it to the model, and routes tool calls back through MCP.",
    flow: "browser client → initialize → tools/list → model → tools/call → answer",
    first:
      "Discover the archive tool and inspect its schema, then ask a question. Both client and demo server run in this browser; no terminal is needed.",
    change:
      "Change the archive in mcp-server.js in the download, refresh, and ask again.",
    reflect: "What changes when tools come from a separate program?",
    defaults: {
      prompt:
        "Search the archive for risograph. What do I need to prepare before booking?",
    },
    mechanism:
      "The official SDK handles MCP initialization and JSON-RPC messages over a linked in-memory transport. Your local model receives the discovered schema; the browser client calls the server.",
    observe:
      "Inspect initialize, tools/list, and tools/call in the collapsed request log. Listing a tool describes it; calling it actually performs the search.",
    action: "Ask using the discovered tool",
    finalLabel: "Answer using the MCP archive",
    paragraphs: [
      "Tool calling defines a function directly in your application. Model Context Protocol (MCP) lets a client ask a server which tools it offers and how to call them. In this lesson, both the client and a small archive server run inside your browser, so you can discover and use a tool here without installing or starting another program.",
    ],
    reading: [
      {
        label: "MCP architecture",
        href: "https://modelcontextprotocol.io/docs/learn/architecture",
      },
      {
        label: "Official SDK client",
        href: "https://ts.sdk.modelcontextprotocol.io/client",
      },
    ],
    noteLabel: "How does it work?",
    noteSteps: [
      "**We connect a client to a small archive server.** Both run inside this browser for the demo. `connectArchive` uses the official MCP SDK and `InMemoryTransport` to carry messages between them, so you don’t need to start a separate server in a terminal. They still have different jobs: the server owns the archive search, and the client asks to use it.",
      "**The client asks which tools the server offers.** `client.listTools()` returns the name `search_archive`, a description of what it does, and the input it expects. Try “Discover archive tools” to inspect that description before asking a question. This discovery step gives our application the tool definition instead of requiring it to write that definition itself.",
      "**We offer the discovered tool to your local model.** When you ask about the risograph, the model receives your question and the archive tool’s definition. It can request a search with a keyword such as “risograph.” It can also reply without calling a tool, so check the request log to see whether a search actually happened.",
      "**The client routes a requested search to the server.** `client.callTool()` passes the tool name and arguments through MCP. The server checks the request, searches its small fictional handbook, and returns matching passages. Those results appear in the page and go back to the model, which can use them to answer your original question.",
      "**Follow the exchange in the request log.** You can see the connection being initialized, the tool listing, and any tool calls. Listing a tool tells us what it can do; calling it runs the search. In the download, try changing the handbook in `mcp-server.js` and refreshing before asking again. The changed answer should come from the server’s new material, without changing the tool definition in the client.",
    ],
  },
];
