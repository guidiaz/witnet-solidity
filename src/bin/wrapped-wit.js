#!/usr/bin/env node

require("dotenv").config()
const moment = require("moment")
const { execSync, spawn } = require("node:child_process")
const os = require("os")
const prompt = require("inquirer").createPromptModule()

const { WrappedWIT } = require("witnet-wrapped-wit")
const { Witnet } = require("@witnet/sdk")

const { ethers, utils } = require("../../dist/src/lib")
const helpers = require("./helpers")
const { green, yellow, lwhite } = helpers.colors

/// CONSTANTS AND GLOBALS =============================================================================================

const settings = {
  flags: {
    help: "Show usage information for a specific command.",
    version: "Print the CLI name and version.",

    check: "See if cross-chain transactions have been consolidated.",
    mints: "Include mint transactions, if any.",
    burns: "Include burn transactions, if any.",
    testnets: "List supported EVM testnets, instead of mainnets.",

  },
  options: {
    offset: {
      hint: "Skip the first output records when using --fromBlock (default: 0)",
      param: "OFFSET",
    },
    limit: {
      hint: "Limit number of output records (default: 64).",
      param: "LIMIT",
    },
    since: {
      hint: "Process events starting from the given EVM block number.",
      param: "EVM_BLOCK",
    },
    from: {
      hint: "Filter events by sender address.",
      param: "EVM|WIT_ADDRESS",
    },
    into: {
      hint: "Filter events by recipient address (or recipient of --value, when specified).",
      param: "EVM|WIT_ADDRESS",
    },
    "vtt-hash": {
      hint: "The hash of some finalized wrap transfer transaction in Witnet, pending to be verified.",
      param: "WIT_VTT_HASH",
    },
    value: {
      hint: "Send this amount of wrapped Wits to the specified recipient (requires --into).",
      param: "WIT_COINS",
    },
    gasPrice: {
      hint: "Specify the EVM transaction gas price to pay for.",
      param: "EVM_GAS_PRICE",
    },
    port: {
      hint: "Port on which the local ETH/RPC signing gateway is expected to be listening (default: 8545).",
      param: "HTTP_PORT",
    },
    witnet: {
      hint: "Wit/Oracle RPC provider to connect to, other than default.",
      param: "URL",
    },
  },
  envars: {
    ETHRPC_PRIVATE_KEYS: "=> Private keys used by the ETH/RPC gateway for signing EVM transactions.",
    WITNET_SDK_PROVIDER_URL: "=> Wit/Oracle RPC provider(s) to connect to, if no otherwise specified.",
    WITNET_SDK_WALLET_MASTER_KEY: "=> Wallet's master key in XPRV format, as exported from either a node, Sheikah or myWitWallet.",
  },
}

/// MAIN WORKFLOW =====================================================================================================

main()

