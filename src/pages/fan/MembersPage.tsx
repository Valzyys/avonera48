import { useSearchParams } from "react-router";
import { MemberCard } from "@/components/domain/Cards";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, EmptyState, ErrorState, Field, Input, PreviewTag, Select, Skeleton, Tabs } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { api } from "@/services";
import type { MemberStatus } from "@/types";

type StatusFilter = "all" | MemberStatus;

export default function MembersPage() {
  useDocumentTitle("Members");
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const generation = params.get("gen") ? Number(params.get("gen")) : undefined;
  const status = (params.get("status") as StatusFilter) || "all";
  const sort = params.get("sort") === "generation" ? "generation" : "name";

  const gens = useResource(() => api.listGenerations(), []);
  const live = useResource(() => api.listLiveNow(), []);
  const res = useResource(() => api.listMembers({ search, generation, status: status === "all" ? undefined : status, sort }), [search, generation, status, sort]);
  const liveSet = new Set(live.data?.map((l) => l.member.slug));

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (!v || v === "all") next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };
  const hasFilters = !!(search || generation || status !== "all");

  return (
    <div className="page">
      <PageHeader title="Members" lead="Search by name or nickname, filter by generation and status." aside={<PreviewTag>Sample profiles</PreviewTag>} />
      <div className="container page-body">
        <div className="member-filters">
          <Field label="Search members" hideLabel>
            {({ id }) => <Input id={id} icon="search" type="search" placeholder="Search name or nickname" value={search} onChange={(e) => set("q", e.target.value)} />}
          </Field>
          <Tabs
            segmented
            label="Status"
            value={status}
            onChange={(v) => set("status", v)}
            items={[
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "trainee", label: "Trainee" },
              { id: "graduated", label: "Graduated" },
            ]}
          />
          <Field label="Generation" hideLabel>
            {({ id }) => (
              <Select id={id} aria-label="Generation" value={generation ?? ""} onChange={(e) => set("gen", e.target.value)}>
                <option value="">All generations</option>
                {gens.data?.map((g) => (
                  <option key={g.number} value={g.number}>
                    {g.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Sort" hideLabel>
            {({ id }) => (
              <Select id={id} aria-label="Sort" value={sort} onChange={(e) => set("sort", e.target.value === "name" ? "" : e.target.value)}>
                <option value="name">Name A–Z</option>
                <option value="generation">Generation</option>
              </Select>
            )}
          </Field>
        </div>

        <p className="result-count meta" role="status" aria-live="polite">
          {res.data ? `${res.data.length} ${res.data.length === 1 ? "member" : "members"}` : "Loading…"}
          {hasFilters && res.data && (
            <button type="button" className="text-btn" onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </button>
          )}
        </p>

        {res.status === "error" ? (
          <ErrorState error={res.error} onRetry={res.reload} />
        ) : !res.data ? (
          <ul className="member-grid">
            {Array.from({ length: 12 }, (_, k) => (
              <li key={k}>
                <Skeleton height={240} />
              </li>
            ))}
          </ul>
        ) : res.data.length === 0 ? (
          <EmptyState icon="users" title="No members match" action={<Button size="sm" variant="secondary" onClick={() => setParams(new URLSearchParams())}>Clear filters</Button>}>
            Check the spelling or try another generation.
          </EmptyState>
        ) : (
          <ul className={`member-grid ${res.status === "loading" ? "is-refreshing" : ""}`} key={`${search}-${generation}-${status}-${sort}`}>
            {res.data.map((m, k) => (
              <MemberCard key={m.slug} member={m} live={liveSet.has(m.slug)} index={k} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
