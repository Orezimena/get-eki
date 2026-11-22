import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { AuthContext, type AuthValue } from "../src/lib/auth";
import { MarketForm } from "../src/components/MarketForm";
import { Route as ManageRoute } from "../src/routes/admin/manage-markets";
import type { Market } from "../src/lib/eki";
import { Route } from "../src/routes/admin/add-market";
import { Route as AdminRoute } from "../src/routes/admin/index";
import { Route as DirectoryRoute } from "../src/routes/markets/index";
import {
  marketDraftSchema,
  marketSlug,
  createMarketCreator,
  marketDraftFromRecord,
} from "../src/lib/market-creation";
import { feeRange, withinStallBudget } from "../src/lib/eki";

const draft = {
  name: " Test Market ",
  city: "Leeds",
  location: "Town   Hall",
  region: "Yorkshire",
  type: "Makers market",
  slug: "test-market-leeds",
  description: "",
  stall_fee_min: "",
  stall_fee_max: "",
};
function harness(
  options: {
    slug?: unknown;
    duplicate?: unknown;
    insert?: unknown;
    wait?: Promise<unknown>;
    network?: boolean;
  } = {},
  existing?: Pick<Market, "id" | "slug" | "region">,
) {
  const calls: unknown[][] = [];
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      const filters: unknown[][] = [];
      const chain = {
        select(columns: string) {
          calls.push(["select", columns]);
          return chain;
        },
        eq(...args: unknown[]) {
          filters.push(["eq", ...args]);
          return chain;
        },
        neq(...args: unknown[]) {
          filters.push(["neq", ...args]);
          return chain;
        },
        update(values: unknown) {
          calls.push(["update", values]);
          return chain;
        },
        ilike(...args: unknown[]) {
          filters.push(["ilike", ...args]);
          return chain;
        },
        async limit(n: number) {
          calls.push(["preflight", filters, n]);
          if (options.network) throw new Error("Network unavailable");
          return filters.some((filter) => filter[1] === "slug")
            ? (options.slug ?? { data: [], error: null })
            : (options.duplicate ?? { data: [], error: null });
        },
        insert(values: unknown) {
          calls.push(["insert", values]);
          return chain;
        },
        async single() {
          calls.push(["single", filters]);
          if (options.wait) await options.wait;
          if (options.insert instanceof Error) throw options.insert;
          return options.insert ?? { data: { id: 42, slug: draft.slug }, error: null };
        },
      };
      return chain;
    },
  };
  return {
    calls,
    create: createMarketCreator(client as Parameters<typeof createMarketCreator>[0], existing),
  };
}