async function main () {
  let ethRpcPort = 8545
  if (process.argv.indexOf("--port") >= 0) {
    ethRpcPort = parseInt(process.argv[process.argv.indexOf("--port") + 1])
  }
  let ethRpcProvider, ethRpcNetwork, ethRpcError
  try {
    ethRpcProvider = new ethers.JsonRpcProvider(`http://127.0.0.1:${ethRpcPort}`)
    ethRpcNetwork = utils.getEvmNetworkByChainId((await ethRpcProvider.getNetwork()).chainId)
  } catch (err) {
    ethRpcError = err
  }

  const router = {
    ...(WrappedWIT.isNetworkSupported(ethRpcNetwork)
      ? {
        accounts: {
          hint: `Show EVM native and Wrapped/WIT balances for all available signing accounts on ${helpers.colors.mcyan(ethRpcNetwork.toUpperCase())}.`,
          options: [
            "port",
          ],
          envars: [],
        },
        contract: {
          hint: `Show Wrapped/WIT contract address on ${helpers.colors.mcyan(ethRpcNetwork.toUpperCase())}.`,
        },
        supplies: {
          hint: `Show relevant token-related supplies on ${helpers.colors.mcyan(ethRpcNetwork.toUpperCase())}.`,
          options: [
            "witnet",
            "port",
            ...(WrappedWIT.isNetworkCanonical(ethRpcNetwork)
              ? ["witnet"]
              : []
            ),
          ],
          envars: [
            ...(WrappedWIT.isNetworkCanonical(ethRpcNetwork)
              ? ["WITNET_SDK_PROVIDER_URL", "WITNET_SDK_WALLET_MASTER_KEY"]
              : []
            ),
          ],
        },
        transfers: {
          hint: `Show transfers of Wrapped/WIT tokens on ${helpers.colors.mcyan(ethRpcNetwork.toUpperCase())}.`,
          flags: [
            "burns",
            "mints",
          ],
          options: [
            "port",
            "limit",
            "offset",
            "since",
            "from",
            "into",
            "value",
            "gasPrice",
          ],
        },
      }
      : {}),
    ...(WrappedWIT.isNetworkCanonical(ethRpcNetwork)
      ? {
        wrappings: {
          hint: `Show wrapping transactions into ${helpers.colors.mcyan(ethRpcNetwork.toUpperCase())}.`,
          flags: [
            "check",
          ],
          options: [
            "witnet",
            "port",
            "limit",
            "offset",
            "since",
            "from",
            "into",
            "value",
            "vtt-hash",
            "gasPrice",
          ],
          envars: [
            "WITNET_SDK_PROVIDER_URL",
            "WITNET_SDK_WALLET_MASTER_KEY",
          ],
        },
        unwrappings: {
          hint: `Show unwrapping transactions from ${helpers.colors.mcyan(ethRpcNetwork.toUpperCase())}.`,
          flags: [
            "check",
          ],
          options: [
            "witnet",
            "port",
            "limit",
            "offset",
            "since",
            "from",
            "into",
            "value",
            "gasPrice",
          ],
          envars: [
            "WITNET_SDK_PROVIDER_URL",
          ],
        },
      }
      : {}),
    gateway: {
      hint: "Launch a local ETH/RPC signing gateway connected to some specific EVM network.",
      params: ["EVM_NETWORK"],
      options: [
        "port",
      ],
      envars: [
        "ETHRPC_PRIVATE_KEYS",
        "ETHRPC_PROVIDER_URL",
      ],
    },
    networks: {
      hint: "List EVM networks where the Wrapped/WIT token is available.",
      params: "[EVM_ECOSYSTEM]",
      flags: [
        "testnets",
      ],
    },
    commands: {
      accounts: balance,
      contract: address,
      gateway,
      networks,
      supplies,
      transfers,
      unwrappings,
      wrappings,
    },
  }

  let [args, flags] = helpers.extractFlagsFromArgs(process.argv.slice(2), Object.keys(settings.flags))
  if (flags.version) {
    console.info(`${helpers.colors.lwhite(`Wrapped/WIT Ethers CLI v${require("../../package.json").version}`)}`)
  }
  let options; [args, options] = helpers.extractOptionsFromArgs(args, Object.keys(settings.options))
  if (args[0] && router.commands[args[0]] && router[args[0]]) {
    const cmd = args[0]
    if (flags.help) {
      showCommandUsage(router, cmd, router[cmd])
    } else {
      try {
        await router.commands[cmd]({
          ...settings,
          ...flags,
          ...options,
          provider: ethRpcProvider,
          network: ethRpcNetwork,
        }, args.slice(1))
      } catch (e) {
        showUsageError(router, cmd, router[cmd], e)
      }
    }
  } else {
    showMainUsage(router, ["ETHRPC_PRIVATE_KEYS", "WITNET_SDK_WALLET_MASTER_KEY"])
    if (!args[0] && ethRpcError) {
      console.info(helpers.colors.mred(`\nNo ETH/RPC gateway running on port ${ethRpcPort}.`))
    }
  }
}

function showMainUsage (router, envars) {
  showUsageHeadline(router)
  showUsageFlags(["help", "version"])
  showUsageOptions(["port"])
  console.info("\nCOMMANDS:")
  const maxLength = Object.keys(router.commands).map(key => key.length).reduce((prev, curr) => curr > prev ? curr : prev)
  Object.keys(router.commands).forEach(cmd => {
    if (router[cmd]) console.info("  ", `${cmd}${" ".repeat(maxLength - cmd.length)}`, " ", router[cmd]?.hint)
  })
  showUsageEnvars(envars)
}

function showCommandUsage (router, cmd, specs) {
  showUsageHeadline(router, cmd, specs)
  showUsageFlags(specs?.flags || [])
  showUsageOptions(specs?.options || [])
  showUsageEnvars(specs?.envars || [])
}

function showUsageEnvars (envars) {
  if (envars.length > 0) {
    console.info("\nENVARS:")
    const maxWidth = envars.map(envar => envar.length).reduce((curr, prev) => curr > prev ? curr : prev)
    envars.forEach(envar => {
      if (envar.toUpperCase().indexOf("KEY") < 0 && process.env[envar]) {
        console.info("  ", `${yellow(envar.toUpperCase())}${" ".repeat(maxWidth - envar.length)}`, ` => Settled to "${process.env[envar]}"`)
      } else {
        console.info("  ", `${yellow(envar.toUpperCase())}${" ".repeat(maxWidth - envar.length)}`, ` ${settings.envars[envar]}`)
      }
    })
  }
}

function showUsageError (router, cmd, specs, error) {
  showCommandUsage(router, cmd, specs)
  if (error) {
    console.info()
    console.error(error?.stack?.split("\n")[0] || error)
  }
}

function showUsageFlags (flags) {
  if (flags.length > 0) {
    const maxWidth = flags.map(flag => flag.length).reduce((curr, prev) => curr > prev ? curr : prev)
    console.info("\nFLAGS:")
    flags.forEach(flag => {
      if (settings.flags[flag]) {
        console.info(`   --${flag}${" ".repeat(maxWidth - flag.length)}   ${settings.flags[flag]}`)
      }
    })
  }
}

