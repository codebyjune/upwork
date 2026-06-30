"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function ChatChrome({ userCount }: { userCount: number }) {
  return (
    <header className="bg-background absolute inset-x-0 top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center justify-between">
        <span className="text-sm font-medium">Superblog</span>
        <span className="text-muted-foreground text-xs">
          {userCount} 位用户
        </span>
      </div>
    </header>
  );
}