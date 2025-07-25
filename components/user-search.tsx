"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useToast } from "@/hooks/use-toast"
import { Search, UserPlus, UserCheck } from "lucide-react"

interface UserSearchProps {
  currentUser: any
}

export default function UserSearch({ currentUser }: UserSearchProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [following, setFollowing] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    loadFollowing()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers()
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  const loadFollowing = async () => {
    try {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", currentUser.id)
      setFollowing(data?.map((f) => f.following_id) || [])
    } catch (error) {
      console.error("Error loading following:", error)
    }
  }

  const searchUsers = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .neq("id", currentUser.id)
        .limit(10)

      setSearchResults(data || [])
    } catch (error) {
      console.error("Error searching users:", error)
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

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <h3 className="text-lg font-semibold text-white">Discover Builders</h3>
          <p className="text-sm text-gray-400">Find crypto natives and Web3 builders</p>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by username or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
            />
          </div>
        </CardContent>
      </Card>

      {searchResults.length > 0 && (
        <div className="space-y-4">
          {searchResults.map((user) => (
            <Card key={user.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-gray-800 text-white">{user.full_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-white">{user.full_name}</p>
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
                        : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                    }
                  >
                    {following.includes(user.id) ? (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {searchQuery && searchResults.length === 0 && !loading && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-8 text-center">
            <p className="text-gray-400">No builders found matching "{searchQuery}"</p>
            <p className="text-sm text-gray-500 mt-2">Try searching for different keywords</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
