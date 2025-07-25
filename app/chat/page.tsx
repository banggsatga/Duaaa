import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import ChatView from "@/components/chat-view"

export default async function ChatPage() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

  if (!profile?.username) {
    redirect("/profile-setup")
  }

  // Get users that current user is following or has chatted with
  const { data: chatUsers } = await supabase.from("profiles").select("*").neq("id", profile.id).limit(20)

  return <ChatView currentUser={profile} chatUsers={chatUsers || []} />
}