test("minimum valid market normalises text and represents unknown fees as NULL", () => {
  const parsed = marketDraftSchema.parse(draft);
  assert.equal(parsed.name, "Test Market");
  assert.equal(parsed.location, "Town Hall");
  assert.equal(parsed.stall_fee_min, null);
  assert.equal(parsed.stall_fee_max, null);
});
test("required fields, supported regions and safe slugs are validated", () => {
  for (const field of ["name", "city", "location", "type", "region", "slug"])
    assert.equal(marketDraftSchema.safeParse({ ...draft, [field]: " " }).success, false);
  for (const slug of ["../admin", "Bad Slug", "a--b", "https://example.com", "a/other"])
    assert.equal(marketDraftSchema.safeParse({ ...draft, slug }).success, false);
  assert.equal(marketDraftSchema.safeParse({ ...draft, region: "not a region" }).success, false);
});
test("fee validation rejects partial, negative, non-finite, imprecise and inverted ranges", () => {
  for (const [min, max] of [
    ["", "10"],
    ["10", ""],
    ["-1", "0"],
    ["NaN", "5"],
    ["1.001", "5"],
    ["0.25", "1.50"],
    ["10.00", "20"],
    ["20", "10"],
    ["1e2", "200"],
    ["0", "100001"],
  ])
    assert.equal(
      marketDraftSchema.safeParse({ ...draft, stall_fee_min: min, stall_fee_max: max }).success,
      false,
    );
  for (const [min, max] of [
    ["0", "0"],
    ["10", "20"],
  ])
    assert.equal(
      marketDraftSchema.safeParse({ ...draft, stall_fee_min: min, stall_fee_max: max }).success,
      true,
    );
});
test("suggested slugs are safe, accented names work, and punctuation alone remains invalid", () => {
  assert.equal(marketSlug("Café & Craft!", "Leeds"), "cafe-craft-leeds");
  assert.equal(marketSlug("!!!", ""), "");
  assert.ok(marketSlug("x".repeat(200), "London").length <= 160);
});
test("successful creation inserts once, returns matching identity and supplies explicit unknown fees", async () => {
  const h = harness();
  assert.deepEqual(await h.create(draft), { id: 42, slug: draft.slug });
  const payload = h.calls.find((call) => call[0] === "insert")![1] as Record<string, unknown>;
  assert.equal(payload.name, "Test Market");
  assert.equal(payload.location, "Town Hall");
  assert.equal(payload.stall_fee_min, null);
  assert.equal(payload.description, null);
  assert.deepEqual(payload.categories_accepted, []);
  assert.deepEqual(h.calls.filter((call) => call[0] === "select").at(-1), ["select", "id,slug"]);
  assert.equal(h.calls.filter((call) => call[0] === "insert").length, 1);
});
test("slug and identity duplicates stop before INSERT", async () => {
  for (const options of [
    { slug: { data: [{ id: 1 }], error: null } },
    { duplicate: { data: [{ id: 1 }], error: null } },
  ]) {
    const h = harness(options);
    await assert.rejects(h.create(draft), /already/);
    assert.equal(
      h.calls.some((call) => call[0] === "insert"),
      false,
    );
  }
});
test("duplicate identity checks escape LIKE wildcard characters", async () => {
  const h = harness();
  await h.create({ ...draft, name: "100%_Market" });
  assert.ok(JSON.stringify(h.calls).includes("100\\\\%\\\\_Market"));
});
test("preflight database/network errors fail closed and never insert", async () => {
  for (const options of [
    { network: true },
    { slug: { data: null, error: { message: "denied" } } },
  ]) {
    const h = harness(options);
    await assert.rejects(h.create(draft));
    assert.equal(
      h.calls.some((call) => call[0] === "insert"),
      false,
    );
  }
});
test("RLS errors, unique races, missing rows and mismatched returned identities never succeed", async () => {
  for (const insert of [
    { data: null, error: { code: "42501" } },
    { data: null, error: { code: "23505" } },
    { data: null, error: null },
    { data: { id: 42, slug: "wrong" }, error: null },
    { data: { id: null, slug: draft.slug }, error: null },
  ])
    await assert.rejects(harness({ insert }).create(draft));
});
test("duplicate clicks cannot create two in-flight inserts; failure permits a later retry", async () => {
  let finish!: () => void;
  const h = harness({
    wait: new Promise<void>((resolve) => {
      finish = resolve;
    }),
  });
  const first = h.create(draft);
  await assert.rejects(h.create(draft), /already being saved/);
  finish();
  await first;
  assert.equal(h.calls.filter((call) => call[0] === "insert").length, 1);
  const failed = harness({ insert: { data: null, error: { code: "42501" } } });
  await assert.rejects(failed.create(draft));
  await assert.rejects(failed.create(draft));
  assert.equal(failed.calls.filter((call) => call[0] === "insert").length, 2);
});
test("unknown fees never display as £0 and price filters distinguish unknown from confirmed free", () => {
  assert.equal(feeRange({ stall_fee_min: null, stall_fee_max: null }), "Stall fee not confirmed");
  assert.equal(feeRange({ stall_fee_min: 0, stall_fee_max: 0 }), "£0");
  assert.equal(feeRange({ stall_fee_min: 25, stall_fee_max: 50 }), "£25–£50");
  assert.equal(withinStallBudget({ stall_fee_min: null }, null), true);
  assert.equal(withinStallBudget({ stall_fee_min: null }, 50), false);
  assert.equal(withinStallBudget({ stall_fee_min: 0 }, 50), true);
  assert.equal(withinStallBudget({ stall_fee_min: 150 }, null), true);
  assert.equal(withinStallBudget({ stall_fee_min: 60 }, 50), false);
});

