import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import ProfileSetupForm from "@/components/profile-setup-form"

export default async function ProfileSetup() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  // Check if user already has a profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

  if (profile?.username) {
    redirect("/dashboard")
  }

  return <ProfileSetupForm user={session.user} />
}
