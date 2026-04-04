export type RunMode = "normal" | "input_request";

// Not sure what this is for tbh
export type InputRequestLike = {
  id: string;
  question: unknown;
  answer?: unknown;
  assignedToActorId: string;
};
