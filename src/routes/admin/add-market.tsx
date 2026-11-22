import { createFileRoute } from "@tanstack/react-router";
import { AdminMarketAccess } from "@/components/AdminMarketAccess";
import { MarketForm } from "@/components/MarketForm";
export const Route = createFileRoute("/admin/add-market")({
  head: () => ({ meta: [{ title: "Add Market — Eki" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminMarketAccess>
      <MarketForm />
    </AdminMarketAccess>
  ),
});
