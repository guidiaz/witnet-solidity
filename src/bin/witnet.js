#!/usr/bin/env node

const { execSync, spawn } = require("node:child_process")
const fs = require("fs")
const inquirer = require("inquirer")
const os = require("os")
const path = require("path")

const utils = require("witnet-solidity-bridge/utils")
const Witnet = require("witnet-toolkit")

const witnet_require_path = process.env.WITNET_SOLIDITY_REQUIRE_PATH || "../../../../witnet"
const witnet_solidity_module_path = process.env.WITNET_SOLIDITY_MODULE_PATH || "node_modules/witnet-solidity/witnet"
const witnet_config_file = `${witnet_solidity_module_path}/truffle.config.js`
const witnet_contracts_path = `${witnet_solidity_module_path}/contracts`
const witnet_migrations_path = `${witnet_solidity_module_path}/scripts/truffle/`
const witnet_tests_path = `${witnet_solidity_module_path}/tests/truffle`

if (process.argv.length >= 3) {
  const command = process.argv[2]
  if (command === "init") {
    if (!fs.existsSync("./witnet/addresses.json")) {
      // if not yet initialized...
      init()
    }
    version()
    showMainUsage()
  } else if (command === "avail") {
    avail()
  } else if (command === "test") {
    test()
  } else if (command === "check") {
    check()
  } else if (command === "console") {
    truffleConsole()
  } else if (command === "deploy") {
    deploy()
  } else if (command === "ethrpc") {
    ethrpc()
  } else if (command === "version") {
    version()
  } else if (command === "wizard") {
    wizard()
  } else {
    version()
    showMainUsage()
  }
} else {
  version()
  showMainUsage()
}

function version (str) {
  console.info(`\x1b[1;96mWitnet Solidity ${str || "utility command"} v${require("../../package.json").version}\x1b[0m`)
}

function showMainUsage () {
  console.info()
  console.info("Usage:")
  console.info()
  console.info("  ", "avail", "\t\t=>", "List available resources from Witnet.")
  console.info("  ", "check", "\t\t=>", "Check that all Witnet assets are properly declared.")
  console.info("  ", "console", "\t\t=>", "Open Truffle console as to interact with Witnet deployed artifacts.")
  console.info("  ", "deploy", "\t\t=>", "Deploy Witnet requests and templates defined within the witnet/assets/ folder.")
  console.info("  ", "ethrpc", "\t\t=>", "Run a local ETH/RPC gateway to the specified chain.")
  console.info("  ", "test", "\t\t=>", "Dry-run requests and templates defined within the witnet/assets/ folder.")
  console.info("  ", "wizard", "\t\t=>", "Helps you to integrate the Witnet Oracle within your smart contracts.")
}

function showAvailUsage () {
  console.info("Usage:")
  console.info()
  console.info("  ", "$ npx witnet avail")
  console.info("  ", "  ", "--chains [<optional-list>]", "\t=>", "List supported sidechains and deployed Witnet artifact addresses within those.")
  console.info("  ", "  ", "--requests [<optional-list>]", "\t=>", "Show details of all Witnet request artifacts currently available for deployment.")
  console.info("  ", "  ", "--templates [<optional-list>]", "\t=>",
    "Show details of all Witnet template artifacts currently available for deployment."
  )
  console.info("  ", "  ", "--sources [<optional-list>]", "\t=>",
    "Show details of Witnet data retriving scripts referable from other Witnet artifacts."
  )
}

