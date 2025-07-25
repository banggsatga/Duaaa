"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"
import { Upload, Loader2, Wallet } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { uploadToPinata } from "@/lib/pinata"

interface ProfileSetupFormProps {
  user: any
}

export default function ProfileSetupForm({ user }: ProfileSetupFormProps) {
  const [username, setUsername] = useState("")
  const [profileImage, setProfileImage] = useState<File | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [creatingWallet, setCreatingWallet] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const supabase = createClientComponentClient()
  const router = useRouter()
  const { toast } = useToast()

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setProfileImage(file)
      const url = URL.createObjectURL(file)
      setProfileImageUrl(url)
    }
  }

  const createAvalancheWallet = async () => {
    setCreatingWallet(true)
    try {
      const response = await fetch("/api/create-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      })

      const walletData = await response.json()
      return walletData
    } catch (error) {
      console.error("Error creating wallet:", error)
      throw error
    } finally {
      setCreatingWallet(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let avatarUrl = ""

      if (profileImage) {
        setUploadingImage(true)
        try {
          const fileName = `avatar-${user.id}-${Date.now()}.${profileImage.name.split(".").pop()}`
          avatarUrl = await uploadToPinata(profileImage, fileName)

          toast({
            title: "Avatar uploaded to IPFS!",
            description: "Profile picture uploaded successfully via Pinata.",
          })
        } catch (error) {
          console.error("Error uploading avatar to Pinata:", error)
          toast({
            title: "Avatar upload failed",
            description: "Using default avatar. You can update it later.",
            variant: "destructive",
          })
          avatarUrl = "" // Use empty string for default avatar
        } finally {
          setUploadingImage(false)
        }
      }

      const walletData = await createAvalancheWallet()

      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        username,
        full_name: user.user_metadata.full_name,
        avatar_url: avatarUrl, // IPFS URL from Pinata or empty for default
        email: user.email,
        wallet_address: walletData.address,
        wallet_private_key: walletData.privateKey,
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      toast({
        title: "Welcome to Start Trade! 🎉",
        description: "Your profile and AVAX wallet created with IPFS storage.",
      })

      router.push("/dashboard")
    } catch (error) {
      console.error("Error creating profile:", error)
      toast({
        title: "Setup failed",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-800">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg"></div>
            <span className="text-xl font-bold">Start Trade</span>
          </div>
          <CardTitle className="text-2xl text-white">Complete Your Profile</CardTitle>
          <CardDescription className="text-gray-400">
            Set up your username and profile picture to start trading
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-24 h-24 border-2 border-gray-700">
                <AvatarImage src={profileImageUrl || user.user_metadata.avatar_url} />
                <AvatarFallback className="bg-gray-800 text-white text-lg">
                  {user.user_metadata.full_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>

              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="profile-image"
                  disabled={uploadingImage}
                />
                <Label
                  htmlFor="profile-image"
                  className="flex items-center gap-2 cursor-pointer bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md text-sm border border-gray-700 text-white disabled:opacity-50"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Photo
                    </>
                  )}
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-white">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
              />
            </div>

            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">AVAX Wallet</h3>
              </div>
              <p className="text-sm text-gray-300">
                We'll automatically create a secure Avalanche wallet for you during setup. This enables seamless Web3
                interactions within the platform.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              disabled={loading || !username.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {creatingWallet
                    ? "Creating Wallet..."
                    : uploadingImage
                      ? "Uploading Image..."
                      : "Setting up Profile..."}
                </>
              ) : (
                "Start Trading"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