function showUsageHeadline (router, cmd, specs) {
  console.info("USAGE:")
  const flags = cmd && (!specs?.flags || specs.flags.length === 0) ? "" : "[FLAGS] "
  const options = specs?.options && specs.options.length > 0 ? "[OPTIONS] " : ""
  if (cmd) {
    if (specs?.params) {
      let params
      const optionalize = (str) => str.endsWith(" ...]")
        ? `[<${str.slice(1, -5)}> ...]`
        : (
          str[0] === "[" ? `[<${str.slice(1, -1)}>]` : `<${str}>`
        )
      if (Array.isArray(specs?.params)) {
        params = specs.params.map(param => optionalize(param)).join(" ") + " "
      } else {
        params = optionalize(specs?.params) + " "
      }
      console.info(`   ${lwhite(`npx wrapped-wit ${cmd}`)} ${params ? green(params) : ""}${flags}${options}`)
    } else {
      console.info(`   ${lwhite(`npx wrapped-wit ${cmd}`)} ${flags}${options}`)
    }
    console.info("\nDESCRIPTION:")
    console.info(`   ${router[cmd].hint}`)
  } else {
    console.info(`   ${lwhite("npx wrapped-wit")} <COMMAND> ${flags}${options}`)
  }
}

function showUsageOptions (options) {
  if (options.length > 0) {
    console.info("\nOPTIONS:")
    const maxLength = options
      .map(option => settings.options[option].param
        ? settings.options[option].param.length + option.length + 3
        : option.length
      )
      .reduce((prev, curr) => curr > prev ? curr : prev)
    options.forEach(option => {
      if (settings.options[option].hint) {
        const str = `${option}${settings.options[option].param ? helpers.colors.gray(` <${settings.options[option].param}>`) : ""}`
        console.info("  ", `--${str}${" ".repeat(maxLength - helpers.colorstrip(str).length)}`, "  ", settings.options[option].hint)
      }
    })
  }
}

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function address (flags = {}) {
  const { network } = flags
  helpers.traceHeader(network.toUpperCase(), helpers.colors.lcyan)
  console.info(`> ${
    helpers.colors.lwhite(WrappedWIT.getNetworkSettings(network).contract)
  }: ${
    helpers.colors.lblue(WrappedWIT.getNetworkContractAddress(network))
  }`)
}

async function balance (flags = {}) {
  const { provider, network } = flags
  const contract = await WrappedWIT.fetchContractFromEthersProvider(provider)
  helpers.traceHeader(network.toUpperCase(), helpers.colors.lcyan)

  const signers = await provider.listAccounts()
  const records = []
  let totalWit = 0n; let totalEth = 0n
  records.push(
    ...await Promise.all(signers.map(async signer => {
      const eth = await provider.getBalance(signer.address)
      const wit = BigInt(await contract.balanceOf.staticCall(signer.address))
      totalEth += eth
      totalWit += wit
      return [signer.address, eth, wit]
    }))
  )
  records.push(["", totalEth, totalWit])

  helpers.traceTable(
    records.map(([address, eth, wit], index) => {
      totalWit += wit
      eth = (Number(eth / BigInt(10 ** 15)) / 1000).toFixed(3)
      wit = (Number(wit / BigInt(10 ** 8)) / 10).toFixed(1)
      return [
        address !== "" ? index : "",
        address,
        address !== "" ? helpers.colors.blue(helpers.commas(eth)) : helpers.colors.lblue(helpers.commas(eth) + " ETH"),
        address !== "" ? helpers.colors.yellow(helpers.commas(wit)) : helpers.colors.lyellow(helpers.commas(wit) + " WIT"),
      ]
    }), {
      headlines: ["INDEX", "EVM ADDRESS", `${helpers.colors.lwhite("ETH")} BALANCE`, `${helpers.colors.lwhite("WIT")} BALANCE`],
      humanizers: [helpers.commas,,,],
      colors: [, helpers.colors.mblue],
    }
  )
}

async function gateway (flags = {}, args = []) {
  [args] = helpers.deleteExtraFlags(args)
  const network = args[0]
  if (!network) {
    throw new Error("No EVM network was specified.")
  } else if (network && !WrappedWIT.isNetworkSupported(network)) {
    throw new Error(`Unsupported network "${network}"`)
  } else {
    const shell = spawn(
      os.type() === "Windows_NT" ? "npx.cmd" : "npx", [
        "ethrpc",
        network,
        flags?.port || 8545,
      ],
      { shell: true }
    )
    shell.stdout.on("data", (x) => {
      process.stdout.write(x.toString())
    })
    shell.stderr.on("data", (x) => {
      process.stderr.write(x.toString())
    })
  }
}

async function networks (flags = {}) {
  const { testnets } = flags
  const networks = Object.fromEntries(WrappedWIT.getSupportedNetworks()
    .filter(network => {
      const settings = WrappedWIT.getNetworkSettings(network)
      const address = WrappedWIT.getNetworkAddresses(network)[settings.contract]
      return address && address !== "" && !(!WrappedWIT.isNetworkMainnet(network) ^ testnets)
    })
    .map(network => {
      return [
        network, {
          "Chain id": WrappedWIT.getNetworkChainId(network),
          Mainnet: WrappedWIT.isNetworkMainnet(network),
          Canonical: WrappedWIT.isNetworkCanonical(network),
        },
      ]
    })
  )
  console.table(networks)
}