async function init () {
  if (!fs.existsSync("./witnet/assets")) {
    fs.mkdirSync("./witnet/assets", { recursive: true })
  }
  if (!fs.existsSync(".env_witnet")) {
    fs.cpSync("node_modules/witnet-solidity/.env_witnet", ".env_witnet")
  }
  fs.cpSync("node_modules/witnet-solidity/witnet/assets/_index.js", "./witnet/assets/index.js")
  if (!fs.existsSync("./witnet/assets/requests.js")) {
    fs.cpSync("node_modules/witnet-solidity/witnet/assets/_requests.js", "./witnet/assets/requests.js")
  }
  if (!fs.existsSync("./witnet/assets/sources.js")) {
    fs.cpSync("node_modules/witnet-solidity/witnet/assets/_sources.js", "./witnet/assets/sources.js")
  }
  if (!fs.existsSync("./witnet/assets/templates.js")) {
    fs.cpSync("node_modules/witnet-solidity/witnet/assets/_templates.js", "./witnet/assets/templates.js")
  }
  if (!fs.existsSync("./witnet/assets/templates.js")) {
    fs.cpSync("node_modules/witnet-solidity/witnet/assets/_templates.js", "./witnet/assets/templates.js")
  }
  if (!fs.existsSync("./witnet/addresses.json")) {
    fs.writeFileSync("./witnet/addresses.json", "{}")
  }
  if (!fs.existsSync("./witnet/_truffle.config.js")) {
    fs.cpSync("node_modules/witnet-solidity/witnet/_truffle.config.js", "./witnet/_truffle.config.js")
  }
}

function avail () {
  const assets = require(`${witnet_require_path}/assets`)
  const { requests, sources, templates } = assets
  const [ecosystems, networks] = [
    assets.supportedEcosystems(),
    assets.supportedNetworks(),
  ]

  if (process.argv.includes("--chains")) {
    let selection = _splitSelectionFromProcessArgv("--chains")
    // add `WITNET_SOLIDITY_DEFAULT_CHAIN` to selection, should no chains list be provided from CLI
    if ((!selection || selection.length === 0) && process.env.WITNET_SOLIDITY_DEFAULT_CHAIN) {
      selection = [process.env.WITNET_SOLIDITY_DEFAULT_CHAIN.toLowerCase().trim().replaceAll(".", ":")]
    }
    if (!selection || selection.length === 0) {
      // if no chains list was specified, just list Witnet supported "ecosystems"
      _traceHeader("SUPPORTED ECOSYSTEMS")
      ecosystems.forEach(ecosystem => {
        console.info("  ", ecosystem.toUpperCase())
      })
      console.info()
      console.info("To get Witnet-supported chains within a list of ecosystems:")
      console.info()
      console.info("  ", "$ npx witnet avail --chains <comma-separated-witnet-supported-ecosystems>")
      console.info()
      console.info("Note: the --chains operand can be omitted if the WITNET_SOLIDITY_DEFAULT_CHAIN environment variable is set.")
      console.info()
      process.exit(0)
    }
    let found = 0
    for (const index in ecosystems) {
      const ecosystem = ecosystems[index]
      if (selection.includes(ecosystem)) {
        // if ecosystem matches any of selection items,
        // print Witnet supported "chains" within it
        found++
        _traceHeader(`${ecosystem.toUpperCase()} ECOSYSTEM`)
        networks.forEach(network => {
          if (network.startsWith(ecosystem)) {
            console.info("  ", network)
          }
        })
        console.info()
        console.info("To get Witnet artifact addresses within one or more chains:")
        console.info()
        console.info(
          "  ",
          "$ npx witnet avail --chains <comma-separated-witnet-supported-chains> [--artifacts <comma-separated-witnet-artifact-names>]"
        )
        console.info()
        console.info("Principal Witnet artifact addresses will be shown if no artifact name list is specified.")
        console.info()
      }
    }
    for (const nix in networks) {
      const network = networks[nix]
      if (selection.length === 0 || selection.includes(network)) {
        found++
        _traceHeader(`${network.toUpperCase()}`)
        if (_traceWitnetAddresses(assets.getAddresses(network), utils.getWitnetArtifactsFromArgs()) === 0) {
          console.info("  ", "Unavailable.")
        }
      }
    }
    if (!found) {
      console.info()
      console.info("Sorry, no entries found for chains: ", selection)
    }
  } else if (process.argv.includes("--requests")) {
    const selection = _splitSelectionFromProcessArgv("--requests")
    if (selection.length === 0) {
      _traceHeader("WITNET DATA REQUESTS")
      _traceWitnetArtifactsBreakdown(requests)
    }
    if (selection.length === 0 || !_traceWitnetArtifacts(requests, selection)) {
      console.info()
      console.info("To delimit tree breakdown, or show the specs of a group of leafs:")
      console.info()
      console.info("  ", "$ npx witnet avail --sources <comma-separated-unique-resource-names>")
      console.info()
    }
  } else if (process.argv.includes("--templates")) {
    const selection = _splitSelectionFromProcessArgv("--templates")
    if (selection.length === 0) {
      _traceHeader("WITNET REQUEST TEMPLATES")
      _traceWitnetArtifactsBreakdown(templates)
    }
    if (selection.length === 0 || !_traceWitnetArtifacts(templates, selection)) {
      console.info()
      console.info("To delimit tree breakdown, or show the specs of a group of leafs:")
      console.info()
      console.info("  ", "$ npx witnet avail --sources <comma-separated-unique-resource-names>")
      console.info()
    }
  } else if (process.argv.includes("--sources")) {
    const selection = _splitSelectionFromProcessArgv("--sources")
    if (selection.length === 0) {
      _traceHeader("DATA SOURCES")
      _traceWitnetSourcesBreakdown(sources)
      console.info()
      console.info("To delimit tree breakdown, or show the specs of a group of leafs:")
      console.info()
      console.info("  ", "$ npx witnet avail --sources <comma-separated-unique-resource-names>")
      console.info()
    } else {
      const dict = Witnet.Dictionary(Object, sources)
      for (const index in selection) {
        const key = selection[index]
        try {
          const source = dict[key]
          if (source?.method) {
            console.info("\n  ", `\x1b[1;37m${key}\x1b[0m`)
            console.info("  ", "=".repeat(key.length))
            _traceWitnetSource(source)
          } else {
            console.info("\n  ", `\x1b[1;37m${key}\x1b[0m`)
            console.info("  ", "=".repeat(key.length))
            _traceWitnetSourcesBreakdown(source)
          }
        } catch (ex) {
          console.info("\n  ", `\x1b[1;31m${key}\x1b[0m`)
          console.info("  ", "=".repeat(key.length))
          console.info("  ", ">", ex.toString().split("\n")[0])
        }
      }
    }
  } else {
    showAvailUsage()
  }
}