const auth: AuthValue = {
  user: { id: "admin-a" } as AuthValue["user"],
  session: null,
  profile: null,
  isAdmin: true,
  loading: false,
  error: null,
  signOut: async () => {},
  refreshProfile: async () => {},
  retry: async () => {},
  saveProfile: async () => {},
};
async function render(authValue: AuthValue, Page = Route.options.component!) {
  const client = new QueryClient();
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={authValue}>
          <Page />
        </AuthContext.Provider>
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const html = renderToStaticMarkup(<RouterProvider router={router} />);
  client.clear();
  return html;
}
test("only authenticated ready admins see the form", async () => {
  for (const state of [
    { ...auth, user: null },
    { ...auth, isAdmin: false },
    { ...auth, loading: true },
    { ...auth, error: "Account unavailable" },
  ]) {
    assert.doesNotMatch(await render(state), /Create market|<form/);
  }
  const html = await render(auth);
  assert.match(html, /Create market/);
  assert.match(html, /Leave both blank if unknown/);
  for (const field of [
    "name",
    "city",
    "location",
    "type",
    "region",
    "slug",
    "description",
    "stall_fee_min",
    "stall_fee_max",
  ])
    assert.ok(html.includes(`for="${field}"`));
});
test("migration structurally enforces admin INSERT and uniqueness without changing records", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20261121010000_admin_add_market.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /AS RESTRICTIVE FOR INSERT TO PUBLIC/);
  assert.match(sql, /AS PERMISSIVE FOR INSERT TO authenticated/);
  assert.match(sql, /WITH CHECK \(public.has_role\(auth.uid\(\), 'admin'::public.app_role\)\)/);
  assert.match(sql, /CREATE UNIQUE INDEX markets_creation_slug_key/);
  assert.match(sql, /CREATE UNIQUE INDEX markets_creation_identity_key/);
  assert.doesNotMatch(sql, /^\s*(UPDATE|DELETE FROM)\s/im);
});

test("dashboard entry point is available only to signed-in administrators", async () => {
  const html = await render(auth, AdminRoute.options.component!);
  assert.match(html, /href="\/admin\/add-market"/);
  for (const value of [
    { ...auth, isAdmin: false },
    { ...auth, user: null },
  ]) {
    assert.doesNotMatch(await render(value, AdminRoute.options.component!), /Add Market/);
  }
});

test("new unrated market is visible in the public directory and unknown fees are not £0", async () => {
  const created = await harness().create(draft);
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  client.setQueryData(
    ["markets"],
    [
      {
        ...marketDraftSchema.parse(draft),
        ...created,
        created_at: "2026-11-21T10:00:00Z",
        categories_accepted: [],
      },
    ],
  );
  client.setQueryData(["reviews", "approved"], []);
  const Page = DirectoryRoute.options.component!;
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <Page />
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const html = renderToStaticMarkup(<RouterProvider router={router} />);
  assert.match(html, /Test Market/);
  assert.match(html, /href="\/markets\/test-market-leeds"/);
  assert.match(html, /Stall fee not confirmed/);
  assert.match(html, /No reviews yet/);
  assert.doesNotMatch(html, /£0/);
  client.clear();
});

