import type { StructuredRequest } from "@/lib/ai/structured-generator";

/** A StructuredGenerator that records every request and answers each with `output`. */
export function generatorAnswering(output: unknown) {
  const requests: StructuredRequest<unknown>[] = [];
  return {
    requests,
    generator: {
      async generate<T>(request: StructuredRequest<T>): Promise<T> {
        requests.push(request);
        return output as T;
      },
    },
  };
}
