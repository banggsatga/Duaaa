import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import ProfileView from "@/components/profile-view"

export default async function ProfilePage() {
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

  // Get followers count
  const { count: followersCount } = await supabase
    .from("follows")
    .select("*", { count: "exact" })
    .eq("following_id", profile.id)

  // Get following count
  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact" })
    .eq("follower_id", profile.id)

  // Get user's posts
  const { data: posts } = await supabase
    .from("posts")
    .select(`
      *,
      profiles:author_id (username, avatar_url, full_name),
      post_likes (user_id),
      post_comments (id),
      post_recasts (user_id)
    `)
    .eq("author_id", profile.id)
    .order("created_at", { ascending: false })

  return (
    <ProfileView
      profile={profile}
      currentUser={profile}
      followersCount={followersCount || 0}
      followingCount={followingCount || 0}
      posts={posts || []}
      isOwnProfile={true}
    />
  )
}
