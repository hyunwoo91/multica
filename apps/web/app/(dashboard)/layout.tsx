"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MulticaIcon } from "@/components/multica-icon";
import { useNavigationStore } from "@/features/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/features/auth";
import { useWorkspaceStore, WorkspaceAvatar } from "@/features/workspace";
import { AppSidebar } from "./_components/app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const workspace = useWorkspaceStore((s) => s.workspace);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    useNavigationStore.getState().onPathChange(pathname);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <MulticaIcon className="size-6" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        {/* Mobile-only header with sidebar trigger */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <WorkspaceAvatar name={workspace?.name ?? "M"} size="sm" />
          <span className="truncate text-sm font-medium">
            {workspace?.name ?? "Multica"}
          </span>
        </header>
        {workspace ? (
          children
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <MulticaIcon className="size-6 animate-pulse" />
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
