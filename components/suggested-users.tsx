"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useToast } from "@/hooks/use-toast"

interface SuggestedUsersProps {
  currentUser: any
}

export default function SuggestedUsers({ currentUser }: SuggestedUsersProps) {
  const [following, setFollowing] = useState<string[]>([])
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    loadFollowing()
    loadSuggestedUsers()
  }, [])

  const loadFollowing = async () => {
    try {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", currentUser.id)
      setFollowing(data?.map((f) => f.following_id) || [])
    } catch (error) {
      console.error("Error loading following:", error)
    }
  }

  const loadSuggestedUsers = async () => {
    try {
      const { data } = await supabase.from("profiles").select("*").neq("id", currentUser.id).limit(6)

      setSuggestedUsers(data || [])
    } catch (error) {
      console.error("Error loading suggested users:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFollow = async (userId: string) => {
    try {
      const isFollowing = following.includes(userId)

      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", userId)
        setFollowing(following.filter((id) => id !== userId))
        toast({
          title: "Unfollowed",
          description: "You are no longer following this user.",
        })
      } else {
        await supabase.from("follows").insert({
          follower_id: currentUser.id,
          following_id: userId,
          created_at: new Date().toISOString(),
        })
        setFollowing([...following, userId])
        toast({
          title: "Following",
          description: "You are now following this user.",
        })
      }
    } catch (error) {
      console.error("Error toggling follow:", error)
      toast({
        title: "Error",
        description: "Failed to update follow status.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <Card className="bg-black border-gray-800">
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-gray-400">Loading suggested users...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (suggestedUsers.length === 0) {
    return (
      <Card className="bg-black border-gray-800">
        <CardContent className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Start Trade!</h2>
            <p className="text-gray-400">Start by creating your first post or inviting friends to join.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-black border-gray-800">
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to Start Trade!</h2>
          <p className="text-gray-400">Follow some traders below to get started</p>
        </div>

        <div className="space-y-4">
          {suggestedUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="bg-gray-800 text-white">
                    {user.full_name?.charAt(0) || user.username?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{user.full_name || user.username}</p>
                  </div>
                  <p className="text-sm text-gray-400">@{user.username}</p>
                </div>
              </div>

              <Button
                onClick={() => handleFollow(user.id)}
                variant={following.includes(user.id) ? "secondary" : "default"}
                size="sm"
                className={
                  following.includes(user.id)
                    ? "bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
                    : "bg-white hover:bg-gray-100 text-black font-semibold px-6"
                }
              >
                {following.includes(user.id) ? "Following" : "Follow"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
