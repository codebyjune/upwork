"use client";

import { Plus, MessageSquare } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useChat } from "@/components/chat-panel";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
};


export function ChatSidebar() {
  const { activeId, setActiveId, newChat,resetNonce } = useChat();
  const [convs, SetConvs] = useState<Conversation[]>([]);
  const [isConvsLoading, setIsConvsLoading] = useState(false);
  const getList = async () => {
    setIsConvsLoading(true);
    try {
      const res = await fetch("api/conversations");
      const data = await res.json();
      SetConvs(data);
    } catch (error) {
      toast.error(
        "获取对话列表失败"
      );
    } finally {
      setIsConvsLoading(false);
    }
  };
  useEffect(() => {
    getList();
  }, [resetNonce]);
  return (
    <Sidebar collapsible="icon" side="left">
      <SidebarHeader className="gap-2 px-2 py-3">
        <Button
          variant="default"
          className="w-full justify-start gap-2"
          onClick={() => newChat()}
        >
          <Plus className="h-4 w-4" />
          <span>新对话</span>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>最近对话</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {convs.map((conv) => (
                <SidebarMenuItem key={conv.id} className={`{activeId === conv.id ? 'bg-accent' : ''} hover:bg-accent/50"`}> 
                  <SidebarMenuButton
                    tooltip={conv.title}
                    isActive={activeId === conv.id}
                    onClick={() => setActiveId(conv.id)}
                    className="h-auto py-2"
                  >
                   
                    <div className="flex flex-col leading-tight">
                      <span className="truncate text-sm">{conv.title}</span>
                   
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