function check () {
  _traceHeader("WITNET ASSETS")
  const assets = require(`${witnet_require_path}/assets`)
  const [requests, templates, sources] = [
    _countLeaves(Witnet.Artifacts.Class, assets?.requests),
    _countLeaves(Witnet.Artifacts.Template, assets?.templates),
    _countLeaves(Witnet.Sources.Class, assets?.sources),
  ]

  if (sources) {
    console.info("  ", "> Data sources:     ", sources)
  }
  if (requests) {
    console.info("  ", "> Data requests:    ", requests)
  }
  if (templates) {
    console.info("  ", "> Request templates:", templates)
  }

  console.info("\nAll assets checked successfully!")
}

function test () {
  let oIndex = -1
  process.argv.forEach((value, index) => {
    if (value.startsWith("--") && oIndex === -1) {
      oIndex = index
    }
  })
  const args = (oIndex >= 0) ? process.argv.slice(oIndex).join(" ") : ""
  try {
    // eslint-disable-next-line
    execSync(`npx truffle test --compile-none --config ${witnet_config_file} --contracts_directory ${witnet_contracts_path} --migrations_directory ${witnet_migrations_path} ${witnet_tests_path}/witnet.templates.spec.js ${witnet_tests_path}/witnet.requests.spec.js ${args}`, { stdio: "inherit" })
  } catch {}
  if (!process.argv.includes("--artifacts")) {
    console.info("Notes")
    console.info("=====")
    console.info("> You may restrict list of templates and/or requests to be tested:")
    console.info()
    console.info("  $ npx witnet test --artifacts <comma-separated-artifact-names> [--verbose]")
    console.info()
  }
}

