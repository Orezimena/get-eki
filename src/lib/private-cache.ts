import type { QueryClient } from "@tanstack/react-query";

export function clearPrivateQueries(queryClient: QueryClient) {
  const privateQuery = (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === "review_votes" ||
    (query.queryKey[0] === "reviews" && query.queryKey[1] !== "approved");
  void queryClient.cancelQueries({ predicate: privateQuery });
  queryClient.removeQueries({ predicate: privateQuery });
}
