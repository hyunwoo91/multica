"use client";

import { useState } from "react";
import { User, Palette, Key, Settings, Users, FolderGit2, MessageSquare, ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspaceStore } from "@/features/workspace";
import { AccountTab } from "./_components/account-tab";
import { AppearanceTab } from "./_components/general-tab";
import { TokensTab } from "./_components/tokens-tab";
import { WorkspaceTab } from "./_components/workspace-tab";
import { MembersTab } from "./_components/members-tab";
import { RepositoriesTab } from "./_components/repositories-tab";
import { ChannelsTab } from "./_components/channels-tab";

const accountTabs = [
  { value: "profile", label: "Profile", icon: User },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "tokens", label: "API Tokens", icon: Key },
];

const workspaceTabs = [
  { value: "workspace", label: "General", icon: Settings },
  { value: "repositories", label: "Repositories", icon: FolderGit2 },
  { value: "channels", label: "Channels", icon: MessageSquare },
  { value: "members", label: "Members", icon: Users },
];

const allTabs = [...accountTabs, ...workspaceTabs];

export default function SettingsPage() {
  const isMobile = useIsMobile();
  const workspaceName = useWorkspaceStore((s) => s.workspace?.name);
  const [activeTab, setActiveTab] = useState("profile");

  const activeLabel = allTabs.find((t) => t.value === activeTab)?.label ?? "Settings";

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} orientation={isMobile ? "horizontal" : "vertical"} className="flex-1 min-h-0 gap-0">
      {/* Mobile: dropdown tab selector */}
      {isMobile ? (
        <div className="flex h-12 shrink-0 items-center border-b px-4">
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Settings className="h-4 w-4" />
                {activeLabel}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            } />
            <DropdownMenuContent align="start" className="w-48">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">My Account</div>
              {accountTabs.map((tab) => (
                <DropdownMenuItem key={tab.value} onClick={() => setActiveTab(tab.value)}>
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </DropdownMenuItem>
              ))}
              <div className="px-2 py-1 pt-2 text-xs font-medium text-muted-foreground truncate">
                {workspaceName ?? "Workspace"}
              </div>
              {workspaceTabs.map((tab) => (
                <DropdownMenuItem key={tab.value} onClick={() => setActiveTab(tab.value)}>
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        /* Desktop: left nav */
        <div className="w-52 shrink-0 border-r overflow-y-auto p-4">
          <h1 className="text-sm font-semibold mb-4 px-2">Settings</h1>
          <TabsList variant="line" className="flex-col items-stretch">
            <span className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
              My Account
            </span>
            {accountTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}

            <span className="px-2 pb-1 pt-4 text-xs font-medium text-muted-foreground truncate">
              {workspaceName ?? "Workspace"}
            </span>
            {workspaceTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto p-4 md:p-6">
          <TabsContent value="profile"><AccountTab /></TabsContent>
          <TabsContent value="appearance"><AppearanceTab /></TabsContent>
          <TabsContent value="tokens"><TokensTab /></TabsContent>
          <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
          <TabsContent value="repositories"><RepositoriesTab /></TabsContent>
          <TabsContent value="channels"><ChannelsTab /></TabsContent>
          <TabsContent value="members"><MembersTab /></TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