function truffleConsole () {
  let network
  if (process.argv.length > 3 && !process.argv[3].startsWith("-")) {
    [, network] = utils.getRealmNetworkFromString(process.argv[3].toLowerCase().trim().replaceAll(".", ":"))
  } else if (process.env.WITNET_SOLIDITY_DEFAULT_CHAIN) {
    [, network] = utils.getRealmNetworkFromString(process.env.WITNET_SOLIDITY_DEFAULT_CHAIN.toLowerCase().trim().replaceAll(".", ":"))
  } else {
    console.info()
    console.info("Usage:")
    console.info()
    console.info("  $ npx witnet console <witnet-supported-chain>")
    console.info()
    console.info("To get a list of <witnet-supported-chain>:")
    console.info()
    console.info("  $ npx witnet avail --chains")
    console.info()
    console.info("No need to specify <witnet-supported-chain> if WITNET_SOLIDITY_DEFAULT_CHAIN environment variable is set, though.")
    console.info("However, if <witnet-supported-chain> is specified, that will always prevail upon the value of WITNET_SOLIDITY_DEFAULT_CHAIN.")
    process.exit(0)
  }
  const assets = require(`${witnet_require_path}/assets`)
  const addresses = assets.getAddresses(network)
  _traceHeader(`${network.replaceAll(".", ":").toUpperCase()}`)
  if (_traceWitnetAddresses(addresses, []) === 0) {
    console.info("  ", "None available.")
  }
  try {
    // eslint-disable-next-line
    execSync(`npx truffle console --config ${witnet_config_file} --contracts_directory ${witnet_contracts_path} --migrations_directory ${witnet_migrations_path} --network ${network}`, { stdio: "inherit" })
  } catch {}
}

function ethrpc () {
  const shell = spawn(os.type() === "Windows_NT" ? "npx.cmd" : "npx", [
    "w3gw",
    ...process.argv.slice(3),
  ])

  shell.stdout.on("data", (data) => {
    process.stdout.write(data.toString())
  })

  shell.stderr.on("data", (data) => {
    process.stderr.write(data.toString())
  })
}

function deploy () {
  let chain
  if (process.argv.length > 3 && !process.argv[3].startsWith("-")) {
    chain = utils.getRealmNetworkFromString(process.argv[3].toLowerCase().trim().replaceAll(".", ":"))
  } else if (process.env.WITNET_SOLIDITY_DEFAULT_CHAIN) {
    chain = utils.getRealmNetworkFromString(process.env.WITNET_SOLIDITY_DEFAULT_CHAIN.toLowerCase().trim().replaceAll(":", "."))
  } else {
    console.info()
    console.info("Usage:")
    console.info()
    console.info("  $ npx witnet deploy <witnet-supported-chain> --artifacts <comma-separated-artifacts-to-be-deployed>")
    console.info()
    console.info("To get a list of <witnet-supported-chain>:")
    console.info()
    console.info("  $ npx witnet avail --chains")
    console.info()
    console.info("No need to specify <witnet-supported-chain> if WITNET_SOLIDITY_DEFAULT_CHAIN environment variable is set, though.")
    console.info("However, if <witnet-supported-chain> is specified, that will always prevail upon the value of WITNET_SOLIDITY_DEFAULT_CHAIN.")
    process.exit(0)
  }
  let oIndex = -1
  process.argv.forEach((value, index) => {
    if (value.startsWith("--") && oIndex === -1) {
      oIndex = index
    }
  })
  const args = (oIndex >= 0) ? process.argv.slice(oIndex).join(" ") : ""
  try {
    // eslint-disable-next-line
    execSync(`npx truffle migrate --compile-none --config ${witnet_config_file} --contracts_directory ${witnet_contracts_path} --migrations_directory ${witnet_migrations_path} --network ${chain[1]} ${args}`, { stdio: "inherit" })
  } catch {}
  if (!process.argv.includes("--artifacts")) {
    console.info("Notes")
    console.info("=====")
    console.info("> Depending on the contents of your migrations/witnet/addresses.json file,")
    console.info("> you may need to specify a list of templates and/or requests to be deployed:")
    console.info()
    console.info("    $ npx witnet deploy [<witnet-supported-chain>] --artifacts <comma-separated-artifact-names>")
    console.info()
  }
}

