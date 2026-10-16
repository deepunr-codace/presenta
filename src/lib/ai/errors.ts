export type AiErrorCode = "auth" | "rate_limit" | "network" | "api" | "refused" | "parse" | "invalid";

/** Error surfaced by the AI layer; `code` is stable for the UI, `message` is human readable. */
export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = "AiError";
    this.code = code;
  }
}

/** The model declined to produce the deck (stop_reason "refusal"). */
export class AiRefusedError extends AiError {
  constructor(message = "The AI declined to generate content for this request. Try rephrasing the brief.") {
    super("refused", message);
    this.name = "AiRefusedError";
  }
}

/** The model answered but the output did not match the schema. */
export class AiParseError extends AiError {
  constructor(message = "The AI returned a response that could not be parsed into a deck. Please try again.") {
    super("parse", message);
    this.name = "AiParseError";
  }
}
