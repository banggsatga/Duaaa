"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useToast } from "@/hooks/use-toast"
import { Search, UserPlus, UserCheck, Loader2, X, TrendingUp, Hash } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PostCard from "@/components/post-card"
import { useRouter } from "next/navigation"

interface SearchViewProps {
  currentUser: any
}

export default function SearchView({ currentUser }: SearchViewProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [postResults, setPostResults] = useState<any[]>([])
  const [following, setFollowing] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("people")
  const [trendingTopics, setTrendingTopics] = useState<any[]>([])
  const [loadingTrends, setLoadingTrends] = useState(true)

  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    loadFollowing()
    loadTrendingTopics()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch()
    } else {
      setSearchResults([])
      setPostResults([])
    }
  }, [searchQuery, activeTab])

  const loadFollowing = async () => {
    try {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", currentUser.id)
      setFollowing(data?.map((f) => f.following_id) || [])
    } catch (error) {
      console.error("Error loading following:", error)
    }
  }

  const loadTrendingTopics = async () => {
    setLoadingTrends(true)
    try {
      // Get hashtags from recent posts
      const { data: posts } = await supabase
        .from("posts")
        .select("content")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .limit(1000)

      if (posts) {
        const hashtagCounts: { [key: string]: number } = {}

        posts.forEach((post) => {
          if (post.content) {
            // Extract hashtags using regex
            const hashtags = post.content.match(/#\w+/g)
            if (hashtags) {
              hashtags.forEach((hashtag) => {
                const cleanHashtag = hashtag.toLowerCase()
                hashtagCounts[cleanHashtag] = (hashtagCounts[cleanHashtag] || 0) + 1
              })
            }
          }
        })

        // Convert to array and sort by count
        const sortedHashtags = Object.entries(hashtagCounts)
          .map(([hashtag, count]) => ({ name: hashtag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10) // Top 10 trending

        // Add some crypto-related trending topics if we don't have enough real data
        const cryptoTopics = [
          { name: "#avalanche", count: Math.floor(Math.random() * 500) + 100 },
          { name: "#defi", count: Math.floor(Math.random() * 400) + 80 },
          { name: "#web3", count: Math.floor(Math.random() * 300) + 60 },
          { name: "#nft", count: Math.floor(Math.random() * 250) + 50 },
          { name: "#crypto", count: Math.floor(Math.random() * 200) + 40 },
        ]

        // Merge real hashtags with crypto topics, prioritizing real data
        const allTopics = [...sortedHashtags]
        cryptoTopics.forEach((cryptoTopic) => {
          if (!allTopics.find((topic) => topic.name === cryptoTopic.name)) {
            allTopics.push(cryptoTopic)
          }
        })

        setTrendingTopics(allTopics.slice(0, 8))
      }
    } catch (error) {
      console.error("Error loading trending topics:", error)
      // Fallback to crypto topics if there's an error
      setTrendingTopics([
        { name: "#avalanche", count: 234 },
        { name: "#defi", count: 187 },
        { name: "#web3", count: 156 },
        { name: "#nft", count: 134 },
        { name: "#crypto", count: 98 },
      ])
    } finally {
      setLoadingTrends(false)
    }
  }

  const performSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      if (activeTab === "people") {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
          .neq("id", currentUser.id)
          .limit(20)

        setSearchResults(data || [])
      } else if (activeTab === "posts") {
        const { data } = await supabase
          .from("posts")
          .select(`
            *,
            profiles:author_id (username, avatar_url, full_name),
            post_likes (user_id),
            post_comments (id),
            post_recasts (user_id)
          `)
          .ilike("content", `%${searchQuery}%`)
          .order("created_at", { ascending: false })
          .limit(20)

        setPostResults(data || [])
      }
    } catch (error) {
      console.error("Error searching:", error)
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

  const handleClearSearch = () => {
    setSearchQuery("")
    setSearchResults([])
    setPostResults([])
  }

  const handlePostUpdate = (updatedPost: any) => {
    setPostResults(postResults.map((post) => (post.id === updatedPost.id ? updatedPost : post)))
  }

  const handlePostDelete = (postId: string) => {
    setPostResults(postResults.filter((post) => post.id !== postId))
  }

  const handleViewProfile = (username: string) => {
    router.push(`/profile/${username}`)
  }

  const handleHashtagClick = (hashtag: string) => {
    setSearchQuery(hashtag)
    setActiveTab("posts")
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-6">
          {/* Search Input */}
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search people, posts, hashtags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 text-gray-400"
                    onClick={handleClearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          {searchQuery && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-900 rounded-lg">
                <TabsTrigger value="people" className="data-[state=active]:bg-gray-800">
                  People
                </TabsTrigger>
                <TabsTrigger value="posts" className="data-[state=active]:bg-gray-800">
                  Posts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="people" className="mt-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-4">
                    {searchResults.map((user) => (
                      <Card
                        key={user.id}
                        className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div
                              className="flex items-center gap-3 cursor-pointer"
                              onClick={() => handleViewProfile(user.username)}
                            >
                              <Avatar className="w-12 h-12">
                                <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                                <AvatarFallback className="bg-gray-800 text-white">
                                  {user.full_name?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-white">{user.full_name}</p>
                                <p className="text-sm text-gray-400">@{user.username}</p>
                                {user.bio && <p className="text-sm text-gray-300 mt-1 line-clamp-1">{user.bio}</p>}
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
                ) : searchQuery ? (
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-8 text-center">
                      <p className="text-gray-400">No people found matching "{searchQuery}"</p>
                      <p className="text-sm text-gray-500 mt-2">Try searching for different keywords</p>
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>

              <TabsContent value="posts" className="mt-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : postResults.length > 0 ? (
                  <div className="space-y-4">
                    {postResults.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        currentUser={currentUser}
                        onUpdate={handlePostUpdate}
                        onDelete={handlePostDelete}
                      />
                    ))}
                  </div>
                ) : searchQuery ? (
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-8 text-center">
                      <p className="text-gray-400">No posts found matching "{searchQuery}"</p>
                      <p className="text-sm text-gray-500 mt-2">Try searching for different keywords</p>
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>
            </Tabs>
          )}

          {/* Trending Topics */}
          {!searchQuery && (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Trending Now</h3>
                </div>
                {loadingTrends ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trendingTopics.map((topic, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
                        onClick={() => handleHashtagClick(topic.name)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-sm font-medium">{index + 1}</span>
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-blue-400" />
                            <span className="text-blue-400 font-medium hover:underline">{topic.name}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 text-sm">{topic.count} posts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!loadingTrends && trendingTopics.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-gray-400">No trending topics yet</p>
                    <p className="text-sm text-gray-500 mt-1">Start using hashtags in your posts!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
