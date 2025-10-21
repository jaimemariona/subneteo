"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Network, Calculator, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// SubnetResult interface removed - using plain objects

const SUBNET_REFERENCE_TABLE = [
  { prefix: "/8", mask: "255.0.0.0", hosts: 16777214, binary: "11111111.00000000.00000000.00000000" },
  { prefix: "/16", mask: "255.255.0.0", hosts: 65534, binary: "11111111.11111111.00000000.00000000" },
  { prefix: "/24", mask: "255.255.255.0", hosts: 254, binary: "11111111.11111111.11111111.00000000" },
  { prefix: "/25", mask: "255.255.255.128", hosts: 126, binary: "11111111.11111111.11111111.10000000" },
  { prefix: "/26", mask: "255.255.255.192", hosts: 62, binary: "11111111.11111111.11111111.11000000" },
  { prefix: "/27", mask: "255.255.255.224", hosts: 30, binary: "11111111.11111111.11111111.11100000" },
  { prefix: "/28", mask: "255.255.255.240", hosts: 14, binary: "11111111.11111111.11111111.11110000" },
  { prefix: "/29", mask: "255.255.255.248", hosts: 6, binary: "11111111.11111111.11111111.11111000" },
  { prefix: "/30", mask: "255.255.255.252", hosts: 2, binary: "11111111.11111111.11111111.11111100" },
]