async function supplies (flags = {}) {
  const { network, provider } = flags
  const contract = await WrappedWIT.fetchContractFromEthersProvider(provider)

  const records = []

  const totalSupply = Witnet.Coins.fromPedros(await contract.totalSupply())
  if (WrappedWIT.isNetworkCanonical(network)) {
    // connect to Witnet
    const witnet = await Witnet.JsonRpcProvider.fromEnv(flags?.witnet)
    const witnetSupply = await witnet.supplyInfo()

    const totalReserve = Witnet.Coins.fromPedros(await contract.totalReserve())
    records.push([
      "Currently tradeable token supply",
      totalReserve.pedros <= totalSupply.pedros
        ? helpers.colors.lyellow(helpers.commas(totalSupply.wits.toFixed(2)))
        : helpers.colors.yellow(helpers.commas(totalSupply.wits.toFixed(2))),
    ])
    records.push([
      "Max. supply that can be unwrapped",
      totalReserve.pedros >= totalSupply.pedros
        ? helpers.colors.myellow(helpers.commas(totalSupply.wits.toFixed(2)))
        : helpers.colors.yellow(helpers.commas(totalReserve.wits.toFixed(2))),
    ])

    const witCustodian = await contract.witCustodian()
    const witUnwrapper = await contract.witUnwrapper()
    let witnetBalance = 0n

    const custodianBalance = await witnet.getBalance(witCustodian)
    witnetBalance += custodianBalance.locked + custodianBalance.staked + custodianBalance.unlocked
    if (witnetBalance > totalSupply.pedros) {
      records.push([
        "Pending to-be-wrapped token supply",
        helpers.colors.magenta(helpers.commas(Witnet.Coins.fromPedros(witnetBalance - totalSupply.pedros).wits.toFixed(2))),
      ])
    }
    if (witUnwrapper !== witCustodian) {
      const unwrapperBalance = await witnet.getBalance(witUnwrapper)
      witnetBalance += unwrapperBalance.locked + unwrapperBalance.staked + unwrapperBalance.unlocked
    }
    records.push([
      "Token under-custody supply on Witnet",
      witnetBalance >= totalReserve.pedros
        ? helpers.colors.mmagenta(helpers.commas(Witnet.Coins.fromPedros(witnetBalance).wits.toFixed(2)))
        : helpers.colors.magenta(helpers.commas(Witnet.Coins.fromPedros(witnetBalance).wits.toFixed(2))),
    ])

    records.push([
      "Potentially wrappable supply on Witnet",
      helpers.colors.lmagenta(helpers.commas(
        Witnet.Coins.fromPedros(BigInt(witnetSupply.current_unlocked_supply) - witnetBalance).wits.toFixed(2)
      )),
    ])

    records.push([
      "Currently locked/staked supply on Witnet",
      helpers.colors.gray(helpers.commas(
        Witnet.Coins.fromPedros(
          BigInt(witnetSupply.current_staked_supply) + BigInt(witnetSupply.current_locked_supply)
        ).wits.toFixed(2)
      )),
    ])

    if (witnetBalance !== totalReserve.pedros) {
      const user = await prompt([{
        message: "On-chain under-custody supply is outdated! Shall we report a fresh new Proof-of-Reserve ?",
        name: "continue",
        type: "confirm",
        default: false,
      }])

      if (user.continue) {
        helpers.traceHeader(network.toUpperCase(), helpers.colors.lcyan)

        // create Witnet Wallet
        const wallet = await Witnet.Wallet.fromEnv({ provider: witnet, strategy: "slim-first" })

        // fetch proof-of-reserve radon bytecode from the token contract
        const bytecode = await contract.witOracleProofOfReserveRadonBytecode()

        // fetch Wit/Oracle Query settings from the token contract
        const querySettings = await contract.witOracleQuerySettings()

        // create Witnet Radon request
        const request = Witnet.Radon.RadonRequest.fromBytecode(bytecode)

        // print dry-run report on console
        console.info(helpers.colors.lwhite("> Notarizing Proof-of-Reserve on Witnet ..."))
        execSync(
          `npx witnet radon dry-run ${bytecode} --verbose --indent 2 --headline "WRAPPED / WIT PROOF-OF-RESERVE DRY-RUN REPORT"`,
          { stdio: "inherit", stdout: "inherit" },
        )
        console.info()

        // create and transmit Witnet Data Request Transaction (DRT)
        const PoRs = Witnet.DataRequests.from(wallet, request)
        let tx = await PoRs.sendTransaction({
          fees: Witnet.TransactionPriority.Medium,
          witnesses: querySettings.minWitnesses,
          maxResultSize: 256,
        })

        // await inclusion of the DRT in Witnet
        console.info(`  - DRO hash:   ${tx.droHash}`)
        console.info(`  - DRT hash:   ${tx.hash}`)
        tx = await PoRs.confirmTransaction(tx.hash, {
          confirmations: 0,
          onStatusChange: () => console.info(`  - DRT status: ${tx.status}`),
        })

        // await resolution of the DRT in Witnet
        let status = tx.status
        do {
          const report = await witnet.getDataRequest(tx.hash, "ethereal")
          if (report.status !== status) {
            status = report.status
            console.info(`  - DRT status: ${report.status}`)
          }
          if (report.status === "solved" && report?.result) {
            console.info(`  - DRT result: ${utils.cbor.decode(utils.fromHexString(report.result.cbor_bytes))}`)
            break
          }
          const delay = ms => new Promise(_resolve => setTimeout(_resolve, ms))
          await helpers.prompter(delay(5000))
        } while (status !== "solved")

        // push proof-of-reserve report into the token contract
        console.info(
          helpers.colors.lwhite("\n> Pushing Proof-of-Reserve report into ") +
            helpers.colors.mblue(WrappedWIT.getNetworkContractAddress(network)) +
            helpers.colors.lwhite(" ...")
        )
        // todo: fetch data push report from kermit

        console.info()
      }
    }
  } else {
    records.push([
      "Currently tradeable token supply",
      helpers.colors.myellow(helpers.commas(totalSupply.wits.toFixed(2))),
    ])
  }

  helpers.traceTable(records, {
    headlines: [
      `${helpers.colors.lcyan(network.replace(":", " ").toUpperCase())}`,
      "Available ($WIT)",
    ],
  }
  )
  process.exit(0)
}

