import type { ModelContext } from "./register";

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }

  interface Navigator {
    readonly modelContext?: ModelContext;
  }
}

export {};