const record: Market = {
  id: 42,
  name: "Original market",
  slug: "test-market-leeds",
  city: "Leeds",
  location: "Town Hall",
  region: "Yorkshire",
  type: "Makers market",
  description: "Existing description",
  organiser: "Existing organiser",
  frequency: "Monthly",
  hours: "10–4",
  typical_days: "Saturday",
  postcode: "LS1 1AA",
  categories_accepted: ["Food", "Art"],
  stall_fee_min: null,
  stall_fee_max: null,
  created_at: "2026-11-21",
};
test("editing prepopulates every supported field, including unknown and free fees", () => {
  const values = marketDraftFromRecord(record);
  assert.equal(values.organiser, record.organiser);
  assert.equal(values.frequency, record.frequency);
  assert.equal(values.hours, record.hours);
  assert.equal(values.typical_days, record.typical_days);
  assert.equal(values.postcode, record.postcode);
  assert.deepEqual(values.categories_accepted, record.categories_accepted);
  assert.equal(values.stall_fee_min, "");
  assert.equal(values.slug, record.slug);
  assert.equal(
    marketDraftFromRecord({ ...record, stall_fee_min: 0, stall_fee_max: 0 }).stall_fee_min,
    "0",
  );
});
test("edit UPDATE preserves ID, slug and reviews and excludes itself from duplicate checks", async () => {
  const h = harness({}, record);
  const changed = {
    ...marketDraftFromRecord(record),
    name: "Renamed market",
    organiser: "New organiser",
  };
  assert.deepEqual(await h.create(changed), { id: 42, slug: record.slug });
  assert.equal(
    h.calls.some((call) => call[0] === "insert"),
    false,
  );
  assert.deepEqual(
    h.calls.find((call) => call[0] === "single"),
    [
      "single",
      [
        ["eq", "id", 42],
        ["eq", "slug", record.slug],
      ],
    ],
  );
  const payload = h.calls.find((call) => call[0] === "update")![1] as Record<string, unknown>;
  assert.equal(payload.name, "Renamed market");
  assert.equal(payload.organiser, "New organiser");
  for (const key of ["id", "slug", "created_at"]) assert.equal(key in payload, false);
  assert.equal(
    h.calls.filter((call) => call[0] === "from").every((call) => call[1] === "markets"),
    true,
  );
  const checks = h.calls.filter((call) => call[0] === "preflight");
  for (const call of checks) assert.ok(JSON.stringify(call).includes('["neq","id",42]'));
});
test("edits reject another market's duplicate and never report success for zero or wrong returned rows", async () => {
  const values = marketDraftFromRecord(record);
  const duplicate = harness({ duplicate: { data: [{ id: 77 }], error: null } }, record);
  await assert.rejects(duplicate.create(values), /already exists/);
  assert.equal(
    duplicate.calls.some((call) => call[0] === "update"),
    false,
  );
  for (const insert of [
    { data: null, error: null },
    { data: { id: 77, slug: record.slug }, error: null },
    { data: null, error: { code: "42501" } },
  ]) {
    await assert.rejects(harness({ insert }, record).create(values), /could not confirm/i);
  }
});
test("editing cannot change a slug but permits preserved legacy URLs", async () => {
  await assert.rejects(
    harness({}, record).create({ ...marketDraftFromRecord(record), slug: "new-url" }),
  );
  const legacy = { ...record, slug: "Legacy_URL" };
  const h = harness({ insert: { data: { id: 42, slug: legacy.slug }, error: null } }, legacy);
  assert.equal((await h.create(marketDraftFromRecord(legacy))).slug, legacy.slug);
});
test("shared edit form renders prepopulated details with a read-only URL", async () => {
  const Page = () => <MarketForm market={record} />;
  const html = await render(auth, Page);
  assert.match(html, /Edit Market/);
  assert.match(html, /Save changes/);
  for (const value of ["Existing organiser", "Monthly", "Saturday", "LS1 1AA", "Original market"])
    assert.ok(html.includes(value));
  assert.match(html, /id="slug"[^>]*readOnly/);
});
test("Manage Markets is protected and lists existing markets with accessible Edit buttons", async () => {
  for (const value of [
    { ...auth, user: null },
    { ...auth, isAdmin: false },
  ])
    assert.doesNotMatch(
      await render(value, ManageRoute.options.component!),
      /Loading markets|Edit Market/,
    );
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  client.setQueryData(["markets"], [record]);
  const Page = ManageRoute.options.component!;
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={auth}>
          <Page />
        </AuthContext.Provider>
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const html = renderToStaticMarkup(<RouterProvider router={router} />);
  assert.match(html, /Manage Markets/);
  assert.match(html, /aria-label="Edit Original market"/);
  client.clear();
});
test("UPDATE policies are restrictive and grants exclude immutable identity fields", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20261121010000_admin_add_market.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /AS RESTRICTIVE FOR UPDATE TO PUBLIC/);
  assert.match(sql, /AS PERMISSIVE FOR UPDATE TO authenticated/);
  const grant = sql.match(/GRANT UPDATE \(([^;]+)\) ON public.markets TO authenticated/);
  assert.ok(grant);
  assert.doesNotMatch(grant[1], /\b(id|slug|created_at)\b/);
});

test("edit network failures never report success and unchanged legacy regions remain editable", async () => {
  await assert.rejects(
    harness({ insert: new Error("Offline") }, record).create(marketDraftFromRecord(record)),
    /Offline/,
  );
  const legacy = { ...record, region: "East of England" };
  const h = harness({}, legacy);
  await h.create(marketDraftFromRecord(legacy));
  const payload = h.calls.find((call) => call[0] === "update")![1] as Record<string, unknown>;
  assert.equal(payload.region, legacy.region);
});

test("migration removes destructive grants and role self-assignment while preserving public reads", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20261121010000_admin_add_market.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    sql,
    /REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.markets\s+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(sql, /GRANT SELECT ON public.markets TO anon, authenticated/);
  assert.match(sql, /ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY/);
  assert.match(
    sql,
    /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN\s+ON public.user_roles FROM PUBLIC, anon, authenticated/,
  );
  assert.match(sql, /REVOKE INSERT \(%s\), UPDATE \(%s\), REFERENCES \(%s\) ON public.user_roles/);
  assert.match(sql, /REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(sql, /DROP POLICY/);
});