async function transfers (flags = {}) {
  let { provider, network, from, into, value, since, gasPrice, confirmations } = flags
  let contract = await WrappedWIT.fetchContractFromEthersProvider(provider)
  helpers.traceHeader(network.toUpperCase(), helpers.colors.lcyan)

  if (value) {
    value = Witnet.Coins.fromWits(value)
    if (!into) {
      throw new Error("--into must be specified.")
    } else if (!from) {
      from = (await provider.listAccounts())[0].address
    }
    contract = contract.connect(await provider.getSigner(from))
    console.info(helpers.colors.lwhite(`> Transferring ${ethers.formatUnits(value.pedros, 9)} WIT ...`))
    console.info(`  - EVM sender:       ${from}`)
    console.info(`  - EVM recipient:    ${into}`)
    await contract
      .transfer
      .send(into, value.pedros, { gasPrice })
      .then(async (tx) => {
        console.info(`  - Transaction hash: ${tx.hash}`)
        return await helpers.prompter(tx.wait(confirmations || 1))
      })
      .then(receipt => {
        console.info(`  - Block number:     ${helpers.commas(receipt.blockNumber)}`)
        console.info(`  - Gas price:        ${helpers.commas(receipt.gasPrice)}`)
        console.info(`  - Gas used:         ${helpers.commas(receipt.gasUsed)}`)
        console.info(`  - Transaction cost: ${ethers.formatEther(receipt.gasPrice * receipt.gasUsed)} ETH`)
        return receipt
      })
  }

  const fromBlock = since ? BigInt(flags.since) : undefined
  let events = (fromBlock !== undefined && !value
    ? (await contract.queryFilter("Transfer", fromBlock)).slice(flags?.offset || 0, flags?.limit || 64)
    : (await contract.queryFilter("Transfer")).reverse().slice(0, flags?.limit || 64)
  )
  if (from) events = events.filter(event => event.args[0].toLowerCase().indexOf(from.toLowerCase()) > -1)
  if (into && !value) events = events.filter(event => event.args[1].toLowerCase().indexOf(into.toLowerCase()) > -1)
  if (!flags?.mints) events = events.filter(event => event.args[0] !== "0x0000000000000000000000000000000000000000")
  if (!flags?.burns) events = events.filter(event => event.args[1] !== "0x0000000000000000000000000000000000000000")
  if (events.length > 0) {
    helpers.traceTable(
      events.map(event => {
        const sender = `${event.args[0].slice(0, 7)}...${event.args[0].slice(-7)}`
        const recipient = `${event.args[1].slice(0, 7)}...${event.args[1].slice(-7)}`
        return [
          event.blockNumber,
          event.transactionHash,
          event.args[0] === "0x0000000000000000000000000000000000000000" ? helpers.colors.blue(sender) : helpers.colors.mblue(sender),
          event.args[1] === "0x0000000000000000000000000000000000000000" ? helpers.colors.blue(recipient) : helpers.colors.mblue(recipient),
          event.args[2],
        ]
      }), {
        headlines: ["BLOCK NUMBER", "EVM TRANSACTION HASH", "EVM SENDER", "EVM RECIPIENT", `VALUE (${helpers.colors.lwhite("$pedros")})`],
        humanizers: [helpers.commas,,,, helpers.commas],
        colors: [, helpers.colors.gray,,, helpers.colors.yellow],
      }
    )
  } else {
    console.info(`^ No transfers found ${from ? `from "${from}" ` : ""}${into ? `into "${into}"` : ""}.`)
  }
}

