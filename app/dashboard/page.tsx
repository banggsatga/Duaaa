import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import Dashboard from "@/components/dashboard"

export default async function DashboardPage() {
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

  const { data: posts } = await supabase
    .from("posts")
    .select(`
      *,
      profiles:author_id (username, avatar_url, full_name),
      post_likes (user_id),
      post_comments (id),
      post_recasts (user_id)
    `)
    .order("created_at", { ascending: false })
    .limit(20)

  return <Dashboard user={session.user} profile={profile} initialPosts={posts || []} />
}