test("signup hook preserves inspected profile and user inserts without any automatic admin assignment", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20261121010000_admin_add_market.sql", import.meta.url),
    "utf8",
  );
  const match = sql.match(
    /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*?\$function\$([\s\S]*?)\$function\$;/,
  );
  assert.ok(match, "The inspected trigger function must be replaced in place");
  const expected = `BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
    END;`;
  const normalise = (text: string) => text.replace(/\s+/g, " ").trim();
  assert.equal(normalise(match[1]), normalise(expected));
  assert.doesNotMatch(match[1], /admin|IF NOT EXISTS|raw_user_meta_data|raw_app_meta_data/i);
  // No data mutation outside the future trigger body is introduced.
  const outsideHook = sql.replace(match[0], "");
  assert.doesNotMatch(outsideHook, /^\s*(INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s/im);
});

test("signup hook retains trigger compatibility and cannot be called by ordinary API roles", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20261121010000_admin_add_market.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)\s+RETURNS trigger\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path TO 'public'/,
  );
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.handle_new_user\(\) FROM PUBLIC, anon, authenticated/,
  );
  assert.doesNotMatch(
    sql,
    /(?:DROP|ALTER) FUNCTION public\.handle_new_user|ALTER FUNCTION public\.handle_new_user\(\) OWNER/i,
  );
  assert.doesNotMatch(sql, /(?:CREATE|DROP|ALTER) TRIGGER/i);
  assert.ok(
    sql.indexOf("CREATE OR REPLACE FUNCTION public.handle_new_user()") < sql.lastIndexOf("COMMIT;"),
  );
});

test("whole-pound fees use the same units through create, edit, display and budget filters", async () => {
  const h = harness();
  await h.create({ ...draft, stall_fee_min: "25", stall_fee_max: "50" });
  const payload = h.calls.find((call) => call[0] === "insert")![1] as Record<string, unknown>;
  assert.equal(payload.stall_fee_min, 25);
  assert.equal(payload.stall_fee_max, 50);
  const known = { ...record, stall_fee_min: 25, stall_fee_max: 50 };
  assert.equal(marketDraftFromRecord(known).stall_fee_min, "25");
  const edit = harness({}, known);
  await edit.create(marketDraftFromRecord(known));
  assert.equal(
    (edit.calls.find((call) => call[0] === "update")![1] as Record<string, unknown>).stall_fee_min,
    25,
  );
  assert.equal(feeRange(known), "£25–£50");
  assert.equal(withinStallBudget(known, 25), true);
  assert.equal(withinStallBudget(known, 20), false);
});

test("fractional fees cannot reach INSERT or UPDATE and the fee constraint validates existing rows", async () => {
  for (const existing of [undefined, record]) {
    const h = harness({}, existing);
    await assert.rejects(h.create({ ...draft, stall_fee_min: "25.50", stall_fee_max: "50" }));
    assert.equal(
      h.calls.some((call) => ["insert", "update"].includes(String(call[0]))),
      false,
    );
  }
  const sql = readFileSync(
    new URL("../supabase/migrations/20261121010000_admin_add_market.sql", import.meta.url),
    "utf8",
  );
  const constraint = sql.match(/ADD CONSTRAINT markets_creation_fee_range_check[\s\S]*?;/);
  assert.ok(constraint);
  assert.doesNotMatch(constraint[0], /NOT VALID/i);
  const form = readFileSync(new URL("../src/components/MarketForm.tsx", import.meta.url), "utf8");
  assert.match(form, /step="1"/);
  assert.match(form, /whole pounds, without pence/);
});

test("migration revokes PostgreSQL 17 maintenance and anonymous role-table read privileges", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20261121010000_admin_add_market.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    sql,
    /REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.markets\s+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    sql,
    /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN\s+ON public.user_roles FROM PUBLIC, anon, authenticated/,
  );
  assert.match(sql, /REVOKE SELECT ON public.user_roles FROM PUBLIC, anon/);
  assert.match(sql, /REVOKE SELECT \(%s\) ON public.user_roles FROM PUBLIC, anon/);
  assert.match(sql, /GRANT SELECT ON public.user_roles TO authenticated/);
});