async function unwrappings (flags = {}) {
  let { check, provider, network, from, into, value, since, offset, limit, gasPrice, confirmations } = flags
  let contract = await WrappedWIT.fetchContractFromEthersProvider(provider)
  helpers.traceHeader(network.toUpperCase(), helpers.colors.lcyan)

  if (from && !ethers.isAddress(from)) {
    throw new Error("--from must specify some valid <EVM_ADDRESS>.")
  } else if (into) {
    try {
      Witnet.PublicKeyHash.fromBech32(into)
    } catch {
      throw new Error("--into must specify some valid <WIT_ADDRESS>.")
    }
  }

  if (value) {
    value = Witnet.Coins.fromWits(value)
    if (!into) {
      throw new Error("--into <WIT_ADDRESS> must be specified.")
    } else if (!from) {
      from = (await provider.listAccounts())[0].address
    }
    contract = contract.connect(await provider.getSigner(from))
    console.info(helpers.colors.lwhite(`> Unwrapping ${ethers.formatUnits(value.pedros, 9)} WIT ...`))
    console.info(`  - EVM sender:       ${from}`)
    console.info(`  - WITNET recipient: ${into}`)
    await contract
      .unwrap
      .send(value.pedros, into, { gasPrice }) // swap method's parameters order
      .then(async (tx) => {
        console.info(`  - Transaction hash: ${tx.hash}`)
        return await helpers.prompter(tx.wait(confirmations || 1))
      })
      .then(receipt => {
        console.info(`  - Transaction cost: ${ethers.formatEther(receipt.gasPrice * receipt.gasUsed)} ETH`)
        console.info(`  - Block number:     ${helpers.commas(receipt.blockNumber)}`)
        console.info(`  - Gas price:        ${helpers.commas(receipt.gasPrice)}`)
        console.info(`  - Gas used:         ${helpers.commas(receipt.gasUsed)}`)
        return receipt
      })
  }

  const fromBlock = since ? BigInt(flags.since) : undefined
  let events = (fromBlock !== undefined && !value
    ? (await contract.queryFilter("Unwrapped", fromBlock)).slice(offset || 0, limit || 64)
    : (await contract.queryFilter("Unwrapped")).reverse().slice(0, limit || 64)
  )
  if (from) events = events.filter(event => event.args[0].toLowerCase().indexOf(from.toLowerCase()) > -1)
  if (into && !value) events = events.filter(event => event.args[1].toLowerCase().indexOf(into.toLowerCase()) > -1)

  if (check) {
    const witnet = await Witnet.JsonRpcProvider.fromEnv(flags?.witnet)
    const records = await helpers.prompter(
      Promise.all(events.map(async event => {
        const ethBlock = await provider.getBlock(event.blockNumber)
        const witUnwrapTx = await WrappedWIT.findUnwrapTransactionFromWitnetProvider(
          witnet,
          network,
          event.blockNumber,
          event.args[3], // nonce
          event.args[0], // from
          event.args[1], // to
          event.args[2] // value
        )
        return [
          { blockNumber: event.blockNumber, hash: event.transactionHash, timestamp: ethBlock.timestamp },
          witUnwrapTx,
          witUnwrapTx ? moment.duration(moment.unix(witUnwrapTx.timestamp).diff(moment.unix(ethBlock.timestamp))).humanize() : "",
        ]
      }))
    )
    helpers.traceTable(
      records.map(([evm, wit, timediff]) => [
        evm.blockNumber,
        evm.hash,
        wit?.hash,
        timediff,
      ]), {
        headlines: ["BLOCK NUMBER", "EVM TRANSACTION HASH", `WITNET ${witnet.network.toUpperCase()} TRANSACTION HASH`, ":TIME DIFF"],
        humanizers: [helpers.commas,,,],
        colors: [, helpers.colors.gray, helpers.colors.magenta],
      }
    )
  } else {
    if (events.length > 0) {
      helpers.traceTable(
        events.map(event => {
          const sender = `${event.args[0].slice(0, 7)}...${event.args[0].slice(-7)}`
          return [
            event.blockNumber,
            event.transactionHash,
            sender,
            event.args[1],
            event.args[2],
          ]
        }), {
          headlines: [
            "BLOCK NUMBER",
            "EVM TRANSACTION HASH",
            "EVM SENDER",
            `WITNET ${WrappedWIT.isNetworkMainnet(network) ? "MAINNET" : "TESTNET"} RECIPIENT`,
            `VALUE (${helpers.colors.lwhite("$pedros")})`,
          ],
          humanizers: [helpers.commas,,,, helpers.commas],
          colors: [, helpers.colors.gray, helpers.colors.mblue, helpers.colors.mmagenta, helpers.colors.yellow],
        }
      )
    } else {
      console.info(`^ No unwrappings found ${from ? `from "${from}" ` : ""}${into ? `into "${into}"` : ""}.`)
    }
  }
}