async function wizard () {
  const assets = require(`${witnet_require_path}/assets`)
  console.clear()
  version("Wizard")
  console.info()
  let contractName = ""
  let contractPath = "contracts/"
  let firstContract = true
  let namedByUser = false
  if (process.argv.includes("--wizard") && process.argv.indexOf("--wizard") < process.argv.length - 1) {
    contractName = process.argv[process.argv.indexOf("--wizard") + 1].toLowerCase()
    if (contractName.indexOf("/") > -1) {
      contractPath = contractName.slice(0, contractName.lastIndexOf("/"))
      contractName = contractName.slice(contractName.lastIndexOf("/") + 1)
    }
    if (fs.existsSync(contractPath + contractName)) {
      console.info("Sorry, output file already exists:", contractName)
      process.exit(1)
    } else if (!fs.existsSync(contractPath)) {
      fs.mkdirSync(contractPath)
    }
    if (contractName.endsWith(".sol")) contractName = contractName.slice(0, -4)
    contractName = _capitalizeFirstLetterOnly(contractName)
    namedByUser = true
  }
  if (contractName === "") {
    const basename = `${_capitalizeFirstLetterOnly(path.basename(process.cwd()))}Witnet`
    if (!fs.existsSync(contractPath)) {
      fs.mkdirSync(contractPath)
    }
    const files = fs.readdirSync(contractPath).filter(filename => filename.startsWith(basename))
    contractName = `${basename}${files.length + 1}`
    firstContract = files.length === 0
  }
  let answers = {
    ...await inquirer.prompt([{
      type: "rawlist",
      name: "usage",
      message: `What will ${
        firstContract ? "your first" : (namedByUser ? `the ${contractName}` : "your next")
      } Solidity contract be using Witnet for?`,
      choices: [
        "Randomness => unmalleable source of entropy.",
        "Price feeds => based on multiple, reliable and public data sources.",
        "Public data => retrieved from a single or multiple providers on the Internet.",
      ],
    }]),
  }
  const appKind = answers.usage.split(" ")[0]
  switch (appKind) {
    case "Randomness": {
      break
    }
    case "Price": {
      answers = {
        ...await inquirer.prompt({
          type: "confirm",
          name: "pull",
          message: "Would you like to force price updates from this contract?",
        }),
        ...answers,
      }
      break
    }
    case "Public": {
      answers = {
        ...await inquirer.prompt({
          type: "list",
          name: "dynamic",
          message: "Will the underlying data sources or parameters vary in time",
          choices: [
            "Yes => either the data sources, or some request parameters, will vary in time.",
            "No => the data sources and parameters will remain constant.",
          ],
        }),
        ...answers,
      }
      if (answers?.dynamic.split(" ")[0] === "Yes") {
        answers = {
          ...await inquirer.prompt({
            type: "list",
            name: "parameterized",
            message: "Will your contract have to deal with data request parameters?",
            choices: [
              "Yes => my contract will have to process data request parameters onchain.",
              "No => actual data requests will be provided by some pre-authorized offchain worflow.",
            ],
          }),
          ...answers,
        }
      }
      if (answers?.dynamic.split(" ")[0] === "No" || answers?.parameterized.split(" ")[0] === "Yes") {
        answers = {
          ...await inquirer.prompt({
            type: "list",
            name: "callbacks",
            message: "How would you like your contract to read data from the Witnet oracle?",
            choices: [
              "Asynchronously => my contract will eventually read the result from Witnet, if available.",
              "Synchronously => my contract is to be called as soon as data is reported from Witnet.",
            ],
          }),
          ...answers,
        }
      }
      break
    }
  }
  // console.info()
  if (appKind === "Randomness" || answers?.callbacks?.split(" ")[0] === "Synchronously") {
    let callbackGasLimit
    do {
      callbackGasLimit = parseInt((await inquirer.prompt({
        type: "number",
        name: "callbackGasLimit",
        message: "Please, specify the maximum gas that you expect your Witnet-callback methods to consume:",
        default: 250000,
      })).callbackGasLimit)
    } while (!callbackGasLimit)
    answers = { callbackGasLimit, ...answers }
  }
  if (
    appKind === "Randomness" ||
        appKind === "Price" ||
        answers?.parameterized?.split(" ")[0] === "Yes"
  ) {
    answers = {
      ...await inquirer.prompt({
        type: "confirm",
        name: "includeMocks",
        message: "Do you intend to include this new contract within your unitary Solidity tests?",
        default: false,
      }),
      ...answers,
    }
    if (!answers.includeMocks) {
      const choices = assets.supportedEcosystems()
      answers = {
        ...await inquirer.prompt({
          type: "checkbox",
          name: "ecosystems",
          message: "Please, select the ecosystem(s) where you intend to deploy this new contract:",
          choices,
          pageSize: 16,
          loop: true,
          validate: (ans) => { return (ans.length > 0) },
        }),
        ...answers,
      }
      // const artifact = appKind === "Price" ? "WitnetPriceFeeds" : "WitnetOracle"
      const findings = []
      answers?.ecosystems.forEach(ecosystem => {
        assets.supportedNetworks(ecosystem.toLowerCase()).forEach(network => {
          const artifactAddr = assets.getAddresses(network)?.artifact
          if (artifactAddr && !findings.includes(artifactAddr)) {
            findings.push(artifactAddr)
          }
        })
      })
      if (findings.length === 1) {
        answers = {
          ...answers,
          witnetAddress: findings[0],
        }
      }
    }
  }
  const baseFeeOverhead = 10 // 10 %
  let constructorParams = answers?.witnetAddress ? "" : "WitnetOracle _witnetRequestBoard"
  const importWitnetMocks = answers.includeMocks
    ? "\nimport \"witnet-solidity-bridge/contracts/mocks/WitnetMockedOracle.sol\";"
    : ""

  let witnetAddress = answers?.witnetAddress || "_witnetRequestBoard"
  let templateFile = `${witnet_solidity_module_path}/contracts/`
  switch (appKind) {
    case "Randomness": {
      templateFile += "_UsingRandomness.tsol"
      break
    }
    case "Price": {
      constructorParams = answers?.witnetAddr ? "" : "WitnetPriceFeeds _witnetPriceFeeds"
      templateFile += "_UsingPriceFeeds.tsol"
      witnetAddress = answers?.witnetAddress || "_witnetPriceFeeds"
      break
    }
    case "Public": {
      if (answers?.dynamic.split(" ")[0] === "Yes") {
        if (answers.parameterized.split(" ")[0] === "Yes") {
          constructorParams = "WitnetRequestTemplate _witnetRequestTemplate"
          witnetAddress = "_witnetRequestTemplate"
          templateFile += (answers?.callbacks.split(" ")[0] === "Synchronously"
            ? "_RequestTemplateConsumer.tsol"
            : "_UsingRequestTemplate.tsol"
          )
        } else {
          templateFile += "_Consumer.tsol"
        }
      } else {
        constructorParams = "WitnetRequest _witnetRequest"
        witnetAddress = "_witnetRequest"
        templateFile += (answers?.callbacks.split(" ")[0] === "Synchronously"
          ? "_RequestConsumer.tsol"
          : "_UsingRequest.tsol"
        )
      }
      break
    }
  }
  const solidity = fs.readFileSync(templateFile, "utf-8")
    .replaceAll("$_importWitnetMocks", importWitnetMocks)
    .replaceAll("$_contractName", contractName)
    .replaceAll("$_constructorParams", constructorParams)
    .replaceAll("$_witnetAddress", witnetAddress)
    .replaceAll("$_baseFeeOverhead", baseFeeOverhead)
    .replaceAll("$_callbackGasLimit", answers.callbackGasLimit)

  const solidityPathFileName = `${contractPath}${contractName}.sol`
  fs.writeFileSync(solidityPathFileName, solidity)
  console.info()
  console.info("\x1b[1;37mAwesome! Your new contract was just created here:\x1b[0m")
  console.info(`\x1b[35m${contractPath}\x1b[1;35m${contractName}.sol\x1b[0m`)
}

