import prisma from "@/lib/prisma";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatPanel, ChatProvider } from "@/components/chat-panel";
import { ChatChrome } from "@/components/chat-chrome";

export default async function Home() {
  const userCount = await prisma.user.count();

  return (
    <ChatProvider>
      <SidebarProvider className="h-svh">
        <ChatSidebar />
        <SidebarInset className="relative h-svh">
          <ChatPanel />
          <ChatChrome userCount={userCount} />
        </SidebarInset>
      </SidebarProvider>
    </ChatProvider>
  );
}