export default function SubnetCalculator() {
  const [networkAddress, setNetworkAddress] = useState("172.16.20.0")
  const [subnetMask, setSubnetMask] = useState("255.255.0.0")
  const [requiredSubnets, setRequiredSubnets] = useState("4")
  const [results, setResults] = useState(null)
  const [calculationSteps, setCalculationSteps] = useState([])
  const [newMask, setNewMask] = useState("")
  const [newPrefix, setNewPrefix] = useState("")

  const calculateSubnets = () => {
    const steps = []
    const numSubnets = Number.parseInt(requiredSubnets)

    if (isNaN(numSubnets) || numSubnets < 2) {
      alert("Por favor ingrese un número válido de subredes (mínimo 2)")
      return
    }

    // Step 1: Calculate bits needed for subnets
    const bitsNeeded = Math.ceil(Math.log2(numSubnets))
    const totalSubnetsAvailable = Math.pow(2, bitsNeeded)
    steps.push(
      `Paso 1: Bits necesarios para ${numSubnets} subredes: 2^${bitsNeeded} = ${totalSubnetsAvailable} subredes disponibles (se generarán solo ${numSubnets})`,
    )

    // Step 2: Calculate new prefix
    const originalPrefix = subnetMask.split(".").reduce((acc, octet) => {
      return acc + Number.parseInt(octet).toString(2).split("1").length - 1
    }, 0)
    const newPrefixValue = originalPrefix + bitsNeeded
    steps.push(`Paso 2: Nuevo prefijo: /${originalPrefix} + ${bitsNeeded} bits = /${newPrefixValue}`)

    // Step 3: Calculate new subnet mask
    const maskBits = "1".repeat(newPrefixValue) + "0".repeat(32 - newPrefixValue)
    const newMaskValue = [
      Number.parseInt(maskBits.slice(0, 8), 2),
      Number.parseInt(maskBits.slice(8, 16), 2),
      Number.parseInt(maskBits.slice(16, 24), 2),
      Number.parseInt(maskBits.slice(24, 32), 2),
    ].join(".")
    setNewMask(newMaskValue)
    setNewPrefix(`/${newPrefixValue}`)
    steps.push(`Paso 3: Nueva máscara de subred: ${newMaskValue}`)

    // Step 4: Calculate hosts per subnet
    const hostBits = 32 - newPrefixValue
    const hostsPerSubnet = Math.pow(2, hostBits) - 2
    steps.push(`Paso 4: Hosts por subred: 2^${hostBits} - 2 = ${hostsPerSubnet} hosts`)

    // Step 5: Calculate network boundaries
    const baseOctets = networkAddress.split(".").map(Number)
    const originalMaskOctets = subnetMask.split(".").map(Number)
    const blockSize = Math.pow(2, 32 - newPrefixValue)
    
    // Calcular el límite superior de la red original
    const networkLimit = [...baseOctets]
    for (let j = 0; j < 4; j++) {
      networkLimit[j] = baseOctets[j] | (~originalMaskOctets[j] & 255)
    }
    
    const subnets = []
    steps.push(`Paso 5: Generando ${numSubnets} subredes con tamaño de bloque ${blockSize}`)

    for (let i = 0; i < numSubnets; i++) {
      // Calcular dirección de red
      const subnetBase = [...baseOctets]
      let carry = i * blockSize

      for (let j = 3; j >= 0; j--) {
        const total = subnetBase[j] + (carry % 256)
        subnetBase[j] = total % 256
        carry = Math.floor(carry / 256) + Math.floor(total / 256)
      }

      // Verificar que la subred no exceda los límites de la red original
      let exceedsLimit = false
      for (let j = 0; j < 4; j++) {
        if (subnetBase[j] > networkLimit[j]) {
          exceedsLimit = true
          break
        } else if (subnetBase[j] < networkLimit[j]) {
          break
        }
      }

      if (exceedsLimit) {
        steps.push(`⚠️ Advertencia: La subred ${i + 1} excede los límites de la red original. Se detiene la generación.`)
        break
      }

      const networkAddr = subnetBase.join(".")
      
      // Calcular primera IP utilizable (red + 1)
      const firstUsable = [...subnetBase]
      let carryFirst = 1
      for (let j = 3; j >= 0 && carryFirst > 0; j--) {
        const total = firstUsable[j] + carryFirst
        firstUsable[j] = total % 256
        carryFirst = Math.floor(total / 256)
      }
      
      // Calcular dirección de broadcast (red + blockSize - 1)
      const broadcast = [...subnetBase]
      let carryBroadcast = blockSize - 1
      for (let j = 3; j >= 0 && carryBroadcast > 0; j--) {
        const total = broadcast[j] + carryBroadcast
        broadcast[j] = total % 256
        carryBroadcast = Math.floor(total / 256)
      }
      
      // Verificar que el broadcast no exceda los límites
      let broadcastExceeds = false
      for (let j = 0; j < 4; j++) {
        if (broadcast[j] > networkLimit[j]) {
          broadcastExceeds = true
          break
        } else if (broadcast[j] < networkLimit[j]) {
          break
        }
      }

      if (broadcastExceeds) {
        steps.push(`⚠️ Advertencia: El broadcast de la subred ${i + 1} excede los límites de la red original. Se detiene la generación.`)
        break
      }
      
      // Calcular última IP utilizable (broadcast - 1)
      const lastUsable = [...broadcast]
      let carryLast = -1
      for (let j = 3; j >= 0 && carryLast !== 0; j--) {
        const total = lastUsable[j] + carryLast
        if (total < 0) {
          lastUsable[j] = 256 + total
          carryLast = -1
        } else {
          lastUsable[j] = total
          carryLast = 0
        }
      }

      subnets.push({
        subnetNumber: i + 1,
        networkAddress: networkAddr,
        firstUsable: firstUsable.join("."),
        lastUsable: lastUsable.join("."),
        broadcast: broadcast.join("."),
        hostsPerSubnet,
      })
    }

    setCalculationSteps(steps)
    setResults(subnets)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Network className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold text-balance">Calculadora de Subneteo</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-3xl mx-auto text-pretty">
          Herramienta interactiva para aprender y calcular subredes paso a paso. Comprende cómo dividir redes IP en
          subredes más pequeñas.
        </p>
      </div>

      {/* Introduction Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            ¿Qué es el Subneteo?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">
            El subneteo es el proceso de dividir una red IP en subredes más pequeñas. Esto permite una mejor
            organización, seguridad y eficiencia en el uso de direcciones IP. A través de esta herramienta, aprenderás
            cómo calcular máscaras de subred, rangos de IPs utilizables y direcciones de broadcast.
          </p>
        </CardContent>
      </Card>

      {/* Input Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Paso 1: Ingreso de Datos
          </CardTitle>
          <CardDescription>Configure los parámetros de red para comenzar el cálculo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="network">Dirección de Red</Label>
              <Input
                id="network"
                value={networkAddress}
                onChange={(e) => setNetworkAddress(e.target.value)}
                placeholder="172.16.20.0"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mask">Máscara de Subred</Label>
              <Input
                id="mask"
                value={subnetMask}
                onChange={(e) => setSubnetMask(e.target.value)}
                placeholder="255.255.0.0"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subnets">Número de Subredes Requeridas</Label>
              <Input
                id="subnets"
                type="number"
                min="2"
                value={requiredSubnets}
                onChange={(e) => setRequiredSubnets(e.target.value)}
                placeholder="4"
              />
            </div>
          </div>
          <Button onClick={calculateSubnets} className="mt-6 w-full md:w-auto" size="lg">
            <Calculator className="mr-2 h-4 w-4" />
            Calcular Subredes
          </Button>
        </CardContent>
      </Card>

      {/* Reference Tables */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Tabla de Referencia: Prefijos y Máscaras</CardTitle>
            <CardDescription>Relación entre notación CIDR, máscaras y hosts disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prefijo</TableHead>
                    <TableHead>Máscara</TableHead>
                    <TableHead className="text-right">Hosts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SUBNET_REFERENCE_TABLE.map((row) => (
                    <TableRow key={row.prefix}>
                      <TableCell className="font-mono font-semibold">{row.prefix}</TableCell>
                      <TableCell className="font-mono text-sm">{row.mask}</TableCell>
                      <TableCell className="text-right font-medium">{row.hosts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Representación Binaria</CardTitle>
            <CardDescription>Visualización de bits en las máscaras de subred</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prefijo</TableHead>
                    <TableHead>Binario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SUBNET_REFERENCE_TABLE.map((row) => (
                    <TableRow key={row.prefix}>
                      <TableCell className="font-mono font-semibold">{row.prefix}</TableCell>
                      <TableCell className="font-mono text-xs">{row.binary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calculation Steps */}
      {calculationSteps.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Proceso de Cálculo</CardTitle>
            <CardDescription>Pasos detallados del subneteo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {calculationSteps.map((step, index) => (
                <Alert key={index}>
                  <AlertDescription className="font-mono text-sm">{step}</AlertDescription>
                </Alert>
              ))}
              {newMask && (
                <div className="mt-4 p-4 bg-accent/20 rounded-lg border border-accent">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default">Resultado</Badge>
                  </div>
                  <p className="font-semibold">
                    Nueva Máscara: <span className="font-mono text-primary">{newMask}</span> ({newPrefix})
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados: Subredes Generadas</CardTitle>
            <CardDescription>Rangos de IPs utilizables y direcciones de broadcast para cada subred</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Subred</TableHead>
                    <TableHead>Dirección de Red</TableHead>
                    <TableHead>Primera IP Utilizable</TableHead>
                    <TableHead>Última IP Utilizable</TableHead>
                    <TableHead>Broadcast</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((subnet) => (
                    <TableRow key={subnet.subnetNumber}>
                      <TableCell>
                        <Badge variant="outline">#{subnet.subnetNumber}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold text-primary">
                        {subnet.networkAddress}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{subnet.firstUsable}</TableCell>
                      <TableCell className="font-mono text-sm">{subnet.lastUsable}</TableCell>
                      <TableCell className="font-mono text-sm">{subnet.broadcast}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