/// ---- internal functions -------------------------------------------------------------------------------------------

function _capitalizeFirstLetterOnly (str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function _countLeaves (t, obj) {
  if (!obj) {
    return 0
  } else if (obj instanceof t) {
    return 1
  } else if (Array.isArray(obj)) {
    return obj.map(function (item) { return _countLeaves(t, item) }).reduce(function (a, b) { return a + b }, 0)
  } else {
    return Object.values(obj).map(function (item) { return _countLeaves(t, item) }).reduce(function (a, b) { return a + b }, 0)
  }
}

function _orderKeys (obj) {
  const keys = Object.keys(obj).sort(function keyOrder (k1, k2) {
    if (k1 < k2) return -1
    else if (k1 > k2) return +1
    else return 0
  })
  let i; const after = {}
  for (i = 0; i < keys.length; i++) {
    after[keys[i]] = obj[keys[i]]
    delete obj[keys[i]]
  }
  for (i = 0; i < keys.length; i++) {
    obj[keys[i]] = after[keys[i]]
  }
  return obj
}

function _splitSelectionFromProcessArgv (operand) {
  let selection = []
  if (process.argv.includes(operand)) {
    process.argv.forEach((argv, index, args) => {
      if (argv === operand) {
        if (index < process.argv.length - 1 && !args[index + 1].startsWith("--")) {
          selection = args[index + 1].replaceAll(".", ":").split(",")
        }
      }
    })
  }
  return selection
}

function _traceHeader (header) {
  console.log("")
  console.log("  ", `\x1b[1;96m${header}\x1b[0m`)
  console.log("  ", `${"-".repeat(header.length)}`)
}

function _traceWitnetAddresses (addresses, selection, level) {
  let found = 0
  for (const key in _orderKeys(addresses)) {
    if (typeof addresses[key] === "object") {
      found += _traceWitnetAddresses(addresses[key], selection, (level || 0) + 1)
    } else {
      if (
        (selection.length === 0 &&
                    key !== "Create2Factory" &&
                    !key.endsWith("Implementation") &&
                    !key.endsWith("Lib") &&
                    !key.endsWith("Proxy")
        ) || selection.includes(key)
      ) {
        found++
        if (level) {
          console.info("  ", `\x1b[36m${addresses[key]}\x1b[0m`, "\t<=", `\x1b[37m${key}\x1b[0m`)
        } else {
          console.info("  ", `\x1b[96m${addresses[key]}\x1b[0m`, "\t<=", `\x1b[1;37m${key}\x1b[0m`)
        }
      }
    }
  }
  return found
}

function _traceWitnetArtifact (artifact) {
  const specs = artifact?.specs
  if (specs) {
    const args = specs?.args
    if (specs?.retrieve.length === 1) {
      if (specs.retrieve[0]?.argsCount) {
        if (!args || args.length === 0) {
          console.info("  ", `[1] RETRIEVE:\t\x1b[1;32m${
            utils.getWitnetRequestMethodString(specs.retrieve[0].method)
          }(\x1b[0;32m<${
            specs.retrieve[0].argsCount
          } args>\x1b[1;32m)\x1b[0m`
          )
        } else {
          // eslint-disable-next-line
          console.info("  ", `[1] RETRIEVE:\t\x1b[1;32m${utils.getWitnetRequestMethodString(specs.retrieve[0].method)}(\x1b[0;32m${JSON.stringify(args[0])}\x1b[1;32m\x1b[0m`)
        }
      } else {
        console.info("  ", `[1] RETRIEVE:\t\x1b[1;32m${utils.getWitnetRequestMethodString(specs.retrieve[0].method)}()\x1b[0m`)
      }
    } else {
      console.info("  ", "[1] RETRIEVE:")
    }
    specs?.retrieve.forEach((value, index) => {
      if (specs?.retrieve.length > 1) {
        if (value?.argsCount) {
          if (!args[index] || args[index].length === 0) {
            // eslint-disable-next-line
            console.info("  ", `    [#${index}]\t\t\x1b[1;32m${utils.getWitnetRequestMethodString(value.method)}(\x1b[0;32m<${value.argsCount} args>\x1b[1;32m)\x1b[0m`)
          } else {
            // eslint-disable-next-line
            console.info("  ", `    [#${index}]\t\t\x1b[1;32m${utils.getWitnetRequestMethodString(value.method)}(\x1b[0;32m${JSON.stringify(args[index])}\x1b[1;32m)\x1b[0m`)
          }
        } else {
          // eslint-disable-next-line
          console.info("  ", `    [#${index}]\t\t\x1b[1;32m${utils.getWitnetRequestMethodString(value.method)}()\x1b[0m`)
        }
      }
      _traceWitnetArtifactSource(value)
    })
    if (specs?.aggregate) {
      console.info("  ", `[2] AGGREGATE:\t\x1b[1;35m${specs.aggregate.toString()}\x1b[0m`)
    }
    if (specs?.tally) {
      console.info("  ", `[3] TALLY:    \t\x1b[1;35m${specs.tally.toString()}\x1b[0m`)
    }
  }
}

function _traceWitnetArtifacts (crafts, selection) {
  const dict = Witnet.Dictionary(Object, crafts)
  let found = 0
  for (const index in selection) {
    const key = selection[index]
    try {
      const artifact = dict[key]
      if (artifact?.specs) {
        console.info(`\n   \x1b[1;37m${key}\x1b[0m`)
        console.info("  ", "=".repeat(key.length))
        _traceWitnetArtifact(artifact)
        found++
      } else {
        console.info("\n  ", `\x1b[1;37m${key}\x1b[0m`)
        console.info("  ", "=".repeat(key.length))
        _traceWitnetArtifactsBreakdown(artifact)
      }
    } catch (ex) {
      console.info("\n  ", `\x1b[1;31m${key}\x1b[0m`)
      console.info("  ", "=".repeat(key.length))
      console.info("  ", ">", ex.toString().split("\n")[0])
    }
  }
  return found
}

function _traceWitnetArtifactSource (specs) {
  if (specs?.url) {
    console.info("  ", `    > URL:     \t\x1b[32m${specs.url}\x1b[0m`)
  }
  if (specs?.body) {
    console.info("  ", `    > Body:    \t\x1b[32m${specs.body}\x1b[0m`)
  }
  if (
    (specs?.headers && !Array.isArray(specs?.headers)) ||
            (Array.isArray(specs?.headers) && specs?.headers.length > 0)
  ) {
    console.info("  ", `    > Headers: \t\x1b[32m${JSON.stringify(specs.headers)}\x1b[0m`)
  }
  if (specs?.script) {
    console.info("  ", `    > Script:  \t\x1b[33m${specs?.script.toString()}\x1b[0m`)
  }
}

function _traceWitnetSourcesBreakdown (sources, level) {
  if (sources?.method) return
  for (const key in _orderKeys(sources)) {
    console.info(" ", " ".repeat(4 * (level || 0)), (sources[key]?.method ? `\x1b[32m${key}\x1b[0m` : `\x1b[1;37m${key}\x1b[0m`))
    _traceWitnetSourcesBreakdown(sources[key], level ? level + 1 : 1)
  }
}

function _traceWitnetArtifactsBreakdown (artifacts, level) {
  if (artifacts?.specs) return
  for (const key in _orderKeys(artifacts)) {
    console.info(" ", " ".repeat(4 * (level || 0)), (artifacts[key]?.specs ? `\x1b[32m${key}\x1b[0m` : `\x1b[1;37m${key}\x1b[0m`))
    _traceWitnetArtifactsBreakdown(artifacts[key], level ? level + 1 : 1)
  }
}

function _traceWitnetSource (value) {
  if (value?.method) {
    if (value?.argsCount) {
      // eslint-disable-next-line
      console.info("  ", `> Method:    \x1b[1;32m${utils.getWitnetRequestMethodString(value.method)}(\x1b[0;32m<${value.argsCount} args>\x1b[1;32m)\x1b[0m`)
    } else {
      console.info("  ", `> Method:    \x1b[1;32m${utils.getWitnetRequestMethodString(value.method)}()\x1b[0m`)
    }
    if (value?.url) {
      console.info("  ", `> URL:       \x1b[32m${value.url}\x1b[0m`)
    }
    if (value?.body) {
      console.info("  ", `> Body:      \x1b[32m${value.body}\x1b[0m`)
    }
    if (
      (value?.headers && !Array.isArray(value?.headers)) ||
            (Array.isArray(value?.headers) && value?.headers.length > 0)
    ) {
      console.info("  ", `> Headers:   \x1b[32m${JSON.stringify(value.headers)}\x1b[0m`)
    }
    if (value?.script) {
      console.info("  ", `> Script:    \x1b[33m${value?.script.toString()}\x1b[0m`)
    }
    if (value?.tuples) {
      console.info("  ", "> Pre-set tuples:")
      const keys = Object.keys(value.tuples)
      keys.forEach(key => {
        console.info("  ", `  "${key}" =>`, JSON.stringify(value.tuples[key]))
      })
    }
  }
}
