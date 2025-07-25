const PINATA_API_KEY = "31d53b12ffa31b18c0d2"
const PINATA_SECRET_API_KEY = "f5b1d909fd0016280ac7ff75078aeab8b6f114ff7ee90f3104ad4dba020eedc8"
const PINATA_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIwNTBhMjA3OS04NGE1LTRiMTgtODFlYS0zYjJmYTQ3YWVkNWUiLCJlbWFpbCI6Inl1c3VmZmZhcW90MDdAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjMxZDUzYjEyZmZhMzFiMThjMGQyIiwic2NvcGVkS2V5U2VjcmV0IjoiZjViMWQ5MDlmZDAwMTYyODBhYzdmZjc1MDc4YWVhYjhiNmYxMTRmZjdlZTkwZjMxMDRhZDRkYmEwMjBlZWRjOCIsImV4cCI6MTc4NDk2Mjk3OH0.MH3jqPPO-2GqvN4-RY8U-nkMjaYxZZtVjJjdyqYZhe4"

export async function uploadToPinata(file: File, fileName?: string): Promise<string> {
  try {
    // Validate file size (max 10MB for better performance)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      throw new Error("File size too large. Maximum 10MB allowed.")
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.")
    }

    const formData = new FormData()
    formData.append("file", file)

    // Add metadata with proper filename
    const metadata = {
      name: fileName || `${Date.now()}-${file.name}`,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        fileType: file.type,
        fileSize: file.size.toString(),
        source: "start-trade-app",
      },
    }

    formData.append("pinataMetadata", JSON.stringify(metadata))

    // Configure pinning options
    formData.append(
      "pinataOptions",
      JSON.stringify({
        cidVersion: 1, // Use CIDv1 for better compatibility
        wrapWithDirectory: false,
      }),
    )

    console.log("Uploading to Pinata IPFS...")

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Pinata upload error:", errorData)
      throw new Error(`Pinata upload failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log("Pinata upload successful:", result)

    // Return the IPFS URL via Pinata gateway
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`

    console.log("IPFS URL generated:", ipfsUrl)
    return ipfsUrl
  } catch (error) {
    console.error("Error uploading to Pinata IPFS:", error)
    throw error
  }
}

export async function uploadJSONToPinata(jsonData: any, fileName: string): Promise<string> {
  try {
    console.log("Uploading JSON to Pinata IPFS...")

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: jsonData,
        pinataMetadata: {
          name: fileName,
          keyvalues: {
            uploadedAt: new Date().toISOString(),
            source: "start-trade-app",
            type: "json",
          },
        },
        pinataOptions: {
          cidVersion: 1,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Pinata JSON upload error:", errorData)
      throw new Error(`Pinata JSON upload failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log("Pinata JSON upload successful:", result)

    // Return the IPFS URL via Pinata gateway
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`

    console.log("IPFS JSON URL generated:", ipfsUrl)
    return ipfsUrl
  } catch (error) {
    console.error("Error uploading JSON to Pinata IPFS:", error)
    throw error
  }
}

// Helper function to check if URL is from IPFS/Pinata
export function isIPFSUrl(url: string): boolean {
  return url.includes("ipfs") || url.includes("pinata.cloud")
}

// Helper function to get IPFS hash from URL
export function getIPFSHash(url: string): string | null {
  const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}
