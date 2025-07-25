"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useToast } from "@/hooks/use-toast"

interface ChatViewProps {
  currentUser: any
  chatUsers: any[]
}

export default function ChatView({ currentUser, chatUsers }: ChatViewProps) {
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    if (selectedUser) {
      loadMessages()
    }
  }, [selectedUser])

  const loadMessages = async () => {
    if (!selectedUser) return

    try {
      const { data } = await supabase
        .from("messages")
        .select(`
          *,
          sender:sender_id (username, avatar_url, full_name),
          receiver:receiver_id (username, avatar_url, full_name)
        `)
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUser.id})`,
        )
        .order("created_at", { ascending: true })

      setMessages(data || [])
    } catch (error) {
      console.error("Error loading messages:", error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedUser.id,
          content: newMessage.trim(),
          created_at: new Date().toISOString(),
        })
        .select(`
          *,
          sender:sender_id (username, avatar_url, full_name),
          receiver:receiver_id (username, avatar_url, full_name)
        `)
        .single()

      if (error) throw error

      setMessages([...messages, data])
      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (selectedUser) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        {/* Chat Header */}
        <header className="bg-black border-b border-gray-800 sticky top-0 z-50">
          <div className="flex items-center gap-4 px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedUser(null)}
              className="text-white hover:bg-gray-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Avatar className="w-10 h-10">
              <AvatarImage src={selectedUser.avatar_url || "/placeholder.svg"} />
              <AvatarFallback className="bg-green-600 text-white">
                {selectedUser.username?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-white">{selectedUser.full_name}</h2>
              <p className="text-sm text-gray-400">@{selectedUser.username}</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No messages yet</p>
              <p className="text-sm text-gray-500 mt-2">Start a conversation with {selectedUser.full_name}</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_id === currentUser.id ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.sender_id === currentUser.id
                      ? "bg-gradient-to-r from-green-600 to-blue-600 text-white"
                      : "bg-gray-800 text-white"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">{new Date(message.created_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-800 p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !newMessage.trim()}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-50">
        <div className="flex items-center gap-4 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-white hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold text-white">Messages</h1>
        </div>
      </header>

      <div className="p-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <h3 className="text-lg font-semibold text-white">Start a conversation</h3>
          </CardHeader>
          <CardContent>
            {chatUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No users available to chat with</p>
                <p className="text-sm text-gray-500 mt-2">Follow some users to start chatting</p>
              </div>
            ) : (
              <div className="space-y-3">
                {chatUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-green-600 text-white">
                        {user.username?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-white">{user.full_name}</p>
                      <p className="text-sm text-gray-400">@{user.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
