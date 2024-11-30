"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadTokenMetadata } from "@/utils/upload";
import { AppConfig, openContractDeploy, UserSession } from "@stacks/connect";
import { useConnect } from "@stacks/connect-react";
import { STACKS_TESTNET } from "@stacks/network";
import { useState } from "react";

const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });

export function TokenDeployer() {
  const { doOpenAuth } = useConnect();
  const [symbol, setSymbol] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [decimals, setDecimals] = useState("6");
  const [deploying, setDeploying] = useState(false);
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const isSignedIn = userSession.isUserSignedIn();

  const handleDisconnect = () => {
    userSession.signUserOut();
    window.location.reload();
  };

  const getWalletAddress = () => {
    return userSession.loadUserData().profile.stxAddress.testnet;
  };

  const generateTokenContract = (symbol: string, tokenUri: string) => {
    // Convert the symbol to uppercase for consistency

    const upperSymbol = symbol.toUpperCase();

    return `
;; Errors 
(define-constant ERR-UNAUTHORIZED u401)
(define-constant ERR-NOT-OWNER u402)
(define-constant ERR-INVALID-PARAMETERS u403)
(define-constant ERR-NOT-ENOUGH-FUND u101)

(impl-trait 'STT5FD8DBRTJJW2W4PHGT06ZZVPBJQ5EW31WHYFG.sip-010-trait-ft-standard.sip-010-trait)

;; Constants
(define-constant MAXSUPPLY u${supply})

;; Variables
(define-fungible-token ${upperSymbol} MAXSUPPLY)
(define-data-var contract-owner principal tx-sender) 

;; SIP-10 Functions
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq from tx-sender)
            (err ERR-UNAUTHORIZED))
        ;; Perform the token transfer
        (ft-transfer? ${upperSymbol} amount from to)
    )
)

;; DEFINE METADATA
(define-data-var token-uri (optional (string-utf8 256)) (some u"${tokenUri}"))

(define-public (set-token-uri (value (string-utf8 256)))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
        (var-set token-uri (some value))
        (ok (print {
              notification: "token-metadata-update",
              payload: {
                contract-id: (as-contract tx-sender),
                token-class: "ft"
              }
            })
        )
    )
)

(define-read-only (get-balance (owner principal))
  (ok (ft-get-balance ${upperSymbol} owner))
)

(define-read-only (get-name)
  (ok "${tokenName}")
)

(define-read-only (get-symbol)
  (ok "${upperSymbol}")
)

(define-read-only (get-decimals)
  (ok u${decimals})
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply ${upperSymbol}))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; transfer ownership
(define-public (transfer-ownership (new-owner principal))
  (begin
    ;; Checks if the sender is the current owner
    (if (is-eq tx-sender (var-get contract-owner))
      (begin
        ;; Sets the new owner
        (var-set contract-owner new-owner)
        ;; Returns success message
        (ok "Ownership transferred successfully"))
      ;; Error if the sender is not the owner
      (err ERR-NOT-OWNER)))
)

;; ---------------------------------------------------------
;; Utility Functions
;; ---------------------------------------------------------
(define-public (send-many (recipients (list 200 { to: principal, amount: uint, memo: (optional (buff 34)) })))
  (fold check-err (map send-token recipients) (ok true))
)

(define-private (check-err (result (response bool uint)) (prior (response bool uint)))
  (match prior ok-value result err-value (err err-value))
)

(define-private (send-token (recipient { to: principal, amount: uint, memo: (optional (buff 34)) }))
  (send-token-with-memo (get amount recipient) (get to recipient) (get memo recipient))
)

(define-private (send-token-with-memo (amount uint) (to principal) (memo (optional (buff 34))))
  (let ((transferOk (try! (transfer amount tx-sender to memo))))
    (ok transferOk)
  )
)

(define-private (send-stx (recipient principal) (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender recipient))
    (ok true) 
  )
)

;; ---------------------------------------------------------
;; Mint
;; ---------------------------------------------------------
(begin
    (try! (ft-mint? ${upperSymbol} MAXSUPPLY (var-get contract-owner)))
)`;
  };

  const deployNewToken = async () => {
    if (!symbol || !tokenName) {
      alert("Please enter token symbol and name");
      return;
    }

    const supplyNum = Number(supply);
    if (supplyNum > 1000000000) {
      alert("Maximum total supply is 1 billion tokens");
      return;
    }

    const decimalsNum = Number(decimals);
    if (decimalsNum < 0 || decimalsNum > 8) {
      alert("Decimals must be between 0 and 8");
      return;
    }

    setDeploying(true);
    try {
      const networkInstance = STACKS_TESTNET;
      if (!logo) {
        alert("Please upload a logo");
        return;
      }
      const metadataPath = await uploadTokenMetadata(
        logo,
        symbol.toUpperCase()
      );

      console.log(metadataPath);

      const contractCode = generateTokenContract(symbol, metadataPath);

      await openContractDeploy({
        contractName: `${symbol.toLowerCase()}-token`,
        codeBody: contractCode,
        network: networkInstance,
        onFinish: (data) => {
          console.log("Deployment finished:", data);
          alert("Token deployed successfully!");
        },
        onCancel: () => {
          console.log("Deployment cancelled");
        },
      });
    } catch (error) {
      console.error("Deployment error:", error);
      alert("Error deploying token");
    } finally {
      setDeploying(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black py-10">
      <div className="container mx-auto">
        <Card className="max-w-3xl mx-auto bg-black/50 backdrop-blur-sm border border-gray-800 shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center text-white">
              Create Your SIP-10 Token
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isSignedIn ? (
              <div className="text-center space-y-4">
                <p className="text-gray-300">
                  Connect your wallet to get started
                </p>
                <Button
                  onClick={() => doOpenAuth()}
                  className="bg-blue-600 hover:bg-blue-700 transform hover:scale-105 transition-all"
                >
                  Connect Wallet
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-gray-800/30 p-3 rounded-lg">
                  <p className="text-sm text-gray-300">
                    Connected: {getWalletAddress()}
                  </p>
                  <Button
                    variant="ghost"
                    onClick={handleDisconnect}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    Disconnect
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="tokenName" className="text-gray-300">
                      Token Name
                    </Label>
                    <Input
                      id="tokenName"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="My Token"
                      className="bg-gray-800/30 border-gray-700 text-white focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="symbol" className="text-gray-300">
                      Token Symbol
                    </Label>
                    <Input
                      id="symbol"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      placeholder="MTK"
                      className="bg-gray-800/30 border-gray-700 text-white focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="supply" className="text-gray-300">
                      Total Supply (Max: 1,000,000,000)
                    </Label>
                    <Input
                      id="supply"
                      type="number"
                      max="1000000000"
                      value={supply}
                      onChange={(e) => setSupply(e.target.value)}
                      className="bg-gray-800/30 border-gray-700 text-white focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="decimals" className="text-gray-300">
                      Decimals (0-8)
                    </Label>
                    <Input
                      id="decimals"
                      type="number"
                      min="0"
                      max="8"
                      value={decimals}
                      onChange={(e) => setDecimals(e.target.value)}
                      className="bg-gray-800/30 border-gray-700 text-white focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-gray-300">Token Logo</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="bg-gray-800/30 border-gray-700 text-white focus:ring-blue-500"
                    />
                    {logoPreview && (
                      <div className="mt-2">
                        <img
                          src={logoPreview}
                          alt="Token Logo Preview"
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description" className="text-gray-300">
                      Token Description
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter token description..."
                      className="bg-gray-800/30 border-gray-700 text-white focus:ring-blue-500"
                    />
                  </div>

                  <Button
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all mt-6"
                    onClick={deployNewToken}
                    disabled={deploying}
                  >
                    {deploying ? "Deploying..." : "Deploy Token"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
