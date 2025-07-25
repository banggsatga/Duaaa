"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useToast } from "@/hooks/use-toast"
import { ImageIcon, Loader2, X } from "lucide-react"
import { uploadToPinata } from "@/lib/pinata"

interface CreatePostProps {
  onPostCreated: (post: any) => void
  profile: any
}

export default function CreatePost({ onPostCreated, profile }: CreatePostProps) {
  const [content, setContent] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const url = URL.createObjectURL(file)
      setImagePreview(url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !image) return

    setLoading(true)

    try {
      let imageUrl = ""

      if (image) {
        setUploadingImage(true)
        try {
          const fileName = `post-${profile.id}-${Date.now()}.${image.name.split(".").pop()}`
          imageUrl = await uploadToPinata(image, fileName)

          toast({
            title: "Image uploaded to IPFS!",
            description: "Post image uploaded successfully via Pinata.",
          })
        } catch (error) {
          console.error("Error uploading image to Pinata:", error)
          toast({
            title: "Image upload failed",
            description: "Could not upload to IPFS. Posting without image.",
            variant: "destructive",
          })
          imageUrl = "" // Reset to empty if upload fails
        } finally {
          setUploadingImage(false)
        }
      }

      const { data: post, error } = await supabase
        .from("posts")
        .insert({
          content: content.trim(),
          image_url: imageUrl, // This will be IPFS URL from Pinata or empty string
          author_id: profile.id,
          created_at: new Date().toISOString(),
        })
        .select(`
        *,
        profiles:author_id (username, avatar_url, full_name)
      `)
        .single()

      if (error) throw error

      const postWithCounts = {
        ...post,
        post_likes: [],
        post_comments: [],
        post_recasts: [],
      }

      onPostCreated(postWithCounts)
      setContent("")
      setImage(null)
      setImagePreview("")

      toast({
        title: "Post shared!",
        description: "Your post has been published with IPFS image storage.",
      })
    } catch (error) {
      console.error("Error creating post:", error)
      toast({
        title: "Error creating post",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={profile.avatar_url || "/placeholder.svg"} />
            <AvatarFallback className="bg-gray-800 text-white">{profile.full_name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-white">{profile.full_name}</p>
            <p className="text-sm text-gray-400">@{profile.username}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="What's happening in crypto?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] resize-none border-none focus-visible:ring-0 text-lg bg-transparent text-white placeholder:text-gray-500 p-0"
          />

          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview || "/placeholder.svg"}
                alt="Preview"
                className="max-h-64 rounded-lg object-cover border border-gray-700"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 bg-gray-900/80 hover:bg-gray-800 border-gray-700"
                onClick={() => {
                  setImage(null)
                  setImagePreview("")
                }}
                disabled={loading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="post-image"
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById("post-image")?.click()}
                className="text-gray-400 hover:text-blue-400 hover:bg-blue-400/10"
                disabled={loading}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Photo
              </Button>
            </div>

            <Button
              type="submit"
              disabled={loading || (!content.trim() && !image)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadingImage ? "Uploading..." : "Posting..."}
                </>
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
