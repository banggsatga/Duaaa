"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { uploadToPinata } from "@/lib/pinata"
import { Loader2, ImageIcon } from "lucide-react"

interface ImageUploadHelperProps {
  onImageUploaded: (url: string) => void
  onImageSelected: (file: File, previewUrl: string) => void
  accept?: string
  maxSize?: number
  buttonText?: string
  className?: string
  disabled?: boolean
}

export default function ImageUploadHelper({
  onImageUploaded,
  onImageSelected,
  accept = "image/*",
  maxSize = 10 * 1024 * 1024, // 10MB default
  buttonText = "Upload Image",
  className = "",
  disabled = false,
}: ImageUploadHelperProps) {
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${Math.round(maxSize / 1024 / 1024)}MB`,
        variant: "destructive",
      })
      return
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    onImageSelected(file, previewUrl)

    // Auto-upload to Pinata
    setUploading(true)
    try {
      const fileName = `upload-${Date.now()}.${file.name.split(".").pop()}`
      const ipfsUrl = await uploadToPinata(file, fileName)

      onImageUploaded(ipfsUrl)

      toast({
        title: "Image uploaded to IPFS!",
        description: "Your image has been stored on the decentralized web.",
      })
    } catch (error) {
      console.error("Upload failed:", error)
      toast({
        title: "Upload failed",
        description: "Could not upload to IPFS. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={className}>
      <Input
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        id="image-upload-helper"
        disabled={disabled || uploading}
      />
      <Label
        htmlFor="image-upload-helper"
        className="flex items-center gap-2 cursor-pointer bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md text-sm border border-gray-700 text-white disabled:opacity-50"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading to IPFS...
          </>
        ) : (
          <>
            <ImageIcon className="w-4 h-4" />
            {buttonText}
          </>
        )}
      </Label>
    </div>
  )
}