async function wrappings (flags = {}) {
  let { provider, network, from, into, value, since, offset, limit, gasPrice, confirmations, check } = flags
  let contract = await WrappedWIT.fetchContractFromEthersProvider(provider)
  helpers.traceHeader(network.toUpperCase(), helpers.colors.lcyan)

  if (into && !ethers.isAddress(into)) {
    throw new Error("--into must specify some valid <EVM_ADDRESS>.")
  } else if (from) {
    try {
      Witnet.PublicKeyHash.fromBech32(from)
    } catch {
      throw new Error("--from must specify some valid <WIT_ADDRESS>.")
    }
  }

  let witnet, wallet, ledger
  if (value || flags["vtt-hash"] || check) {
    // connect to witnet provider
    witnet = await Witnet.JsonRpcProvider.fromEnv(flags?.witnet)

    if (value || flags["vtt-has"]) {
      // create local wallet
      wallet = await Witnet.Wallet.fromEnv({ provider: witnet, strategy: "slim-first", onlyWithFunds: false })

      // select account/signer address from witnet wallet
      ledger = from ? wallet.getAccount(from) : wallet
      if (!ledger) {
        throw new Error("--from <WIT_ADDRESS> not found on wallet.")
      }
    }
  }

  if (value && witnet) {
    value = Witnet.Coins.fromWits(value)
    if ((await ledger.getBalance()).unlocked < value.pedros) {
      throw new Error(`Insufficient funds on ${ledger.pkh}`)
    }

    // read Wit/ custodian address from token contract
    const witCustodian = await contract.witCustodian()

    const user = await prompt([{
      message: `Transfer ${value.toString(2)} into custodian address at ${witCustodian} ?`,
      name: "continue",
      type: "confirm",
      default: false,
    }])

    if (user.continue) {
      // create and send to Witnet a new value transfer transaction with metadata tag
      const VTTs = Witnet.ValueTransfers.from(ledger)
      const metadata = Witnet.PublicKeyHash.fromHexString(into).toBech32(witnet.network)
      let tx = await VTTs.sendTransaction({
        recipients: [
          [witCustodian, value],
          [metadata, Witnet.Coins.fromPedros(1n)],
        ],
      })
      console.info(`  - From:       ${helpers.colors.mmagenta(ledger.pkh)}`)
      console.info(`  - Into:       ${helpers.colors.mcyan(witCustodian)}`)
      console.info(`  - Value:      ${helpers.colors.myellow(`${value.wits.toFixed(2)} WIT`)}`)
      console.info(`  - Fees:       ${helpers.colors.yellow(tx.fees.toString())}`)
      console.info(`  - VTT hash:   ${helpers.colors.lwhite(tx.hash)}`)
      // 7327fc0922c2466c9f032b51501814e4de9ef90e8732ef005c71533392ecce4b

      // await inclusion of the VTT in Witnet
      tx = await VTTs.confirmTransaction(tx.hash, {
        confirmations: 0,
        onStatusChange: () => console.info(`  - VTT status: ${tx.status}`),
      })

      console.info(helpers.colors.myellow("\n => Please, wait a few minutes until the transaction gets finalized on Witnet,"))
      console.info(helpers.colors.myellow("      before querying on-chain verification.\n"))

      // remove --into filter
      into = undefined
    }
  }

  if (flags["vtt-hash"] && witnet) {
    const vttHash = flags["vtt-hash"].startsWith("0x") ? flags["vtt-hash"].slice(2) : flags["vtt-hash"]
    if (!utils.isHexStringOfLength(vttHash, 32)) {
      throw new Error("--vtt-hash must specify a valid Witnet transaction hash.")
    }

    // check the VTT exists, and fetch transaction etheral report
    const vtt = await witnet.getValueTransfer(vttHash, "ethereal")

    // read Wit/ custodian address from token contract
    const witCustodian = await contract.witCustodian()

    // check if the VTT is a valid transfer to the custodian address:
    if (vtt.recipient !== witCustodian) {
      throw new Error(`Transaction ${vttHash} transfers no value to custodian address at ${witCustodian}.`)
    } else if (!vtt.metadata) {
      throw new Error(`Transaction ${vttHash} transfers value to custodian address at ${witCustodian}, but specifies no EVM recipient.`)
    }

    let proceed, wrapEvent, user

    // check VTT's current wrapping status
    switch (await contract.getWrapTransactionStatus(`0x${vttHash}`)) {
      case 3n: // Done
        proceed = false
        wrapEvent = (await contract.queryFilter("Wrapped")).find(event => event.args[3] === `0x${vttHash.toLowerCase()}`)
        if (wrapEvent) {
          since = wrapEvent.blockNumber; offset = 0; limit = 1
          from = wrapEvent.args[0]; into = wrapEvent.args[1]
          console.info(helpers.colors.mgreen(" => This Witnet wrap transaction has already been verified and minted:"))
        }
        break

      case 0n: // Unknown
      case 2n: // Retry
        proceed = true
        break

      case 1n: // Awaiting
        user = await prompt([{
          message: "The specified VTT hash is currently being verified. Shall we retry, anyways ?",
          name: "continue",
          type: "confirm",
          default: false,
        }])
        proceed = user.continue
        break

      default:
        proceed = false
    }

    if (proceed && vtt.finalized !== 1) {
      console.info(helpers.colors.mred("\n => Sorry, wait a few minutes until the transaction gets finalized on Witnet,"))
      console.info(helpers.colors.mred("      before querying on-chain verification.\n"))
      proceed = false
    }

    if (proceed) {
      if (!gasPrice) gasPrice = (await provider.getFeeData()).gasPrice
      const fee = await contract.witOracleEstimateWrappingFee(gasPrice)
      const gas = await contract.wrap.estimateGas(`0x${vttHash}`, { value: fee, gasPrice })
      const cost = fee + gasPrice * gas
      user = await prompt([{
        message: `Verification is expected to cost ${ethers.formatEther(cost)} ETH. Shall we proceed ?`,
        name: "continue",
        type: "confirm",
        default: true,
      }])
      if (user.continue) {
        // connect contract to the eth/rpc provider's default signer
        contract = contract.connect(await provider.getSigner())

        console.info(helpers.colors.lwhite(`> Wrapping ${ethers.formatUnits(vtt.value, 9)} WIT ...`))
        console.info(`  - WITNET sender:  ${vtt.sender}`)
        console.info(`  - EVM recipient:  ${ethers.getAddress(`0x${vtt.metadata}`)}`)
        console.info(`  - EVM signer:     ${(await provider.getSigner()).address}`)
        console.info(`  - Wit/Oracle fee: ${ethers.formatEther(fee)} ETH`)

        await contract
          .wrap
          .send(`0x${vttHash}`, { value: fee, gasPrice })
          .then(async (tx) => {
            console.info(`  - EVM tx hash:    ${tx.hash}`)
            return await helpers.prompter(tx.wait(confirmations || 1))
          })
          .then(receipt => {
            console.info(`  - EVM tx cost:    ${ethers.formatEther(fee + receipt.gasPrice * receipt.gasUsed)} ETH`)
            console.info(`  - Gas price:      ${helpers.commas(receipt.gasPrice)}`)
            console.info(`  - Gas used:       ${helpers.commas(receipt.gasUsed)}`)
            console.info(`  - Block number:   ${helpers.commas(receipt.blockNumber)}`)
            return receipt
          })
        // settle --from filter
        from = vtt.sender
        // delete --into filter
        into = undefined
      }
    }
  }

  const fromBlock = since ? BigInt(since) : undefined
  let events = (fromBlock !== undefined && !value
    ? (await contract.queryFilter("Wrapped", fromBlock)).slice(offset || 0, limit || 64)
    : (await contract.queryFilter("Wrapped")).reverse().slice(0, limit || 64)
  )
  if (from) events = events.filter(event => event.args[0].toLowerCase().indexOf(from.toLowerCase()) > -1)
  if (into) events = events.filter(event => event.args[1].toLowerCase().indexOf(into.toLowerCase()) > -1)

  if (check && witnet) {
    const records = await helpers.prompter(
      Promise.all(events.map(async event => {
        const ethBlock = await provider.getBlock(event.blockNumber)
        const ethTxHash = event.transactionHash
        const witTxHash = event.args[3]
        const witTx = await witnet.getValueTransfer(witTxHash.slice(2), "ethereal")
        return [
          { hash: witTxHash.slice(2), timestamp: witTx.timestamp },
          { blockNumber: event.blockNumber, hash: ethTxHash, timestamp: ethBlock.timestamp },
          moment.duration(moment.unix(ethBlock.timestamp).diff(moment.unix(witTx.timestamp))).humanize(),
        ]
      }))
    )
    if (records.length > 0) {
      helpers.traceTable(
        records.map(([wit, evm, timediff]) => [
          evm.blockNumber,
          wit.hash,
          evm.hash,
          timediff,
        ]), {
          headlines: [
            "BLOCK NUMBER",
            `WITNET ${witnet.network.toUpperCase()} TRANSFER HASH`,
            "EVM WRAP VERIFICATION HASH",
            ":TIME DIFF",
          ],
          humanizers: [helpers.commas,,,],
          colors: [, helpers.colors.magenta, helpers.colors.gray],
        }
      )
    } else {
      console.info(`^ No verified wrappings found so far ${from ? `from "${from}" ` : ""}${into ? `into "${into}"` : ""}.`)
    }
  } else {
    if (events.length > 0) {
      helpers.traceTable(
        events.map(event => {
          const recipient = `${event.args[1].slice(0, 7)}...${event.args[1].slice(-7)}`
          return [
            event.blockNumber,
            event.args[0],
            event.transactionHash,
            recipient,
            event.args[2],
          ]
        }), {
          headlines: [
            "BLOCK NUMBER",
            `WITNET ${WrappedWIT.isNetworkMainnet(network) ? "MAINNET" : "TESTNET"} SENDER`,
            "EVM WRAP VERIFICATION HASH",
            "EVM RECIPIENT",
            `VALUE (${helpers.colors.lwhite("$pedros")})`,
          ],
          humanizers: [helpers.commas,,,, helpers.commas],
          colors: [, helpers.colors.mmagenta, helpers.colors.gray, helpers.colors.mblue, helpers.colors.yellow],
        }
      )
    } else {
      console.info(`^ No verified wrappings found so far ${from ? `from "${from}" ` : ""}${into ? `into "${into}"` : ""}.`)
    }
  }
}
