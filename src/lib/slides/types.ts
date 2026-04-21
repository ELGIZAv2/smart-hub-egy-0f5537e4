export type SlideType = "cover" | "section" | "content" | "quote" | "stats" | "closing";

export interface SlideStat { label: string; value: string; }

export interface Slide {
  type: SlideType;
  title?: string;
  subtitle?: string;
  kicker?: string;
  bullets?: string[];
  body?: string;
  quote?: string;
  attribution?: string;
  stats?: SlideStat[];
  author?: string;
  cta?: string;
  /** AI-suggested keywords for fetching a Pexels photo. */
  image_query?: string;
  /** Resolved photo URL injected by the backend. */
  image?: string;
}

export interface SlidePalette {
  primary: string;
  accent: string;
  bg: string;
  fg: string;
}

export interface SlideDeck {
  title: string;
  subtitle?: string;
  language?: string;
  templateId: string;
  palette: SlidePalette;
  slides: Slide[];
}
