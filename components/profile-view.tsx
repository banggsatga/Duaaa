"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Edit, UserPlus, UserCheck, MessageCircle, Calendar, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useToast } from "@/hooks/use-toast"
import PostCard from "@/components/post-card"
import { formatDistanceToNow } from "date-fns"
import { uploadToPinata } from "@/lib/pinata"

interface ProfileViewProps {
  profile: any
  currentUser: any
  followersCount: number
  followingCount: number
  posts: any[]
  isOwnProfile: boolean
  isFollowing?: boolean
}

export default function ProfileView({
  profile,
  currentUser,
  followersCount,
  followingCount,
  posts,
  isOwnProfile,
  isFollowing = false,
}: ProfileViewProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [editedProfile, setEditedProfile] = useState({
    username: profile.username || "",
    full_name: profile.full_name || "",
    bio: profile.bio || "",
  })
  const [profileImage, setProfileImage] = useState<File | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [following, setFollowing] = useState(isFollowing)
  const [followersCountState, setFollowersCountState] = useState(followersCount)

  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setProfileImage(file)
      const url = URL.createObjectURL(file)
      setProfileImageUrl(url)
    }
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    try {
      let avatarUrl = profile.avatar_url

      if (profileImage) {
        setUploadingImage(true)
        try {
          const fileName = `avatar-${profile.id}-${Date.now()}.${profileImage.name.split(".").pop()}`
          avatarUrl = await uploadToPinata(profileImage, fileName)

          toast({
            title: "Avatar uploaded to IPFS!",
            description: "Profile picture updated successfully via Pinata.",
          })
        } catch (error) {
          console.error("Error uploading avatar to Pinata:", error)
          toast({
            title: "Avatar upload failed",
            description: "Profile updated without new image.",
            variant: "destructive",
          })
          avatarUrl = profile.avatar_url // Keep old avatar if upload fails
        } finally {
          setUploadingImage(false)
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          username: editedProfile.username,
          full_name: editedProfile.full_name,
          bio: editedProfile.bio,
          avatar_url: avatarUrl, // IPFS URL from Pinata
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)

      if (error) throw error

      toast({
        title: "Profile updated!",
        description: "Your profile has been updated with IPFS storage.",
      })

      setShowEditModal(false)
      window.location.reload() // Refresh to show updated data
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFollow = async () => {
    try {
      if (following) {
        await supabase.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", profile.id)
        setFollowing(false)
        setFollowersCountState(followersCountState - 1)
        toast({
          title: "Unfollowed",
          description: `You are no longer following @${profile.username}`,
        })
      } else {
        await supabase.from("follows").insert({
          follower_id: currentUser.id,
          following_id: profile.id,
          created_at: new Date().toISOString(),
        })
        setFollowing(true)
        setFollowersCountState(followersCountState + 1)
        toast({
          title: "Following",
          description: `You are now following @${profile.username}`,
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

  const handleMessage = () => {
    router.push(`/chat?user=${profile.username}`)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-white hover:bg-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-white">{profile.full_name}</h1>
              <p className="text-sm text-gray-400">{posts.length} posts</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {/* Profile Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-start justify-between mb-4">
            <Avatar className="w-24 h-24">
              <AvatarImage src={profile.avatar_url || "/placeholder.svg"} />
              <AvatarFallback className="bg-green-600 text-white text-2xl">
                {profile.full_name?.charAt(0) || profile.username?.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div className="flex gap-2">
              {isOwnProfile ? (
                <Button
                  variant="outline"
                  onClick={() => setShowEditModal(true)}
                  className="border-gray-700 text-white hover:bg-gray-800 bg-transparent"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={handleMessage}
                    variant="outline"
                    className="border-gray-700 text-white hover:bg-gray-800 bg-transparent"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleFollow}
                    variant={following ? "secondary" : "default"}
                    className={
                      following
                        ? "bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
                        : "bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
                    }
                  >
                    {following ? (
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
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-xl font-bold text-white">{profile.full_name}</h2>
              <p className="text-gray-400">@{profile.username}</p>
            </div>

            {profile.bio && <p className="text-gray-200">{profile.bio}</p>}

            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}</span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <button className="hover:underline">
                <span className="font-bold text-white">{followingCount}</span>
                <span className="text-gray-400 ml-1">Following</span>
              </button>
              <button className="hover:underline">
                <span className="font-bold text-white">{followersCountState}</span>
                <span className="text-gray-400 ml-1">Followers</span>
              </button>
            </div>
          </div>
        </div>

        {/* Posts */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-transparent border-b border-gray-800 rounded-none h-auto p-0">
            <TabsTrigger
              value="posts"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500 text-gray-400 rounded-none pb-3"
            >
              Posts
            </TabsTrigger>
            <TabsTrigger
              value="replies"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500 text-gray-400 rounded-none pb-3"
            >
              Replies
            </TabsTrigger>
            <TabsTrigger
              value="likes"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500 text-gray-400 rounded-none pb-3"
            >
              Likes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-0">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No posts yet</p>
                {isOwnProfile && <p className="text-sm text-gray-500 mt-2">Share your first post to get started!</p>}
              </div>
            ) : (
              <div className="space-y-0">
                {posts.map((post) => (
                  <div key={post.id} className="border-b border-gray-800">
                    <PostCard
                      post={post}
                      currentUser={currentUser}
                      onUpdate={(updatedPost) => {
                        // Handle post updates if needed
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="replies" className="mt-0">
            <div className="text-center py-12">
              <p className="text-gray-400">No replies yet</p>
            </div>
          </TabsContent>

          <TabsContent value="likes" className="mt-0">
            <div className="text-center py-12">
              <p className="text-gray-400">No liked posts yet</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Profile Image */}
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-24 h-24 border-2 border-gray-700">
                <AvatarImage src={profileImageUrl || profile.avatar_url || "/placeholder.svg"} />
                <AvatarFallback className="bg-gray-800 text-white text-xl">
                  {editedProfile.full_name?.charAt(0) || editedProfile.username?.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="edit-profile-image"
                  disabled={uploadingImage}
                />
                <Label
                  htmlFor="edit-profile-image"
                  className="flex items-center gap-2 cursor-pointer bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md text-sm border border-gray-700 text-white disabled:opacity-50"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4" />
                      Change Photo
                    </>
                  )}
                </Label>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-username" className="text-white">
                  Username
                </Label>
                <Input
                  id="edit-username"
                  value={editedProfile.username}
                  onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-name" className="text-white">
                  Display Name
                </Label>
                <Input
                  id="edit-name"
                  value={editedProfile.full_name}
                  onChange={(e) => setEditedProfile({ ...editedProfile, full_name: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-bio" className="text-white">
                  Bio
                </Label>
                <Textarea
                  id="edit-bio"
                  value={editedProfile.bio}
                  onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 mt-1 min-h-[80px]"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="flex-1 border-gray-700 text-white hover:bg-gray-800 bg-transparent"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {uploadingImage ? "Uploading..." : "Saving..."}
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
