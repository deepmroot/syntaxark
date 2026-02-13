import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup stale voice signals and rate limits",
  { minutes: 2 },
  internal.chat.cleanupStaleSignals,
  {},
);

export default crons;
