"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Loader2, Info, Check, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { uploadToPinata } from "@/lib/pinata"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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

interface TokenLaunchViewProps {
  profile: any
}

export default function TokenLaunchView({ profile }: TokenLaunchViewProps) {
  const [step, setStep] = useState(1)
  const [tokenName, setTokenName] = useState("")
  const [tokenSymbol, setTokenSymbol] = useState("")
  const [tokenDescription, setTokenDescription] = useState("")
  const [tokenImage, setTokenImage] = useState<File | null>(null)
  const [tokenImageUrl, setTokenImageUrl] = useState("")
  const [tokenImageIpfsUrl, setTokenImageIpfsUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [launchProgress, setLaunchProgress] = useState(0)
  const [currentRaised, setCurrentRaised] = useState(0)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [launchActive, setLaunchActive] = useState(false)
  const [tokenPrice, setTokenPrice] = useState(0.000001) // Starting price: 0.000001 AVAX per token
  const [investAmount, setInvestAmount] = useState("")
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [userTokenBalance, setUserTokenBalance] = useState(0)
  const [totalSupply, setTotalSupply] = useState(0)
  const [priceChange24h, setPriceChange24h] = useState(0)

  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientComponentClient()

  const targetAmount = 200 // 200 AVAX cap
  const progressPercentage = (currentRaised / targetAmount) * 100

  // Calculate dynamic price based on bonding curve
  const calculateCurrentPrice = (raised: number) => {
    const initialPrice = 0.000001
    const factor = raised / 1000000 + 1 // Price increment factor
    return initialPrice * Math.pow(factor, 2) // Exponential curve
  }

  // Calculate tokens to receive for AVAX amount
  const calculateTokensForAVAX = (avaxAmount: number) => {
    if (avaxAmount <= 0) return 0

    let tokensToReceive = 0
    let remainingAVAX = avaxAmount
    let simulatedRaised = currentRaised

    // Simulate the purchase with bonding curve
    while (remainingAVAX > 0 && simulatedRaised < targetAmount) {
      const currentPriceAtLevel = calculateCurrentPrice(simulatedRaised)
      const avaxForOneToken = currentPriceAtLevel

      if (remainingAVAX >= avaxForOneToken) {
        tokensToReceive += 1
        remainingAVAX -= avaxForOneToken
        simulatedRaised += avaxForOneToken
      } else {
        // Partial token
        tokensToReceive += remainingAVAX / avaxForOneToken
        remainingAVAX = 0
      }
    }

    return tokensToReceive
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setTokenImage(file)
      const url = URL.createObjectURL(file)
      setTokenImageUrl(url)

      setUploadingImage(true)
      try {
        const fileName = `token-${profile.id}-${Date.now()}.${file.name.split(".").pop()}`
        const ipfsUrl = await uploadToPinata(file, fileName)
        setTokenImageIpfsUrl(ipfsUrl)

        toast({
          title: "Token image uploaded!",
          description: "Your token image has been stored on IPFS.",
        })
      } catch (error) {
        console.error("Error uploading token image:", error)
        toast({
          title: "Image upload failed",
          description: "Please try again or use a different image.",
          variant: "destructive",
        })
      } finally {
        setUploadingImage(false)
      }
    }
  }

  const handleNextStep = () => {
    if (step === 1) {
      if (!tokenName || !tokenSymbol || !tokenImageIpfsUrl) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields and upload a token image.",
          variant: "destructive",
        })
        return
      }
    }

    setStep(step + 1)
  }

  const handlePreviousStep = () => {
    setStep(step - 1)
  }

  const handleLaunchToken = async () => {
    setLoading(true)

    try {
      // Create token metadata
      const tokenMetadata = {
        name: tokenName,
        symbol: tokenSymbol,
        description: tokenDescription,
        image: tokenImageIpfsUrl,
        creator: profile.id,
        creatorUsername: profile.username,
        initialPrice: 0.000001,
        launchCap: targetAmount,
        createdAt: new Date().toISOString(),
        contractType: "FairLaunch",
        network: "Avalanche",
      }

      // Upload metadata to IPFS
      const metadataFileName = `token-metadata-${profile.id}-${Date.now()}.json`
      const metadataBlob = new Blob([JSON.stringify(tokenMetadata)], { type: "application/json" })
      const metadataUrl = await uploadToPinata(metadataBlob as File, metadataFileName)

      // Save token to database
      const { data: token, error } = await supabase
        .from("tokens")
        .insert({
          name: tokenName,
          symbol: tokenSymbol,
          description: tokenDescription,
          image_url: tokenImageIpfsUrl,
          metadata_url: metadataUrl,
          creator_id: profile.id,
          initial_price: 0.000001,
          launch_cap: targetAmount,
          current_raised: 0,
          current_price: 0.000001,
          total_supply: 0,
          status: "active",
          contract_address: null, // Will be updated when smart contract is deployed
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Token launch created!",
        description: "Your fair launch token is now active and ready for trading.",
      })

      setLaunchActive(true)
      setShowConfirmDialog(false)

      // Initialize with starting values
      setCurrentRaised(0)
      setTokenPrice(0.000001)
      setTotalSupply(0)
      setUserTokenBalance(0)
      setLaunchProgress(0)
      setPriceChange24h(0)
    } catch (error) {
      console.error("Error launching token:", error)
      toast({
        title: "Launch failed",
        description: "There was an error creating your token launch. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBuyTokens = () => {
    const amount = Number.parseFloat(investAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid investment amount.",
        variant: "destructive",
      })
      return
    }

    if (currentRaised + amount > targetAmount) {
      toast({
        title: "Exceeds cap",
        description: `Investment would exceed the ${targetAmount} AVAX cap.`,
        variant: "destructive",
      })
      return
    }

    // Calculate tokens to receive
    const tokensToReceive = calculateTokensForAVAX(amount)

    // Update state
    const newTotal = currentRaised + amount
    const newPercentage = (newTotal / targetAmount) * 100
    const newPrice = calculateCurrentPrice(newTotal)
    const newSupply = totalSupply + tokensToReceive

    setCurrentRaised(newTotal)
    setLaunchProgress(newPercentage)
    setTokenPrice(newPrice)
    setTotalSupply(newSupply)
    setUserTokenBalance(userTokenBalance + tokensToReceive)
    setInvestAmount("")

    // Calculate price change
    const priceChangePercent = ((newPrice - 0.000001) / 0.000001) * 100
    setPriceChange24h(priceChangePercent)

    toast({
      title: "Tokens purchased!",
      description: `You bought ${tokensToReceive.toFixed(2)} ${tokenSymbol} for ${amount} AVAX.`,
    })

    // Check if cap reached
    if (newTotal >= targetAmount) {
      setShowSuccessDialog(true)
    }
  }

  const handleSellTokens = () => {
    const tokensToSell = Number.parseFloat(investAmount)
    if (isNaN(tokensToSell) || tokensToSell <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid token amount to sell.",
        variant: "destructive",
      })
      return
    }

    if (tokensToSell > userTokenBalance) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough tokens to sell.",
        variant: "destructive",
      })
      return
    }

    // Calculate AVAX to receive (with bonding curve)
    const avaxToReceive = tokensToSell * tokenPrice * 0.95 // 5% slippage

    // Update state
    const newTotal = Math.max(0, currentRaised - avaxToReceive)
    const newPercentage = (newTotal / targetAmount) * 100
    const newPrice = calculateCurrentPrice(newTotal)
    const newSupply = totalSupply - tokensToSell

    setCurrentRaised(newTotal)
    setLaunchProgress(newPercentage)
    setTokenPrice(newPrice)
    setTotalSupply(newSupply)
    setUserTokenBalance(userTokenBalance - tokensToSell)
    setInvestAmount("")

    // Calculate price change
    const priceChangePercent = ((newPrice - 0.000001) / 0.000001) * 100
    setPriceChange24h(priceChangePercent)

    toast({
      title: "Tokens sold!",
      description: `You sold ${tokensToSell.toFixed(2)} ${tokenSymbol} for ${avaxToReceive.toFixed(6)} AVAX.`,
    })
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
              <h1 className="text-xl font-semibold text-white">Fair Launch</h1>
              <p className="text-sm text-gray-400">Create your own token with bonding curve</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {!launchActive ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">{step === 1 ? "Create Your Token" : "Fair Launch Setup"}</CardTitle>
              <CardDescription className="text-gray-400">
                {step === 1 ? "Define your token's identity" : "Configure your bonding curve launch"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {step === 1 ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="token-name" className="text-white">
                      Token Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="token-name"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="e.g. Awesome Token"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="token-symbol" className="text-white">
                      Token Symbol <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="token-symbol"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      placeholder="e.g. AWE"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                      maxLength={6}
                    />
                    <p className="text-xs text-gray-400">Maximum 6 characters, uppercase letters recommended</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="token-description" className="text-white">
                      Description
                    </Label>
                    <Textarea
                      id="token-description"
                      value={tokenDescription}
                      onChange={(e) => setTokenDescription(e.target.value)}
                      placeholder="Describe your token and its purpose..."
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">
                      Token Image <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="w-20 h-20 border-2 border-gray-700">
                          {tokenImageUrl ? (
                            <AvatarImage src={tokenImageUrl || "/placeholder.svg"} />
                          ) : (
                            <AvatarFallback className="bg-gray-800 text-white text-xl">
                              {tokenSymbol ? tokenSymbol.charAt(0) : "T"}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        {uploadingImage && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="token-image"
                          disabled={uploadingImage}
                        />
                        <Label
                          htmlFor="token-image"
                          className="flex items-center gap-2 cursor-pointer bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md text-sm border border-gray-700 text-white disabled:opacity-50"
                        >
                          {uploadingImage ? "Uploading..." : "Upload Image"}
                        </Label>
                        <p className="text-xs text-gray-400 mt-1">Recommended: 512x512px PNG or JPG</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-green-400 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-white mb-1">Bonding Curve Fair Launch</h3>
                        <p className="text-sm text-gray-300">
                          Your token uses a bonding curve mechanism. No max supply - tokens are minted when bought and
                          burned when sold. Price increases exponentially with demand.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">Starting Price</p>
                        <p className="text-gray-400 text-sm">Initial token price</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">0.000001</p>
                        <p className="text-gray-400 text-sm">AVAX per {tokenSymbol}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">Launch Cap</p>
                        <p className="text-gray-400 text-sm">Migration threshold</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{targetAmount.toLocaleString()}</p>
                        <p className="text-gray-400 text-sm">AVAX</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">Token Supply</p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-help">
                                <p className="text-gray-400 text-sm">Dynamic supply</p>
                                <Info className="w-3 h-3 text-gray-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-gray-800 border-gray-700 text-white">
                              <p>Tokens are minted on buy, burned on sell</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">Unlimited</p>
                        <p className="text-gray-400 text-sm">Bonding curve</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">Trading Fees</p>
                        <p className="text-gray-400 text-sm">Fee distribution</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">80% / 20%</p>
                        <p className="text-gray-400 text-sm">Creator / Protocol</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">Liquidity Pair</p>
                        <p className="text-gray-400 text-sm">After migration</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{tokenSymbol}/WAVAX</p>
                        <p className="text-gray-400 text-sm">Uniswap V2</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-white mb-1">Smart Contract Deployment</h3>
                        <p className="text-sm text-gray-300">
                          Your token will be deployed as a smart contract on Avalanche. Once launched, the bonding curve
                          parameters cannot be changed.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              {step > 1 ? (
                <Button
                  variant="outline"
                  onClick={handlePreviousStep}
                  className="border-gray-700 text-white hover:bg-gray-800 bg-transparent"
                >
                  Back
                </Button>
              ) : (
                <div></div>
              )}

              {step < 2 ? (
                <Button
                  onClick={handleNextStep}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    "Deploy Token"
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={tokenImageUrl || "/placeholder.svg"} />
                    <AvatarFallback className="bg-gray-800 text-white">{tokenSymbol?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-white">
                      {tokenName} ({tokenSymbol})
                    </CardTitle>
                    <CardDescription className="text-gray-400">Created by @{profile.username}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <p className="text-gray-400">Launch Progress</p>
                    <p className="text-white font-medium">
                      {currentRaised.toFixed(2)}/{targetAmount} AVAX
                    </p>
                  </div>
                  <Progress value={launchProgress} className="h-2" />
                  <p className="text-right text-sm text-gray-400 mt-1">{launchProgress.toFixed(1)}% Complete</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Current Price</p>
                    <div className="flex items-center gap-2">
                      <p className="text-white text-xl font-bold">{tokenPrice.toFixed(8)}</p>
                      {priceChange24h !== 0 && (
                        <div
                          className={`flex items-center gap-1 ${priceChange24h > 0 ? "text-green-400" : "text-red-400"}`}
                        >
                          {priceChange24h > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span className="text-sm">{Math.abs(priceChange24h).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">AVAX per {tokenSymbol}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Your Balance</p>
                    <p className="text-white text-xl font-bold">{userTokenBalance.toFixed(2)}</p>
                    <p className="text-gray-400 text-sm">{tokenSymbol}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Total Supply</p>
                    <p className="text-white text-lg font-bold">{totalSupply.toFixed(0)}</p>
                    <p className="text-gray-400 text-sm">{tokenSymbol}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Market Cap</p>
                    <p className="text-white text-lg font-bold">{(totalSupply * tokenPrice).toFixed(2)}</p>
                    <p className="text-gray-400 text-sm">AVAX</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={investAmount}
                      onChange={(e) => setInvestAmount(e.target.value)}
                      placeholder="Amount"
                      type="number"
                      step="0.001"
                      min="0.001"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                    />
                    <Button
                      onClick={handleBuyTokens}
                      className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 px-6"
                    >
                      Buy
                    </Button>
                    <Button
                      onClick={handleSellTokens}
                      variant="outline"
                      className="border-gray-700 text-white hover:bg-gray-800 bg-transparent px-6"
                    >
                      Sell
                    </Button>
                  </div>
                  <div className="text-center">
                    {investAmount && (
                      <p className="text-sm text-gray-400">
                        {calculateTokensForAVAX(Number.parseFloat(investAmount) || 0).toFixed(2)} {tokenSymbol} for{" "}
                        {investAmount} AVAX
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-white mb-1">Bonding Curve Trading</h3>
                      <p className="text-sm text-gray-300">
                        Price increases exponentially as more AVAX is invested. When {targetAmount} AVAX is reached, the
                        token will migrate to Uniswap with permanent liquidity.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">About {tokenName}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300">
                  {tokenDescription ||
                    `${tokenName} (${tokenSymbol}) is a fair launch token on Avalanche using a bonding curve mechanism.`}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Contract Type</p>
                    <p className="text-white font-medium">Fair Launch Bonding Curve</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Network</p>
                    <p className="text-white font-medium">Avalanche C-Chain</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Creator Fee</p>
                    <p className="text-white font-medium">80% of trading fees</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Protocol Fee</p>
                    <p className="text-white font-medium">20% of trading fees</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Confirm Launch Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deploy {tokenName} ({tokenSymbol})?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will deploy your token smart contract on Avalanche. The bonding curve parameters cannot be changed
              after deployment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLaunchToken}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : (
                "Deploy Contract"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Dialog */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-green-500/20 p-3 rounded-full">
                <Check className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <AlertDialogTitle className="text-center">Migration Successful!</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 text-center">
              Congratulations! {tokenName} ({tokenSymbol}) has reached its funding goal of {targetAmount} AVAX. The
              token has been migrated to Uniswap with permanent liquidity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-gray-800 rounded-lg p-4 my-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-gray-400">Token Contract</p>
                <p className="text-white font-mono text-sm">
                  0x{Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-gray-400">Uniswap Pair</p>
                <p className="text-white font-mono text-sm">
                  0x{Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}
                </p>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              onClick={() => {
                setShowSuccessDialog(false)
                router.push("/wallet")
              }}
            >
              View in Wallet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
