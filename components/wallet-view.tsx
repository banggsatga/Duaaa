"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ArrowLeft, MoreHorizontal, Eye, Key, Copy, Send, Download } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import QRCode from "qrcode"
import { useEffect } from "react"

interface WalletViewProps {
  profile: any
}

export default function WalletView({ profile }: WalletViewProps) {
  const [hideZeroBalance, setHideZeroBalance] = useState(true)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false)
  const [withdrawAddress, setWithdrawAddress] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  // Generate QR Code when component mounts or wallet address changes
  useEffect(() => {
    if (profile.wallet_address) {
      QRCode.toDataURL(profile.wallet_address, {
        width: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })
        .then((url) => {
          setQrCodeUrl(url)
        })
        .catch((err) => {
          console.error("Error generating QR code:", err)
        })
    }
  }, [profile.wallet_address])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    })
  }

  const handleWithdraw = () => {
    if (!withdrawAddress || !withdrawAmount) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    // Simulate withdrawal
    toast({
      title: "Withdrawal Initiated",
      description: `Withdrawing ${withdrawAmount} AVAX to ${withdrawAddress.slice(0, 6)}...${withdrawAddress.slice(-4)}`,
    })
    setShowWithdrawModal(false)
    setWithdrawAddress("")
    setWithdrawAmount("")
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
            <Avatar className="w-10 h-10">
              <AvatarImage src={profile.avatar_url || "/placeholder.svg"} />
              <AvatarFallback className="bg-green-600 text-white">
                {profile.username?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-white">{profile.full_name}</h2>
              <p className="text-sm text-gray-400">@{profile.username}</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-gray-800">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-900 border-gray-700">
              <DropdownMenuItem
                onClick={() => setHideZeroBalance(!hideZeroBalance)}
                className="text-white hover:bg-gray-800 cursor-pointer"
              >
                <Eye className="w-4 h-4 mr-2" />
                {hideZeroBalance ? "Show" : "Hide"} zero balance tokens
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowPrivateKeyModal(true)}
                className="text-white hover:bg-gray-800 cursor-pointer"
              >
                <Key className="w-4 h-4 mr-2" />
                Export private keys
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Portfolio Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-sm mb-1">Portfolio Value</p>
              <p className="text-2xl font-bold text-white">$0</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-sm mb-1">Fees Earned</p>
              <p className="text-2xl font-bold text-white">$0</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="border-gray-700 text-white hover:bg-gray-800 py-3 bg-transparent"
            onClick={() => setShowDepositModal(true)}
          >
            <Download className="w-4 h-4 mr-2" />
            Deposit
          </Button>
          <Button
            variant="outline"
            className="border-gray-700 text-white hover:bg-gray-800 py-3 bg-transparent"
            onClick={() => setShowWithdrawModal(true)}
          >
            <Send className="w-4 h-4 mr-2" />
            Withdraw
          </Button>
        </div>

        {/* Total Balance */}
        <Card className="bg-gradient-to-r from-green-600 to-blue-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm mb-1">Total Balance</p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">ST</span>
                  </div>
                  <p className="text-3xl font-bold text-white">0.00</p>
                </div>
              </div>
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none">
                Trade Portal
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="tokens" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-transparent border-b border-gray-800 rounded-none h-auto p-0">
            <TabsTrigger
              value="tokens"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500 text-gray-400 rounded-none pb-3"
            >
              Tokens
            </TabsTrigger>
            <TabsTrigger
              value="trades"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500 text-gray-400 rounded-none pb-3"
            >
              Trades
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500 text-gray-400 rounded-none pb-3"
            >
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tokens" className="mt-6">
            <div className="text-center py-12">
              <p className="text-gray-400">No tokens to display</p>
            </div>
          </TabsContent>

          <TabsContent value="trades" className="mt-6">
            <div className="text-center py-12">
              <p className="text-gray-400">No trades to display</p>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <div className="text-center py-12">
              <p className="text-gray-400">No activity to display</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Deposit Modal */}
      <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Deposit AVAX</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-gray-400 mb-4">Send AVAX to this address:</p>

              {/* QR Code */}
              <div className="flex justify-center mb-4">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl || "/placeholder.svg"}
                    alt="Wallet QR Code"
                    className="w-48 h-48 border border-gray-700 rounded-lg bg-white p-2"
                  />
                ) : (
                  <div className="w-48 h-48 border border-gray-700 rounded-lg bg-gray-800 flex items-center justify-center">
                    <p className="text-gray-400">Generating QR Code...</p>
                  </div>
                )}
              </div>

              {/* Wallet Address */}
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">Wallet Address</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm text-white break-all mr-2">{profile.wallet_address}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(profile.wallet_address, "Wallet address")}
                    className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mt-4">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Only send AVAX to this address. Sending other tokens may result in permanent loss.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Withdraw AVAX</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdraw-address" className="text-white">
                Destination Address
              </Label>
              <Input
                id="withdraw-address"
                placeholder="0x..."
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 mt-1"
              />
            </div>

            <div>
              <Label htmlFor="withdraw-amount" className="text-white">
                Amount (AVAX)
              </Label>
              <Input
                id="withdraw-amount"
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 mt-1"
              />
            </div>

            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Available Balance:</span>
                <span className="text-white">0.00 AVAX</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-400">Network Fee:</span>
                <span className="text-white">~0.001 AVAX</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 border-gray-700 text-white hover:bg-gray-800 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleWithdraw}
                className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              >
                Withdraw
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Private Key Modal */}
      <Dialog open={showPrivateKeyModal} onOpenChange={setShowPrivateKeyModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Export Private Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400 text-sm font-semibold mb-2">⚠️ Security Warning</p>
              <p className="text-red-300 text-sm">
                Never share your private key with anyone. Anyone with access to your private key can control your wallet
                and steal your funds.
              </p>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400 mb-2">Private Key</p>
              <div className="flex items-center justify-between">
                <p className="font-mono text-sm text-white break-all mr-2">{profile.wallet_private_key}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(profile.wallet_private_key, "Private key")}
                  className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
              <p className="text-gray-300 text-sm">
                You can import this private key into other wallets like MetaMask, Trust Wallet, or any
                Avalanche-compatible wallet.
              </p>
            </div>

            <Button
              onClick={() => setShowPrivateKeyModal(false)}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            >
              I've Saved My Private Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
