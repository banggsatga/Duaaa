"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useToast } from "@/hooks/use-toast"
import { Heart, MessageCircle, Repeat2, Share, Send, MoreHorizontal, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface PostCardProps {
  post: any
  currentUser: any
  onUpdate: (post: any) => void
  onDelete?: (postId: string) => void
}

export default function PostCard({ post, currentUser, onUpdate, onDelete }: PostCardProps) {
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)

  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const isLiked = post.post_likes?.some((like: any) => like.user_id === currentUser.id)
  const isRecasted = post.post_recasts?.some((recast: any) => recast.user_id === currentUser.id)
  const isOwnPost = post.author_id === currentUser.id

  const handleLike = async () => {
    try {
      if (isLiked) {
        await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUser.id)
      } else {
        await supabase.from("post_likes").insert({
          post_id: post.id,
          user_id: currentUser.id,
        })
      }

      const updatedPost = {
        ...post,
        post_likes: isLiked
          ? post.post_likes.filter((like: any) => like.user_id !== currentUser.id)
          : [...post.post_likes, { user_id: currentUser.id }],
      }
      onUpdate(updatedPost)
    } catch (error) {
      console.error("Error toggling like:", error)
    }
  }

  const handleRecast = async () => {
    try {
      if (isRecasted) {
        await supabase.from("post_recasts").delete().eq("post_id", post.id).eq("user_id", currentUser.id)
      } else {
        await supabase.from("post_recasts").insert({
          post_id: post.id,
          user_id: currentUser.id,
        })
      }

      const updatedPost = {
        ...post,
        post_recasts: isRecasted
          ? post.post_recasts.filter((recast: any) => recast.user_id !== currentUser.id)
          : [...post.post_recasts, { user_id: currentUser.id }],
      }
      onUpdate(updatedPost)

      if (!isRecasted) {
        toast({
          title: "Post amplified!",
          description: "The post has been shared to your followers.",
        })
      }
    } catch (error) {
      console.error("Error toggling recast:", error)
    }
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setLoading(true)
    try {
      const { data: comment, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: post.id,
          user_id: currentUser.id,
          content: newComment.trim(),
          created_at: new Date().toISOString(),
        })
        .select(`
          *,
          profiles:user_id (username, avatar_url, full_name)
        `)
        .single()

      if (error) throw error

      const updatedPost = {
        ...post,
        post_comments: [...post.post_comments, comment],
      }
      onUpdate(updatedPost)
      setNewComment("")

      toast({
        title: "Comment added!",
        description: "Your comment has been posted.",
      })
    } catch (error) {
      console.error("Error adding comment:", error)
      toast({
        title: "Error adding comment",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePost = async () => {
    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id)

      if (error) throw error

      toast({
        title: "Post deleted",
        description: "Your post has been removed.",
      })

      if (onDelete) {
        onDelete(post.id)
      }
    } catch (error) {
      console.error("Error deleting post:", error)
      toast({
        title: "Error deleting post",
        description: "Please try again.",
        variant: "destructive",
      })
    }

    setShowDeleteAlert(false)
  }

  return (
    <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.profiles?.avatar_url || "/placeholder.svg"} />
              <AvatarFallback className="bg-gray-800 text-white">{post.profiles?.full_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white">{post.profiles?.full_name}</p>
                <p className="text-sm text-gray-400">@{post.profiles?.username}</p>
                <span className="text-gray-600">·</span>
                <p className="text-sm text-gray-400">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          </div>

          {isOwnPost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                <DropdownMenuItem
                  className="text-red-400 focus:text-red-400 cursor-pointer"
                  onClick={() => setShowDeleteAlert(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {post.content && <p className="text-gray-100 whitespace-pre-wrap leading-relaxed">{post.content}</p>}

        {post.image_url && (
          <img
            src={post.image_url || "/placeholder.svg"}
            alt="Post image"
            className="rounded-lg max-h-96 w-full object-cover border border-gray-800"
          />
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{post.post_comments?.length || 0}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRecast}
            className={`flex items-center gap-2 ${
              isRecasted
                ? "text-green-400 hover:text-green-300"
                : "text-gray-400 hover:text-green-400 hover:bg-green-400/10"
            }`}
          >
            <Repeat2 className="w-4 h-4" />
            <span>{post.post_recasts?.length || 0}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={`flex items-center gap-2 ${
              isLiked ? "text-red-400 hover:text-red-300" : "text-gray-400 hover:text-red-400 hover:bg-red-400/10"
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
            <span>{post.post_likes?.length || 0}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10"
          >
            <Share className="w-4 h-4" />
          </Button>
        </div>

        {showComments && (
          <div className="space-y-4 pt-4 border-t border-gray-800">
            <form onSubmit={handleComment} className="flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={currentUser.avatar_url || "/placeholder.svg"} />
                <AvatarFallback className="bg-gray-800 text-white text-sm">
                  {currentUser.full_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] resize-none bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading || !newComment.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              {post.post_comments?.map((comment: any) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={comment.profiles?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback className="bg-gray-800 text-white text-sm">
                      {comment.profiles?.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm text-white">{comment.profiles?.full_name}</p>
                        <p className="text-xs text-gray-400">@{comment.profiles?.username}</p>
                      </div>
                      <p className="text-sm text-gray-200">{comment.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Post Alert Dialog */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete your post. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
