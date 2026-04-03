"use client";

import { useEffect, useCallback } from "react";
import { ArrowLeft, Server } from "lucide-react";
import { useDefaultLayout } from "react-resizable-panels";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthStore } from "@/features/auth";
import { useWorkspaceStore } from "@/features/workspace";
import { useWSEvent } from "@/features/realtime";
import { useRuntimeStore } from "../store";
import { RuntimeList } from "./runtime-list";
import { RuntimeDetail } from "./runtime-detail";

export default function RuntimesPage() {
  const isMobile = useIsMobile();
  const isLoading = useAuthStore((s) => s.isLoading);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const runtimes = useRuntimeStore((s) => s.runtimes);
  const selectedId = useRuntimeStore((s) => s.selectedId);
  const fetching = useRuntimeStore((s) => s.fetching);
  const fetchRuntimes = useRuntimeStore((s) => s.fetchRuntimes);
  const setSelectedId = useRuntimeStore((s) => s.setSelectedId);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "multica_runtimes_layout",
  });

  useEffect(() => {
    if (workspace) fetchRuntimes();
  }, [workspace, fetchRuntimes]);

  // Re-fetch on daemon register/deregister events.
  // Heartbeat events are not broadcast over WS, so no handler needed.
  const handleDaemonEvent = useCallback(() => {
    fetchRuntimes();
  }, [fetchRuntimes]);

  useWSEvent("daemon:register", handleDaemonEvent);

  const selected = runtimes.find((r) => r.id === selectedId) ?? null;

  const detailContent = selected ? (
    <div className="flex flex-col h-full min-h-0">
      {isMobile && (
        <div className="flex h-12 shrink-0 items-center border-b px-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId("")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      )}
      <RuntimeDetail key={selected.id} runtime={selected} />
    </div>
  ) : (
    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
      <Server className="h-10 w-10 text-muted-foreground/30" />
      <p className="mt-3 text-sm">Select a runtime to view details</p>
    </div>
  );

  if (isLoading || fetching) {
    return (
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 md:flex-none md:w-72 border-r">
          <div className="flex h-12 items-center justify-between border-b px-4">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden md:block flex-1 p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Mobile: show list or detail, not both
  if (isMobile) {
    return (
      <div className="flex flex-1 min-h-0 flex-col">
        {selectedId ? detailContent : (
          <RuntimeList runtimes={runtimes} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="flex-1 min-h-0"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel
        id="list"
        defaultSize={280}
        minSize={240}
        maxSize={400}
        groupResizeBehavior="preserve-pixel-size"
      >
        <RuntimeList
          runtimes={runtimes}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel id="detail" minSize="50%">
        {detailContent}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
