"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useToast } from "@/hooks/use-toast"
import { Wallet, Menu, Home, Search, Bell, MessageCircle, User, Settings, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import PostCard from "@/components/post-card"
import CreatePost from "@/components/create-post"
import SuggestedUsers from "@/components/suggested-users"

interface DashboardProps {
  user: any
  profile: any
  initialPosts: any[]
}

export default function Dashboard({ user, profile, initialPosts }: DashboardProps) {
  const [posts, setPosts] = useState(initialPosts)
  const [activeTab, setActiveTab] = useState("following")
  const [showSidebar, setShowSidebar] = useState(false)
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  const handleNewPost = (newPost: any) => {
    setPosts([newPost, ...posts])
  }

  const handlePostUpdate = (updatedPost: any) => {
    setPosts(posts.map((post) => (post.id === updatedPost.id ? updatedPost : post)))
  }

  const handlePostDelete = (postId: string) => {
    setPosts(posts.filter((post) => post.id !== postId))
    toast({
      title: "Post deleted",
      description: "Your post has been removed successfully.",
    })
  }

  const navigateTo = (path: string) => {
    router.push(path)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-white hover:bg-gray-800"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile.avatar_url || "/placeholder.svg"} />
              <AvatarFallback className="bg-green-600 text-white text-sm">
                {profile.username?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigateTo("/wallet")}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-gray-800"
            >
              <Wallet className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        {showSidebar && (
          <div className="fixed inset-0 z-40 lg:relative lg:inset-auto">
            <div className="absolute inset-0 bg-black/50 lg:hidden" onClick={() => setShowSidebar(false)} />
            <div className="relative w-80 h-full bg-black border-r border-gray-800 p-4">
              <div className="flex items-center gap-3 mb-8">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={profile.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="bg-green-600 text-white text-xl">
                    {profile.username?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-white">{profile.full_name}</h3>
                  <p className="text-gray-400 text-sm">{profile.username}</p>
                </div>
              </div>

              <nav className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  onClick={() => navigateTo("/profile")}
                >
                  <User className="w-5 h-5 mr-3" />
                  Profile
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  onClick={() => navigateTo("/trade-launch")}
                >
                  <Plus className="w-5 h-5 mr-3" />
                  Trade Launch
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  onClick={() => toast({ title: "Coming Soon", description: "Refer & Earn feature is coming soon!" })}
                >
                  Refer & Earn
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  onClick={() => toast({ title: "Coming Soon", description: "Bookmarks feature is coming soon!" })}
                >
                  Bookmarks
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  onClick={() => toast({ title: "Coming Soon", description: "App Store feature is coming soon!" })}
                >
                  Start Trade App Store
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  onClick={() => toast({ title: "Coming Soon", description: "Tokenomics feature is coming soon!" })}
                >
                  $START Tokenomics
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  onClick={() => toast({ title: "Coming Soon", description: "Trading feature is coming soon!" })}
                >
                  StartTrade
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  onClick={() => toast({ title: "Coming Soon", description: "Settings feature is coming soon!" })}
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Setting & Support
                </Button>
              </nav>

              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full mt-8 border-gray-700 text-white hover:bg-gray-800 bg-transparent"
              >
                Log out
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 max-w-2xl mx-auto">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 pt-4">
            <TabsList className="grid w-full grid-cols-3 bg-transparent border-b border-gray-800 rounded-none h-auto p-0">
              <TabsTrigger
                value="following"
                className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500 text-gray-400 rounded-none pb-3"
              >
                Following
              </TabsTrigger>
              <TabsTrigger
                value="trenches"
                className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500 text-gray-400 rounded-none pb-3"
              >
                Markets
              </TabsTrigger>
              <TabsTrigger
                value="trending"
                className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500 text-gray-400 rounded-none pb-3"
              >
                Trending
              </TabsTrigger>
            </TabsList>

            <TabsContent value="following" className="mt-6 space-y-4">
              <SuggestedUsers currentUser={profile} />
              <CreatePost onPostCreated={handleNewPost} profile={profile} />
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={profile}
                    onUpdate={handlePostUpdate}
                    onDelete={handlePostDelete}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="trenches" className="mt-6">
              <div className="text-center py-12">
                <p className="text-gray-400">Markets data coming soon...</p>
              </div>
            </TabsContent>

            <TabsContent value="trending" className="mt-6">
              <div className="text-center py-12">
                <p className="text-gray-400">Trending content coming soon...</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-4 py-2">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Button variant="ghost" size="sm" className="text-green-500" onClick={() => navigateTo("/dashboard")}>
            <Home className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => navigateTo("/search")}>
            <Search className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => navigateTo("/notifications")}>
            <Bell className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => navigateTo("/chat")}>
            <MessageCircle className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => navigateTo("/profile")}>
            <User className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => navigateTo("/wallet")}>
            <Wallet className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Floating Action Button */}
      <Button
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 shadow-lg"
        onClick={() => navigateTo("/trade-launch")}
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  )
}
