import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin tracing root to this project so Next doesn't scan the user's entire
  // home folder when there's a lockfile higher up. Without this Next walked
  // the whole home directory looking for files to include in the deploy
  // output trace, which made every dev compile painfully slow.
  outputFileTracingRoot: __dirname,

  // Don't trace the raw pipeline data into the deploy output. Those files
  // are huge (stemmer.json alone is 340 MB) and only used by preprocess —
  // never read at runtime by the Next.js app.
  outputFileTracingExcludes: {
    "*": [
      "public/data/stemmer.json",
      "public/data/cases.json",
      "public/data/case_steps.json",
      "public/data/vote_case_actors.json",
      "public/data/actor_relations.json",
      "public/data/emneord_sag.json",
      "public/data/agenda_items.json",
      "public/data/topics.json",
      "public/data/members.json",
      "public/data/votes.json",
      "public/data/meetings.json",
      "public/data/meetings_list.json",
      "public/data/meeting_actors.json",
      "public/data/periods.json",
      "pipeline/**",
    ],
  },

  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
