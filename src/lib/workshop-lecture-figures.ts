import type { ImageMetadata } from "astro";
import computerLove from "../assets/week-11-computer-love.jpg";
import communityMemory from "../assets/week-12-community-memory.jpg";

const assets = import.meta.glob<ImageMetadata>(
  "../assets/workshop-lecture/*.webp",
  {
    eager: true,
    import: "default",
  },
);

const commons = "https://commons.wikimedia.org/wiki/File:";
const transformer = "https://arxiv.org/html/2408.04619v2";
const dinkins = "https://www.stephaniedinkins.com/ntoo.html";
const kite = "https://listart.mit.edu/exhibitions/list-projects-31-kite";
const lauren = "https://get-lauren.net/LAUREN";

function figure(
  asset: string | ImageMetadata,
  title: string,
  alt: string,
  source: string,
  credit: string,
  wide = false,
) {
  const image =
    typeof asset === "string"
      ? assets[`../assets/workshop-lecture/${asset}.webp`]
      : asset;

  if (!image) throw new Error(`Missing lecture figure ${asset}`);
  return { image, title, alt, source, credit, wide };
}

export const lectureFigures = {
  knowledge: [
    figure(
      "quipu",
      "Quipu, T-1198",
      "An Andean quipu with many knotted cords extending from a main cord.",
      commons + "Quipu,_T-1198.jpg",
      "Unknown Andean maker, 1450–1534. Photo by Bruce M. White Photography. Public domain.",
    ),
    figure(
      "i-ching",
      "Hexagram diagram sent to Leibniz",
      "A hexagram diagram marked with handwritten annotations.",
      commons +
        "Diagram_of_I_Ching_hexagrams_owned_by_Gottfried_Wilhelm_Leibniz,_1701.jpg",
      "1701, unknown maker. Public domain.",
    ),
    figure(
      "jacquard",
      "Jacquard loom punch cards",
      "A series of punched cards feeding into a loom.",
      commons +
        "A_Jacquard_loom_showing_information_punchcards,_National_Museum_of_Scotland.jpg",
      "Photo by Stephen C. Dickson, resized, CC BY-SA 4.0.",
    ),
    figure(
      "naca",
      "Human computers at work",
      "Women working at desks in the NACA computing section.",
      commons + "Early_NACA_Human_Computers_at_Work_(7538103290).jpg",
      "NASA on The Commons, 1949. No known copyright restrictions.",
    ),
    figure(
      "eniac",
      "Reprogramming ENIAC",
      "Two operators working at large panels and wiring on ENIAC.",
      commons + "Reprogramming_ENIAC.png",
      "Unidentified U.S. Army photographer, 1946. Public domain.",
    ),
  ],
  language: [
    figure(
      "markov",
      "Andrey Markov",
      "Black-and-white portrait of Andrey Markov.",
      commons + "AAMarkov.jpg",
      "Public domain.",
    ),
    figure(
      "markov-weather",
      "Markov state transitions",
      "Sunny and rainy states connected by four arrows labeled with probabilities.",
      commons + "Markov_Chain_weather_model_matrix_as_a_graph.png",
      "Pmdusso, CC BY-SA 3.0.",
    ),
    figure(
      "eliza",
      "A conversation with ELIZA",
      "A monochrome transcript of a person exchanging messages with ELIZA.",
      commons + "ELIZA_conversation.png",
      "Unknown author. Public domain.",
    ),
    figure(
      computerLove,
      "Christopher Strachey’s Love-Letters program",
      "A generated love letter addressed to Dear Moppet and signed MUC.",
      "https://timeline.lerandom.art/m/love-letters-by-christopher-strachey",
      "Computer Love by NightCity85, CC BY-NC-ND 2.0.",
    ),
    figure(
      communityMemory,
      "Community Memory workstation",
      "A wooden public bulletin-board terminal with a screen, keyboard, and coin slot.",
      commons +
        "Community_Memory_Project_coin-op_workstation_1,_Computer_History_Museum,_Mountain_View,_California,_USA_(49502016452).jpg",
      "Photo by Cory Doctorow, resized, CC BY-SA 2.0.",
    ),
  ],
  models: [
    figure(
      "neural-network",
      "A layered neural network",
      "A diagram of nodes and arrows connecting an input layer, hidden layer, and output layer.",
      commons + "Artificial_neural_network.svg",
      "Cburnett, rasterized, CC BY-SA 3.0.",
    ),
    figure(
      "decoder",
      "Decoder-only transformer",
      "A schematic of repeated attention and feed-forward blocks that lead to next-token probabilities.",
      transformer,
      "Aeree Cho et al., Transformer Explainer, fig. 2, resized, CC BY.",
      true,
    ),
    figure(
      "embedding",
      "From token ID to embedding",
      "An explainer shows token IDs and positional information as vectors.",
      transformer,
      "Aeree Cho et al., Transformer Explainer, fig. 5, resized, CC BY.",
    ),
    figure(
      "sampling",
      "From logits to sampling",
      "A step-by-step diagram compares raw scores, filtered scores, and probabilities.",
      transformer,
      "Aeree Cho et al., Transformer Explainer, fig. 4, resized, CC BY.",
    ),
    figure(
      "transformer",
      "A token’s path through GPT-2",
      "An overview of the Transformer Explainer with embeddings, attention heads, and ranked next tokens.",
      transformer,
      "Aeree Cho et al., Transformer Explainer, fig. 1, resized, CC BY.",
      true,
    ),
  ],
  extraction: [
    figure(
      "moths",
      "A nineteenth-century classification plate",
      "A plate arranging and naming six moth specimens.",
      commons +
        "Illustrations_of_typical_specimens_of_Lepidoptera_Heterocera_in_the_collection_of_the_British_Museum_(Pl._CXX)_(9005217351).jpg",
      "British Museum (Natural History), 1886. Public domain.",
    ),
    figure(
      "imagenet-roulette",
      "ImageNet Roulette",
      "Faces in a photograph are enclosed in green boxes with labels overlaid.",
      "https://paglen.studio/2020/04/29/imagenet-roulette/",
      "Kate Crawford and Trevor Paglen, project documentation.",
    ),
    figure(
      "anatomy",
      "Extractive operations",
      "A diagram of the terraced contours and roads of a mining operation.",
      "https://anatomyof.ai/",
      "Kate Crawford and Vladan Joler, Anatomy of an AI System, 2018.",
    ),
    figure(
      "salar",
      "Salar de Atacama",
      "A satellite view of the Atacama salt flat in Chile.",
      commons + "Salar_de_Atacama_-_Chile.jpg",
      "European Union, Copernicus Sentinel-2 imagery, 2020.",
    ),
    figure(
      "servers",
      "PDC server room",
      "Tall racks filled with computing equipment and cables.",
      commons + "PDC_server_room.jpg",
      "Photo by Johan Fredriksson, resized, CC BY-SA 3.0.",
    ),
  ],
  futures: [
    figure(
      "ntoo",
      "Not the Only One",
      "A dark sculptural head with multiple faces on a wooden plinth.",
      dinkins,
      "Stephanie Dinkins. Photo by Paula Virta, EMMA – Espoo Museum of Modern Art.",
    ),
    figure(
      "ntoo-prep",
      "Dinkins working on Not the Only One",
      "A black-and-white photograph of the artist at a computer among equipment.",
      dinkins,
      "Process photograph from Stephanie Dinkins’s project page.",
    ),
    figure(
      "kite-install",
      "Wičháȟpi Wóihaŋbleya (Dreamlike Star)",
      "A dark gallery with blue projections and stones arranged on the floor.",
      kite,
      "Kite, 2024. Installation view at MIT List Visual Arts Center, 2025. Photo by Dario Lasagni.",
    ),
    figure(
      "kite-detail",
      "Dreamlike Star, another moment in the installation",
      "Green and gold imagery lights the wall beside a blue projection and stones.",
      kite,
      "Kite, 2024. Installation view at MIT List Visual Arts Center, 2025. Photo by Dario Lasagni.",
    ),
    figure(
      "lauren-install",
      "LAUREN at Frankfurter Kunstverein",
      "Five screens and a small desk in a mostly white exhibition room.",
      lauren,
      "Lauren Lee McCarthy. Photo by Norbert Miguletz, 2020.",
    ),
    figure(
      "lauren-interface",
      "The LAUREN control interface",
      "A screenshot of multiple home-camera views and device controls.",
      lauren,
      "Screenshot from Lauren Lee McCarthy’s project documentation.",
    ),
  ],
};
