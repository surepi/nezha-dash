"use client";

import { ServerApi } from "@/app/types/nezha-api";
import ServerCard from "@/components/ServerCard";
import Switch from "@/components/Switch";
import getEnv from "@/lib/env-entry";
import { useFilter } from "@/lib/network-filter-context";
import { useStatus } from "@/lib/status-context";
import { nezhaFetcher } from "@/lib/utils";
import { GlobeAsiaAustraliaIcon } from "@heroicons/react/20/solid";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

export default function ServerListClient() {
  const { status } = useStatus();
  const { filter } = useFilter();
  const t = useTranslations("ServerListClient");
  const containerRef = useRef<HTMLDivElement>(null);
  const defaultTag = "defaultTag";
  const router = useRouter();

  const [tag, setTag] = useState<string>(defaultTag);

  useEffect(() => {
    const savedTag = sessionStorage.getItem("selectedTag") || defaultTag;
    setTag(savedTag);

    restoreScrollPosition();
  }, []);

  const handleTagChange = (newTag: string) => {
    setTag(newTag);
    sessionStorage.setItem("selectedTag", newTag);
    sessionStorage.setItem(
      "scrollPosition",
      String(containerRef.current?.scrollTop || 0),
    );
  };

  const restoreScrollPosition = () => {
    const savedPosition = sessionStorage.getItem("scrollPosition");
    if (savedPosition && containerRef.current) {
      containerRef.current.scrollTop = Number(savedPosition);
    }
  };

  useEffect(() => {
    const handleRouteChange = () => {
      restoreScrollPosition();
    };

    window.addEventListener("popstate", handleRouteChange);
    return () => {
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  const { data, error } = useSWR<ServerApi>("/api/server", nezhaFetcher, {
    refreshInterval: Number(getEnv("NEXT_PUBLIC_NezhaFetchInterval")) || 2000,
  });

  if (error)
    return (
      <div className="flex flex-col items-center justify-center">
        <p className="text-sm font-medium opacity-40">{error.message}</p>
        <p className="text-sm font-medium opacity-40">{t("error_message")}</p>
      </div>
    );

  if (!data?.result) return null;

  const { result } = data;
  const sortedServers = result.sort((a, b) => {
    const displayIndexDiff = (b.display_index || 0) - (a.display_index || 0);
    if (displayIndexDiff !== 0) return displayIndexDiff;
    return a.id - b.id;
  });

  const filteredServersByStatus =
    status === "all"
      ? sortedServers
      : sortedServers.filter((server) =>
          [status].includes(server.online_status ? "online" : "offline"),
        );

  const allTag = filteredServersByStatus
    .map((server) => server.tag)
    .filter(Boolean);
  const uniqueTags = [...new Set(allTag)];
  uniqueTags.unshift(defaultTag);

  const filteredServers =
    tag === defaultTag
      ? filteredServersByStatus
      : filteredServersByStatus.filter((server) => server.tag === tag);

  if (filter) {
    // 根据使用流量进行从高到低排序
    filteredServers.sort((a, b) => {
      return (
        b.status.NetInTransfer +
        b.status.NetOutTransfer -
        (a.status.NetInTransfer + b.status.NetOutTransfer)
      );
    });
  }

  const tagCountMap: Record<string, number> = {};
  filteredServersByStatus.forEach((server) => {
    if (server.tag) {
      tagCountMap[server.tag] = (tagCountMap[server.tag] || 0) + 1;
    }
  });

  return (
    <>
      <section className="flex items-center gap-2 w-full overflow-hidden">
        <button
          onClick={() => {
            router.push(`/?global=true`);
          }}
          className="rounded-[50px] text-white cursor-pointer [text-shadow:_0_1px_0_rgb(0_0_0_/_20%)] bg-blue-600 hover:bg-blue-500 p-[10px] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[inset_0_1px_0_rgba(0,0,0,0.2)] "
        >
          <GlobeAsiaAustraliaIcon className="size-[13px]" />
        </button>
        {getEnv("NEXT_PUBLIC_ShowTag") === "true" && (
          <Switch
            allTag={uniqueTags}
            nowTag={tag}
            tagCountMap={tagCountMap}
            onTagChange={handleTagChange}
          />
        )}
      </section>
      <section
        ref={containerRef}
        className="grid grid-cols-1 gap-2 md:grid-cols-2"
      >
        {filteredServers.map((serverInfo) => (
          <ServerCard key={serverInfo.id} serverInfo={serverInfo} />
        ))}
      </section>
    </>
  );
}
